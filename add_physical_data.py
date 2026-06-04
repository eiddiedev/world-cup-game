#!/usr/bin/env python3
"""
给所有球员添加身高体重数据
基于位置生成合理的身高体重
"""
import os
import re
import random

# 身高体重范围（基于位置）
PHYSICAL_RANGES = {
    'GK': {'height': (185, 196), 'weight': (80, 92)},
    'DF': {'height': (180, 192), 'weight': (75, 88)},
    'MF': {'height': (174, 186), 'weight': (68, 80)},
    'FW': {'height': (174, 188), 'weight': (70, 82)},
}

# 球星特殊身高体重（可选）
STAR_PLAYER_PHYSICAL = {
    '法国超跑': {'height': '182cm', 'weight': '75kg'},  # Mbappé
    '桑巴舞者': {'height': '175cm', 'weight': '72kg'},  # Neymar
    '当世球王': {'height': '170cm', 'weight': '72kg'},  # Messi
    '罗总裁': {'height': '187cm', 'weight': '84kg'},    # Ronaldo
}

def generate_physical(position, name):
    """根据位置和名字生成身高体重"""
    # 检查是否是球星
    if name in STAR_PLAYER_PHYSICAL:
        return STAR_PLAYER_PHYSICAL[name]

    ranges = PHYSICAL_RANGES.get(position, PHYSICAL_RANGES['MF'])

    # 使用名字的hash作为种子，保证同一球员每次生成相同
    seed = hash(name) % 10000
    random.seed(seed)

    height = random.randint(ranges['height'][0], ranges['height'][1])
    weight = random.randint(ranges['weight'][0], ranges['weight'][1])

    return {'height': f'{height}cm', 'weight': f'{weight}kg'}

def process_player_file(filepath):
    """处理单个球员文件，添加身高体重"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 检查是否已有身高体重
    if 'height:' in content:
        print(f"  Already has physical data: {filepath}")
        return False

    # 找到所有球员块
    # 匹配模式: { id: 'xxx', name: 'xxx', position: 'xxx', ...
    player_pattern = re.compile(
        r"(\{[^{}]*?id:\s*'([^']+)'[^{}]*?name:\s*'([^']+)'[^{}]*?position:\s*'([^']+)'[^{}]*?)(description:\s*'[^']*')",
        re.DOTALL
    )

    def add_physical(match):
        prefix = match.group(1)
        player_id = match.group(2)
        name = match.group(3)
        position = match.group(4)
        description = match.group(5)

        physical = generate_physical(position, name)

        # 在description之前添加height和weight
        new_content = prefix
        new_content += f"height: '{physical['height']}',\n    "
        new_content += f"weight: '{physical['weight']}',\n    "
        new_content += description

        return new_content

    new_content = player_pattern.sub(add_physical, content)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    return False

def main():
    players_dir = '/Users/a1234/my-game/src/data/players'

    for filename in os.listdir(players_dir):
        if filename.endswith('.js') and filename != 'index.js':
            filepath = os.path.join(players_dir, filename)
            print(f"Processing {filename}...")
            if process_player_file(filepath):
                print(f"  ✓ Added physical data")
            else:
                print(f"  - No changes needed")

if __name__ == '__main__':
    main()
