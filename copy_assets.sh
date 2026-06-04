#!/bin/bash
# 复制游戏所需的资源到 public/assets 文件夹。
# 用法：
#   ./copy_assets.sh
#   ./copy_assets.sh /path/to/source/assets /path/to/public/assets

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SOURCE="${1:-$ROOT/assets}"
DEST="${2:-$ROOT/public/assets}"

if [ ! -d "$SOURCE" ]; then
    echo "Source assets folder not found: $SOURCE" >&2
    exit 1
fi

# 清空目标文件夹
rm -rf "$DEST"
mkdir -p "$DEST"

# 复制球队文件夹（球员头像）
for team in 法国 巴西 阿根廷 葡萄牙 德国 日本 挪威 摩洛哥 新西兰 库拉索; do
    mkdir -p "$DEST/$team"
    cp "$SOURCE/$team"/*.png "$DEST/$team/" 2>/dev/null
done

# 复制国旗
mkdir -p "$DEST/国旗"
cp "$SOURCE/国旗"/*.png "$DEST/国旗/" 2>/dev/null

# 复制属性图标
mkdir -p "$DEST/属性"
cp "$SOURCE/属性"/*.png "$DEST/属性/" 2>/dev/null

# 复制其他游戏资源
cp "$SOURCE/足球场.png" "$DEST/" 2>/dev/null
cp "$SOURCE/足球.png" "$DEST/" 2>/dev/null
cp "$SOURCE/金币.png" "$DEST/" 2>/dev/null
cp "$SOURCE/星星.png" "$DEST/" 2>/dev/null
cp "$SOURCE/背景图.png" "$DEST/" 2>/dev/null
cp "$SOURCE/标题.png" "$DEST/" 2>/dev/null
cp "$SOURCE/大力神杯.png" "$DEST/" 2>/dev/null
cp "$SOURCE/庆祝.gif" "$DEST/" 2>/dev/null
cp "$SOURCE/logo.png" "$DEST/" 2>/dev/null
cp "$SOURCE/logo2.png" "$DEST/" 2>/dev/null

# 复制字体
mkdir -p "$DEST/fonts"
cp "$SOURCE/fonts"/*.ttf "$DEST/fonts/" 2>/dev/null

echo "Assets copied!"
du -sh "$DEST"
