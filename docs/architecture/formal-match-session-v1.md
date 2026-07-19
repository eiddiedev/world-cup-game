# FormalMatchSession V1：正式比赛单一权威链

日期：2026-07-14  
状态：已接入正式 `MatchScreen` 与独立验收入口。

## 目标

`FormalMatchSession` 取代旧 `MatchScreen` 自己维护的计时器、随机比分和独立播报。正式比赛现在只有一份分钟、比分、统计、播报、决策和赛后报告；HappySeed Runtime 提供连续 11v11 现场、原生足球事件和物理画面，业务层负责规则与存档。

## 权威边界

- `src/utils/formalMatchSession.js`：比赛分钟、比分、统计、播报、决策次数、非决策规则事件和终场报告的唯一业务权威。
- `src/services/happySeedMatchRuntime.js`：Runtime 适配层，捕获连续比赛瞬间并驱动 `DecisionSceneScriptV2`；不自行生成正式比分或存档结果。
- `src/utils/decisionSystem.js`：53 个决策的本地 outcome 与动态成功率权威。
- `src/components/HappySeedMatchBroadcast.jsx`：只投影 MatchSession 状态、收集用户选择并等待导演 settled；不独立计时或随机生成进球。
- `src/components/MatchScreen.jsx`：把终场报告写入 `currentRun.lastMatchResult`、比赛历史、球员状态和赛后页面。

第三方 `match.rebuilt.js` 不修改。原生 `ab-goal` 只在 Runtime 的球越过门线后进入 MatchSession；决策进球只在足球到达脚本终点并进入 `settled` 后进入 MatchSession。

## 比赛节奏

- 产品默认时长：2 个现实分钟，对应 90 个比赛分钟。
- 每场目标决策数：5。
- 目标窗口：10′、24′、39′、54′、66′。窗口不是强制摆拍点；到达窗口后必须等待当前球权和球场区域满足事件合同。
- 选择期间 Runtime 比赛时间冻结，但渲染、路线和自由镜头继续工作。
- 结算播报只能在 `settled` 写入，终点画面保持 1000ms 后恢复连续比赛。

## 53 个决策

`formalDecisionSceneCatalog.js` 显式登记全部 53 个 scenario，并把 171 个唯一 outcome 映射为明确视觉终点。每个选择都由 `DecisionSceneScriptV2` 写出参与者、现场站位、路线/区域/角色交互、动作 cue、终点和保持时长；不允许通过播报文字或正则猜动作。

危险任意球继续使用精细三路线脚本；其余 52 个事件沿同一 schema 使用当前 Runtime 球、持球者、接应者、门将和防守者生成场内选择，不搬运整队、不移动主罚者到预设坐标。

## 普通比赛播报

非决策事件与决策共用 MatchSession 时间线。当前支持：开球、推进、逼抢、对抗、拦截、普通犯规、越位、角球、门球、界外球和手抛球违例。手抛球违例等细节事件只写播报与统计，不打开教练决策。

原生进球事件携带最后射门者的 Runtime entity id；播报按实际加分的红/蓝方解析球员，禁止再用进球后的开球持球者猜射手。

## 平衡目标

- 强队决策层 300 场模拟、每场 5 次决策：法国/巴西对不同对手的决策进球均值约 2.58-2.77。
- 连续 Runtime 原生进球与决策进球共同组成最终比分。桌面整场验收样本为 3:1，落在文档的强队 3.0-4.2、对手 0.6-1.2 区间；单场仍允许合理波动。
- 弱队对强队的五决策成功率约 36.73%-38.53%，保持难度差异。

完整模拟结果见 `docs/balance/2026-07-14-decision-balance-report.md`。

## 恢复和幂等

- 决策 prepare 失败时取消导演、恢复 live、回退该决策槽位，下一次合法现场可重试。
- 同一选择只能锁定一次；超时执行稳健方案；同一 Runtime 进球和同一决策结算不可重复记分。
- 取消、异常和正常执行都必须恢复足球、比赛时间倍率和原相机。
- `ab-match-ended` 后释放启动 Promise；下一场正式比赛可在同一 SPA 会话中重新启动 Runtime，不复用旧终场状态。
- 淘汰赛 90′ 平局不会直接写赛后页；先打开既有本地点球大战，点球胜者合并进同一终场报告后再推进赛程。

## 开发验收参数

开发环境可用 `?scenario=id` 或 `?scenarios=id1,id2,...` 指定待验场景顺序，并用 `acceptanceOutcome` 直达合法 outcome。强制场景仍必须等待真实球权和区域满足合同，不写坐标、不进入生产存档。
