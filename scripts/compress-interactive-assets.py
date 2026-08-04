#!/usr/bin/env python3
"""Compress an already-built Interactive Space package without deleting content.

The output keeps every relative path and every raster dimension. PNG assets are
palette-quantized in place only when the encoded result is smaller; JPEG assets
are re-encoded at the selected quality. The source package is never modified.
"""

from __future__ import annotations

import argparse
import shutil
import tempfile
import zipfile
from pathlib import Path

from PIL import Image


PROFILES = {
    "lossless": {
        "asset_colors": 0,
        "pixel_colors": 0,
        "stadium_colors": 0,
        "jpeg_quality": 0,
    },
    "balanced": {
        "asset_colors": 160,
        "pixel_colors": 128,
        "stadium_colors": 128,
        "jpeg_quality": 78,
    },
    "strong": {
        "asset_colors": 80,
        "pixel_colors": 64,
        "stadium_colors": 64,
        "jpeg_quality": 68,
    },
    "maximum": {
        "asset_colors": 40,
        "pixel_colors": 32,
        "stadium_colors": 32,
        "jpeg_quality": 58,
    },
    "platform": {
        "asset_colors": 24,
        "pixel_colors": 16,
        "stadium_colors": 16,
        "jpeg_quality": 48,
    },
    "platform-safe": {
        "asset_colors": 16,
        "pixel_colors": 12,
        "stadium_colors": 12,
        "jpeg_quality": 42,
    },
    "match-quality": {
        "asset_colors": 24,
        "pixel_colors": 0,
        "stadium_colors": 96,
        "jpeg_quality": 56,
    },
}


def walk_files(root: Path) -> list[Path]:
    return sorted(path for path in root.rglob("*") if path.is_file())


def png_color_budget(relative_path: Path, profile: dict[str, int]) -> int:
    normalized = relative_path.as_posix()
    if normalized == "pixel/stadiums/international-championship-day-v1/stadium-day-master-v1.png":
        return profile["stadium_colors"]
    if normalized.startswith("pixel/"):
        return profile["pixel_colors"]
    return profile["asset_colors"]


def quantize_png(source: Path, destination: Path, colors: int) -> bool:
    with Image.open(source) as image:
        original_size = image.size
        has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info
        working = image.convert("RGBA" if has_alpha else "RGB")
        method = (
            Image.Quantize.FASTOCTREE
            if has_alpha
            else Image.Quantize.MEDIANCUT
        )
        quantized = working.quantize(
            colors=colors,
            method=method,
            dither=Image.Dither.NONE,
        )
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
            temporary = Path(handle.name)
        try:
            quantized.save(temporary, format="PNG", optimize=True, compress_level=9)
            if temporary.stat().st_size >= source.stat().st_size:
                shutil.copy2(source, destination)
                return False
            shutil.copy2(temporary, destination)
            with Image.open(destination) as encoded:
                if encoded.size != original_size:
                    raise RuntimeError(f"PNG dimensions changed: {source}")
            return True
        finally:
            temporary.unlink(missing_ok=True)


def optimize_png_losslessly(source: Path, destination: Path) -> bool:
    with Image.open(source) as image:
        original_size = image.size
        original_rgba = image.convert("RGBA").tobytes()
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
            temporary = Path(handle.name)
        try:
            image.save(temporary, format="PNG", optimize=True, compress_level=9)
            if temporary.stat().st_size >= source.stat().st_size:
                shutil.copy2(source, destination)
                return False
            shutil.copy2(temporary, destination)
            with Image.open(destination) as encoded:
                if encoded.size != original_size or encoded.convert("RGBA").tobytes() != original_rgba:
                    raise RuntimeError(f"Lossless PNG verification failed: {source}")
            return True
        finally:
            temporary.unlink(missing_ok=True)


def recompress_jpeg(source: Path, destination: Path, quality: int) -> bool:
    with Image.open(source) as image:
        original_size = image.size
        working = image.convert("RGB")
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as handle:
            temporary = Path(handle.name)
        try:
            working.save(
                temporary,
                format="JPEG",
                quality=quality,
                optimize=True,
                progressive=True,
                subsampling="4:2:0",
            )
            if temporary.stat().st_size >= source.stat().st_size:
                shutil.copy2(source, destination)
                return False
            shutil.copy2(temporary, destination)
            with Image.open(destination) as encoded:
                if encoded.size != original_size:
                    raise RuntimeError(f"JPEG dimensions changed: {source}")
            return True
        finally:
            temporary.unlink(missing_ok=True)


def write_zip(source_root: Path, destination: Path) -> None:
    destination.unlink(missing_ok=True)
    with zipfile.ZipFile(
        destination,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
        strict_timestamps=False,
    ) as archive:
        for path in walk_files(source_root):
            archive.write(path, path.relative_to(source_root).as_posix())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--profile", choices=sorted(PROFILES), required=True)
    args = parser.parse_args()

    source_root = args.source.resolve()
    output_root = args.output.resolve()
    zip_path = output_root.with_suffix(".zip")
    profile = PROFILES[args.profile]

    if not (source_root / "index.html").is_file():
        raise SystemExit(f"Missing package entry: {source_root / 'index.html'}")

    shutil.rmtree(output_root, ignore_errors=True)
    shutil.copytree(source_root, output_root)

    source_files = walk_files(source_root)
    before_bytes = sum(path.stat().st_size for path in source_files)
    changed_images = 0

    for source in source_files:
        relative_path = source.relative_to(source_root)
        destination = output_root / relative_path
        suffix = source.suffix.lower()
        if suffix == ".png":
            colors = png_color_budget(relative_path, profile)
            if colors:
                changed_images += quantize_png(source, destination, colors)
            else:
                changed_images += optimize_png_losslessly(source, destination)
        elif suffix in {".jpg", ".jpeg"}:
            if profile["jpeg_quality"]:
                changed_images += recompress_jpeg(
                    source,
                    destination,
                    profile["jpeg_quality"],
                )

    output_files = walk_files(output_root)
    input_paths = {path.relative_to(source_root).as_posix() for path in source_files}
    output_paths = {path.relative_to(output_root).as_posix() for path in output_files}
    if input_paths != output_paths:
        raise RuntimeError("Compression changed the package file list")

    after_bytes = sum(path.stat().st_size for path in output_files)
    write_zip(output_root, zip_path)

    with zipfile.ZipFile(zip_path) as archive:
        zip_paths = {info.filename for info in archive.infolist()}
        non_ascii = [
            info
            for info in archive.infolist()
            if any(ord(character) > 127 for character in info.filename)
        ]
        if zip_paths != output_paths:
            raise RuntimeError("ZIP file list differs from the source package")
        if any(not (info.flag_bits & 0x800) for info in non_ascii):
            raise RuntimeError("ZIP contains a non-UTF-8 path")

    print(
        {
            "profile": args.profile,
            "files": len(output_files),
            "changed_images": changed_images,
            "before_bytes": before_bytes,
            "after_bytes": after_bytes,
            "zip_bytes": zip_path.stat().st_size,
            "zip_path": str(zip_path),
        }
    )


if __name__ == "__main__":
    main()
