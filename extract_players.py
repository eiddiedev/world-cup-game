#!/usr/bin/env python3
"""
从策划书docx提取球员数据
格式：每行一个字段
  名称 → 位置 → 速度 → 身体 → 技术 → 防守 → 体能 → 关键时刻 → 描述
"""
import zipfile
import xml.etree.ElementTree as ET
import os

docx_path = '/Users/a1234/Desktop/资产/剑指美加墨_完整游戏策划书_最终命名版.docx'
output_dir = '/Users/a1234/my-game/src/data/players'

team_mapping = {
    '法国': 'france', '巴西': 'brazil', '阿根廷': 'argentina',
    '葡萄牙': 'portugal', '德国': 'germany', '日本': 'japan',
    '挪威': 'norway', '摩洛哥': 'morocco', '新西兰': 'newzealand',
    '库拉索': 'curacao',
}

golden_players = {
    '法国超跑', '桑巴舞者', '当世球王', '边路游龙', '战车门卫',
    '蓝武锋魂', '北欧魔人', '北非之狐', '全白重炮', '蓝浪飞翼',
}

# 重命名含有数字的球员名称
name_replacements = {
    '创意十号': '创意中场',
}

positions = {'GK', 'FW', 'MF', 'DF'}

def parse_star(s):
    return s.count('★')

def is_number(s):
    try:
        int(s)
        return True
    except ValueError:
        return False

def extract_text():
    with zipfile.ZipFile(docx_path) as z:
        with z.open('word/document.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            return [
                ''.join(t.text for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text)
                for p in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p')
                if any(t.text for t in p.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'))
            ]

def parse_prices(lines):
    """第一遍：解析价格表"""
    prices = {}
    current_team_id = None
    mode = None
    price_state = 'idle'
    price_name = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        matched_team = False
        for team_name, team_id in team_mapping.items():
            if line.startswith(team_name) and '预算' in line:
                current_team_id = team_id
                mode = None
                price_state = 'idle'
                matched_team = True
                break
        if matched_team:
            continue

        if '▶ 价格参考表' in line:
            mode = 'price'
            price_state = 'idle'
            continue
        if '▶ 属性数值表' in line:
            mode = None
            continue
        if line.startswith('▶') or line.startswith('九、') or line.startswith('十、'):
            mode = None

        if not current_team_id or mode != 'price':
            continue

        if line in ['球员名称', '位置', '价格(分)', '关键时刻', '描述']:
            continue
        if line in positions:
            price_state = 'waiting_price'
        elif price_state == 'idle':
            price_name = line
            price_state = 'waiting_position'
        elif price_state == 'waiting_position' and line in positions:
            price_state = 'waiting_price'
        elif price_state == 'waiting_price' and is_number(line):
            if current_team_id not in prices:
                prices[current_team_id] = {}
            prices[current_team_id][price_name] = int(line)
            price_state = 'waiting_star'
        elif price_state == 'waiting_star' and '★' in line:
            price_state = 'waiting_desc'
        elif price_state == 'waiting_desc':
            price_state = 'idle'

    return prices


def parse_all_players(lines):
    # 第一遍：先解析价格
    prices = parse_prices(lines)

    all_teams = {}
    current_team_id = None
    mode = None

    # 状态机状态
    state = 'idle'
    current_name = None
    current_position = None
    stats = []
    current_star = ''
    current_desc = ''

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 检测球队
        matched_team = False
        for team_name, team_id in team_mapping.items():
            if line.startswith(team_name) and '预算' in line:
                current_team_id = team_id
                if current_team_id not in all_teams:
                    all_teams[current_team_id] = {'name': team_name, 'players': []}
                mode = None
                state = 'idle'
                matched_team = True
                break
        if matched_team:
            continue

        # 检测模式切换
        if '▶ 属性数值表' in line:
            mode = 'attr'
            state = 'idle'
            continue
        if '▶ 价格参考表' in line:
            mode = 'price'
            price_state = 'idle'
            continue
        if line.startswith('▶') or line.startswith('九、') or line.startswith('十、'):
            # 保存最后的球员
            if mode == 'attr' and state == 'waiting_desc' and current_name and current_position and len(stats) >= 5:
                try:
                    save_player(all_teams, current_team_id, current_name, current_position, stats, prices.get(current_team_id, {}))
                except:
                    pass
            mode = None
            state = 'idle'

        if not current_team_id or not mode:
            continue

        # 跳过表头
        if line in ['球员名称', '位置', '速度', '身体', '技术', '防守', '体能', '关键时刻', '描述', '价格(分)']:
            continue

        # 属性表解析
        if mode == 'attr':
            if line in positions:
                # 遇到位置，说明上一个球员已结束（如果有的话），开始新球员
                if state == 'waiting_desc' and current_name and current_position and len(stats) >= 5:
                    try:
                        save_player(all_teams, current_team_id, current_name, current_position, stats, prices.get(current_team_id, {}))
                    except:
                        pass

                current_position = line
                stats = []
                state = 'waiting_stats'
            elif state == 'waiting_stats' and is_number(line):
                stats.append(int(line))
                if len(stats) == 5:
                    state = 'waiting_star'
            elif state == 'waiting_star' and '★' in line:
                state = 'waiting_desc'
                # 保存当前球员信息
                current_star = line
                current_desc = ''
            elif state == 'waiting_desc':
                # 这是描述
                current_desc = line
                # 现在保存球员
                try:
                    import random
                    status_for = random.randint(60, 100)
                    original_name = current_name
                    display_name = name_replacements.get(current_name, current_name)
                    is_golden = original_name in golden_players
                    number = get_player_number(current_team_id, original_name, current_position, is_golden)
                    rating = calculate_rating(stats[0], stats[1], stats[2], stats[3], stats[4], current_position)
                    player = {
                        'id': f"{current_team_id}_{original_name}",
                        'name': display_name,
                        'position': current_position,
                        'number': number,
                        'rating': rating,
                        'spd': stats[0],
                        'phy': stats[1],
                        'tec': stats[2],
                        'def': stats[3],
                        'sta': stats[4],
                        'star': parse_star(current_star),
                        'form': status_for,
                        'description': current_desc,
                        'isGolden': is_golden,
                        'price': prices.get(current_team_id, {}).get(original_name, 0),
                        'avatar': get_avatar_path(all_teams[current_team_id]["name"], original_name, current_position, is_golden),
                    }
                    all_teams[current_team_id]['players'].append(player)
                except:
                    pass
                state = 'idle'
                current_name = None
            elif state == 'idle' or state == 'waiting_desc':
                # 这是球员名称
                current_name = line
                state = 'waiting_position'

    # 保存最后一个球员
    if mode == 'attr' and current_name and current_position and len(stats) >= 5 and current_team_id:
        try:
            save_player(all_teams, current_team_id, current_name, current_position, stats, prices.get(current_team_id, {}))
        except:
            pass

    # 合并价格
    for team_id, team_data in all_teams.items():
        if team_id in prices:
            for player in team_data['players']:
                if player['name'] in prices[team_id]:
                    player['price'] = prices[team_id][player['name']]

    return all_teams

def get_avatar_path(team_id, name, position, is_golden, team_name):
    """根据球员信息生成正确的头像路径"""
    # 金卡球星使用单独命名的文件
    if is_golden:
        return f'/assets/{team_name}/{name}.png'

    # 门将使用 gk.png 或 gk2.png
    if position == 'GK':
        return f'/assets/{team_name}/gk.png'

    # 其他球员使用 slice_XX.png（简化处理，使用占位）
    return f'/assets/{team_name}/slice_02.png'

# 每个队的切片素材列表（按顺序分配给非GK非金卡球员）
team_slices = {
    '法国': ['slice_02', 'slice_03', 'slice_04', 'slice_05', 'slice_08', 'slice_14', 'slice_15', 'slice_16', 'slice_17', 'slice_20', 'slice_21', 'slice_22', 'slice_23'],
    '巴西': ['slice_02', 'slice_03', 'slice_04', 'slice_05', 'slice_08', 'slice_09', 'slice_11', 'slice_14', 'slice_15', 'slice_16', 'slice_17', 'slice_22', 'slice_23'],
    '阿根廷': ['slice_02', 'slice_04', 'slice_05', 'slice_06', 'slice_09', 'slice_10', 'slice_11', 'slice_12', 'slice_13', 'slice_16', 'slice_17', 'slice_18', 'slice_19', 'slice_20', 'slice_24', 'slice_25', 'slice_26'],
    '葡萄牙': ['slice_03', 'slice_04', 'slice_05', 'slice_08', 'slice_09', 'slice_10', 'slice_11', 'slice_14', 'slice_15', 'slice_16', 'slice_17', 'slice_20', 'slice_21'],
    '德国': ['slice_02', 'slice_03', 'slice_04', 'slice_05', 'slice_08', 'slice_09', 'slice_10', 'slice_11', 'slice_14', 'slice_15', 'slice_16', 'slice_17', 'slice_20', 'slice_21'],
    '日本': ['slice_02', 'slice_03', 'slice_04', 'slice_05', 'slice_08', 'slice_09', 'slice_10', 'slice_11', 'slice_16', 'slice_17', 'slice_20', 'slice_21', 'slice_23'],
    '挪威': ['slice_03', 'slice_04', 'slice_05', 'slice_08', 'slice_09', 'slice_10', 'slice_11', 'slice_14', 'slice_15', 'slice_16', 'slice_17', 'slice_20', 'slice_21'],
    '摩洛哥': ['slice_02', 'slice_03', 'slice_04', 'slice_05', 'slice_08', 'slice_09', 'slice_10', 'slice_11', 'slice_14', 'slice_16', 'slice_17', 'slice_20', 'slice_21'],
    '新西兰': ['slice_03', 'slice_04', 'slice_05', 'slice_08', 'slice_09', 'slice_10', 'slice_11', 'slice_14', 'slice_15', 'slice_16', 'slice_17', 'slice_20', 'slice_21'],
    '库拉索': ['slice_02', 'slice_03', 'slice_04', 'slice_05', 'slice_08', 'slice_09', 'slice_10', 'slice_11', 'slice_14', 'slice_15', 'slice_16', 'slice_17', 'slice_21'],
}

# 每个队已分配的切片索计数
slice_counters = {}

gk_counters = {}

def get_avatar_path(team_name, name, position, is_golden):
    """根据球员信息生成正确的头像路径"""
    if is_golden:
        return f'/assets/{team_name}/{name}.png'
    if position == 'GK':
        # 第一个门将用gk.png，第二个用gk2.png
        if team_name not in gk_counters:
            gk_counters[team_name] = 0
        gk_idx = gk_counters[team_name]
        gk_counters[team_name] += 1
        if gk_idx == 0:
            return f'/assets/{team_name}/gk.png'
        else:
            return f'/assets/{team_name}/gk2.png'
    # 分配不同的切片给不同球员
    if team_name not in slice_counters:
        slice_counters[team_name] = 0
    slices = team_slices.get(team_name, ['slice_02'])
    idx = slice_counters[team_name] % len(slices)
    slice_counters[team_name] += 1
    return f'/assets/{team_name}/{slices[idx]}.png'

# 金卡球星的标志性号码
golden_numbers = {
    '法国超跑': 10,    # Mbappé
    '桑巴舞者': 10,    # Neymar
    '当世球王': 10,    # Messi
    '边路游龙': 7,     # Ronaldo
    '战车门卫': 1,     # Neuer
    '蓝武锋魂': 14,    # Iniesta风格
    '北欧魔人': 9,     # Haaland
    '北非之狐': 7,     # Hakimi
    '全白重炮': 9,     # Wood
    '蓝浪飞翼': 11,    # 路易斯·苏亚雷斯
}

# 按位置分配号码的规则
position_number_pool = {
    'GK': [1, 12, 23],
    'DF': [2, 3, 4, 5, 13, 15, 16, 17, 18, 19, 20, 21, 22, 24, 25],
    'MF': [6, 7, 8, 14, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
    'FW': [9, 10, 11, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48],
}

# 每个队已使用的号码集合
used_numbers = {}

def get_player_number(team_id, name, position, is_golden):
    """分配球员号码 - 确保同队不重复"""
    if team_id not in used_numbers:
        used_numbers[team_id] = set()

    # 金卡球星使用标志性号码
    if is_golden and name in golden_numbers:
        num = golden_numbers[name]
        used_numbers[team_id].add(num)
        return num

    # 从位置号码池中选择未使用的号码
    pool = position_number_pool.get(position, [99])
    for num in pool:
        if num not in used_numbers[team_id]:
            used_numbers[team_id].add(num)
            return num

    # 如果位置池用完了，从大号开始
    for num in range(50, 100):
        if num not in used_numbers[team_id]:
            used_numbers[team_id].add(num)
            return num

    return 99

def calculate_rating(spd, phy, tec, def_val, sta, position):
    """按位置计算总评分 - 金卡约95分，普通球员70-85分"""
    if position == 'GK':
        base = def_val * 0.35 + phy * 0.2 + sta * 0.2 + tec * 0.15 + spd * 0.1
        return round(base * 1.05)
    elif position == 'DF':
        base = def_val * 0.35 + phy * 0.25 + sta * 0.15 + spd * 0.15 + tec * 0.1
        return round(base * 1.05)
    elif position == 'MF':
        base = tec * 0.35 + spd * 0.2 + sta * 0.2 + phy * 0.15 + def_val * 0.1
        return round(base * 1.05)
    else:  # FW
        base = spd * 0.4 + tec * 0.35 + phy * 0.15 + sta * 0.1
        return round(base * 1.08)

def save_player(all_teams, team_id, name, position, stats, prices):
    # 替换含有数字的名称
    original_name = name
    if name in name_replacements:
        name = name_replacements[name]

    is_golden = original_name in golden_players
    team_name = all_teams[team_id]["name"]
    import random
    status_for = random.randint(60, 100)
    number = get_player_number(team_id, original_name, position, is_golden)
    rating = calculate_rating(stats[0], stats[1], stats[2], stats[3], stats[4], position)
    player = {
        'id': f"{team_id}_{original_name}",
        'name': name,
        'position': position,
        'number': number,
        'rating': rating,
        'spd': stats[0],
        'phy': stats[1],
        'tec': stats[2],
        'def': stats[3],
        'sta': stats[4],
        'star': 0,
        'form': status_for,
        'description': '',
        'isGolden': is_golden,
        'price': prices.get(original_name, 0),
        'avatar': get_avatar_path(team_name, original_name, position, is_golden),
    }
    all_teams[team_id]['players'].append(player)

def generate_js_file(team_id, team_data):
    players = team_data['players']
    team_name = team_data['name']
    lines = [f'/**\n * {team_name}队球员数据\n * 自动生成自策划书，共{len(players)}名球员\n */']
    lines.append(f'export const {team_id}Players = [')

    for p in players:
        lines.append(f"  {{")
        lines.append(f"    id: '{p['id']}',")
        lines.append(f"    name: '{p['name']}',")
        lines.append(f"    position: '{p['position']}',")
        lines.append(f"    number: {p.get('number', 0)},")
        lines.append(f"    rating: {p.get('rating', 70)},")
        lines.append(f"    price: {p['price']},")
        lines.append(f"    spd: {p['spd']},")
        lines.append(f"    phy: {p['phy']},")
        lines.append(f"    tec: {p['tec']},")
        lines.append(f"    def: {p['def']},")
        lines.append(f"    sta: {p['sta']},")
        lines.append(f"    star: {p['star']},")
        lines.append(f"    form: {p.get('form', 80)},")
        lines.append(f"    description: '{p['description']}',")
        lines.append(f"    isGolden: {str(p['isGolden']).lower()},")
        lines.append(f"    avatar: '{p['avatar']}',")
        lines.append(f"  }},")

    lines.append(']')
    return '\n'.join(lines) + '\n'

def main():
    print("提取球员数据...")
    lines = extract_text()

    start_idx = next(i for i, l in enumerate(lines) if '八、' in l)
    all_teams = parse_all_players(lines[start_idx:])

    os.makedirs(output_dir, exist_ok=True)

    total = 0
    for team_id, team_data in all_teams.items():
        js = generate_js_file(team_id, team_data)
        path = os.path.join(output_dir, f'{team_id}.js')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(js)
        n = len(team_data['players'])
        total += n
        print(f"  {team_data['name']}: {n} 名球员")

    idx = '/**\n * 球员数据汇总\n */\n'
    for tid in all_teams:
        idx += f"import {{ {tid}Players }} from './{tid}.js'\n"
    idx += "\nexport const allPlayers = {\n"
    for tid in all_teams:
        idx += f"  {tid}: {tid}Players,\n"
    idx += "}\n"

    with open(os.path.join(output_dir, 'index.js'), 'w', encoding='utf-8') as f:
        f.write(idx)

    print(f"\n总计: {total} 名球员")

if __name__ == '__main__':
    main()
