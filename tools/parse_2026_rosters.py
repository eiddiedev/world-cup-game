from __future__ import annotations

import re
import sys
import urllib.request
from collections import Counter

from lxml import html


URL = "https://zh.wikipedia.org/zh-cn/2026%E5%B9%B4%E5%9C%8B%E9%9A%9B%E8%B6%B3%E5%8D%94%E4%B8%96%E7%95%8C%E7%9B%83%E5%8F%83%E8%B3%BD%E7%90%83%E5%93%A1%E5%90%8D%E5%96%AE"

TEAMS = [
    "西班牙", "阿根廷", "法国", "英格兰", "巴西", "葡萄牙", "德国", "日本",
    "摩洛哥", "挪威", "哥伦比亚", "美国", "加拿大", "墨西哥", "佛得角", "库拉索",
]


def clean(text: str) -> str:
    text = re.sub(r"\[[^\]]+\]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def parse() -> dict[str, list[dict[str, str]]]:
    request = urllib.request.Request(URL, headers={"User-Agent": "HappySeed roster planning/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        tree = html.fromstring(response.read())
    result: dict[str, list[dict[str, str]]] = {}
    for team in TEAMS:
        heading = None
        for candidate in tree.xpath("//h3"):
            if clean("".join(candidate.itertext())).startswith(team):
                heading = candidate
                break
        if heading is None:
            raise RuntimeError(f"Missing team heading: {team}")
        table = heading.xpath("following::table[1]")[0]
        players = []
        for row in table.xpath(".//tr"):
            cells = [clean("".join(cell.itertext())) for cell in row.xpath("./th|./td")]
            if len(cells) < 4 or not cells[0].isdigit():
                continue
            name = re.sub(r"\s*\([^)]*(?:队长|captain)[^)]*\)\s*", "", cells[2], flags=re.I)
            players.append({"number": cells[0], "position": cells[1], "name": clean(name), "cells": cells})
        result[team] = players
    return result


if __name__ == "__main__":
    rosters = parse()
    for team, players in rosters.items():
        print(f"{team}\t{len(players)}\t{Counter(player['position'] for player in players)}")
        if "--names" in sys.argv:
            for player in players:
                print(f"  {player['number']:>2} {player['position']} {player['name']}")
