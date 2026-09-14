#!/usr/bin/env python3
"""Build the production perspective-correct mowing stadium without moving lines.

The generated texture is intentionally treated as colour/texture material only.
Its nominally vertical bands are projected toward the same upper vanishing point
as the two goal lines, so they fan outward toward the foreground instead of being
screen-vertical. Every non-turf pixel is copied from the approved reference.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


# The playable projection remains locked to (648, 611, 2800, 1057), while the
# texture replacement deliberately covers the complete green infield and runoff
# area outside the white touchlines as well.
TURF_REPLACEMENT_BOUNDS = (450, 440, 3650, 1810)

# The approved pitch is a trapezoid. Its goal lines run approximately from
# (790, 611) to (660, 1668), and from (3290, 611) to (3430, 1668). Extending
# those lines upward meets close to this point. Keeping the top touchline as the
# reference row gives the foreground a roughly 11% wider mowing pattern, which
# matches the original field projection.
PERSPECTIVE_VANISHING_POINT = (2048.0, -9000.0)
PERSPECTIVE_REFERENCE_Y = 611.0


def turf_mask(reference_rgb: Image.Image) -> Image.Image:
    """Select only green pitch pixels inside the locked production bounds."""
    pixels = reference_rgb.load()
    mask = Image.new("L", reference_rgb.size, 0)
    out = mask.load()
    left, top, right, bottom = TURF_REPLACEMENT_BOUNDS
    for y in range(top, bottom):
        for x in range(left, right):
            red, green, blue = pixels[x, y]
            # The source uses a saturated green palette for every playable-turf
            # shade. White markings, goals, shadows and surrounding architecture
            # intentionally fail this test and remain byte-for-byte unchanged.
            if green >= 58 and green >= red * 1.18 and green >= blue * 1.12:
                out[x, y] = 255
    return mask


def quantize_to_reference_palette(texture: Image.Image, reference: Image.Image) -> Image.Image:
    palette = reference if reference.mode == "P" else reference.convert("P", palette=Image.Palette.ADAPTIVE)
    return texture.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE)


def project_texture_to_pitch(texture: Image.Image) -> Image.Image:
    """Fan vertical source bands outward using the reference pitch projection."""
    left, top, right, bottom = TURF_REPLACEMENT_BOUNDS
    width = right - left
    height = bottom - top
    source = texture.resize((width, height), Image.Resampling.LANCZOS)
    projected = Image.new("RGB", (width, height))
    vanish_x, vanish_y = PERSPECTIVE_VANISHING_POINT

    for local_y in range(height):
        canvas_y = top + local_y
        scale = (canvas_y - vanish_y) / (PERSPECTIVE_REFERENCE_Y - vanish_y)
        # Pillow's affine coefficients map destination pixels back to the source.
        # Convert the destination x to canvas space, intersect its ray from the
        # vanishing point with the reference row, then convert back to crop space.
        inverse_scale = 1.0 / scale
        source_offset = (left - vanish_x) * inverse_scale + vanish_x - left
        source_row = source.crop((0, local_y, width, local_y + 1))
        projected_row = source_row.transform(
            (width, 1),
            Image.Transform.AFFINE,
            (inverse_scale, 0.0, source_offset, 0.0, 1.0, 0.0),
            resample=Image.Resampling.BILINEAR,
        )
        projected.paste(projected_row, (0, local_y))

    return projected


def compose(reference_path: Path, texture_path: Path, output_path: Path) -> None:
    reference = Image.open(reference_path)
    if reference.size != (4096, 2048):
        raise ValueError(f"reference must be 4096x2048, got {reference.size}")

    reference_rgb = reference.convert("RGB")
    texture = Image.open(texture_path).convert("RGB")
    left, top, right, bottom = TURF_REPLACEMENT_BOUNDS
    texture = project_texture_to_pitch(texture)
    texture = quantize_to_reference_palette(texture, reference)

    texture_layer = reference.copy()
    texture_layer.paste(texture, (left, top))
    result = reference.copy()
    result.paste(texture_layer, (0, 0), turf_mask(reference_rgb))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--texture", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--bootstrap", type=Path)
    args = parser.parse_args()
    compose(args.reference, args.texture, args.output)
    if args.bootstrap:
        args.bootstrap.parent.mkdir(parents=True, exist_ok=True)
        Image.new("RGB", (16, 8), (24, 70, 48)).save(args.bootstrap, optimize=True)


if __name__ == "__main__":
    main()
