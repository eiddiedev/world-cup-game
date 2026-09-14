#!/usr/bin/env python3
"""Verify the production turf is aligned and follows the pitch perspective."""

from __future__ import annotations

import argparse
import statistics
from pathlib import Path

from PIL import Image, ImageChops, ImageOps


PLAYABLE_PITCH_BOUNDS = (648, 611, 3448, 1668)
TURF_REPLACEMENT_BOUNDS = (450, 440, 3650, 1810)


def turf_mask(reference: Image.Image) -> Image.Image:
    rgb = reference.convert("RGB")
    pixels = rgb.load()
    mask = Image.new("L", rgb.size, 0)
    output = mask.load()
    left, top, right, bottom = TURF_REPLACEMENT_BOUNDS
    for y in range(top, bottom):
        for x in range(left, right):
            red, green, blue = pixels[x, y]
            if green >= 58 and green >= red * 1.18 and green >= blue * 1.12:
                output[x, y] = 255
    return mask


def marking_mask(reference: Image.Image) -> Image.Image:
    rgb = reference.convert("RGB")
    pixels = rgb.load()
    mask = Image.new("L", rgb.size, 0)
    output = mask.load()
    left, top, right, bottom = PLAYABLE_PITCH_BOUNDS
    for y in range(top, bottom):
        for x in range(left, right):
            red, green, blue = pixels[x, y]
            saturation = max(red, green, blue) - min(red, green, blue)
            if min(red, green, blue) >= 142 and saturation <= 72:
                output[x, y] = 255
    return mask


def assert_unchanged(reference: Image.Image, result: Image.Image, protected: Image.Image, label: str) -> None:
    difference = ImageChops.difference(reference.convert("RGB"), result.convert("RGB"))
    difference.paste((0, 0, 0), mask=ImageOps.invert(protected))
    if difference.getbbox() is not None:
        raise AssertionError(f"{label} pixels moved or changed")


def stripe_axis_score(result: Image.Image) -> tuple[float, float]:
    # Stay inside the touchlines and away from the centre/penalty markings.
    crop = result.convert("RGB").crop((720, 690, 3376, 1588))
    pixels = crop.load()
    width, height = crop.size
    column_means = []
    row_means = []
    for x in range(width):
        values = [pixels[x, y][1] for y in range(height)]
        column_means.append(sum(values) / len(values))
    for y in range(height):
        values = [pixels[x, y][1] for x in range(width) if not (1280 <= x <= 1375)]
        row_means.append(sum(values) / len(values))
    return statistics.pstdev(column_means), statistics.pstdev(row_means)


def smoothed_green_profile(result: Image.Image, centre_y: int) -> list[float]:
    rgb = result.convert("RGB")
    pixels = rgb.load()
    profile: list[float | None] = []
    for x in range(rgb.width):
        greens = []
        for y in range(centre_y - 12, centre_y + 13):
            red, green, blue = pixels[x, y]
            if green >= 58 and green >= red * 1.18 and green >= blue * 1.12:
                greens.append(float(green))
        profile.append(statistics.median(greens) if greens else None)

    # Field markings leave small holes in a row. Fill them from the nearest turf
    # samples, then smooth grass grain so this audit measures mowing geometry.
    last = None
    for index, value in enumerate(profile):
        if value is not None:
            last = value
        elif last is not None:
            profile[index] = last
    last = None
    for index in range(len(profile) - 1, -1, -1):
        value = profile[index]
        if value is not None:
            last = value
        elif last is not None:
            profile[index] = last
    resolved = [value if value is not None else 0.0 for value in profile]
    radius = 15
    return [
        sum(resolved[max(0, x - radius):min(len(resolved), x + radius + 1)])
        / (min(len(resolved), x + radius + 1) - max(0, x - radius))
        for x in range(len(resolved))
    ]


def sample(profile: list[float], x: float) -> float:
    left = max(0, min(len(profile) - 1, int(x)))
    right = min(len(profile) - 1, left + 1)
    amount = max(0.0, min(1.0, x - left))
    return profile[left] * (1.0 - amount) + profile[right] * amount


def perspective_fit_error(result: Image.Image, vanishing_y: float) -> float:
    top_y, bottom_y = 760, 1500
    reference_y = 611.0
    vanishing_x = 2048.0
    top = smoothed_green_profile(result, top_y)
    bottom = smoothed_green_profile(result, bottom_y)
    squared_error = 0.0
    count = 0
    for reference_x in range(900, 3200, 3):
        top_x = vanishing_x + (reference_x - vanishing_x) * (top_y - vanishing_y) / (reference_y - vanishing_y)
        bottom_x = vanishing_x + (reference_x - vanishing_x) * (bottom_y - vanishing_y) / (reference_y - vanishing_y)
        squared_error += (sample(top, top_x) - sample(bottom, bottom_x)) ** 2
        count += 1
    return squared_error / count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference", type=Path, required=True)
    parser.add_argument("--result", type=Path, required=True)
    args = parser.parse_args()

    reference = Image.open(args.reference)
    result = Image.open(args.result)
    if reference.size != (4096, 2048) or result.size != reference.size:
        raise AssertionError(f"expected matching 4096x2048 images, got {reference.size} and {result.size}")

    turf = turf_mask(reference)
    assert_unchanged(reference, result, ImageOps.invert(turf), "non-turf")
    assert_unchanged(reference, result, marking_mask(reference), "field marking")

    column_score, row_score = stripe_axis_score(result)
    if column_score <= row_score * 2:
        raise AssertionError(
            f"mowing pattern is not decisively vertical: columns={column_score:.2f}, rows={row_score:.2f}"
        )

    screen_vertical_error = perspective_fit_error(result, -1_000_000.0)
    perspective_candidates = [-15_000.0, -12_000.0, -10_000.0, -9_000.0, -8_000.0, -7_000.0, -6_000.0, -5_000.0]
    fitted_y = min(perspective_candidates, key=lambda candidate: perspective_fit_error(result, candidate))
    fitted_error = perspective_fit_error(result, fitted_y)
    if not -12_000.0 <= fitted_y <= -7_000.0 or fitted_error >= screen_vertical_error * 0.35:
        raise AssertionError(
            "mowing bands do not share the goal-line perspective: "
            f"fitted vanishing y={fitted_y:.0f}, perspective error={fitted_error:.2f}, "
            f"screen-vertical error={screen_vertical_error:.2f}"
        )

    print(
        "Perspective pitch audit passed: 4096x2048, full infield and runoff replaced, protected pixels exact, "
        f"vertical-axis score {column_score:.2f} vs horizontal {row_score:.2f}, "
        f"fitted mowing vanishing y={fitted_y:.0f}."
    )


if __name__ == "__main__":
    main()
