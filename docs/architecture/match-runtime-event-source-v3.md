# Match Runtime 事件同源与决策导演 V3

日期：2026-07-14  
状态：正式 Runtime 合同

## 1. 权威链

正式比赛只允许一条事实链：

`第三方 Runtime 真实动作/位置 -> MatchRuntimeEventV1 -> 决策触发 / 播报 / MatchSfxBus`

- 第三方 `match.rebuilt.js` 继续负责 11v11、物理、球门碰撞、动态球网、AI 和相机基础能力，不修改其文件。
- `standalone-match.js` 只在适配层读取 Runtime 信号并发出统一事件。
- `FormalMatchSession` 负责比赛分钟、比分、统计、决策预算、完整播报历史和赛后报告。
- `DecisionSceneScriptV3` 负责场景表达与执行，但不能反推或改写本地结算结果。
- 网络与 AI 不进入触发、足球运动、结果结算、事实播报和音效链。

## 2. MatchRuntimeEventV1

原生事件：

- `touch`、`pass`、`shot`、`possession-change`
- `tackle-contact`、`save`、`post-hit`、`crossbar-hit`
- `corner`、`throw-in`、`goal-kick`、`kickoff`
- `goal`、`ball-out`、`period-change`

规则派生事件：

- `foul`、`offside`、`card`、`injury`
- `handball-review`、`var-review`、`var-result`、`throw-in-violation`、`penalty`

每条事件必须包含：

- 唯一 `id`、Runtime 帧号、原始 matchTime 与映射分钟；
- 球权方、主次参与者和参与者 ID；
- 足球前后位置、Runtime 前后状态；
- 派生事件的有效 `sourceEventId`。

派生规则只能从已接受的原生事件展开。例如犯规/伤病/黄牌候选来自真实 `tackle-contact`，手球审查来自真实 `shot`，每个真实 `goal` 依次产生带同一来源的 `var-review` 和明确 `var-result`，手抛球违例只能来自真实 `throw-in`。VAR 小概率以越位或进攻犯规判进球无效；点球场景不得使用越位理由。没有前置事件就不生成事实。

## 3. 自然决策触发

- 五个目标窗口为 `10/24/39/54/66` 分钟，窗口只控制频率。
- 场景必须同时满足当前球位、球权、阶段和 `sourceEvent` 合同；不满足就继续等待后续真实机会。
- 每次进入条件只掷一次概率，同一事件最多打开一个决策，场景单场去重。
- 稀有事件不会为了凑数传送球员。连续 Runtime 回放和 300 场本地触发模拟用于验证约 5 次的目标。

## 4. DecisionSceneScriptV3

53 个正式场景逐项登记，数量固定为：

| 导演方式 | 数量 | 行为 |
| --- | ---: | --- |
| `freeze-live` | 30 | 当前现场原地冻结，不移动 actor/球 |
| `blackout-stage` | 12 | 120ms 淡出，黑场重排，180ms 淡入 |
| `freeze-incident` | 8 | 冻结事故现场，突出人员、区域或裁判状态 |
| `freeze-match-state` | 3 | 自然死球/稳定控球段展示阵型与区域 |

六种场内表达固定为：

- `ball-path`
- `run-lane`
- `duel-vector`
- `zone`
- `actor`
- `formation`

所有几何来自当前足球、球员、门柱、边线和统一球场投影锚点。单刀近角/远角随进攻方向镜像；非足球选择不能生成球路；实时场景不能写入 staged actor 位置。

每个 choice 的足球事件语义也显式登记为 `pass` 或 `shot`。传中、短传、解围和门将出球不再因为“存在路径”而误报为射门。

171 个 outcome 全部有明确 terminal、路径/无路径、动作 cue、时长和 settled 播报 cue。正常完成从 outcome 终点继续；只有取消或异常恢复原始快照。

## 5. 状态机与冻结

`idle -> staging -> choosing -> executing -> settled -> restoring -> idle`

- 倒计时只在按钮可点击后开始，按全部可见文字计算并限制在 15–25 秒。
- 页面后台、设置暂停或转场未完成时不消耗倒计时。
- 点击后先锁定并高亮表达，150ms 后执行。
- 结果在动作/足球到达 terminal 后发布，终点保持 1000ms。
- 导演非 idle 时，适配层跳过第三方 AI simulation tick，但继续提交渲染帧和导演动画；这是真冻结，不依赖 `timeScale=0` 后仍运行 AI。

## 6. 同源播报

- 每条播报至少保留一个 `sourceEventId`；聚合事件同时保留 `sourceEventIds`。
- 射门、扑救、门柱、横梁、进球、判罚、VAR、伤病、死球和决策结果即时进入同一历史。
- 普通传球链、常规球权转换和非判罚接触共享单场 3 条的常规播报预算。
- 连续射门聚合为一条“连续 N 次攻门”，仍保存每次射门 ID。
- 进球/半场后的开球，以及射门出界后的门球，更新到同一事件链播报并保存后续事件 ID。
- 桌面显示最近 4 条，`844×390` 显示最近 3 条，历史报告保留全部聚合后的事实链。

## 7. MatchSfxBus

- `touch/pass/shot` 驱动触球音，80ms 去重；`save`、门柱、横梁和 `goal` 使用各自事件。
- 第一次用户交互解锁音频；设置中的音效开关仍是总控制。
- 正式包包含两个 CC0 低码率素材：触球 7,200 bytes，欢呼 35,952 bytes。
- 加载或播放失败时回退到本地 WebAudio 瞬态音，断网不影响比赛。
- `manifest-v1.json` 记录来源、许可证、SHA-256 和字节数；审计上限 400 KiB。

## 8. 服务接口

- `prepareFormalCoachDecision(decision)`
- `subscribeToRuntimeDecisionChoices(listener)`
- `executeFormalCoachDecisionChoice(decision, choiceId)`
- `getDecisionDirectorSnapshot()`
- `cancelFormalCoachDecision()`
- `subscribeToRuntimeMatchEvents(listener)`

正式内部桥为 `window.__happySeedDecisionDirectorV3`，只暴露 `prepare/execute/cancel/getSnapshot`。V2 桥只保留在技术实验室。
