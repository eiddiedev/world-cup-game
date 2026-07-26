#!/usr/bin/env python3
"""Cut the approved ImageGen paper-doll master into Runtime attachment canvases.

The original Spine skeleton remains the animation authority.  This script only
replaces the visible attachment silhouettes and palette, then refreshes asset
manifest byte counts after the deterministic Node generators have run.

v2: Clean logos from shirt, generate 5 differentiated head variants.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

from kit_patterns import (
    KIT_PATTERNS,
    TEAM_KIT_COLORS,
    render_pattern,
    render_solid_from_color,
)


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
MASTER_PATH = ROOT / "docs" / "art-reference" / "happyseed-human-v3-production-paper-doll-master.png"
PART_SET_ID = "happyseed-human-v4"
OUTLINE = (18, 23, 25, 255)

# ---------------------------------------------------------------------------
# 5 head appearance presets (skin tone + hair color combinations)
# ---------------------------------------------------------------------------
HEAD_PRESETS = [
    {  # 0: Light skin + dark brown short hair (European)
        "id": "head-euro-dark",
        "skin": "#E8B87A", "skinHighlight": "#F5D4A0", "skinShadow": "#B8844A",
        "hair": "#2A1A0E", "hairHighlight": "#4A3020",
    },
    {  # 1: Light skin + blonde short hair (Nordic)
        "id": "head-nordic-blonde",
        "skin": "#F0C896", "skinHighlight": "#FCE0B8", "skinShadow": "#C89860",
        "hair": "#C8A030", "hairHighlight": "#E0C060",
    },
    {  # 2: Medium skin + black straight hair (East Asian / mixed)
        "id": "head-asian-black",
        "skin": "#D4A060", "skinHighlight": "#E8C080", "skinShadow": "#A07030",
        "hair": "#101010", "hairHighlight": "#303030",
    },
    {  # 3: Medium-dark skin + dark curly hair (Mixed / North African)
        "id": "head-mixed-curly",
        "skin": "#A06830", "skinHighlight": "#C08848", "skinShadow": "#704018",
        "hair": "#181008", "hairHighlight": "#382818",
    },
    {  # 4: Dark skin + black short hair (Black / Sub-Saharan)
        "id": "head-dark-black",
        "skin": "#6B3D1A", "skinHighlight": "#8B5D30", "skinShadow": "#3D2008",
        "hair": "#080808", "hairHighlight": "#1A1A1A",
    },
]

# Mapping from skinTone field values to head preset index
SKIN_TONE_TO_HEAD = {
    "light": 0,
    "light-blonde": 1,
    "medium": 2,
    "medium-dark": 3,
    "dark": 4,
}

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
    """Recolor kit part to team colors. Plain/blank style - no accent mapping."""
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output = []
    for red, green, blue, alpha in image.getdata():
        if alpha == 0:
            output.append((0, 0, 0, 0))
            continue
        luminance = (red * .299) + (green * .587) + (blue * .114)
        if luminance < 26:
            output.append(OUTLINE)
        elif luminance > 105:
            # Light pixels (was white collar/logos) → use lighter shade of main
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


def clean_shirt_logos(master: Image.Image) -> Image.Image:
    """Remove Nike swoosh and French rooster from shirt_front region.

    Replaces logo pixels with the dominant shirt body color from the same row.
    """
    master = master.copy()
    # shirt_front region in master coordinates
    sx, sy, sx2, sy2 = COMPONENTS["shirt_front"]
    region = master.crop((sx, sy, sx2, sy2)).convert("RGB")
    arr = np.array(region)
    h, w = arr.shape[:2]

    # Detect magenta (background) to know what's shirt vs background
    r, g, b = arr[:, :, 0].astype(int), arr[:, :, 1].astype(int), arr[:, :, 2].astype(int)
    magenta = (r > 185) & (b > 135) & (g < 115)
    outline = (r < 30) & (g < 30) & (b < 30)
    shirt_body = ~magenta & ~outline

    # ALL white pixels on the shirt are logos or collar trim → remove them
    # (we want a completely blank/plain shirt with no decorative elements)
    white_logo = (r > 175) & (g > 175) & (b > 165) & shirt_body

    # Gold/orange logo pixels (French rooster)
    gold_logo = (r > 140) & (g > 70) & (g < 160) & (b < 80) & shirt_body

    logo_mask = white_logo | gold_logo

    # For each logo pixel, replace with a mid-luminance shirt color
    # (luminance 50-105 maps to 'main' in recolor_kit, avoiding dark artifacts)
    for y in range(h):
        row_shirt = shirt_body[y] & ~logo_mask[y]
        if not row_shirt.any():
            continue
        # Get median color of shirt pixels in this row
        shirt_pixels = arr[y][row_shirt]
        fill_color = np.median(shirt_pixels, axis=0).astype(np.uint8)
        # Ensure fill luminance is in 50-105 range (maps to 'main' after recolor)
        fill_lum = fill_color[0] * .299 + fill_color[1] * .587 + fill_color[2] * .114
        if fill_lum < 50:
            scale = 75.0 / max(fill_lum, 1.0)
            fill_color = np.clip(fill_color.astype(float) * scale, 0, 255).astype(np.uint8)
        elif fill_lum > 105:
            scale = 80.0 / fill_lum
            fill_color = np.clip(fill_color.astype(float) * scale, 0, 255).astype(np.uint8)
        arr[y][logo_mask[y]] = fill_color

    cleaned = Image.fromarray(arr)
    master.paste(cleaned, (sx, sy))
    return master


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True, compress_level=9)


# Hair style type for each preset (applied after recoloring)
# 0=short_crop, 1=spiky, 2=straight_bangs, 3=curly_wide, 4=buzz_cut
HAIR_STYLES = ["short_crop", "spiky", "straight_bangs", "curly_wide", "buzz_cut"]


def apply_hair_style(image: Image.Image, style: str, hair_color: tuple, hair_light: tuple) -> Image.Image:
    """Modify the hair silhouette of a head image to create different hairstyles.

    Uses spatial position to identify hair: opaque non-skin pixels in the upper
    portion of the head (above the face/eyes region).
    """
    arr = np.array(image.convert("RGBA"))
    h, w = arr.shape[:2]
    a = arr[:, :, 3]
    r, g, b = arr[:,:,0].astype(int), arr[:,:,1].astype(int), arr[:,:,2].astype(int)
    opaque = a > 0

    # Skin detection: bright warm pixels (R > 100, not dark)
    is_skin = opaque & (r > 100) & ((r + g + b) > 250)
    # Find where face starts (first row with significant skin in center)
    skin_rows = np.where(is_skin[:, w//4:3*w//4].any(axis=1))[0]
    face_top = skin_rows[0] if len(skin_rows) > 0 else h // 2

    # Hair = opaque, non-skin, in the upper region (above face_top + 3)
    hair_zone_bottom = min(face_top + 4, h)
    is_hair = opaque & ~is_skin
    is_hair[hair_zone_bottom:, :] = False  # only upper region

    # Also include side hair (beside face, dark pixels)
    for y in range(face_top, min(face_top + 15, h)):
        row_skin = np.where(is_skin[y, :])[0]
        if len(row_skin) == 0:
            continue
        left_skin = row_skin[0]
        right_skin = row_skin[-1]
        # Dark pixels to the left/right of face = side hair
        for x in range(max(0, left_skin - 6), left_skin):
            if opaque[y, x] and not is_skin[y, x]:
                is_hair[y, x] = True
        for x in range(right_skin + 1, min(w, right_skin + 6)):
            if opaque[y, x] and not is_skin[y, x]:
                is_hair[y, x] = True

    hair_coords = np.where(is_hair)
    if len(hair_coords[0]) == 0:
        return image

    hair_top = hair_coords[0].min()
    result = arr.copy()

    if style == "buzz_cut":
        # Very short - remove top 55% of hair region
        cut_line = hair_top + int((face_top - hair_top) * 0.45)
        for y in range(hair_top, cut_line):
            for x in range(w):
                if is_hair[y, x]:
                    result[y, x] = [0, 0, 0, 0]
        # Thin cap line
        for x in range(w):
            if cut_line < h and is_hair[min(cut_line + 1, h-1), x]:
                result[cut_line, x] = [*hair_color, 255]

    elif style == "spiky":
        # Add tall spikes (4-6px) above the hair top
        for x in range(w):
            col_hair = np.where(is_hair[:, x])[0]
            if len(col_hair) == 0:
                continue
            top_y = col_hair[0]
            if x % 4 == 0 and top_y > 5:
                spike_h = 4 + (x % 3)
                for dy in range(1, spike_h + 1):
                    sy = top_y - dy
                    if 0 <= sy < h:
                        result[sy, x] = [*hair_color, 255]
            elif x % 4 == 2 and top_y > 3:
                spike_h = 3 + (x % 2)
                for dy in range(1, spike_h + 1):
                    sy = top_y - dy
                    if 0 <= sy < h:
                        result[sy, x] = [*hair_light, 255]

    elif style == "straight_bangs":
        # Flat top + bangs hanging over forehead
        center_hair_tops = []
        for x in range(w // 4, 3 * w // 4):
            col_hair = np.where(is_hair[:, x])[0]
            if len(col_hair) > 0:
                center_hair_tops.append(col_hair[0])
        if center_hair_tops:
            flat_top = min(center_hair_tops) + 1
            # Remove hair above flat_top
            for y in range(hair_top, flat_top):
                for x in range(w // 4, 3 * w // 4):
                    if is_hair[y, x]:
                        result[y, x] = [0, 0, 0, 0]
            # Straight fringe line
            for x in range(w // 4, 3 * w // 4):
                if flat_top < h:
                    result[flat_top, x] = [*hair_color, 255]
                    if flat_top + 1 < h:
                        result[flat_top + 1, x] = [*hair_light, 255]
            # Bangs: extend hair down over forehead by 4-5 rows
            bang_bottom = min(face_top + 5, h)
            for y in range(flat_top + 2, bang_bottom):
                for x in range(w // 3, 2 * w // 3):
                    if result[y, x, 3] == 0:
                        result[y, x] = [*hair_color, 255]

    elif style == "curly_wide":
        # Wider silhouette + bumpy top
        for y in range(hair_top, min(face_top + 8, h)):
            row_hair = np.where(is_hair[y, :])[0]
            if len(row_hair) == 0:
                continue
            left_edge = row_hair[0]
            right_edge = row_hair[-1]
            progress = (y - hair_top) / max(1, face_top - hair_top)
            expand = max(2, int(4 * (1 - progress * 0.5)))
            for dx in range(1, expand + 1):
                lx = left_edge - dx
                rx = right_edge + dx
                if 0 <= lx < w and result[y, lx, 3] == 0:
                    result[y, lx] = [*hair_color, 255]
                if 0 <= rx < w and result[y, rx, 3] == 0:
                    result[y, rx] = [*hair_color, 255]
        # Bumpy curly top
        for x in range(w):
            col_hair = np.where(is_hair[:, x])[0]
            if len(col_hair) == 0:
                continue
            top_y = col_hair[0]
            if x % 3 == 0 and top_y > 2:
                result[top_y - 1, x] = [*hair_light, 255]
                result[top_y - 2, x] = [*hair_color, 255]
            elif x % 3 == 1 and top_y > 1:
                result[top_y - 1, x] = [*hair_color, 255]

    elif style == "short_crop":
        # Neat short - trim 3 rows from top
        for y in range(hair_top, min(hair_top + 3, h)):
            for x in range(w):
                if is_hair[y, x]:
                    result[y, x] = [0, 0, 0, 0]

    return Image.fromarray(result)


def build_head_variants(master: Image.Image) -> None:
    """Generate 5 skin-tone differentiated head variants from the master image.
    No hair style modification - only skin/hair color changes."""
    head_front_raw = rgba_component(master, "head_front")
    head_back_raw = rgba_component(master, "head_back")

    for preset in HEAD_PRESETS:
        profile_id = preset["id"]
        root = PUBLIC / "pixel" / "player" / PART_SET_ID / profile_id
        appearance = preset

        front = recolor_body(head_front_raw, appearance)
        save(fit(front, TARGET_SIZES["head_front"], (46, 52), 5), root / "head_front.png")

        back = recolor_body(head_back_raw, appearance)
        save(fit(back, TARGET_SIZES["head_back"], (46, 50), 6), root / "head_back.png")

        # Body parts with matching skin
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

    print(f"  Generated {len(HEAD_PRESETS)} head variants (skin-tone only): {[p['id'] for p in HEAD_PRESETS]}")


def build_body_profiles(master: Image.Image) -> None:
    """Legacy: build body profiles from recipes (kept for backward compat)."""
    recipes_dir = PUBLIC / "pixel" / "recipes"
    if not recipes_dir.exists():
        return
    recipes = sorted(recipes_dir.glob("*/*.json"))
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
    """Generate kit parts for all teams using pattern rendering.

    - 16 playable teams: shirt uses pattern (solid/stripes/cross), other parts use solid color
    - 32 opponent teams: all parts use solid color from TEAM_KIT_COLORS
    """
    # Pre-extract master regions for reuse
    shirt_front_region = master.crop(COMPONENTS["shirt_front"])
    shirt_back_region = master.crop(COMPONENTS["shirt_back"])
    sleeve_left_region = master.crop((132, 409, 199, 500))
    sleeve_right_region = master.crop((924, 409, 990, 500))
    shorts_region = master.crop((461, 673, 663, 724))
    shorts_leg_region = master.crop((461, 700, 562, 785))
    socks_region = master.crop((395, 1060, 461, 1167))
    shoes_region = master.crop(COMPONENTS["shoe_left"])

    for kit_root in sorted((PUBLIC / "pixel" / "kits").glob(f"*/*/{PART_SET_ID}")):
        # Extract team_id and kit_type from path
        # Path: public/pixel/kits/{team_id}/{kit_type}/happyseed-human-v4
        parts = kit_root.parts
        team_id = parts[-3]
        kit_type = parts[-2]

        # Determine if this is a home or away kit
        is_home = kit_type in ('home', 'goalkeeper')
        is_away = kit_type in ('away', 'away-goalkeeper')
        is_goalkeeper = 'goalkeeper' in kit_type

        # Get team colors
        team_colors = TEAM_KIT_COLORS.get(team_id)
        if team_colors is None:
            # Unknown team - skip (shouldn't happen)
            continue

        # For away kits, use inverted colors (simplified: swap shirt/shorts)
        if is_away:
            shirt_color = team_colors['shorts']  # away shirt = home shorts color
            shorts_color = team_colors['shirt']  # away shorts = home shirt color
            socks_color = team_colors['shirt']
        else:
            shirt_color = team_colors['shirt']
            shorts_color = team_colors['shorts']
            socks_color = team_colors['socks']
        shoes_color = team_colors['shoes']

        # Goalkeeper gets a distinct color
        if is_goalkeeper:
            shirt_color = '#52A447' if is_home else '#D6A51F'
            shorts_color = shirt_color
            socks_color = shirt_color

        # Render shirt front/back
        if team_id in KIT_PATTERNS and not is_goalkeeper and is_home:
            # Use pattern rendering for home shirt of playable teams
            front = render_pattern(team_id, shirt_front_region)
            back = render_pattern(team_id, shirt_back_region)
        else:
            # Solid color for away/goalkeeper/opponent teams
            front = render_solid_from_color(shirt_front_region, shirt_color)
            back = render_solid_from_color(shirt_back_region, shirt_color)

        # Render other parts with solid colors
        sleeve_left = render_solid_from_color(sleeve_left_region, shirt_color)
        sleeve_right = render_solid_from_color(sleeve_right_region, shirt_color)
        shorts = render_solid_from_color(shorts_region, shorts_color)
        shorts_leg = render_solid_from_color(shorts_leg_region, shorts_color)
        socks = render_solid_from_color(socks_region, socks_color)
        shoes = render_solid_from_color(shoes_region, shoes_color)

        # Fit and save
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
    # Step 1: Clean logos from shirt
    master = clean_shirt_logos(master)
    # Step 2: Generate 5 skin-tone head variants (same silhouette, different colors)
    build_head_variants(master)
    # Step 3: Generate kit parts with pattern system
    build_kit_slices(master)
    # Step 4: Refresh manifests
    refresh_manifest(PUBLIC / "pixel" / "human-runtime-slice-manifest.json")
    refresh_manifest(PUBLIC / "pixel" / "runtime-actor-assets-manifest.json")
    print(f"Done: {PART_SET_ID} assets regenerated.")
    print("  5 head variants (skin-tone only, no hair style changes)")
    print("  Kit patterns applied to all teams")


if __name__ == "__main__":
    main()
