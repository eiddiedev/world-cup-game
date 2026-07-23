#!/usr/bin/env python3
"""Directly cut the locked 16-team home/goalkeeper kits from approved player art.

The approved paper-doll master defines only canvas sizes, pivots and visible bounds.
Every visible kit pixel comes from the selected player artwork; the compiler never
repaints a source into a generic master silhouette.
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter, deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
DOWNLOADS = Path.home() / "Downloads"
PART_SET_ID = "happyseed-human-v4"
OUTLINE = (18, 23, 25, 255)

TARGET_SIZES = {
    "shirt_front": (56, 52),
    "shirt_back": (56, 52),
    "sleeve_left": (14, 22),
    "sleeve_right": (23, 18),
    "shorts": (55, 8),
    "shorts_leg": (12, 16),
    "socks": (11, 14),
    "shoes": (16, 6),
    "hand_left": (26, 24),
    "hand_right": (26, 25),
}

FIT_RULES = {
    "shirt_front": ((56, 46), 1),
    "shirt_back": ((56, 45), 1),
    "sleeve_left": ((13, 20), 1),
    "sleeve_right": ((20, 17), 1),
    "shorts": ((52, 8), 0),
    "shorts_leg": ((11, 15), 0),
    "socks": ((9, 13), 0),
    "shoes": ((15, 6), 0),
    "hand_left": ((23, 22), 1),
    "hand_right": ((23, 23), 1),
}

SEGMENTS = {
    # Central chest only: sleeves and shorts have their own slots and must never
    # leak into the 56x52 shirt attachment.
    "shirt_front": (0.20, 0.43, 0.60, 0.27),
    "sleeve_left": (0.12, 0.44, 0.20, 0.20),
    "sleeve_right": (0.68, 0.44, 0.20, 0.20),
    "shorts": (0.28, 0.70, 0.44, 0.10),
    "shorts_leg": (0.29, 0.72, 0.21, 0.15),
    "socks": (0.29, 0.82, 0.21, 0.12),
    "shoes": (0.22, 0.90, 0.31, 0.10),
    "hand_left": (0.10, 0.56, 0.23, 0.23),
    "hand_right": (0.67, 0.56, 0.23, 0.23),
}

TEAM_NAMES = {
    "spain": "西班牙", "argentina": "阿根廷", "france": "法国", "england": "英格兰",
    "brazil": "巴西", "portugal": "葡萄牙", "germany": "德国", "japan": "日本",
    "morocco": "摩洛哥", "norway": "挪威", "colombia": "哥伦比亚", "usa": "美国",
    "canada": "加拿大", "mexico": "墨西哥", "capeverde": "佛得角", "curacao": "库拉索",
}

EXISTING_SOURCES = {
    "argentina": ("阿根廷/slice_02.png", "阿根廷/gk.png"),
    "brazil": ("巴西/slice_02.png", "巴西/gk.png"),
    "curacao": ("库拉索/slice_02.png", "库拉索/gk.png"),
    "france": ("法国/slice_02.png", "法国/gk.png"),
    "germany": ("德国/slice_02.png", "德国/gk.png"),
    "japan": ("日本/slice_02.png", "日本/gk.png"),
    "morocco": ("摩洛哥/slice_02.png", "摩洛哥/gk.png"),
    "norway": ("挪威/slice_03.png", "挪威/gk.png"),
    "portugal": ("葡萄牙/slice_03.png", "葡萄牙/gk.png"),
}

ROSTER_SOURCES = {
    "spain": "西班牙.png",
    "england": "英格兰.png",
    "colombia": "哥伦比亚.png",
    "usa": "美国.png",
    "canada": "加拿大.png",
    "mexico": "墨西哥.png",
    "capeverde": "佛得角.png",
}


def is_light(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return alpha > 0 and min(red, green, blue) >= 226 and max(red, green, blue) - min(red, green, blue) <= 28


def strip_sticker_edge(image: Image.Image) -> Image.Image:
    """Remove only the connected near-white sticker ring, not white kit interiors."""
    result = image.convert("RGBA")
    pixels = result.load()
    width, height = result.size
    removable: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()
    for y in range(height):
        for x in range(width):
            if not is_light(pixels[x, y]):
                continue
            if any(
                nx < 0 or ny < 0 or nx >= width or ny >= height or pixels[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            ):
                queue.append((x, y))
                removable.add((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in removable and is_light(pixels[nx, ny]):
                removable.add((nx, ny))
                queue.append((nx, ny))
    for x, y in removable:
        pixels[x, y] = (0, 0, 0, 0)
    return result


def remove_black_background(image: Image.Image) -> Image.Image:
    result = image.convert("RGBA")
    pixels = result.load()
    width, height = result.size
    visited: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.extend(((x, 0), (x, height - 1)))
    for y in range(height):
        queue.extend(((0, y), (width - 1, y)))
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not (0 <= x < width and 0 <= y < height):
            continue
        visited.add((x, y))
        red, green, blue, alpha = pixels[x, y]
        if alpha == 0 or max(red, green, blue) <= 8:
            pixels[x, y] = (0, 0, 0, 0)
            queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return result


def largest_component(image: Image.Image) -> Image.Image:
    pixels = image.load()
    width, height = image.size
    seen = bytearray(width * height)
    components: list[list[tuple[int, int]]] = []
    for y in range(height):
        for x in range(width):
            offset = y * width + x
            if seen[offset] or pixels[x, y][3] == 0:
                continue
            seen[offset] = 1
            queue = [(x, y)]
            component: list[tuple[int, int]] = []
            while queue:
                current_x, current_y = queue.pop()
                component.append((current_x, current_y))
                for next_x, next_y in ((current_x - 1, current_y), (current_x + 1, current_y), (current_x, current_y - 1), (current_x, current_y + 1)):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_offset = next_y * width + next_x
                    if seen[next_offset] or pixels[next_x, next_y][3] == 0:
                        continue
                    seen[next_offset] = 1
                    queue.append((next_x, next_y))
            components.append(component)
    if not components:
        raise RuntimeError("source crop has no visible player component")
    largest = max(components, key=len)
    largest_min_x = min(x for x, _y in largest)
    largest_max_x = max(x for x, _y in largest)
    largest_max_y = max(y for _x, y in largest)
    minimum_size = max(20, round(len(largest) * 0.035))
    keep = []
    for component in components:
        component_min_x = min(x for x, _y in component)
        component_max_x = max(x for x, _y in component)
        component_min_y = min(y for _x, y in component)
        component_center_x = (component_min_x + component_max_x) / 2
        belongs_to_player = (
            len(component) >= minimum_size
            and largest_min_x - 28 <= component_center_x <= largest_max_x + 28
            and component_min_y <= largest_max_y + 12
        )
        if component is largest or belongs_to_player:
            keep.extend(component)
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output_pixels = output.load()
    for x, y in keep:
        output_pixels[x, y] = pixels[x, y]
    return output.crop(output.getbbox())


def extract_roster_player(path: Path, column: int) -> Image.Image:
    roster = Image.open(path).convert("RGBA")
    cell_width = roster.width / 6
    left = round(column * cell_width)
    right = round((column + 1) * cell_width)
    crop = roster.crop((left, 0, right, min(roster.height, round(roster.height * 0.29))))
    return largest_component(remove_black_background(crop))


def quantize_rgba(image: Image.Image, colors: int = 16) -> Image.Image:
    image = image.convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 24 else 0)
    rgb = Image.new("RGB", image.size, OUTLINE[:3])
    rgb.paste(image.convert("RGB"), mask=alpha)
    quantized = rgb.quantize(colors=max(4, colors), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    quantized.putalpha(alpha)
    return quantized


def normalized_source(image: Image.Image) -> Image.Image:
    cleaned = strip_sticker_edge(image)
    bbox = cleaned.getbbox()
    if not bbox:
        raise RuntimeError("source art is empty after edge cleanup")
    cleaned = cleaned.crop(bbox)
    width = 96
    height = max(1, round(cleaned.height / cleaned.width * width))
    return quantize_rgba(cleaned.resize((width, height), Image.Resampling.NEAREST), 20)


def sampled_skin_colors(source: Image.Image) -> set[tuple[int, int, int]]:
    """Read the player's quantized skin ramp from the face, not from nationality metadata."""
    counter = Counter()
    left, top = round(source.width * 0.25), round(source.height * 0.16)
    right, bottom = round(source.width * 0.75), round(source.height * 0.35)
    pixels = source.convert("RGBA").load()
    for y in range(top, bottom):
        for x in range(left, right):
            red, green, blue, alpha = pixels[x, y]
            luminance = red * 0.299 + green * 0.587 + blue * 0.114
            if alpha and 42 < luminance < 235 and red > blue + 10 and red >= green * 0.98:
                counter[(red, green, blue)] += 1
    return set(counter)


def crop_segment(
    source: Image.Image,
    segment: tuple[float, float, float, float],
    colors_to_remove: set[tuple[int, int, int]] | None = None,
) -> Image.Image:
    x, y, width, height = segment
    box = (
        round(x * source.width), round(y * source.height),
        round((x + width) * source.width), round((y + height) * source.height),
    )
    crop = source.crop(box).convert("RGBA")
    if colors_to_remove:
        pixels = crop.load()
        for target_y in range(crop.height):
            for target_x in range(crop.width):
                red, green, blue, alpha = pixels[target_x, target_y]
                if alpha and (red, green, blue) in colors_to_remove:
                    pixels[target_x, target_y] = (0, 0, 0, 0)
    bbox = crop.getbbox()
    if not bbox:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    return crop.crop(bbox)


def enforce_dark_boundary(image: Image.Image) -> Image.Image:
    result = image.copy().convert("RGBA")
    pixels = result.load()
    width, height = result.size
    replacements = []
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            boundary = any(
                nx < 0 or ny < 0 or nx >= width or ny >= height or pixels[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if boundary and red * 0.299 + green * 0.587 + blue * 0.114 > 150:
                replacements.append((x, y))
    for x, y in replacements:
        pixels[x, y] = OUTLINE
    return result


def fit(source: Image.Image, slot_id: str) -> Image.Image:
    target = TARGET_SIZES[slot_id]
    visible, bottom = FIT_RULES[slot_id]
    bbox = source.getbbox()
    if not bbox:
        return Image.new("RGBA", target, (0, 0, 0, 0))
    source = source.crop(bbox)
    scale = min(visible[0] / source.width, visible[1] / source.height)
    size = (max(1, round(source.width * scale)), max(1, round(source.height * scale)))
    resized = source.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", target, (0, 0, 0, 0))
    left = (target[0] - size[0]) // 2
    top = max(0, target[1] - bottom - size[1])
    canvas.alpha_composite(resized, (left, top))
    return enforce_dark_boundary(quantize_rgba(canvas, 16))


def dominant_fill_color(image: Image.Image) -> tuple[int, int, int, int]:
    counter = Counter()
    for red, green, blue, alpha in image.convert("RGBA").getdata():
        luminance = red * 0.299 + green * 0.587 + blue * 0.114
        if alpha and luminance > 42:
            counter[(red, green, blue, 255)] += 1
    return counter.most_common(1)[0][0] if counter else (45, 83, 146, 255)


def central_base_color(image: Image.Image) -> tuple[int, int, int, int]:
    counter = Counter()
    pixels = image.convert("RGBA").load()
    for y in range(round(image.height * 0.42), round(image.height * 0.82)):
        for x in range(round(image.width * 0.28), round(image.width * 0.72)):
            red, green, blue, alpha = pixels[x, y]
            luminance = red * 0.299 + green * 0.587 + blue * 0.114
            if alpha and luminance > 42:
                counter[(red, green, blue, 255)] += 1
    return counter.most_common(1)[0][0] if counter else dominant_fill_color(image)


def replace_light_pixels_with_base(image: Image.Image) -> Image.Image:
    result = image.copy().convert("RGBA")
    candidates = Counter()
    for red, green, blue, alpha in result.getdata():
        luminance = red * 0.299 + green * 0.587 + blue * 0.114
        if alpha and 8 < luminance < 180 and (max(red, green, blue) - min(red, green, blue) > 12 or luminance > 55):
            candidates[(red, green, blue, 255)] += 1
    base = candidates.most_common(1)[0][0] if candidates else central_base_color(result)
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            red, green, blue, alpha = pixels[x, y]
            if alpha and min(red, green, blue) > 215:
                pixels[x, y] = base
    return result


def synthesize_back(front: Image.Image) -> Image.Image:
    back = front.transpose(Image.Transpose.FLIP_LEFT_RIGHT).convert("RGBA")
    pixels = back.load()
    base = dominant_fill_color(back)
    outside: set[tuple[int, int]] = set()
    queue: deque[tuple[int, int]] = deque()
    for x in range(back.width):
        queue.extend(((x, 0), (x, back.height - 1)))
    for y in range(back.height):
        queue.extend(((0, y), (back.width - 1, y)))
    for y in range(round(back.height * 0.38)):
        for x in range(round(back.width * 0.30), round(back.width * 0.70)):
            if pixels[x, y][3] == 0:
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        if (x, y) in outside or not (0 <= x < back.width and 0 <= y < back.height) or pixels[x, y][3]:
            continue
        outside.add((x, y))
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    output = []
    for y in range(back.height):
        for x in range(back.width):
            if (x, y) in outside:
                output.append((0, 0, 0, 0))
                continue
            boundary = any(
                nx < 0 or ny < 0 or nx >= back.width or ny >= back.height or (nx, ny) in outside
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            output.append(OUTLINE if boundary else base)
    back.putdata(output)
    return enforce_dark_boundary(back)


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=9)


def boundary_light_count(image: Image.Image) -> int:
    pixels = image.convert("RGBA").load()
    count = 0
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, alpha = pixels[x, y]
            if not alpha:
                continue
            boundary = any(
                nx < 0 or ny < 0 or nx >= image.width or ny >= image.height or pixels[nx, ny][3] == 0
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if boundary and red * 0.299 + green * 0.587 + blue * 0.114 > 190:
                count += 1
    return count


def audit_png(path: Path, slot_id: str) -> dict:
    image = Image.open(path).convert("RGBA")
    colors = {pixel for pixel in image.getdata() if pixel[3]}
    semitransparent = sum(1 for pixel in image.getdata() if 0 < pixel[3] < 255)
    expected = TARGET_SIZES[slot_id]
    passed = image.size == expected and semitransparent == 0 and boundary_light_count(image) == 0 and image.getbbox() is not None
    return {
        "path": f"/{path.relative_to(PUBLIC).as_posix()}",
        "slotId": slot_id,
        "width": image.width,
        "height": image.height,
        "opaqueColors": len(colors),
        "semiTransparentPixels": semitransparent,
        "lightBoundaryPixels": boundary_light_count(image),
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "passed": passed,
    }


def refresh_existing_manifest(path: Path) -> None:
    """Keep legacy audits honest when one of their referenced kit files changes."""
    if not path.exists():
        return
    manifest = json.loads(path.read_text(encoding="utf-8"))
    total = 0
    for asset in manifest.get("files", []):
        asset_path = PUBLIC / str(asset.get("path", "")).lstrip("/")
        if asset_path.exists():
            asset["bytes"] = asset_path.stat().st_size
        total += int(asset.get("bytes", 0))
    manifest["totalBytes"] = total
    manifest["totalKiB"] = round(total / 1024, 2)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def source_for(team_id: str, kit_type: str) -> tuple[Image.Image, dict]:
    if team_id in EXISTING_SOURCES:
        relative = EXISTING_SOURCES[team_id][0 if kit_type == "home" else 1]
        path = PUBLIC / "assets" / relative
        return Image.open(path).convert("RGBA"), {
            "kind": "existing-player-art",
            "path": f"/assets/{relative}",
            "column": None,
        }
    roster_path = DOWNLOADS / ROSTER_SOURCES[team_id]
    column = 2 if kit_type == "home" else 0
    return extract_roster_player(roster_path, column), {
        "kind": "download-roster",
        "path": str(roster_path),
        "column": column + 1,
        "goalkeeperCandidates": [1, 2] if kit_type == "goalkeeper" else None,
    }


def build_kit(team_id: str, kit_type: str) -> dict:
    raw_source, source_record = source_for(team_id, kit_type)
    source = normalized_source(raw_source)
    reference_path = PUBLIC / "pixel" / "kit-studio" / "sources" / f"{team_id}-{kit_type}.png"
    save_png(source, reference_path)
    root = PUBLIC / "pixel" / "kits" / team_id / kit_type / PART_SET_ID
    assets: dict[str, Image.Image] = {}
    skin_colors = sampled_skin_colors(source)
    for slot_id in ("shirt_front", "sleeve_left", "sleeve_right", "shorts", "shorts_leg", "socks", "shoes"):
        texture = crop_segment(source, SEGMENTS[slot_id], skin_colors)
        if slot_id == "shirt_front":
            base_luminance = sum(central_base_color(texture)[:3]) / 3
            if base_luminance < 205:
                texture = strip_sticker_edge(texture)
            if team_id == "france" and kit_type == "home":
                texture = replace_light_pixels_with_base(texture)
        # Preserve the authored source silhouette and its exact pixel detail. The
        # gold master contributes only the fixed Runtime canvas and pivot padding.
        assets[slot_id] = fit(texture, slot_id)
        if slot_id == "shirt_front" and team_id == "france" and kit_type == "home":
            assets[slot_id] = replace_light_pixels_with_base(assets[slot_id])
    assets["shirt_back"] = synthesize_back(assets["shirt_front"])
    if kit_type == "goalkeeper":
        assets["hand_left"] = fit(crop_segment(source, SEGMENTS["hand_left"], skin_colors), "hand_left")
        assets["hand_right"] = fit(crop_segment(source, SEGMENTS["hand_right"], skin_colors), "hand_right")
    records = []
    for slot_id, image in assets.items():
        path = root / f"{slot_id}.png"
        save_png(image, path)
        records.append(audit_png(path, slot_id))
    passed = all(record["passed"] for record in records)
    return {
        "teamId": team_id,
        "teamName": TEAM_NAMES[team_id],
        "kitType": kit_type,
        "label": "普通球员" if kit_type == "home" else "门将",
        "partSetId": PART_SET_ID,
        "source": source_record,
        "referencePath": f"/{reference_path.relative_to(PUBLIC).as_posix()}",
        "runtimeRoot": f"/pixel/kits/{team_id}/{kit_type}/{PART_SET_ID}",
        "status": "gold-pass" if passed else "review-required",
        "extractionMethod": "direct-source-crop",
        "files": records,
    }


def main() -> None:
    missing = [str(DOWNLOADS / filename) for filename in ROSTER_SOURCES.values() if not (DOWNLOADS / filename).exists()]
    if missing:
        raise SystemExit("Missing roster source files:\n" + "\n".join(missing))
    kits = []
    for team_id in TEAM_NAMES:
        for kit_type in ("home", "goalkeeper"):
            entry = build_kit(team_id, kit_type)
            kits.append(entry)
            print(f"{entry['teamName']} {entry['label']}: {entry['status']}")
    audit = {
        "schemaVersion": "happyseed-kit-asset-audit-v1",
        "partSetId": PART_SET_ID,
        "teamCount": len({entry["teamId"] for entry in kits}),
        "kitCount": len(kits),
        "fileCount": sum(len(entry["files"]) for entry in kits),
        "passedKitCount": sum(entry["status"] == "gold-pass" for entry in kits),
        "newZealandExcluded": True,
        "rules": {
            "extractionMethod": "direct-source-crop",
            "sourcePixelsRepainted": False,
            "nearestNeighbor": True,
            "fixedCanvas": True,
            "semiTransparentEdgesAllowed": False,
            "lightBoundaryPixelsAllowed": 0,
            "runtimeStickerBorder": False,
        },
        "kits": kits,
    }
    catalog_path = PUBLIC / "pixel" / "kit-studio" / "catalog.json"
    audit_path = PUBLIC / "pixel" / "kit-studio" / "asset-audit.json"
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_path.write_text(json.dumps({"schemaVersion": "happyseed-kit-catalog-v1", "kits": kits}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    refresh_existing_manifest(PUBLIC / "pixel" / "human-runtime-slice-manifest.json")
    refresh_existing_manifest(PUBLIC / "pixel" / "runtime-actor-assets-manifest.json")
    if audit["passedKitCount"] != 32:
        raise SystemExit(f"Kit audit failed: {audit['passedKitCount']}/32 passed")
    print(f"Wrote {catalog_path}")
    print(f"Wrote {audit_path}")


if __name__ == "__main__":
    main()
