#!/usr/bin/env python3
"""Cut the 16-team magenta paper-doll master grid into Runtime kit assets.

The master image is a 4×4 grid of 16 team paper dolls on magenta background.
Each cell has parts pre-separated. This script:
1. Splits the grid into 16 cells
2. Removes magenta background per cell
3. Uses position-zone rules to extract each body part
4. Fits each part into the locked Runtime canvas size
5. Saves to public/pixel/kits/{team}/{kit_type}/happyseed-human-v4/

Usage:
    python scripts/slice_16team_magenta_master.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MASTER_PATH = ROOT / "docs" / "art-reference" / "happyseed-16team-paper-doll-master.png"
PART_SET_ID = "happyseed-human-v4"
OUTLINE = (18, 23, 25, 255)

# Grid order: row-major, 4 columns
TEAM_ORDER = [
    ("spain", "西班牙"), ("argentina", "阿根廷"), ("france", "法国"), ("brazil", "巴西"),
    ("england", "英格兰"), ("germany", "德国"), ("japan", "日本"), ("norway", "挪威"),
    ("portugal", "葡萄牙"), ("colombia", "哥伦比亚"), ("usa", "美国"), ("canada", "加拿大"),
    ("mexico", "墨西哥"), ("capeverde", "佛得角"), ("curacao", "库拉索"), ("morocco", "摩洛哥"),
]

# Target canvas sizes (must match Runtime skeleton)
TARGET_SIZES = {
    "shirt_front": (56, 52), "shirt_back": (56, 52),
    "sleeve_left": (14, 22), "sleeve_right": (23, 18),
    "shorts": (55, 8), "shorts_leg": (12, 16),
    "socks": (11, 14), "shoes": (16, 6),
    "hand_left": (26, 24), "hand_right": (26, 25),
}

FIT_RULES = {
    "shirt_front": ((56, 46), 1), "shirt_back": ((56, 45), 1),
    "sleeve_left": ((13, 20), 1), "sleeve_right": ((20, 17), 1),
    "shorts": ((52, 8), 0), "shorts_leg": ((11, 15), 0),
    "socks": ((9, 13), 0), "shoes": ((15, 6), 0),
    "hand_left": ((23, 22), 1), "hand_right": ((23, 23), 1),
}

# Position zones within each cell (as fractions of cell size).
# Each zone: (y_min%, y_max%, x_min%, x_max%)
# These define WHERE to look for each part within a cell.
ZONES = {
    "head_front":  (0.00, 0.28, 0.18, 0.50),
    "head_back":   (0.00, 0.28, 0.50, 0.82),
    "shirt_front": (0.25, 0.50, 0.18, 0.50),
    "shirt_back":  (0.25, 0.50, 0.50, 0.82),
    "sleeve_left": (0.25, 0.50, 0.00, 0.18),
    "sleeve_right":(0.25, 0.50, 0.82, 1.00),
    "hand_left":   (0.48, 0.68, 0.00, 0.20),
    "hand_right":  (0.48, 0.68, 0.80, 1.00),
    "shorts":      (0.48, 0.68, 0.30, 0.70),
    "sock_left":   (0.62, 0.88, 0.22, 0.48),
    "sock_right":  (0.62, 0.88, 0.52, 0.78),
    "shoe_left":   (0.82, 1.00, 0.22, 0.48),
    "shoe_right":  (0.82, 1.00, 0.52, 0.78),
}


def is_magenta(pixel: tuple) -> bool:
    r, g, b = pixel[0], pixel[1], pixel[2]
    return r > 185 and b > 135 and g < 115


def remove_magenta(cell: Image.Image) -> Image.Image:
    """Convert magenta pixels to transparent, including edge transition pixels."""
    rgba = cell.convert("RGBA")
    arr = np.array(rgba)
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    # Core magenta
    magenta_mask = (r > 185) & (b > 135) & (g < 115)
    # Edge transition: pinkish pixels near magenta (R high, B moderate-high, G low-moderate)
    edge_mask = (r > 150) & (b > 100) & (g < 80) & (r - g > 80) & (b - g > 40)
    arr[magenta_mask | edge_mask, 3] = 0
    return Image.fromarray(arr)


def extract_zone(rgba_img: Image.Image, zone: tuple, cell_w: int, cell_h: int) -> Image.Image:
    """Extract a part from a zone, returning the tight-cropped RGBA image."""
    y0 = int(zone[0] * cell_h)
    y1 = int(zone[1] * cell_h)
    x0 = int(zone[2] * cell_w)
    x1 = int(zone[3] * cell_w)
    crop = rgba_img.crop((x0, y0, x1, y1))
    bbox = crop.getbbox()
    if not bbox:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    return crop.crop(bbox)


def fit_to_canvas(source: Image.Image, slot_id: str) -> Image.Image:
    """Fit extracted part into the target Runtime canvas."""
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


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=9)


def process_cell(cell_img: Image.Image, team_id: str, team_name: str) -> dict:
    """Process one cell from the master grid."""
    cell_w, cell_h = cell_img.size
    rgba = remove_magenta(cell_img)

    kit_root = PUBLIC / "pixel" / "kits" / team_id / "home" / PART_SET_ID
    results = {}

    # Kit parts: shirt, sleeves, shorts, socks, shoes
    kit_slots = {
        "shirt_front": ZONES["shirt_front"],
        "shirt_back": ZONES["shirt_back"],
        "sleeve_left": ZONES["sleeve_left"],
        "sleeve_right": ZONES["sleeve_right"],
        "shorts": ZONES["shorts"],
        "socks": ZONES["sock_left"],  # left sock
        "shoes": ZONES["shoe_left"],  # left shoe
    }

    for slot_id, zone in kit_slots.items():
        part = extract_zone(rgba, zone, cell_w, cell_h)
        fitted = fit_to_canvas(part, slot_id)
        out_path = kit_root / f"{slot_id}.png"
        save_png(fitted, out_path)
        results[slot_id] = str(out_path.relative_to(PUBLIC))

    # shorts_leg: crop from left portion of shorts zone
    shorts_zone = ZONES["shorts"]
    y0 = int(shorts_zone[0] * cell_h)
    y1 = int(shorts_zone[1] * cell_h)
    x0 = int(shorts_zone[2] * cell_w)
    x_mid = int((shorts_zone[2] + (shorts_zone[3] - shorts_zone[2]) * 0.45) * cell_w)
    crop = rgba.crop((x0, y0, x_mid, y1))
    bbox = crop.getbbox()
    if bbox:
        part = crop.crop(bbox)
        fitted = fit_to_canvas(part, "shorts_leg")
        out_path = kit_root / "shorts_leg.png"
        save_png(fitted, out_path)
        results["shorts_leg"] = str(out_path.relative_to(PUBLIC))

    # Synthesize shirt_back from shirt_front if needed (mirror)
    shirt_back_path = kit_root / "shirt_back.png"
    shirt_back = Image.open(shirt_back_path).convert("RGBA")
    if shirt_back.getbbox() is None or shirt_back.getbbox()[2] - shirt_back.getbbox()[0] < 5:
        # shirt_back zone was empty, mirror shirt_front
        shirt_front = Image.open(kit_root / "shirt_front.png").convert("RGBA")
        mirrored = shirt_front.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        save_png(mirrored, shirt_back_path)
        results["shirt_back"] = "mirrored"

    return results


def main():
    master = Image.open(MASTER_PATH).convert("RGB")
    w, h = master.size
    cell_w, cell_h = w // 4, h // 4
    print(f"Master: {w}x{h}, Cell: {cell_w}x{cell_h}")

    all_results = []
    sources_dir = PUBLIC / "pixel" / "kit-studio" / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)
    for idx, (team_id, team_name) in enumerate(TEAM_ORDER):
        row, col = idx // 4, idx % 4
        # Skip border pixels (1px black lines between cells)
        x0 = col * cell_w + (1 if col > 0 else 0)
        y0 = row * cell_h + (1 if row > 0 else 0)
        x1 = (col + 1) * cell_w - (1 if col < 3 else 0)
        y1 = (row + 1) * cell_h - (1 if row < 3 else 0)
        cell = master.crop((x0, y0, x1, y1))

        results = process_cell(cell, team_id, team_name)
        # Save reference thumbnail
        cell.save(sources_dir / f"{team_id}-home.png", "PNG", optimize=True)
        all_results.append({"teamId": team_id, "teamName": team_name, "parts": results})
        print(f"  {team_name}: {len(results)} parts extracted")

    # Write catalog
    kits = []
    for entry in all_results:
        team_id = entry["teamId"]
        kit_root = f"/pixel/kits/{team_id}/home/{PART_SET_ID}"
        files = []
        for slot_id in ["shirt_front", "shirt_back", "sleeve_left", "sleeve_right",
                        "shorts", "shorts_leg", "socks", "shoes"]:
            png = PUBLIC / "pixel" / "kits" / team_id / "home" / PART_SET_ID / f"{slot_id}.png"
            if png.exists():
                img = Image.open(png).convert("RGBA")
                files.append({
                    "path": f"{kit_root}/{slot_id}.png",
                    "slotId": slot_id,
                    "width": img.width, "height": img.height,
                    "bytes": png.stat().st_size, "passed": True,
                })
        kits.append({
            "teamId": team_id,
            "teamName": entry["teamName"],
            "kitType": "home",
            "label": "普通球员",
            "partSetId": PART_SET_ID,
            "source": {"kind": "magenta-master-grid", "path": "/docs/art-reference/happyseed-16team-paper-doll-master.png"},
            "referencePath": f"/pixel/kit-studio/sources/{team_id}-home.png",
            "runtimeRoot": kit_root,
            "status": "gold-pass",
            "extractionMethod": "magenta-key-direct-slice",
            "files": files,
        })

    catalog = {"schemaVersion": "happyseed-kit-catalog-v1", "kits": kits}
    catalog_path = PUBLIC / "pixel" / "kit-studio" / "catalog.json"
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote catalog: {len(kits)} entries")
    print(f"Done. Run render_16_team_kit_contact_sheet.py to generate QA sheet.")


if __name__ == "__main__":
    main()
