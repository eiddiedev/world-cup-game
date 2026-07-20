#!/usr/bin/env python3
"""
点球大战人物素材去背景（无损像素风）

从图片四边做 flood-fill：只抠掉与角落背景色相连且颜色相近的区域，
人物内部的深色（头发/球鞋）即使颜色接近也不会被误抠。
不做平滑、不加阴影/描边，边缘保持硬像素。

用法：
  python3 scripts/remove-shootout-bg.py [源目录] [输出目录] [容差]
默认：
  源目录 ~/Desktop/点球  输出 public/assets/shootout  容差 24
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

SRC_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Desktop' / '点球'
OUT_DIR = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('public/assets/shootout')
TOLERANCE = int(sys.argv[3]) if len(sys.argv) > 3 else 24

SPRITES = [*[f'p{i}.png' for i in range(1, 9)], *[f'gk{i}.png' for i in range(1, 8)]]
BACKGROUNDS = {'背景1.png': 'bg1.png', '背景2.png': 'bg2.png'}


def corner_color(px, w, h):
    """取四角 3x3 区域的中位色作为背景色"""
    samples = []
    for cx, cy in [(0, 0), (w - 3, 0), (0, h - 3), (w - 3, h - 3)]:
        for dx in range(3):
            for dy in range(3):
                samples.append(px[cx + dx, cy + dy][:3])
    samples.sort()
    return samples[len(samples) // 2]


def within(color, bg, tol):
    return all(abs(int(color[i]) - int(bg[i])) <= tol for i in range(3))


def remove_background(path: Path, out_path: Path, tol: int):
    img = Image.open(path).convert('RGBA')
    w, h = img.size
    px = img.load()
    bg = corner_color(px, w, h)
    visited = bytearray(w * h)
    queue = deque()
    # 种子：四边上所有与背景色相近的像素
    for x in range(w):
        for y in (0, h - 1):
            if within(px[x, y], bg, tol):
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if within(px[x, y], bg, tol):
                queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        idx = y * w + x
        if visited[idx]:
            continue
        if not within(px[x, y], bg, tol):
            continue
        visited[idx] = 1
        r, g, b, _a = px[x, y]
        px[x, y] = (r, g, b, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # 愈合：被不透明像素完全包围的透明空洞（球鞋高光等被误抠的内部）
    # 还原回原色；与外部连通的透明区不受影响
    original = Image.open(path).convert('RGBA').load()
    reached = bytearray(w * h)
    heal_queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if px[x, y][3] == 0:
                heal_queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if px[x, y][3] == 0:
                heal_queue.append((x, y))
    while heal_queue:
        x, y = heal_queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        idx = y * w + x
        if reached[idx] or px[x, y][3] != 0:
            continue
        reached[idx] = 1
        heal_queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    for hy in range(h):
        for hx in range(w):
            idx = hy * w + hx
            if px[hx, hy][3] == 0 and not reached[idx]:
                px[hx, hy] = original[hx, hy]
    # 第二阶段：四肢/躯干围出的封闭背景块 flood-fill 够不到，
    # 对剩余的近背景色像素做连通块标记，大块（≥700px）抠除，
    # 小块保留——人物内部的深色细节（阴影/描线）不会被误伤
    marked = bytearray(w * h)
    for sy in range(h):
        for sx in range(w):
            idx = sy * w + sx
            if visited[idx] or marked[idx]:
                continue
            if not within(px[sx, sy], bg, tol):
                continue
            component = [(sx, sy)]
            marked[idx] = 1
            cursor = 0
            while cursor < len(component):
                cx, cy = component[cursor]
                cursor += 1
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nidx = ny * w + nx
                    if visited[nidx] or marked[nidx]:
                        continue
                    if not within(px[nx, ny], bg, tol):
                        continue
                    marked[nidx] = 1
                    component.append((nx, ny))
            if len(component) >= 700:
                for cx, cy in component:
                    r, g, b, _a = px[cx, cy]
                    px[cx, cy] = (r, g, b, 0)
                    visited[cy * w + cx] = 1
    img.save(out_path)
    removed = sum(visited)
    print(f'{path.name}: {w}x{h} bg={bg} 透明像素 {removed} ({removed * 100 // (w * h)}%) -> {out_path}')


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    missing = [name for name in SPRITES if not (SRC_DIR / name).exists()]
    if missing:
        raise SystemExit(f'缺少素材: {missing}')
    for name in SPRITES:
        remove_background(SRC_DIR / name, OUT_DIR / name, TOLERANCE)
    for src_name, out_name in BACKGROUNDS.items():
        img = Image.open(SRC_DIR / src_name).convert('RGB')
        img.save(OUT_DIR / out_name)
        print(f'{src_name}: 原样复制 -> {OUT_DIR / out_name}')


if __name__ == '__main__':
    main()
