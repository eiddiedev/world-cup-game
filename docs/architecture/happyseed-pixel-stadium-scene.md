# HappySeed 像素球场场景合同

## 目的

`international-championship-day-v1` 是正式 Runtime 当前使用的 11v11 像素国际赛事场景。它只替换比赛表现层，不改变第三方 Runtime 的世界坐标、球门碰撞、动态球网、足球物理、相机实现或深度排序。旧夜间场景已在 2026-07-19 清理中退役，源码不再保留；如需追溯可从 Git 历史恢复。

场景视觉基准是明亮白天国际赛事看台、清晰条纹草坪和人类像素观众。人物仍是画面的第一识别层；观众与场边环境只建立赛事氛围，不与球员争夺注意力。

## 尺寸与尺度

- 源图：`4096 x 2048`。
- Runtime 画布：`5120 x 2560`，缩放倍率 `1.25`。
- 球场投影：`x=810, y=764, width=3500, height=1321`。
- 人物参考：阶段 2 锁定的 `123.69 x 202.3` 骨架边界与 `root-footline` 脚底锚点。

单一合同位于 `src/utils/happySeedPixelStadium.js`。生成后的 `scene.json` 与浏览器启动时注入 Runtime 的内存合同都包含相同的 `composition` 数据，避免球门、广告带和工作人员位置出现双份配置。

## 正式层级结构

| 顺序 | 层 | Runtime 容器 | 说明 |
| ---: | --- | --- | --- |
| 1 | master-background | base | 一张不透明主背景，包含草坪、白线、看台和人类观众 |
| 2 | goal-back | bottom | 复用原 Runtime 球门位置和后框层级 |
| 3 | actors-and-ball | middle | 球员、门将与足球按 Runtime 深度排序 |
| 4 | goal-front | middle | 原 Runtime 门柱前框 |
| 5 | net | runtime-net | 原 Runtime 动态球网，替换为当前像素皮肤 |

启动壳只加载一张不透明球场背景，不再叠加旧球场遮罩。球门碰撞、足球物理和动态球网继续由原 Runtime 掌管，适配动作只发生在独立 Runtime 壳，不修改 `match.rebuilt.js`。

## 六种镜头

- `normal`：常规跟球镜头。
- `goal`：进球侧重点。
- `corner`：角球区域。
- `goal-kick`：门球区域。
- `touchline`：边线球区域。
- `penalty`：点球区域。

`window.__happySeedStadiumScene` 只作为独立验收页的调试桥，提供 `setCameraPreset()`、`setCrowdMotion()` 和 `getSnapshot()`。正式比赛页仍应通过 `src/services/happySeedMatchRuntime.js` 调用，不直接依赖 window 全局对象。

## 资源生产与校验

- `scripts/generate-pixel-stadium-slice.mjs`：从已校准的主背景生成 `scene.json` 与清单。
- `scripts/audit-pixel-stadium-slice.mjs`：校验图片尺寸、单背景、投影误差、镜头和物理保留项。
- `public/pixel/stadiums/international-championship-day-v1/manifest.json`：记录当前资源的逐文件体积。

观众已烘焙进主背景，不会随球队和球员数量线性增加资源体积。

## 后续边界

阶段 4 在此场景上建立 22 个业务球员到 Runtime actor 的一对一映射。本合同不负责业务球员 ID、红黄牌、体力、伤病、换人或比分权威；这些数据仍由玩法层管理。
