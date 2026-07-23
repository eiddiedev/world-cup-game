# 剑指美加墨（World Cup Game）

《剑指美加墨》是一款面向 2026 世界杯主题的离线优先像素足球游戏。玩家从国家队候选池征召 23 人、排兵布阵，并通过场内教练决策、换人和战术调整影响一套持续运行的 11v11 2.5D Match Runtime。

项目不是一次性 Demo。完整产品目标包含四个主菜单入口：教练模式、球员模式、点球大战和设置；联网只用于火山引擎 AI 的解说、建议、复盘、球探与叙事增强，核心比赛在断网时必须完整可玩。

## 当前开发状态（2026-07-22）

- 已建立 10 支球队模板，每队 38 名候选球员，玩家征召 23 人；最终内容目标为 48 支球队、每队 35–40 人。
- 教练模式已接入 HappySeed 11v11 Runtime、人类像素纸娃娃 v4、白天像素世界杯球场、像素足球/球门/动态球网和 22 人业务 actor 映射。
- 正式比赛为约 3 分钟有效比赛时间，支持上下半场补时、淘汰赛加时赛和加时后点球大战。
- 53 个场内决策、171 个 outcome 使用 V3 显式导演脚本；另有 42 个赛前/中场/加时阶段更衣室决策。
- 比赛事件、比分、播报、VAR、音效和决策触发共用 Runtime 事件来源；换人支持 3 个窗口、最多 5 人；雨天使用像素雨和本地双层雨声音效。
- 独立点球大战已支持射门与守门交互、五轮和突然死亡。
- 球员模式目前只有菜单、存档和数据契约，直接操作层尚未完成，不能视为可交付玩法。
- 当前自动门禁：29 个测试文件、358 项有效测试。53 场景、126 个选择、400 条 outcome 分支和 171 个唯一结果已通过语义审计；自动通过仍不等于 53 场景逐项产品验收通过。

当前任务顺序和验收口径见 [TODO_2026-07-22.md](docs/TODO_2026-07-22.md)。完整路线图保存在开发机桌面的 `剑指美加墨复赛完整开发路线图_方案B.md`。

## 正式入口

| 入口 | 用途 | 发布属性 |
| --- | --- | --- |
| `index.html` | 完整 React 游戏流程 | 正式 |
| `happyseed-runtime.html` | 教练模式正式比赛 Runtime | 正式 |
| `happyseed-decision-review.html` | 53 个决策逐项验收 | 开发验收 |
| `happyseed-runtime-lab.html` | Runtime 技术实验室 | 开发工具 |

正式比赛通过 `src/services/happySeedMatchRuntime.js` 与 Runtime 通信。`public/match-runtime-min/scripts/match.rebuilt.js` 是第三方物理核心，不得直接修改；自有适配逻辑位于 `public/match-runtime-min/standalone-match.js` 和 `public/match-runtime-min/happyseed/`。

## 本地运行

要求 Node.js 20 或更高版本。

```bash
npm ci
npm run dev
```

Vite 默认会输出本地地址。正式比赛可直接打开：

```text
http://127.0.0.1:5173/happyseed-runtime.html?mode=coach
```

## 验证命令

```bash
npm test -- --run
npm run lint
npm run audit:human-slice
npm run audit:runtime-actors
npm run audit:match-equipment
npm run audit:stadium-slice
npm run audit:match-sfx
npm run audit:decision-scenes
npm run build
git diff --check
```

算法与触发分布可额外运行：

```bash
npm run balance:decisions
node scripts/decision-trigger-sim.mjs
node scripts/full-balance-sim.mjs --runs 4000 --seed 20260720
```

## 目录与资产约定

- `src/`：React 外壳、业务数据、正式比赛会话、决策与测试。
- `public/match-runtime-min/`：第三方 Runtime 与 HappySeed 适配层。
- `public/assets/`：界面、球队头像、比赛事件、点球和音频资产。
- `public/pixel/`：当前生产像素资源，只保留纸娃娃 v4、装备 v6 和白天球场 v1。
- `docs/architecture/`：运行时、事件源、名单、决策导演等权威合同。
- `docs/balance/2026-07-20-algorithm-optimization-report.md`：现有算法平衡基线；后续调参前先与用户确认口径。
- `scripts/`：资源生成、审计、包体构建与平衡模拟。

历史资源和过期进度文档不常驻当前树；需要追溯时使用 Git 历史，不要复制回生产目录。

## 包体策略

完整开发版和抖音互动空间候选包分开管理：

- 完整版允许保留高质量球队、球员、比赛和点球资产，目标约 80–120MB，可在内容扩展后上浮到 100–200MB。
- 抖音候选包只在功能冻结后生成，通过减少可玩球队、字体子集和资源压缩缩小体积，不反向牺牲完整版本质量。
- `dist/`、`dist-douyin/`、`deliverables/` 和 `node_modules/` 都是本地可再生成内容，不提交 Git。

2026-07-22 清理后的本地基线：

- `public/` 原始运行资源：`76,706,772 bytes`（73.15MiB）。
- `npm run build` 完整构建：`77,785,979 bytes`（74.18MiB）。
- 本轮从 `public/` 删除 `3,333,228 bytes`（3.18MiB）的退役资源。
- 未重新生成抖音候选包；现有被忽略的 `dist-douyin/` 与 `deliverables/` 属旧构建，不能代表当前提交。

不要用包含约 589MB 本地依赖和 187MB Git 历史的工作目录大小代表产品包。

本轮只清理当前 Git 树，没有重写共享仓库历史；因此新提交会变干净，但已有 clone 的 `.git` 不会立即缩小。若未来要压缩 Git 历史，必须单独安排带备份的迁移，不能在日常开发中强推改写。

## 必须保持的约束

- AI 和网络不参与触发、足球运动、比分结算或事实播报，所有 AI 功能必须有本地 fallback。
- 不做 WebSocket、实时 PVP、实时联网点球或必须联网才能运行的核心玩法。
- 三种玩法最终必须复用同一套 11v11 Runtime、角色、球场、球衣、足球物理、球门、球网和相机。
- 稀有事件宁可不出现，也不能为了凑次数传送球员或伪造与画面无关的播报。
