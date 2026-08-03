#!/usr/bin/env python3
"""Build two neutral kit templates for tinted non-selectable opponents."""

from pathlib import Path
import sys

from PIL import Image


PART_SET = "happyseed-human-v4"


def neutralize(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGBA")
    pixels = []
    for red, green, blue, alpha in image.getdata():
        if alpha == 0:
            pixels.append((0, 0, 0, 0))
            continue
        luminance = round((red * 0.299) + (green * 0.587) + (blue * 0.114))
        neutral = 170 + round(luminance * 85 / 255)
        pixels.append((neutral, neutral, neutral, alpha))
    image.putdata(pixels)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, optimize=True)


def build_variant(project_root: Path, output_root: Path, source_variant: str, target_variant: str) -> None:
    source_root = project_root / "public" / "pixel" / "kits" / "england" / source_variant / PART_SET
    target_root = output_root / "pixel" / "kits" / "shared" / target_variant / PART_SET
    for source in sorted(source_root.glob("*.png")):
        neutralize(source, target_root / source.name)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: build-shared-runtime-kit.py PROJECT_ROOT OUTPUT_ROOT")
    project_root = Path(sys.argv[1]).resolve()
    output_root = Path(sys.argv[2]).resolve()
    build_variant(project_root, output_root, "home", "away")
    build_variant(project_root, output_root, "goalkeeper", "away-goalkeeper")


if __name__ == "__main__":
    main()
