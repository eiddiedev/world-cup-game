#!/usr/bin/env python3
"""Slice individual magenta paper-doll images from Desktop into Runtime assets.

Each image has parts pre-separated on magenta background. This script:
1. Detects connected components via magenta removal + dilation
2. Assigns each component to a slot by relative position
3. Splits arm into sleeve (top) + arm skin (bottom)
4. Fits each part into locked Runtime canvas sizes
5. Outputs to public/pixel/kits/ and public/pixel/player/

Usage:
    python scripts/slice_desktop_magenta_masters.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
DESKTOP = Path.home() / "Desktop" / "未命名文件夹"
PART_SET_ID = "happyseed-human-v4"

TEAM_MAP = {
    "西班牙": "spain", "阿根廷": "argentina", "法国": "france", "巴西": "brazil",
    "英格兰": "england", "德国": "germany", "日本": "japan", "挪威": "norway",
    "葡萄牙": "portugal", "哥伦比亚": "colombia", "美国": "usa", "加拿大": "canada",
    "墨西哥": "mexico", "佛得角": "capeverde", "库拉索": "curacao", "摩洛哥": "morocco",
}

TARGET_SIZES = {
    "head_front": (81, 77), "head_back": (81, 77),
    "shirt_front": (56, 52), "shirt_back": (56, 52),
    "sleeve_left": (14, 22), "sleeve_right": (23, 18),
    "arm_left": (14, 11), "arm_right": (15, 17),
    "hand_left": (25, 28), "hand_right": (23, 38),
    "shorts": (55, 8), "shorts_leg": (12, 16),
    "knee": (8, 9), "socks": (11, 14), "shoes": (16, 6),
    "neck": (20, 18),
}

FIT_RULES = {
    "head_front": ((46, 52), 5), "head_back": ((46, 50), 6),
    "shirt_front": ((56, 46), 1), "shirt_back": ((56, 45), 1),
    "sleeve_left": ((13, 20), 1), "sleeve_right": ((20, 17), 1),
    "arm_left": ((10, 10), 0), "arm_right": ((10, 15), 1),
    "hand_left": ((11, 16), 5), "hand_right": ((11, 17), 10),
    "shorts": ((52, 8), 0), "shorts_leg": ((11, 15), 0),
    "knee": ((6, 8), 0), "socks": ((9, 13), 0), "shoes": ((15, 6), 0),
    "neck": ((10, 14), 2),
}


def remove_magenta(img: Image.Image) -> tuple[np.ndarray, np.ndarray]:
    """Return (rgba_array, foreground_mask)."""
    rgba = np.array(img.convert("RGBA"))
    r, g, b = rgba[:, :, 0].astype(int), rgba[:, :, 1].astype(int), rgba[:, :, 2].astype(int)
    magenta = (r > 185) & (b > 135) & (g < 115)
    # Also catch edge pinkish pixels
    edge = (r > 150) & (b > 100) & (g < 80) & (r - g > 80) & (b - g > 40)
    fg = ~(magenta | edge)
    rgba[~fg, 3] = 0
    return rgba, fg


def detect_parts(fg: np.ndarray, h: int, w: int) -> list[dict]:
    """Detect connected components and assign slot names by position."""
    dilated = ndimage.binary_dilation(fg, iterations=2)
    labeled, num = ndimage.label(dilated)

    parts = []
    for i in range(1, num + 1):
        comp = (labeled == i) & fg
        size = int(comp.sum())
        if size < 50:
            continue
        ys, xs = np.where(comp)
        bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
        cx = ((bbox[0] + bbox[2]) / 2) / w
        cy = ((bbox[1] + bbox[3]) / 2) / h
        parts.append({"bbox": bbox, "cx": cx, "cy": cy, "size": size, "mask": comp})

    # Assign slots by position
    assigned = {}
    for p in parts:
        cx, cy = p["cx"], p["cy"]
        slot = None
        if cy < 0.20:
            slot = "head_front" if cx < 0.50 else "head_back"
        elif cy < 0.45:
            if cx < 0.22:
                slot = "arm_left"
            elif cx < 0.50:
                slot = "shirt_front"
            elif cx < 0.78:
                slot = "shirt_back"
            else:
                slot = "arm_right"
        elif cy < 0.58:
            if cx < 0.25:
                slot = "hand_left"
            elif cx > 0.75:
                slot = "hand_right"
            else:
                slot = "shorts"
        elif cy < 0.70:
            slot = "thigh_left" if cx < 0.50 else "thigh_right"
        elif cy < 0.85:
            slot = "sock_left" if cx < 0.50 else "sock_right"
        else:
            slot = "shoe_left" if cx < 0.50 else "shoe_right"

        # Handle duplicates: keep larger one
        if slot in assigned:
            if p["size"] > assigned[slot]["size"]:
                assigned[slot] = p
        else:
            assigned[slot] = p

    return assigned


def extract_part_rgba(rgba: np.ndarray, mask: np.ndarray) -> Image.Image:
    """Extract pixels where mask is True as RGBA image, tight-cropped."""
    result = np.zeros_like(rgba)
    result[mask] = rgba[mask]
    result[mask, 3] = 255
    img = Image.fromarray(result)
    bbox = img.getbbox()
    if not bbox:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    return img.crop(bbox)


def fit_to_canvas(source: Image.Image, slot_id: str) -> Image.Image:
    """Fit into target Runtime canvas."""
    target = TARGET_SIZES[slot_id]
    visible, bottom = FIT_RULES[slot_id]
    bbox = source.getbbox()
    if not bbox:
        return Image.new("RGBA", target, (0, 0, 0, 0))
    cropped = source.crop(bbox)
    scale = min(visible[0] / cropped.width, visible[1] / cropped.height)
    new_w = max(1, round(cropped.width * scale))
    new_h = max(1, round(cropped.height * scale))
    resized = cropped.resize((new_w, new_h), Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", target, (0, 0, 0, 0))
    left = (target[0] - new_w) // 2
    top = max(0, target[1] - bottom - new_h)
    canvas.alpha_composite(resized, (left, top))
    return canvas


def split_arm_sleeve(arm_img: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Split arm component into sleeve (top non-skin) and arm skin (bottom skin)."""
    arr = np.array(arm_img.convert("RGBA"))
    h, w = arr.shape[:2]
    r, g, b, a = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int), arr[:, :, 3]
    opaque = a > 24
    # Skin detection
    lum = r * 0.299 + g * 0.587 + b * 0.114
    gb_ratio = np.where(b > 0, g / np.maximum(b, 1), 999.0)
    skin = opaque & (r > 120) & (r > b + 20) & (r > g * 1.05) & (gb_ratio < 4.0) & (lum > 70) & (lum < 230)

    # Find split point: first row from top where skin dominates
    split_y = h // 2  # default
    for y in range(h):
        row_opaque = opaque[y].sum()
        row_skin = skin[y].sum()
        if row_opaque > 0 and row_skin / max(1, row_opaque) > 0.5:
            split_y = y
            break

    # Sleeve = top portion
    sleeve_mask = np.zeros((h, w), dtype=bool)
    sleeve_mask[:split_y] = opaque[:split_y]
    # Arm = bottom portion (skin + outline)
    arm_mask = np.zeros((h, w), dtype=bool)
    arm_mask[split_y:] = opaque[split_y:]

    sleeve_img = extract_part_rgba(arr, sleeve_mask)
    arm_skin_img = extract_part_rgba(arr, arm_mask)
    return sleeve_img, arm_skin_img


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=9)


def process_image(img_path: Path, team_id: str, kit_type: str) -> dict:
    """Process one magenta master image."""
    img = Image.open(img_path).convert("RGB")
    h, w = img.size[1], img.size[0]
    rgba, fg = remove_magenta(img)
    parts = detect_parts(fg, h, w)

    role = "outfield" if kit_type == "home" else "goalkeeper"
    kit_root = PUBLIC / "pixel" / "kits" / team_id / kit_type / PART_SET_ID
    player_root = PUBLIC / "pixel" / "player" / PART_SET_ID / f"{team_id}-{role}"

    results = {"team": team_id, "kit_type": kit_type, "slots": {}}

    # Kit parts
    kit_mapping = {
        "shirt_front": "shirt_front", "shirt_back": "shirt_back",
        "shorts": "shorts", "sock_left": "socks", "shoe_left": "shoes",
    }

    for src_slot, out_slot in kit_mapping.items():
        if src_slot in parts:
            part_img = extract_part_rgba(rgba, parts[src_slot]["mask"])
            fitted = fit_to_canvas(part_img, out_slot)
            save_png(fitted, kit_root / f"{out_slot}.png")
            results["slots"][out_slot] = "ok"

    # Shorts_leg from shorts (left half)
    if "shorts" in parts:
        bbox = parts["shorts"]["bbox"]
        mask = parts["shorts"]["mask"].copy()
        mid_x = (bbox[0] + bbox[2]) // 2
        mask[:, mid_x:] = False
        part_img = extract_part_rgba(rgba, mask)
        fitted = fit_to_canvas(part_img, "shorts_leg")
        save_png(fitted, kit_root / "shorts_leg.png")
        results["slots"]["shorts_leg"] = "ok"

    # Knee from thigh_left
    if "thigh_left" in parts:
        part_img = extract_part_rgba(rgba, parts["thigh_left"]["mask"])
        fitted = fit_to_canvas(part_img, "knee")
        save_png(fitted, player_root / "knee.png")
        results["slots"]["knee"] = "ok"

    # Arms → split into sleeve + arm skin
    for side, arm_slot, sleeve_slot, arm_out in [
        ("left", "arm_left", "sleeve_left", "arm_left"),
        ("right", "arm_right", "sleeve_right", "arm_right"),
    ]:
        if arm_slot in parts:
            full_arm = extract_part_rgba(rgba, parts[arm_slot]["mask"])
            sleeve_img, arm_skin_img = split_arm_sleeve(full_arm)
            # Sleeve → kit
            fitted_sleeve = fit_to_canvas(sleeve_img, sleeve_slot)
            save_png(fitted_sleeve, kit_root / f"{sleeve_slot}.png")
            results["slots"][sleeve_slot] = "ok"
            # Arm skin → player
            fitted_arm = fit_to_canvas(arm_skin_img, arm_out)
            save_png(fitted_arm, player_root / f"{arm_out}.png")
            results["slots"][arm_out] = "ok"

    # Hands → kit (goalkeeper gloves) or player
    for hand_slot, hand_out in [("hand_left", "hand_left"), ("hand_right", "hand_right")]:
        if hand_slot in parts:
            part_img = extract_part_rgba(rgba, parts[hand_slot]["mask"])
            fitted = fit_to_canvas(part_img, hand_out)
            save_png(fitted, kit_root / f"{hand_out}.png")
            save_png(fitted, player_root / f"{hand_out}.png")
            results["slots"][hand_out] = "ok"

    # Heads → player
    for head_slot in ["head_front", "head_back"]:
        if head_slot in parts:
            part_img = extract_part_rgba(rgba, parts[head_slot]["mask"])
            fitted = fit_to_canvas(part_img, head_slot)
            save_png(fitted, player_root / f"{head_slot}.png")
            results["slots"][head_slot] = "ok"

    # Synthesize neck
    neck = Image.new("RGBA", TARGET_SIZES["neck"], (0, 0, 0, 0))
    # Sample skin color from arm or hand
    skin_color = (210, 150, 90, 255)
    if "hand_left" in parts:
        hand_arr = rgba[parts["hand_left"]["mask"]]
        # Find most common warm pixel
        from collections import Counter
        colors = Counter()
        for px in hand_arr[::10]:  # sample every 10th
            r, g, b, a = int(px[0]), int(px[1]), int(px[2]), int(px[3])
            if a > 24 and r > 120 and r > b + 20:
                colors[(r, g, b, 255)] += 1
        if colors:
            skin_color = colors.most_common(1)[0][0]
    # Draw simple neck
    nw, nh = 8, 12
    left = (20 - nw) // 2
    top = (18 - nh) // 2
    for y in range(top, top + nh):
        for x in range(left, left + nw):
            if x == left or x == left + nw - 1 or y == top or y == top + nh - 1:
                neck.putpixel((x, y), (18, 23, 25, 255))
            else:
                neck.putpixel((x, y), skin_color)
    save_png(neck, player_root / "neck.png")
    results["slots"]["neck"] = "synthesized"

    return results


def main():
    files = sorted(DESKTOP.glob("*.png"))
    kit_files = [f for f in files if "主场" in f.name or "门将" in f.name]
    print(f"Found {len(kit_files)} magenta master images on Desktop")

    all_results = []
    for f in kit_files:
        name = f.stem
        # Parse team name and type
        kit_type = "home" if "主场" in name else "goalkeeper"
        team_cn = name.replace("主场", "").replace("门将", "")
        team_id = TEAM_MAP.get(team_cn)
        if not team_id:
            print(f"  SKIP: unknown team '{team_cn}' in {f.name}")
            continue

        result = process_image(f, team_id, kit_type)
        all_results.append(result)
        n_slots = len(result["slots"])
        print(f"  {team_cn} {'普通' if kit_type == 'home' else '门将'}: {n_slots} slots")

    # Build catalog
    kits = []
    for r in all_results:
        team_id = r["team"]
        kit_type = r["kit_type"]
        kit_root = f"/pixel/kits/{team_id}/{kit_type}/{PART_SET_ID}"
        files_list = []
        for slot_id in ["shirt_front", "shirt_back", "sleeve_left", "sleeve_right",
                        "shorts", "shorts_leg", "socks", "shoes", "hand_left", "hand_right"]:
            png = PUBLIC / "pixel" / "kits" / team_id / kit_type / PART_SET_ID / f"{slot_id}.png"
            if png.exists():
                img = Image.open(png)
                files_list.append({
                    "path": f"{kit_root}/{slot_id}.png",
                    "slotId": slot_id,
                    "width": img.width, "height": img.height,
                    "bytes": png.stat().st_size, "passed": True,
                })
        label = "普通球员" if kit_type == "home" else "门将"
        team_cn = [k for k, v in TEAM_MAP.items() if v == team_id][0]
        kits.append({
            "teamId": team_id,
            "teamName": team_cn,
            "kitType": kit_type,
            "label": label,
            "partSetId": PART_SET_ID,
            "source": {"kind": "magenta-master-individual", "path": str(f)},
            "referencePath": f"/pixel/kit-studio/sources/{team_id}-{kit_type}.png",
            "runtimeRoot": kit_root,
            "status": "gold-pass",
            "extractionMethod": "magenta-key-connected-component",
            "files": files_list,
        })

    catalog = {"schemaVersion": "happyseed-kit-catalog-v1", "kits": kits}
    catalog_path = PUBLIC / "pixel" / "kit-studio" / "catalog.json"
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote catalog: {len(kits)} entries to {catalog_path.relative_to(ROOT)}")

    # Save reference thumbnails
    sources_dir = PUBLIC / "pixel" / "kit-studio" / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)
    for f in kit_files:
        name = f.stem
        kit_type = "home" if "主场" in name else "goalkeeper"
        team_cn = name.replace("主场", "").replace("门将", "")
        team_id = TEAM_MAP.get(team_cn)
        if team_id:
            img = Image.open(f).convert("RGB")
            img.thumbnail((200, 240), Image.Resampling.NEAREST)
            img.save(sources_dir / f"{team_id}-{kit_type}.png", "PNG", optimize=True)

    print("Done.")


if __name__ == "__main__":
    main()
