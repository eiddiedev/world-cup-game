from pathlib import Path
import sys

from fontTools import subset
from PIL import Image


def collect_text(source_root: Path) -> str:
    characters = set(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
        "0123456789"
        "，。！？：；、（）《》【】+-—→·%/.'\" "
    )
    for path in source_root.rglob("*"):
        if path.suffix.lower() not in {".js", ".jsx", ".css", ".html", ".md"}:
            continue
        characters.update(path.read_text(encoding="utf-8", errors="ignore"))
    return "".join(sorted(characters))


def subset_font(project_root: Path, output_root: Path) -> None:
    font_source = project_root / "public/assets/fonts/zpix.ttf"
    font_target = output_root / "assets/fonts/zpix.ttf"
    font_target.parent.mkdir(parents=True, exist_ok=True)
    text_file = output_root / ".font-characters.txt"
    text_file.write_text(collect_text(project_root / "src"), encoding="utf-8")

    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.notdef_glyph = True
    options.notdef_outline = True
    font = subset.load_font(str(font_source), options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text_file.read_text(encoding="utf-8"))
    subsetter.subset(font)
    subset.save_font(font, str(font_target), options)
    text_file.unlink()


def build_pitch(project_root: Path, output_root: Path) -> None:
    source = project_root / "public/assets/足球场.png"
    target = output_root / "assets/足球场.png"
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        resized = image.resize((384, 576), Image.Resampling.NEAREST)
        resized.save(target, "PNG", optimize=True, compress_level=9)


def main() -> None:
    project_root = Path(sys.argv[1]).resolve()
    output_root = Path(sys.argv[2]).resolve()
    subset_font(project_root, output_root)
    build_pitch(project_root, output_root)


if __name__ == "__main__":
    main()

