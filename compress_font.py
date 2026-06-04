#!/usr/bin/env python3
"""
压缩字体文件：只保留游戏中使用的字符
"""
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
import os

# 游戏中使用的字符集合
GAME_CHARS = set()

# 基本ASCII
GAME_CHARS.update(range(0x20, 0x7F))

# 常用中文字符（游戏界面用到的）
CHINESE_CHARS = """
剑指美加墨世界杯赛程排兵布阵球员招募选择国家队
确认阵容开始比赛继续暂停结束查看结算返回首页
小组赛淘汰赛决赛强积分小组第名出线未能晋级
恭喜胜利平局负场替补席门将后卫中场前锋
速度身体技术防守体能状态关键时刻星级金币
预算已购出售购买价格阵容总评还需选择
比赛事件关键时刻战术突破射门组织长传
进球红牌黄牌犯规角球任意球点球大战
胜利失败平局晋级淘汰冠军亚军季军
属性面板信息身高体重国籍位置号码
拖拽上阵位置不匹配确定安排取消
弱中强提示警告错误加载中
一 二 三 四 五 六 七 八 九 十
"""

for char in CHINESE_CHARS:
    if char.strip():
        GAME_CHARS.add(ord(char))

# 数字和常用标点
for char in '0123456789.,!?;:()[]{}+-*/=%@#$&\'"':
    GAME_CHARS.add(ord(char))

# 星星符号
for char in '★☆⚽🏆🎉😔✅🟡🔴':
    GAME_CHARS.add(ord(char))

def subset_font(input_path, output_path, chars):
    """子集化字体"""
    font = TTFont(input_path)

    options = Options()
    options.flavor = 'woff2'
    options.desubroutinize = True

    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=chars)
    subsetter.subset(font)

    font.save(output_path)

    # 检查文件大小
    original_size = os.path.getsize(input_path)
    new_size = os.path.getsize(output_path)
    print(f"Original: {original_size / 1024 / 1024:.2f} MB")
    print(f"Subset:   {new_size / 1024 / 1024:.2f} MB")
    print(f"Reduction: {(1 - new_size / original_size) * 100:.1f}%")

if __name__ == '__main__':
    input_font = '/Users/a1234/my-game/assets/fonts/zpix.ttf'
    output_font = '/Users/a1234/my-game/public/assets/fonts/zpix.woff2'

    os.makedirs(os.path.dirname(output_font), exist_ok=True)
    subset_font(input_font, output_font, GAME_CHARS)
