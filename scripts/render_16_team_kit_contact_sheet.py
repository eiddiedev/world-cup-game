#!/usr/bin/env python3
"""Render a deterministic visual QA sheet for all 32 locked kit templates."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
CATALOG = PUBLIC / "pixel" / "kit-studio" / "catalog.json"
OUTPUT = PUBLIC / "pixel" / "kit-studio" / "gold-contact-sheet.png"
FONT_PATH = Path("/System/Library/Fonts/STHeiti Medium.ttc")


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    return ImageFont.truetype(FONT_PATH, size) if FONT_PATH.exists() else ImageFont.load_default()


def checker(size: tuple[int, int], cell: int = 8) -> Image.Image:
    image = Image.new("RGBA", size, (244, 242, 235, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                draw.rectangle((x, y, min(size[0], x + cell) - 1, min(size[1], y + cell) - 1), fill=(218, 216, 209, 255))
    return image


def place_pixel_art(canvas: Image.Image, path: Path, box: tuple[int, int, int, int], scale: int) -> None:
    image = Image.open(path).convert("RGBA")
    image = image.resize((image.width * scale, image.height * scale), Image.Resampling.NEAREST)
    left = box[0] + (box[2] - box[0] - image.width) // 2
    top = box[1] + (box[3] - box[1] - image.height) // 2
    canvas.alpha_composite(image, (left, top))


def main() -> None:
    entries = json.loads(CATALOG.read_text(encoding="utf-8"))["kits"]
    columns = 4
    tile_width, tile_height = 470, 310
    header_height = 100
    rows = (len(entries) + columns - 1) // columns
    sheet = Image.new("RGBA", (columns * tile_width, header_height + rows * tile_height), (238, 236, 229, 255))
    draw = ImageDraw.Draw(sheet)
    draw.text((28, 22), "HAPPYSEED 16×2 球衣金标总览", font=font(30), fill=(23, 32, 38, 255))
    draw.text((30, 62), "原图直接裁片 / 固定插槽 / 最近邻 / 零半透明毛边 / 新西兰已排除", font=font(15), fill=(76, 88, 96, 255))
    for index, entry in enumerate(entries):
        column, row = index % columns, index // columns
        left, top = column * tile_width, header_height + row * tile_height
        draw.rectangle((left, top, left + tile_width - 1, top + tile_height - 1), outline=(188, 190, 185, 255), width=1)
        title = f"{entry['teamName']} · {entry['label']}"
        draw.text((left + 18, top + 14), title, font=font(20), fill=(23, 32, 38, 255))
        draw.text((left + 18, top + 42), entry["status"].upper(), font=font(11), fill=(36, 87, 214, 255))
        source_box = (left + 18, top + 66, left + 142, top + 285)
        source_background = checker((source_box[2] - source_box[0], source_box[3] - source_box[1]))
        sheet.alpha_composite(source_background, source_box[:2])
        source = Image.open(PUBLIC / entry["referencePath"].lstrip("/")).convert("RGBA")
        source.thumbnail((116, 210), Image.Resampling.NEAREST)
        sheet.alpha_composite(source, (source_box[0] + (124 - source.width) // 2, source_box[1] + (219 - source.height) // 2))
        root = PUBLIC / entry["runtimeRoot"].lstrip("/")
        slots = [
            ("shirt_front", 3, (left + 158, top + 70, left + 330, top + 230)),
            ("shirt_back", 3, (left + 300, top + 70, left + 462, top + 230)),
            ("sleeve_left", 3, (left + 152, top + 218, left + 218, top + 298)),
            ("sleeve_right", 3, (left + 216, top + 218, left + 292, top + 298)),
            ("shorts", 3, (left + 287, top + 228, left + 452, top + 270)),
            ("socks", 3, (left + 315, top + 262, left + 365, top + 305)),
            ("shoes", 3, (left + 376, top + 267, left + 438, top + 303)),
        ]
        for slot_id, scale, box in slots:
            place_pixel_art(sheet, root / f"{slot_id}.png", box, scale)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(OUTPUT, "PNG", optimize=True, compress_level=9)
    print(OUTPUT)


if __name__ == "__main__":
    main()
