#!/usr/bin/env python3
"""Build UV-safe pixel football and goal/net skins without changing Runtime geometry."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUTPUT_ROOT = PUBLIC / "pixel" / "runtime-equipment" / "happyseed-equipment-v6"

BALL_SOURCE = PUBLIC / "match-runtime-min" / "data" / "balls" / "classic_1" / "texture.png"
GOAL_SOURCE = PUBLIC / "match-runtime-min" / "data" / "stadiums" / "common" / "goal.png"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def quantize_rgb(value: int, step: int = 32) -> int:
    return max(0, min(255, round(value / step) * step))


def build_pixel_ball(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGB")
    reduced = image.resize((64, 32), Image.Resampling.BOX)
    pixels = []
    for red, green, blue in reduced.getdata():
        luminance = (red * 0.299) + (green * 0.587) + (blue * 0.114)
        if luminance < 112:
            pixels.append((24, 31, 30))
        elif luminance < 192:
            pixels.append((176, 175, 164))
        else:
            pixels.append((248, 243, 224))
    reduced.putdata(pixels)
    result = reduced.resize(image.size, Image.Resampling.NEAREST)
    result.save(destination, format="PNG", optimize=True, compress_level=9)


def build_pixel_goal(source: Path, destination: Path) -> None:
    image = Image.open(source).convert("RGBA")
    result = Image.new("RGBA", image.size, (0, 0, 0, 0))
    source_pixels = image.load()
    result_pixels = result.load()
    block_size = 4

    for top in range(0, image.height, block_size):
        for left in range(0, image.width, block_size):
            samples = [
                source_pixels[x, y]
                for y in range(top, min(top + block_size, image.height))
                for x in range(left, min(left + block_size, image.width))
            ]
            visible = [sample for sample in samples if sample[3] >= 20]
            coverage = len(visible) / len(samples)
            if not visible:
                color = (0, 0, 0, 0)
            else:
                brightest = max(
                    (sample[0] * 0.299) + (sample[1] * 0.587) + (sample[2] * 0.114)
                    for sample in visible
                )
                if brightest >= 220:
                    rgb = (248, 248, 232)
                    alpha = 255 if coverage >= 0.18 else 224
                elif brightest >= 145:
                    rgb = (188, 198, 194)
                    alpha = 224 if coverage >= 0.18 else 176
                elif brightest >= 70:
                    rgb = (132, 146, 139)
                    alpha = 168 if coverage >= 0.18 else 128
                else:
                    # The old atlas contained a fixed dark net shadow. The live
                    # Runtime net now draws its own shadow from the same physics
                    # endpoints, so keeping this layer would create a doubled,
                    # misaligned mesh.
                    rgb = (0, 0, 0)
                    alpha = 0
                color = (*rgb, alpha)
            for y in range(top, min(top + block_size, image.height)):
                for x in range(left, min(left + block_size, image.width)):
                    result_pixels[x, y] = color

    result.save(destination, format="PNG", optimize=True, compress_level=9)


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    ball_output = OUTPUT_ROOT / "football-pixel-v6.png"
    goal_output = OUTPUT_ROOT / "goal-net-pixel-v6.png"
    build_pixel_ball(BALL_SOURCE, ball_output)
    build_pixel_goal(GOAL_SOURCE, goal_output)

    files = [
        {
            "role": "football-sphere-uv",
            "path": f"/{ball_output.relative_to(PUBLIC).as_posix()}",
            "source": f"/{BALL_SOURCE.relative_to(PUBLIC).as_posix()}",
            "dimensions": [512, 256],
            "bytes": ball_output.stat().st_size,
            "sha256": sha256(ball_output),
        },
        {
            "role": "goal-and-dynamic-net-atlas",
            "path": f"/{goal_output.relative_to(PUBLIC).as_posix()}",
            "source": f"/{GOAL_SOURCE.relative_to(PUBLIC).as_posix()}",
            "dimensions": [512, 512],
            "bytes": goal_output.stat().st_size,
            "sha256": sha256(goal_output),
        },
    ]
    total_bytes = sum(item["bytes"] for item in files)
    manifest = {
        "schemaVersion": "happyseed-runtime-equipment-assets-v6",
        "generatedBy": "scripts/generate_pixel_match_equipment.py",
        "integration": {
            "ballGeometry": "original-runtime-sphere",
            "goalPlacement": "stadium.json",
            "goalCollision": "original-runtime",
            "dynamicNet": "original-runtime",
            "dynamicNetRendering": "runtime-endpoint-continuous-pixel-wire",
            "filtering": "nearest",
            "pixelGrid": {"ball": [64, 32], "ballOutput": [12, 12], "goalBlock": 4, "netScreen": 4},
            "netTopologyStride": {"side": [1, 3], "top": [1, 2]},
            "netLineBlock": 4,
            "netShadowSource": "same-runtime-endpoints",
            "netShadowAlpha": 0.12,
            "netShadowOffset": 4,
        },
        "fileCount": len(files),
        "totalBytes": total_bytes,
        "totalKiB": round(total_bytes / 1024, 2),
        "files": files,
    }
    (OUTPUT_ROOT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(files)} pixel equipment textures ({total_bytes / 1024:.2f} KiB).")


if __name__ == "__main__":
    main()
