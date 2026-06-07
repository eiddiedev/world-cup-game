# 剑指美加墨 — World Cup Game

世界杯贴纸册 × GBA 足球棋盘 × 开罗游戏式轻策略。玩家选择国家队，用有限预算招募球员、排兵布阵，并在关键时刻做出进攻、防守、任意球、点球、换人等决策，带队冲击 2026 美加墨世界杯冠军。

## 当前内容

- 10 支可选国家队与 24 人名单预算招募
- 金卡球星、像素头像、国旗、属性图标与球场资产
- 11 人首发、替补席、10 种阵型与状态校验
- 小组赛、淘汰赛、点球大战与赛后结算闭环
- FC 式俯视球场表现：22 枚号码棋子持续跑位，播报、球路、决策动画同步
- 红黄牌、伤停、换人、扑救、进球、任意球与点球事件
- 像素风 UI、全局音效、背景音乐、震动与设置开关

## 本地运行

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址即可游玩。

## 验证命令

```bash
npm test -- --run
npm run lint
npm run build
npm run build:demo
npm run balance -- --teams france,curacao --runs 100 --strategy balanced
```

## 抖音互动空间 Demo

`npm run build:demo` 会生成法国与库拉索可玩的横屏多文件 Demo：

- `dist-douyin/`：使用相对路径的提交目录
- `deliverables/剑指美加墨-抖音互动空间-Demo.zip`：可交付 ZIP

构建会保留完整比赛流程和两队原始球员图片，对中文像素字体做字符子集，并在未压缩目录或 ZIP 超过 `8,000,000` bytes 时直接失败。脚本依赖 Python 的 `fontTools` 与 `Pillow`。

## 目录说明

- `src/`：React/Vite 游戏源码
- `public/assets/`：运行时像素资产与策划文档
- `docs/`：测试、平衡性与协作说明
- `scripts/`：文档同步与模拟辅助脚本

旧原型、重复源码、一次性迁移脚本和未使用资源已经清理；当前可运行版本以 `src/` 和 `public/assets/` 为准。
