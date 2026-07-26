#!/usr/bin/env python3
"""Subset Zpix to the characters that can appear in this offline project."""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_FONT = ROOT / "resources" / "source-fonts" / "zpix-full.ttf"
OUTPUT_FONT = ROOT / "public" / "assets" / "fonts" / "zpix.ttf"
TEXT_SUFFIXES = {".css", ".html", ".js", ".jsx", ".json", ".md", ".mjs", ".py"}
SCAN_ROOTS = (ROOT / "src", ROOT / "scripts", ROOT / "docs")
ROOT_TEXT_FILES = tuple(ROOT.glob("*.html")) + (ROOT / "README.md",)
ALWAYS_INCLUDE = "".join(chr(code) for code in range(32, 127)) + "\n\t，。！？：；（）【】《》“”‘’—…·￥℃★☆←→↑↓✓✕"


def corpus() -> str:
    chunks = [ALWAYS_INCLUDE]
    paths = list(ROOT_TEXT_FILES)
    for scan_root in SCAN_ROOTS:
        if scan_root.exists():
            paths.extend(path for path in scan_root.rglob("*") if path.suffix in TEXT_SUFFIXES)
    for path in sorted(set(paths)):
        try:
            chunks.append(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError):
            continue
    return "\n".join(chunks)


def build_subset(output: Path) -> None:
    text = corpus()
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    options.name_legacy = True
    options.name_languages = ["*"]
    options.recommended_glyphs = True
    options.notdef_glyph = True
    options.notdef_outline = True

    font = TTFont(SOURCE_FONT)
    worker = subset.Subsetter(options=options)
    worker.populate(text=text)
    worker.subset(font)
    output.parent.mkdir(parents=True, exist_ok=True)
    font.save(output)

    source_cmap = set(TTFont(SOURCE_FONT).getBestCmap() or {})
    output_cmap = set(TTFont(output).getBestCmap() or {})
    required = {ord(character) for character in text if ord(character) in source_cmap}
    missing = required - output_cmap
    if missing:
        raise SystemExit(f"Subset font is missing {len(missing)} required glyphs")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if not SOURCE_FONT.exists():
        raise SystemExit(f"Missing source font: {SOURCE_FONT}")

    if args.write:
        temporary = OUTPUT_FONT.with_suffix(".tmp.ttf")
        build_subset(temporary)
        temporary.replace(OUTPUT_FONT)
    else:
        if not OUTPUT_FONT.exists():
            raise SystemExit("Zpix subset is missing; run with --write")
        text = corpus()
        source_cmap = set(TTFont(SOURCE_FONT).getBestCmap() or {})
        output_cmap = set(TTFont(OUTPUT_FONT).getBestCmap() or {})
        required = {ord(character) for character in text if ord(character) in source_cmap}
        missing = required - output_cmap
        if missing:
            raise SystemExit(
                f"Zpix subset is missing {len(missing)} required glyphs; run with --write"
            )
        if OUTPUT_FONT.stat().st_size >= SOURCE_FONT.stat().st_size:
            raise SystemExit("Zpix subset is not smaller than its source font")
    print(
        f"Zpix subset passed: {SOURCE_FONT.stat().st_size} -> {OUTPUT_FONT.stat().st_size} bytes"
    )


if __name__ == "__main__":
    main()
