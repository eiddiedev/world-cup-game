from pathlib import Path
import sys

from PIL import Image, ImageOps, ImageDraw


def main() -> None:
    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    destination.mkdir(parents=True, exist_ok=True)
    pages = sorted(source.glob("page-*.png"), key=lambda path: int(path.stem.split("-")[-1]))
    for group_index in range(0, len(pages), 4):
        batch = pages[group_index : group_index + 4]
        opened = [Image.open(path).convert("RGB") for path in batch]
        thumb_width = 1100
        thumbs = []
        for path, page in zip(batch, opened):
            height = int(page.height * thumb_width / page.width)
            thumb = page.resize((thumb_width, height), Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", (thumb_width + 20, height + 56), "#D7DCE2")
            canvas.paste(thumb, (10, 42))
            draw = ImageDraw.Draw(canvas)
            draw.text((14, 12), path.stem, fill="#17223B")
            thumbs.append(canvas)
        cell_width = max(image.width for image in thumbs)
        cell_height = max(image.height for image in thumbs)
        sheet = Image.new("RGB", (cell_width * 2, cell_height * 2), "#AEB7C2")
        for index, image in enumerate(thumbs):
            sheet.paste(image, ((index % 2) * cell_width, (index // 2) * cell_height))
        sheet.save(destination / f"contact-{group_index // 4 + 1}.png", optimize=True)


if __name__ == "__main__":
    main()
