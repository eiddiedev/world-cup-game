#!/usr/bin/env python3
"""Cut the approved ImageGen paper-doll master into Runtime attachment canvases.

The original Spine skeleton remains the animation authority.  This script only
replaces the visible attachment silhouettes and palette, then refreshes asset
manifest byte counts after the deterministic Node generators have run.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MASTER_PATH = ROOT / "docs" / "art-reference" / "happyseed-human-v3-production-paper-doll-master.png"
PART_SET_ID = "happyseed-human-v4"
OUTLINE = (18, 23, 25, 255)

COMPONENTS = {
    "head_front": (301, 76, 505, 298),
    "head_back": (616, 76, 816, 289),
    "shirt_front": (282, 384, 540, 580),
    "shirt_back": (592, 386, 839, 580),
    "arm_left": (132, 409, 199, 589),
    "arm_right": (924, 409, 990, 589),
    "hand_left": (141, 670, 216, 775),
    "hand_right": (907, 670, 981, 775),
    "shorts": (461, 673, 663, 785),
    "thigh_left": (394, 850, 471, 954),
    "thigh_right": (651, 850, 728, 954),
    "sock_left": (395, 1016, 461, 1167),
    "sock_right": (660, 1016, 726, 1167),
    "shoe_left": (344, 1233, 463, 1315),
    "shoe_right": (659, 1233, 778, 1315),
}

TARGET_SIZES = {
    "head_front": (81, 77),
    "head_back": (81, 77),
    "arm_left": (14, 11),
    "arm_right": (15, 17),
    "hand_left": (25, 28),
    "hand_right": (23, 38),
    "knee": (8, 9),
    "neck": (20, 18),
    "sleeve_left": (14, 22),
    "sleeve_right": (23, 18),
    "shirt_front": (56, 52),
    "shirt_back": (56, 52),
    "shorts": (55, 8),
    "shorts_leg": (12, 16),
    "socks": (11, 14),
    "shoes": (16, 6),
}


def is_key(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    return red > 185 and blue > 135 and green < 115


def rgba_component(master: Image.Image, name: str, crop: tuple[int, int, int, int] | None = None) -> Image.Image:
    image = master.crop(crop or COMPONENTS[name]).convert("RGBA")
    pixels = []
    for red, green, blue, _alpha in image.getdata():
        pixels.append((0, 0, 0, 0) if is_key((red, green, blue)) else (red, green, blue, 255))
    image.putdata(pixels)
    return image


def color(hex_value: str, fallback: str) -> tuple[int, int, int]:
    value = str(hex_value or fallback).lstrip("#")
    if len(value) != 6:
        value = fallback.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def shade(rgb: tuple[int, int, int], amount: float) -> tuple[int, int, int]:
    return tuple(max(0, min(255, round(channel * amount))) for channel in rgb)


def recolor_body(image: Image.Image, appearance: dict) -> Image.Image:
    skin = color(appearance.get("skin"), "#C8793D")
    skin_light = color(appearance.get("skinHighlight"), "#E39B58")
    skin_shadow = color(appearance.get("skinShadow"), "#8D4826")
    hair = color(appearance.get("hair"), "#20140E")
    hair_light = color(appearance.get("hairHighlight"), "#50301D")
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output = []
    for red, green, blue, alpha in image.getdata():
        if alpha == 0:
            output.append((0, 0, 0, 0))
            continue
        luminance = (red * .299) + (green * .587) + (blue * .114)
        skin_like = red > 115 and green > 65 and red > blue + 28
        white_like = red > 175 and green > 175 and blue > 165
        if white_like:
            output.append((248, 245, 229, 255))
        elif skin_like:
            selected = skin_light if luminance > 190 else skin if luminance > 125 else skin_shadow
            output.append((*selected, 255))
        elif luminance < 28:
            output.append(OUTLINE)
        else:
            selected = hair_light if luminance > 60 else hair
            output.append((*selected, 255))
    result.putdata(output)
    return result


def recolor_kit(image: Image.Image, main: tuple[int, int, int], accent: tuple[int, int, int]) -> Image.Image:
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output = []
    for red, green, blue, alpha in image.getdata():
        if alpha == 0:
            output.append((0, 0, 0, 0))
            continue
        luminance = (red * .299) + (green * .587) + (blue * .114)
        white_like = red > 175 and green > 175 and blue > 165
        if luminance < 26:
            output.append(OUTLINE)
        elif white_like:
            output.append((*accent, 255))
        elif luminance > 105:
            output.append((*shade(main, 1.12), 255))
        elif luminance < 50:
            output.append((*shade(main, .62), 255))
        else:
            output.append((*main, 255))
    result.putdata(output)
    return result


def fit(source: Image.Image, canvas_size: tuple[int, int], visible_size: tuple[int, int], bottom: int = 1) -> Image.Image:
    source = source.crop(source.getbbox())
    max_width, max_height = visible_size
    scale = min(max_width / source.width, max_height / source.height)
    size = (max(1, round(source.width * scale)), max(1, round(source.height * scale)))
    resized = source.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    left = (canvas.width - resized.width) // 2
    top = max(0, canvas.height - bottom - resized.height)
    canvas.alpha_composite(resized, (left, top))
    return canvas


def dominant_colors(path: Path) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    image = Image.open(path).convert("RGBA")
    candidates = Counter()
    for red, green, blue, alpha in image.getdata():
        luminance = (red * .299) + (green * .587) + (blue * .114)
        if alpha > 180 and 35 < luminance < 235:
            candidates[(red, green, blue)] += 1
    ranked = [entry[0] for entry in candidates.most_common(6)]
    main = ranked[0] if ranked else (22, 70, 130)
    accent = next((item for item in ranked[1:] if sum(abs(a - b) for a, b in zip(item, main)) > 90), (248, 245, 229))
    return main, accent


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=9)


def build_body_profiles(master: Image.Image) -> None:
    recipes = sorted((PUBLIC / "pixel" / "recipes").glob("*/*.json"))
    for recipe_path in recipes:
        recipe = json.loads(recipe_path.read_text(encoding="utf-8"))
        if recipe.get("partSetId") != PART_SET_ID:
            continue
        root = PUBLIC / recipe["assets"]["playerRoot"].lstrip("/")
        appearance = recipe.get("appearance", {})
        front = recolor_body(rgba_component(master, "head_front"), appearance)
        back = recolor_body(rgba_component(master, "head_back"), appearance)
        save(fit(front, TARGET_SIZES["head_front"], (46, 52), 5), root / "head_front.png")
        save(fit(back, TARGET_SIZES["head_back"], (46, 50), 6), root / "head_back.png")

        left_arm = recolor_body(rgba_component(master, "arm_left", (132, 495, 199, 589)), appearance)
        right_arm = recolor_body(rgba_component(master, "arm_right", (924, 495, 990, 589)), appearance)
        left_hand = recolor_body(rgba_component(master, "hand_left"), appearance)
        right_hand = recolor_body(rgba_component(master, "hand_right"), appearance)
        thigh = recolor_body(rgba_component(master, "thigh_left", (394, 850, 471, 925)), appearance)
        save(fit(left_arm, TARGET_SIZES["arm_left"], (10, 10), 0), root / "arm_left.png")
        save(fit(right_arm, TARGET_SIZES["arm_right"], (10, 15), 1), root / "arm_right.png")
        save(fit(left_hand, TARGET_SIZES["hand_left"], (11, 16), 5), root / "hand_left.png")
        save(fit(right_hand, TARGET_SIZES["hand_right"], (11, 17), 10), root / "hand_right.png")
        save(fit(thigh, TARGET_SIZES["knee"], (6, 8), 0), root / "knee.png")
        neck = Image.new("RGBA", TARGET_SIZES["neck"], (0, 0, 0, 0))
        skin = color(appearance.get("skin"), "#C8793D")
        for x in range(6, 14):
            for y in range(3, 15):
                neck.putpixel((x, y), (*skin, 255) if 7 <= x <= 12 else OUTLINE)
        save(neck, root / "neck.png")


def build_kit_slices(master: Image.Image) -> None:
    for kit_root in sorted((PUBLIC / "pixel" / "kits").glob(f"*/*/{PART_SET_ID}")):
        shirt_path = kit_root / "shirt_front.png"
        if not shirt_path.exists():
            continue
        main, accent = dominant_colors(shirt_path)
        shorts_main, _ = dominant_colors(kit_root / "shorts.png")
        socks_main, _ = dominant_colors(kit_root / "socks.png")
        boots_main, _ = dominant_colors(kit_root / "shoes.png")

        front = recolor_kit(rgba_component(master, "shirt_front"), main, accent)
        back = recolor_kit(rgba_component(master, "shirt_back"), main, accent)
        sleeve_left = recolor_kit(rgba_component(master, "arm_left", (132, 409, 199, 500)), main, accent)
        sleeve_right = recolor_kit(rgba_component(master, "arm_right", (924, 409, 990, 500)), main, accent)
        shorts = recolor_kit(rgba_component(master, "shorts", (461, 673, 663, 724)), shorts_main, accent)
        shorts_leg = recolor_kit(rgba_component(master, "shorts", (461, 700, 562, 785)), shorts_main, accent)
        socks = recolor_kit(rgba_component(master, "sock_left", (395, 1060, 461, 1167)), socks_main, accent)
        shoes = recolor_kit(rgba_component(master, "shoe_left"), boots_main, accent)

        save(fit(front, TARGET_SIZES["shirt_front"], (56, 46), 1), kit_root / "shirt_front.png")
        save(fit(back, TARGET_SIZES["shirt_back"], (56, 45), 1), kit_root / "shirt_back.png")
        save(fit(sleeve_left, TARGET_SIZES["sleeve_left"], (13, 20), 1), kit_root / "sleeve_left.png")
        save(fit(sleeve_right, TARGET_SIZES["sleeve_right"], (20, 17), 1), kit_root / "sleeve_right.png")
        save(fit(shorts, TARGET_SIZES["shorts"], (52, 8), 0), kit_root / "shorts.png")
        save(fit(shorts_leg, TARGET_SIZES["shorts_leg"], (11, 15), 0), kit_root / "shorts_leg.png")
        save(fit(socks, TARGET_SIZES["socks"], (9, 13), 0), kit_root / "socks.png")
        save(fit(shoes, TARGET_SIZES["shoes"], (15, 6), 0), kit_root / "shoes.png")


def refresh_manifest(path: Path) -> None:
    if not path.exists():
        return
    manifest = json.loads(path.read_text(encoding="utf-8"))
    total = 0
    for asset in manifest.get("files", []):
        file_path = PUBLIC / asset["path"].lstrip("/")
        if file_path.exists():
            asset["bytes"] = file_path.stat().st_size
        total += int(asset.get("bytes", 0))
    manifest["totalBytes"] = total
    manifest["totalKiB"] = round(total / 1024, 2)
    manifest["artSource"] = "/docs/art-reference/happyseed-human-v3-production-paper-doll-master.png"
    manifest["silhouette"] = "imagegen-master-direct-slice"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    master = Image.open(MASTER_PATH).convert("RGB")
    build_body_profiles(master)
    build_kit_slices(master)
    refresh_manifest(PUBLIC / "pixel" / "human-runtime-slice-manifest.json")
    refresh_manifest(PUBLIC / "pixel" / "runtime-actor-assets-manifest.json")
    print(f"Applied direct ImageGen paper-doll slices to {PART_SET_ID}.")


if __name__ == "__main__":
    main()
