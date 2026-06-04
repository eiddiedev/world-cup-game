#!/usr/bin/env python3
"""
压缩大型游戏图片
"""
from PIL import Image
import os

def compress_large_image(input_path, output_path, max_width=800, quality=85):
    """压缩大型图片"""
    try:
        img = Image.open(input_path)

        # 如果宽度超过最大值，按比例缩小
        if img.width > max_width:
            ratio = max_width / img.width
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        # 保存为压缩的PNG
        img.save(output_path, 'PNG', optimize=True)

        original_size = os.path.getsize(input_path)
        new_size = os.path.getsize(output_path)
        print(f"  {os.path.basename(input_path)}: {original_size//1024}KB -> {new_size//1024}KB")
        return True
    except Exception as e:
        print(f"Error processing {input_path}: {e}")
        return False

def main():
    assets_dir = '/Users/a1234/my-game/public/assets'

    # 压缩大型图片
    large_images = [
        ('背景图.png', 800),
        ('足球场.png', 600),
        ('标题.png', 600),
        ('logo.png', 400),
        ('logo2.png', 400),
        ('庆祝.gif', 400),
        ('大力神杯.png', 300),
        ('星星.png', 200),
        ('金币.png', 200),
        ('足球.png', 200),
    ]

    for filename, max_width in large_images:
        input_path = os.path.join(assets_dir, filename)
        if os.path.exists(input_path):
            print(f"Compressing {filename}...")
            compress_large_image(input_path, input_path, max_width)

    # 检查最终大小
    total_size = 0
    for root, dirs, files in os.walk(assets_dir):
        for file in files:
            total_size += os.path.getsize(os.path.join(root, file))

    print(f"\nTotal assets size: {total_size / 1024 / 1024:.2f} MB")

if __name__ == '__main__':
    main()
