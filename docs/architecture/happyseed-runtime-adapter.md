# HappySeed 比赛运行时隔离接入

## 目的

`happyseed-runtime.html` 是独立的技术验证入口，用来确认导出的比赛运行时能否承担后续 11v11 比赛表现层。它不会替换现有 `MatchScreen`、比赛判定、教练决策或存档流程。

## 边界

- `public/match-runtime-min/scripts/match.rebuilt.js`：不改动的第三方物理与渲染核心。
- `public/match-runtime-min/standalone-match.js`：独立启动壳；仅把导出包写死的 7v7 / 2-3-1 解锁为 11v11 / 4-3-3，并保留触控与事件桥接。
- `public/match-runtime-min/data/`：第三方运行时所需数据与素材，不在其中写业务逻辑。
- `src/services/happySeedMatchRuntime.js`：唯一适配层，负责启动、暂停、倍速、镜头、触控输入、事件订阅与定位球注入。
- `src/components/HappySeedRuntimeLab.jsx`：只用于人工验收适配能力。
- `happyseed-runtime.html`：独立 Vite 入口，避免运行时全局 CSS、`window.require` 和 Pixi 状态污染主游戏。

## 已验证接口

- 11v11 启动：`bootHappySeedMatch()`
- 比赛快照：`getSnapshot()`
- 暂停与继续：`pauseMatch()` / `resumeMatch()`
- 0.5x-3x 时间倍率：`setSpeed()`
- 玩家输入：`updatePlayerInput()`
- 镜头缩放：`setZoom()`
- 原生角球状态：`injectCorner()`
- 比赛事件：`subscribeToMatchEvents()`
- 人类角色切片状态：`getHumanSliceSnapshot()`
- 人类角色配方：`setHumanSliceProfile()`
- 人类角色动作：`setHumanSliceAction()`
- 人物朝向与巡检：`setHumanSliceFacing()` / `setHumanSliceAutoCycle()`
- 球场场景快照：`getStadiumSceneSnapshot()`
- 六种场景镜头：`setStadiumCameraPreset()`
- 观众动态开关：`setStadiumCrowdMotion()`
- 22 人角色快照：`getRuntimeActorSnapshot()`
- 精确角色选择与状态：`selectRuntimeActor()` / `setRuntimeActorState()`
- 精确换人：`substituteRuntimeActor()`
- 比赛事件快照：`getMatchVisualEventSnapshot()`
- 单个与五事件串行播放：`playMatchVisualEvent()` / `playRepresentativeMatchVisualEvents()`
- 比赛事件重置：`resetRepresentativeMatchVisualEvents()`

## 阶段 2 人类骨架切片

- `src/utils/happySeedHumanPlayer.js` 是骨骼、slot、纹理尺寸、动作映射和 recipe 的单一合同。
- `scripts/generate-human-runtime-slice.mjs` 以确定性 PNG 生成器输出三套样板，避免手工导出导致画布漂移。
- `scripts/audit-human-runtime-slice.mjs` 对照原 `player.json` 校验 `17` 骨骼、`32` 插槽、Spine `2.1.27`、动作名、PNG 尺寸、recipe 与资源字节数。
- 独立实验页通过 `window.__happySeedHumanSlice` 暴露 profile/action/facing/auto-cycle 验收控制；这只是适配壳的调试接口，不是正式玩法层 API。
- 旧 Pixi 在同一实验壳额外创建多个 `PlayerRenderer` 会产生 RenderTexture 黑块，因此切片只维护一个共享预览骨架并切换 recipe。正式比赛的 22 个既有 actor 不受影响。
- 本阶段未修改 `public/match-runtime-min/scripts/match.rebuilt.js`，也未把实验 UI 接入正式 `MatchScreen`。

## 阶段 3 像素球场场景切片

- `src/utils/happySeedPixelStadium.js` 是场景尺寸、球场投影、八层结构、六镜头、资源路径和摆放数据的单一合同。
- `scripts/generate-pixel-stadium-slice.mjs` 确定性生成球场基底、四帧观众图集、观众 mask、广告带、球门图集、场边人员和前景护栏。
- `scripts/audit-pixel-stadium-slice.mjs` 校验 8 个场景文件、PNG 尺寸、层级、镜头和物理保留项。
- 独立实验页通过 `window.__happySeedStadiumScene` 暴露镜头与观众开关；正式调用继续收口在 `src/services/happySeedMatchRuntime.js`。
- 启动壳在原观众烘焙结束窗口内有限次重绘新基底，以清除旧动物观众，同时保留原动态球网与球门碰撞。
- 完整层级与后续边界见 `docs/architecture/happyseed-pixel-stadium-scene.md`。

## 阶段 4 Runtime actor 映射

- `src/utils/happySeedRuntimeActors.js` 是 23 人征召、11 人首发、22 个固定 actor 槽位、视觉 binding、状态和换人约束的单一合同。
- 启动壳直接改造 Runtime 已有的 22 个 `PlayerRenderer`；不为正式比赛创建额外物理球员。
- 红牌与停赛调用原 Runtime `removePlayer`；换人复用原槽位并替换业务身份、号码和纹理，不改比分。
- `scripts/generate-runtime-actor-assets.mjs` 与 `scripts/audit-runtime-actor-assets.mjs` 提供 10 队四类球衣和 1-99 号码的确定性资源门禁。
- `window.__happySeedRuntimeActors` 只作为独立验收桥；正式调用继续收口在 `src/services/happySeedMatchRuntime.js`。
- 完整字段、在场资格和阶段 5 消费边界见 `docs/architecture/happyseed-runtime-actor-mapping.md`。

## 阶段 5 MatchVisualEvent 事件桥

- `src/utils/matchVisualEvent.js` 是五个代表事件、业务与 Runtime actor 引用、连续球路、权威结果、播报和完成顺序的单一合同。
- `src/services/happySeedMatchRuntime.js` 在启动时注入事件配置，并以完成 Promise 串行驱动独立 Runtime；正式 React 层不直接调用全局桥。
- 启动壳只高亮既有 actor、绘制连续球路、切换镜头并发出开始/完成事件；只有角球复用原生 Corner 状态，事件桥不写 Runtime 比分。
- `CoachDecisionEvent` 通过显式适配器复用原 `keyPlayers`，不重新随机选择事件参与者。
- 完整字段、权威边界和阶段关闭门槛见 `docs/architecture/match-visual-event-v1.md`。

## 阶段 6 正式转播页面

- `happyseed-runtime.html` 默认渲染 `HappySeedMatchBroadcast`；阶段 2-5 实验室迁到 `?lab=1`。
- `src/utils/matchBroadcast.js` 是权威比分/统计、事件播报和换人候选的纯数据投影层。
- 正式页面只在 Runtime 完成事件后结算权威状态；播放中显示前奏，完成后显示结果。
- 精简统计与换人抽屉互斥，移动端按两步选择换人；省电模式关闭观众动态和叠层动画。
- 完整布局、数据与关闭门槛见 `docs/architecture/happyseed-formal-match-broadcast.md`。

## 后续迁移原则

只有在本页通过连续运行、球员控制、定位球和移动端性能验收后，才把适配器接到正式比赛页。正式接入时，现有赛果和决策系统仍是权威数据源，第三方运行时只消费比赛脚本并负责画面表现。

第三方运行时的授权、署名和可再分发范围需要在正式发布前单独复核。
