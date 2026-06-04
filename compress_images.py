#!/usr/bin/env python3
"""
压缩游戏图片：降低质量减小文件大小
"""
from PIL import Image
import os
import glob

def compress_image(input_path, output_path, max_size=128):
    """压缩图片到指定最大尺寸"""
    try:
        img = Image.open(input_path)

        # 如果图片大于最大尺寸，缩小
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        # 保存为压缩的PNG
        img.save(output_path, 'PNG', optimize=True)
        return True
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return False

def compress_folder(folder_path, max_size=128):
    """压缩文件夹中的所有PNG图片"""
    png_files = glob.glob(os.path.join(folder_path, '*.png'))

    for png_file in png_files:
        filename = os.path.basename(png_file)
        output_path = png_file  # 直接覆盖原文件

        original_size = os.path.getsize(png_file)
        compress_image(png_file, output_path, max_size)
        new_size = os.path.getsize(output_path)

        if new_size < original_size:
            print(f"  {filename}: {original_size//1024}KB -> {new_size//1024}KB")

def main():
    assets_dir = '/Users/a1234/my-game/public/assets'

    # 压缩球员头像（64x64足够）
    for team in ['法国', '巴西', '阿根廷', '葡萄牙', '德国', '日本', '挪威', '摩洛哥', '新西兰', '库拉索']:
        team_dir = os.path.join(assets_dir, team)
        if os.path.exists(team_dir):
            print(f"Compressing {team}...")
            compress_folder(team_dir, max_size=64)

    # 压缩国旗（32x32）
    flags_dir = os.path.join(assets_dir, '国旗')
    if os.path.exists(flags_dir):
        print("Compressing flags...")
        compress_folder(flags_dir, max_size=32)

    # 压缩属性图标（24x24）
    attrs_dir = os.path.join(assets_dir, '属性')
    if os.path.exists(attrs_dir):
        print("Compressing attributes...")
        compress_folder(attrs_dir, max_size=24)

    # 检查最终大小
    total_size = 0
    for root, dirs, files in os.walk(assets_dir):
        for file in files:
            total_size += os.path.getsize(os.path.join(root, file))

    print(f"\nTotal assets size: {total_size / 1024 / 1024:.2f} MB")

if __name__ == '__main__':
    main()
