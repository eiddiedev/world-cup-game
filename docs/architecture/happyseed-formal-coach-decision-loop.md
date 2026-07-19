# HappySeed 正式教练限时决策闭环

## 目标与边界

阶段 7 在正式全屏比赛页中复用现有 `CoachDecisionEvent`、22 人业务 actor 和 `MatchVisualEvent`，形成一条本地可运行的教练决策状态机。第三方 Runtime 继续只负责连续比赛与表现，不写权威比分、统计、牌、伤病或换人。

首批顺序固定为：

1. 单刀
2. 角球
3. 危险任意球
4. 禁区犯规风险
5. 点球

这五次决策使用 18、31、44、63、78 分钟的业务时间标记，倒计时均限制在 3-6 秒。正式扩展到 50+ 场景时仍复用同一状态机，不为每个场景复制页面逻辑。

## 状态机

`HappySeedMatchBroadcast` 使用以下单向流程：

1. `continuous`：11v11 Runtime 正常连续运行。
2. `prelude`：生成纯表现前奏事件，锁定真实 actor、球路与镜头；比分和统计增量均为 0。
3. `choosing`：前奏 Promise 完成后暂停 Runtime，显示不遮满球场的决策条，并启动 3-6 秒倒计时。
4. `resolving`：玩家选择后立即关闭选项、恢复 Runtime，并生成唯一结果事件。
5. `cooldown`：结果动画 Promise 完成后才应用权威比分、统计与结果播报，短暂停留后回到连续比赛。
6. `complete`：五次闭环完成，比赛继续运行。

倒计时归零时，`findConservativeFormalCoachChoice()` 按风险词、成功率和原始顺序选择最低风险方案。超时与手动点击共用同一个 `decisionChoiceLockedRef`，同一决策最多结算一次。

## 前奏与结果分权

每个决策拆成两个唯一视觉事件：

- `coach.<scenario>.<n>.prelude`：只展示铺垫，`scoreDelta`、`statsDelta` 和 `opponentStatsDelta` 均为空或 0，不进入权威结算。
- `coach.<scenario>.<n>.<choice>.result`：携带选择、随机结果、真实播报、比分和统计增量；Runtime 完成 Promise resolve 后才进入 `applyMatchVisualEventAuthority()`。

这样可以保证玩家尚未选择时不会提前知道或结算结果，也不会让前奏和结果重复写分。

## 业务球员与本地结算

`buildFormalCoachDecision()` 从当前 Runtime actor 配置中筛选仍在场的 11 人，再回查球队数据取得评分、速度、技术、身体、防守、体力和球星等级。换人后的业务 `playerId` 会沿用原 Runtime 槽位进入下一次决策，已离场 actor 不会被重新选择。

成功率与结果继续调用本地 `executeDecision()`、`resolveChoiceResult()` 和 `resolveMatchPenaltyChoice()`。火山引擎 AI 未来只能增强建议和播报文字；断网时场景、倒计时、选择、结果、比分和统计必须完整可用。

## 正式入口与回归入口

- `happyseed-runtime.html`：默认运行阶段 7 教练决策闭环。
- `happyseed-runtime.html?events=auto`：保留阶段 6 的五个代表性 `MatchVisualEvent` 自动串行回归。
- `happyseed-runtime.html?events=manual`：不自动触发事件或决策，用于换人、统计和运行时人工验收。
- `happyseed-runtime.html?lab=1`：保留阶段 2-5 技术实验室。

## 阶段关闭证据

2026-07-13 已完成以下桌面、844×390 横屏和回归验收：

- 手动选择后必须出现结果动画和同一事件播报，权威比分/统计只增加一次。
- 至少一次决策必须自然超时，并自动执行最低风险选项。
- 选择阶段 Runtime 暂停；结果阶段恢复；五次决策之间重新回到连续比赛。
- 决策条与统计/换人抽屉互斥，PC 与 844×390 手机横屏均不遮满核心球场；横屏决策条与换人入口保留 8px 间距且页面无溢出。
- `?events=auto`、`?events=manual`、`?lab=1` 和四入口主菜单保持回归可用。
- 全量 135 项测试、lint、三套资源审计、105 模块 build、包体记录和零 console error 浏览器验收通过。
