#!/usr/bin/env python3
"""Extract paper-doll parts from standing player art using color segmentation.

Instead of naive percentage-rectangle cropping (which fails because body parts
overlap in a standing figure), this script classifies every pixel by color
category and uses vertical+horizontal position constraints to build clean
per-part masks.

Usage:
    python scripts/slice_paper_doll_from_standing.py [--team france] [--all]

Output goes to: public/pixel/player/happyseed-human-v4/{team}-{role}/
                public/pixel/kits/{team}/{kit_type}/happyseed-human-v4/
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
PART_SET_ID = "happyseed-human-v4"
OUTLINE_COLOR = (18, 23, 25, 255)

# Target canvas sizes for each slot (must match Runtime skeleton)
TARGET_SIZES = {
    "head_front": (81, 77),
    "head_back": (81, 77),
    "neck": (20, 18),
    "shirt_front": (56, 52),
    "shirt_back": (56, 52),
    "sleeve_left": (14, 22),
    "sleeve_right": (23, 18),
    "arm_left": (14, 11),
    "arm_right": (15, 17),
    "hand_left": (25, 28),
    "hand_right": (23, 38),
    "shorts": (55, 8),
    "shorts_leg": (12, 16),
    "knee": (8, 9),
    "socks": (11, 14),
    "shoes": (16, 6),
}

# Visible area within each canvas + bottom padding
FIT_RULES = {
    "head_front": ((46, 52), 5),
    "head_back": ((46, 50), 6),
    "neck": ((10, 14), 2),
    "shirt_front": ((56, 46), 1),
    "shirt_back": ((56, 45), 1),
    "sleeve_left": ((13, 20), 1),
    "sleeve_right": ((20, 17), 1),
    "arm_left": ((10, 10), 0),
    "arm_right": ((10, 15), 1),
    "hand_left": ((11, 16), 5),
    "hand_right": ((11, 17), 10),
    "shorts": ((52, 8), 0),
    "shorts_leg": ((11, 15), 0),
    "knee": ((6, 8), 0),
    "socks": ((9, 13), 0),
    "shoes": ((15, 6), 0),
}

# Source files per team: (outfield_path, goalkeeper_path)
# 16 teams = all except New Zealand
TEAM_SOURCES = {
    "argentina": ("阿根廷/slice_02.png", "阿根廷/gk.png"),
    "france": ("法国/slice_02.png", "法国/gk.png"),
    "brazil": ("巴西/slice_02.png", "巴西/gk.png"),
    "portugal": ("葡萄牙/slice_03.png", "葡萄牙/gk.png"),
    "germany": ("德国/slice_02.png", "德国/gk.png"),
    "japan": ("日本/slice_02.png", "日本/gk.png"),
    "morocco": ("摩洛哥/slice_02.png", "摩洛哥/gk.png"),
    "norway": ("挪威/slice_03.png", "挪威/gk.png"),
    "curacao": ("库拉索/slice_02.png", "库拉索/gk.png"),
}

TEAM_NAMES = {
    "argentina": "阿根廷", "france": "法国",
    "brazil": "巴西", "portugal": "葡萄牙",
    "germany": "德国", "japan": "日本", "morocco": "摩洛哥",
    "norway": "挪威", "curacao": "库拉索",
}


# ---------------------------------------------------------------------------
# Color classification
# ---------------------------------------------------------------------------

def classify_pixels(rgba: np.ndarray) -> dict[str, np.ndarray]:
    """Classify each pixel into a semantic category.

    Returns dict of category_name -> boolean mask (same shape as alpha channel).
    """
    r = rgba[:, :, 0].astype(np.float32)
    g = rgba[:, :, 1].astype(np.float32)
    b = rgba[:, :, 2].astype(np.float32)
    a = rgba[:, :, 3]
    lum = r * 0.299 + g * 0.587 + b * 0.114
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    saturation = max_c - min_c  # 0 = grey/black, high = colorful

    opaque = a > 24

    # True outline: very dark AND low saturation (neutral black/dark grey)
    outline = opaque & (lum < 45) & (saturation < 35)

    # Dark colored (e.g. dark blue shirt): dark but has color saturation
    dark_colored = opaque & (lum < 80) & (saturation >= 35)

    # Skin: warm hue, medium-high luminance, NOT yellow/green
    # Key: skin has G/B ratio < 4 (yellow has B≈0 → G/B very high)
    # Skin has R > G (warm tone), yellow has R ≈ G
    gb_ratio = np.where(b > 0, g / np.maximum(b, 1), 999.0)
    skin = opaque & (r > 120) & (r > b + 20) & (r > g * 1.05) & (gb_ratio < 4.0) & (lum > 70) & (lum < 230) & ~outline & ~dark_colored

    # White / near-white (eyes, shorts, sock stripes, shoe highlights)
    white = opaque & (r > 195) & (g > 195) & (b > 185) & ~outline

    # Colored (kit fabric, socks, etc.) - includes dark colored
    colored = opaque & ~outline & ~skin & ~white
    # colored now includes dark_colored

    return {
        "opaque": opaque,
        "outline": outline,
        "dark_colored": dark_colored,
        "skin": skin,
        "white": white,
        "colored": colored,
        # Legacy alias: dark = outline only (for boundary detection)
        "dark": outline,
    }


# ---------------------------------------------------------------------------
# Vertical band analysis to find body landmarks
# ---------------------------------------------------------------------------

def find_landmarks(classified: dict, height: int, width: int) -> dict:
    """Analyze vertical distribution to find body part boundaries.

    Uses center-column analysis to avoid arm skin confusing torso boundaries.
    """
    opaque = classified["opaque"]
    skin = classified["skin"]
    colored = classified["colored"]
    white = classified["white"]
    outline = classified["outline"]

    # Center column (avoid arms on sides)
    cx0 = int(width * 0.30)
    cx1 = int(width * 0.70)
    # Side columns (for arm detection)
    side_w = int(width * 0.25)

    row_opaque = opaque.sum(axis=1)
    center_skin = skin[:, cx0:cx1].sum(axis=1)
    center_colored = colored[:, cx0:cx1].sum(axis=1)
    center_white = white[:, cx0:cx1].sum(axis=1)
    center_outline = outline[:, cx0:cx1].sum(axis=1)
    left_skin = skin[:, :side_w].sum(axis=1)
    right_skin = skin[:, width - side_w:].sum(axis=1)
    left_opaque = opaque[:, :side_w].sum(axis=1)
    right_opaque = opaque[:, width - side_w:].sum(axis=1)

    # Find vertical extents
    opaque_rows = np.where(row_opaque > 0)[0]
    top = int(opaque_rows[0])
    bottom = int(opaque_rows[-1])
    total_h = bottom - top + 1

    # --- HEAD ---
    # Head = from top until center skin drops significantly (face ends)
    # Look for the last row in top 50% where center has face skin
    head_search_end = top + int(total_h * 0.50)
    head_skin_rows = np.where(center_skin[top:head_search_end] > 2)[0]
    if len(head_skin_rows) > 0:
        head_bottom = top + int(head_skin_rows[-1]) + 1
    else:
        head_bottom = top + int(total_h * 0.35)

    # --- NECK ---
    neck_top = head_bottom
    # Neck ends where shirt fabric (colored) starts in center
    shirt_search_end = top + int(total_h * 0.70)
    shirt_colored_rows = np.where(center_colored[neck_top:shirt_search_end] > 2)[0]
    if len(shirt_colored_rows) > 0:
        shirt_top = neck_top + int(shirt_colored_rows[0])
    else:
        shirt_top = top + int(total_h * 0.42)
    neck_bottom = shirt_top

    # --- SHIRT ---
    # Shirt ends where the center column width drops significantly
    # (transition from wide torso to narrow legs/shorts)
    shirt_region_end = top + int(total_h * 0.82)
    # Measure center opaque width per row; shirt ends when it narrows
    center_opaque = opaque[:, cx0:cx1].sum(axis=1)
    # Find the max width in the shirt region as reference
    shirt_max_width = 0
    for y in range(shirt_top, min(shirt_top + int(total_h * 0.15), height)):
        shirt_max_width = max(shirt_max_width, int(center_opaque[y]))
    if shirt_max_width < 5:
        shirt_max_width = int((cx1 - cx0) * 0.6)
    # Shirt bottom = first row where center opaque drops below 50% of max
    # AND we're at least 15% of total_h into the shirt
    shirt_min_height = shirt_top + int(total_h * 0.12)
    shirt_bottom = shirt_min_height
    for y in range(shirt_min_height, min(shirt_region_end, height)):
        if center_opaque[y] < shirt_max_width * 0.45:
            shirt_bottom = y
            break
    else:
        shirt_bottom = top + int(total_h * 0.65)

    # --- SHORTS ---
    shorts_top = shirt_bottom
    # Shorts = white/colored band in center below shirt
    # Shorts end where we see skin in center (knees) or colored-only (socks)
    shorts_region_end = top + int(total_h * 0.88)
    shorts_bottom = shorts_top + 2
    for y in range(shorts_top + 2, min(shorts_region_end, height)):
        # Knee = center skin appears
        if center_skin[y] > 2 and center_skin[y] >= center_white[y]:
            shorts_bottom = y
            break
        # Or socks = center colored without white
        if center_colored[y] > 5 and center_white[y] < 2 and center_skin[y] < 2:
            shorts_bottom = y
            break
    else:
        shorts_bottom = top + int(total_h * 0.78)

    # --- KNEE ---
    knee_top = shorts_bottom
    # Knee = skin in center below shorts
    knee_region_end = top + int(total_h * 0.92)
    knee_bottom = knee_top + 1
    for y in range(knee_top + 1, min(knee_region_end, height)):
        if center_skin[y] < 2 and (center_colored[y] > 2 or center_white[y] > 2):
            knee_bottom = y
            break
    else:
        knee_bottom = top + int(total_h * 0.84)

    # --- SOCKS ---
    socks_top = knee_bottom
    socks_region_end = top + int(total_h * 0.96)
    socks_bottom = socks_top + 1
    for y in range(socks_top + 1, min(socks_region_end, height)):
        # Shoes = mostly outline/dark in center
        if center_outline[y] > (cx1 - cx0) * 0.5 and center_colored[y] < 3 and center_white[y] < 3:
            socks_bottom = y
            break
    else:
        socks_bottom = top + int(total_h * 0.90)

    # --- SHOES ---
    shoes_top = socks_bottom
    shoes_bottom = bottom + 1

    # --- ARMS ---
    # Arms = skin on sides during shirt+shorts height
    arm_top = shirt_top - 2
    arm_bottom = shirt_bottom + int(total_h * 0.08)
    # Refine: find where side skin actually exists
    arm_skin_rows = np.where((left_skin[arm_top:min(arm_bottom, height)] > 1) |
                             (right_skin[arm_top:min(arm_bottom, height)] > 1))[0]
    if len(arm_skin_rows) > 0:
        arm_top = arm_top + int(arm_skin_rows[0])
        arm_bottom = arm_top + int(arm_skin_rows[-1]) + 1

    # --- HANDS ---
    # Hands = opaque pixels on sides below arms
    hand_top = arm_bottom
    hand_bottom = min(shorts_bottom + int(total_h * 0.05), height)

    return {
        "top": top,
        "bottom": bottom,
        "total_h": total_h,
        "head_top": top,
        "head_bottom": head_bottom,
        "neck_top": neck_top,
        "neck_bottom": neck_bottom,
        "shirt_top": shirt_top,
        "shirt_bottom": shirt_bottom,
        "shorts_top": shorts_top,
        "shorts_bottom": shorts_bottom,
        "knee_top": knee_top,
        "knee_bottom": knee_bottom,
        "socks_top": socks_top,
        "socks_bottom": socks_bottom,
        "shoes_top": shoes_top,
        "shoes_bottom": shoes_bottom,
        "arm_top": max(top, arm_top),
        "arm_bottom": min(bottom + 1, arm_bottom),
        "hand_top": max(top, hand_top),
        "hand_bottom": min(bottom + 1, hand_bottom),
    }


# ---------------------------------------------------------------------------
# Part extraction using color + position masks
# ---------------------------------------------------------------------------

def extract_part_mask(
    classified: dict,
    landmarks: dict,
    slot_id: str,
    height: int,
    width: int,
) -> np.ndarray:
    """Build a boolean mask for a specific body part."""
    opaque = classified["opaque"]
    outline = classified["outline"]
    skin = classified["skin"]
    white = classified["white"]
    colored = classified["colored"]

    mask = np.zeros((height, width), dtype=bool)

    if slot_id == "head_front":
        # Everything in the head vertical band
        y0, y1 = landmarks["head_top"], landmarks["head_bottom"]
        mask[y0:y1, :] = opaque[y0:y1, :]

    elif slot_id == "neck":
        # Narrow skin/outline band between head and shirt (center only)
        y0, y1 = landmarks["neck_top"], landmarks["neck_bottom"]
        x0 = int(width * 0.30)
        x1 = int(width * 0.70)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:x1] = True
        mask = region & opaque

    elif slot_id == "shirt_front":
        # Non-skin opaque pixels in center at shirt height
        y0, y1 = landmarks["shirt_top"], landmarks["shirt_bottom"]
        x0 = int(width * 0.18)
        x1 = int(width * 0.82)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:x1] = True
        # Shirt = everything except skin in this region
        mask = region & opaque & ~skin

    elif slot_id == "sleeve_left":
        # Non-skin on the left side at upper shirt height
        y0, y1 = landmarks["shirt_top"], landmarks["shirt_top"] + int(landmarks["total_h"] * 0.14)
        x1 = int(width * 0.28)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, :x1] = True
        mask = region & opaque & ~skin

    elif slot_id == "sleeve_right":
        # Non-skin on the right side at upper shirt height
        y0, y1 = landmarks["shirt_top"], landmarks["shirt_top"] + int(landmarks["total_h"] * 0.14)
        x0 = int(width * 0.72)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:] = True
        mask = region & opaque & ~skin

    elif slot_id == "arm_left":
        # Skin + outline on left side at arm height
        y0, y1 = landmarks["arm_top"], landmarks["arm_bottom"]
        x1 = int(width * 0.28)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, :x1] = True
        mask = region & (skin | (outline & opaque))
        # Only keep outline pixels adjacent to skin (part of arm outline)
        # Simple approach: just take skin + any opaque on the sides
        mask = region & opaque

    elif slot_id == "arm_right":
        # Skin + outline on right side at arm height
        y0, y1 = landmarks["arm_top"], landmarks["arm_bottom"]
        x0 = int(width * 0.72)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:] = True
        mask = region & opaque

    elif slot_id == "hand_left":
        # Opaque on left side in the hand/glove zone
        # Use absolute proportions of total height for robustness
        y0 = landmarks["top"] + int(landmarks["total_h"] * 0.55)
        y1 = landmarks["top"] + int(landmarks["total_h"] * 0.82)
        y1 = min(y1, landmarks["shoes_top"], height)
        if y0 >= y1:
            return mask
        x1 = int(width * 0.28)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, :x1] = True
        mask = region & opaque

    elif slot_id == "hand_right":
        # Opaque on right side in the hand/glove zone
        y0 = landmarks["top"] + int(landmarks["total_h"] * 0.55)
        y1 = landmarks["top"] + int(landmarks["total_h"] * 0.82)
        y1 = min(y1, landmarks["shoes_top"], height)
        if y0 >= y1:
            return mask
        x0 = int(width * 0.72)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:] = True
        mask = region & opaque

    elif slot_id == "shorts":
        # Non-skin in center at shorts height (full width of shorts)
        y0, y1 = landmarks["shorts_top"], landmarks["shorts_bottom"]
        if y1 <= y0:
            y1 = min(y0 + int(landmarks["total_h"] * 0.06), height)
        x0 = int(width * 0.22)
        x1 = int(width * 0.78)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:x1] = True
        mask = region & opaque & ~skin

    elif slot_id == "shorts_leg":
        # Non-skin left-leg portion at shorts height
        y0, y1 = landmarks["shorts_top"], landmarks["shorts_bottom"]
        if y1 <= y0:
            y1 = min(y0 + int(landmarks["total_h"] * 0.08), height)
        x0 = int(width * 0.25)
        x1 = int(width * 0.52)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:x1] = True
        mask = region & opaque & ~skin
        # Fallback: if still empty, take any opaque in a wider range
        if not mask.any():
            y1 = min(y0 + int(landmarks["total_h"] * 0.12), landmarks["knee_top"], height)
            region = np.zeros((height, width), dtype=bool)
            region[y0:y1, x0:x1] = True
            mask = region & opaque

    elif slot_id == "knee":
        # Skin in center-left at knee height
        y0, y1 = landmarks["knee_top"], landmarks["knee_bottom"]
        if y1 <= y0:
            y1 = min(y0 + 5, height)
        x0 = int(width * 0.28)
        x1 = int(width * 0.52)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:x1] = True
        mask = region & (skin | outline)  # skin + its outline
        # If no skin found, take any opaque
        if not mask.any():
            mask = region & opaque

    elif slot_id == "socks":
        # Non-skin at socks height (left leg)
        y0, y1 = landmarks["socks_top"], landmarks["socks_bottom"]
        if y1 <= y0:
            y1 = min(y0 + 5, height)
        x0 = int(width * 0.25)
        x1 = int(width * 0.52)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:x1] = True
        mask = region & opaque

    elif slot_id == "shoes":
        # Everything at shoe height (left shoe)
        y0, y1 = landmarks["shoes_top"], landmarks["shoes_bottom"]
        x0 = int(width * 0.15)
        x1 = int(width * 0.52)
        region = np.zeros((height, width), dtype=bool)
        region[y0:y1, x0:x1] = True
        mask = region & opaque

    return mask


# ---------------------------------------------------------------------------
# Image fitting
# ---------------------------------------------------------------------------

def fit_to_canvas(part_image: Image.Image, slot_id: str) -> Image.Image:
    """Fit extracted part into the target canvas size with proper anchoring."""
    target = TARGET_SIZES[slot_id]
    visible, bottom = FIT_RULES[slot_id]

    bbox = part_image.getbbox()
    if not bbox:
        return Image.new("RGBA", target, (0, 0, 0, 0))

    cropped = part_image.crop(bbox)
    scale = min(visible[0] / cropped.width, visible[1] / cropped.height)
    new_w = max(1, round(cropped.width * scale))
    new_h = max(1, round(cropped.height * scale))
    resized = cropped.resize((new_w, new_h), Image.Resampling.NEAREST)

    canvas = Image.new("RGBA", target, (0, 0, 0, 0))
    left = (target[0] - new_w) // 2
    top = max(0, target[1] - bottom - new_h)
    canvas.alpha_composite(resized, (left, top))
    return canvas


def extract_part_image(rgba: np.ndarray, mask: np.ndarray) -> Image.Image:
    """Create an RGBA image from the source pixels where mask is True."""
    result = np.zeros((*mask.shape, 4), dtype=np.uint8)
    result[mask] = rgba[mask]
    # Ensure masked pixels are fully opaque
    result[mask, 3] = 255
    return Image.fromarray(result, "RGBA")


# ---------------------------------------------------------------------------
# Synthesis helpers
# ---------------------------------------------------------------------------

def synthesize_neck(rgba: np.ndarray, classified: dict, landmarks: dict, height: int, width: int) -> Image.Image:
    """Create a simple neck from the dominant skin color in the head region."""
    from collections import Counter
    skin = classified["skin"]
    y0, y1 = landmarks["head_top"], landmarks["head_bottom"]
    # Sample actual skin colors from head
    color_counter = Counter()
    for y in range(y0, min(y1, height)):
        for x in range(width):
            if skin[y, x]:
                color_counter[tuple(rgba[y, x])] += 1
    skin_color = color_counter.most_common(1)[0][0] if color_counter else (210, 150, 90, 255)

    target = TARGET_SIZES["neck"]
    canvas = Image.new("RGBA", target, (0, 0, 0, 0))
    # Draw a simple neck rectangle (6px wide, 12px tall, centered)
    neck_w = 8
    neck_h = 12
    left = (target[0] - neck_w) // 2
    top = (target[1] - neck_h) // 2
    outline = OUTLINE_COLOR
    for y in range(top, top + neck_h):
        for x in range(left, left + neck_w):
            if x == left or x == left + neck_w - 1 or y == top or y == top + neck_h - 1:
                canvas.putpixel((x, y), outline)
            else:
                canvas.putpixel((x, y), skin_color)
    return canvas


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def normalize_source(image: Image.Image, target_width: int = 96) -> Image.Image:
    """Crop to opaque bbox and resize to standard width."""
    bbox = image.getbbox()
    if not bbox:
        raise RuntimeError("Source image is empty")
    cropped = image.crop(bbox)
    height = max(1, round(cropped.height / cropped.width * target_width))
    return cropped.resize((target_width, height), Image.Resampling.NEAREST)


def process_player(source_path: Path, team_id: str, role: str) -> dict:
    """Process a single standing player image into paper doll parts."""
    image = Image.open(source_path).convert("RGBA")
    normalized = normalize_source(image)
    rgba = np.array(normalized)
    height, width = rgba.shape[:2]

    classified = classify_pixels(rgba)
    landmarks = find_landmarks(classified, height, width)

    # Body parts (go to player directory)
    body_slots = ["head_front", "neck", "arm_left", "arm_right", "hand_left", "hand_right", "knee"]
    # Kit parts (go to kit directory)
    kit_slots = ["shirt_front", "sleeve_left", "sleeve_right", "shorts", "shorts_leg", "socks", "shoes"]

    kit_type = "home" if role == "outfield" else "goalkeeper"
    player_root = PUBLIC / "pixel" / "player" / PART_SET_ID / f"{team_id}-{role}"
    kit_root = PUBLIC / "pixel" / "kits" / team_id / kit_type / PART_SET_ID

    results = {"team": team_id, "role": role, "source": str(source_path), "parts": {}}

    for slot_id in body_slots:
        mask = extract_part_mask(classified, landmarks, slot_id, height, width)
        if not mask.any():
            # Synthesize neck if extraction fails (head connects directly to shirt)
            if slot_id == "neck":
                fitted = synthesize_neck(rgba, classified, landmarks, height, width)
                out_path = player_root / f"{slot_id}.png"
                out_path.parent.mkdir(parents=True, exist_ok=True)
                fitted.save(out_path, "PNG", optimize=True)
                results["parts"][slot_id] = str(out_path.relative_to(PUBLIC))
                continue
            results["parts"][slot_id] = "EMPTY"
            continue
        part_img = extract_part_image(rgba, mask)
        fitted = fit_to_canvas(part_img, slot_id)
        out_path = player_root / f"{slot_id}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        fitted.save(out_path, "PNG", optimize=True)
        results["parts"][slot_id] = str(out_path.relative_to(PUBLIC))

    for slot_id in kit_slots:
        mask = extract_part_mask(classified, landmarks, slot_id, height, width)
        if not mask.any():
            results["parts"][slot_id] = "EMPTY"
            continue
        part_img = extract_part_image(rgba, mask)
        fitted = fit_to_canvas(part_img, slot_id)
        out_path = kit_root / f"{slot_id}.png"
        out_path.parent.mkdir(parents=True, exist_ok=True)
        fitted.save(out_path, "PNG", optimize=True)
        results["parts"][slot_id] = str(out_path.relative_to(PUBLIC))

    # Synthesize shirt_back from shirt_front (mirror + clean)
    shirt_front_path = kit_root / "shirt_front.png"
    if shirt_front_path.exists():
        front = Image.open(shirt_front_path).convert("RGBA")
        back = front.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        back_path = kit_root / "shirt_back.png"
        back.save(back_path, "PNG", optimize=True)
        results["parts"]["shirt_back"] = str(back_path.relative_to(PUBLIC))

    # Synthesize head_back from head_front (mirror)
    head_front_path = player_root / "head_front.png"
    if head_front_path.exists():
        front = Image.open(head_front_path).convert("RGBA")
        back = front.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        back_path = player_root / "head_back.png"
        back.save(back_path, "PNG", optimize=True)
        results["parts"]["head_back"] = str(back_path.relative_to(PUBLIC))

    return results


def main():
    parser = argparse.ArgumentParser(description="Extract paper-doll parts from standing player art")
    parser.add_argument("--team", type=str, help="Process single team (e.g. france)")
    parser.add_argument("--all", action="store_true", help="Process all 16 teams")
    args = parser.parse_args()

    if not args.team and not args.all:
        args.all = True

    teams = [args.team] if args.team else list(TEAM_SOURCES.keys())
    all_results = []

    for team_id in teams:
        if team_id not in TEAM_SOURCES:
            print(f"WARNING: Unknown team '{team_id}', skipping")
            continue

        outfield_path, gk_path = TEAM_SOURCES[team_id]
        outfield_full = PUBLIC / "assets" / outfield_path
        gk_full = PUBLIC / "assets" / gk_path

        if outfield_full.exists():
            result = process_player(outfield_full, team_id, "outfield")
            all_results.append(result)
            empty = [k for k, v in result["parts"].items() if v == "EMPTY"]
            status = f"OK ({len(result['parts']) - len(empty)}/{len(result['parts'])} parts)" if not empty else f"PARTIAL (empty: {empty})"
            print(f"  {TEAM_NAMES[team_id]} 普通球员: {status}")
        else:
            print(f"  {TEAM_NAMES[team_id]} 普通球员: SOURCE MISSING ({outfield_path})")

        if gk_full.exists():
            result = process_player(gk_full, team_id, "goalkeeper")
            all_results.append(result)
            empty = [k for k, v in result["parts"].items() if v == "EMPTY"]
            status = f"OK ({len(result['parts']) - len(empty)}/{len(result['parts'])} parts)" if not empty else f"PARTIAL (empty: {empty})"
            print(f"  {TEAM_NAMES[team_id]} 门将: {status}")
        else:
            print(f"  {TEAM_NAMES[team_id]} 门将: SOURCE MISSING ({gk_path})")

    # Write summary
    summary_path = PUBLIC / "pixel" / "paper-doll-extraction-report.json"
    summary_path.write_text(json.dumps(all_results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nDone. Report: {summary_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
