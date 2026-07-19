# MatchVisualEvent V1：比赛逻辑与 Runtime 表现桥

## 目的

`MatchVisualEvent` 是权威玩法层、HappySeed Runtime、比赛统计与播报之间唯一共享的事件合同。阶段 5 先锁定常规进攻、单刀、角球、危险任意球、禁区犯规/点球五个代表事件，避免业务结果、场上人物和文字播报分别随机。

本合同只替换表现层，不把比赛判定交给第三方 Runtime，也不改变现有世界杯、决策、红黄牌、换人、停赛或存档权威边界。

## 单一事件结构

事件版本固定为 `match-visual-event-v1`，每个事件至少包含：

- `id`、`sequence`、`minute`、`type`、`label` 与来源决策场景。
- `actors.primary/support/defender/goalkeeper`：同时携带业务 `playerId` 和阶段 4 锁定的 `runtimeActorId`。
- `ball`：归一化球场坐标、连续样条路径、起点和目标 actor；禁止直接 snap 或瞬移。
- `runtime`：镜头、表现时长和可选原生定位球状态；标记为 `presentationOnly`。
- `outcome`：权威比分增量和统计增量。
- `commentary`：同一事件的铺垫与结果播报。
- `completion`：Runtime 必须发出 `ab-match-visual-event-completed`，队列收到完成信号后才可播放下一事件。
- `authority` 与 `invariants`：明确 Runtime 不可写比分、红黄牌、伤停或换人；禁止人物/足球瞬移、重复播放和联网依赖。

## 五个代表事件

| 类型 | 决策来源 | Runtime 表现 | 权威结果样板 |
| --- | --- | --- | --- |
| `regular_attack` | `penalty_area_cross` | 正常镜头、推进与接应球路 | 传球、射门、射正，比分不变 |
| `solo_run` | `solo_run_penalty` | 球门镜头、前锋到门将的连续球路 | 射门、射正、进球，红队 +1 |
| `corner` | `header_corner` | 角球镜头并进入原生 Corner 状态 | 角球、头球偏出，比分不变 |
| `dangerous_free_kick` | `freekick_dangerous` | 球门镜头、弧线任意球球路 | 任意球、射门、人墙封堵 |
| `penalty_area_foul` | `penalty_area_foul_risk` | 点球镜头、禁区内连续冲突球路 | 造犯规、点球、对方黄牌 |

只有角球使用第三方 Runtime 已验证的原生 `Corner` 重启状态。其余事件不把人物或足球强制改到决策坐标，只在真实 actor 上高亮参与者并沿事件路径绘制连续表现标记；后续人物动作和足球物理增强必须继续消费同一合同。

## 权威结算与串行队列

`applyMatchVisualEventAuthority()` 按事件 ID 幂等结算比分、统计和结果播报。相同事件重复调用不会产生第二次进球或统计。

`createMatchVisualEventQueue()` 的状态为 `idle -> queued -> playing -> completed/failed`：

1. 入队时过滤 active、queued 或 completed 的重复 ID。
2. 同时只允许一个 active event。
3. `playEvent(event)` 返回的 Promise 必须在 Runtime 完成回调后 resolve。
4. 当前事件完成后才取下一项；失败时停止并记录 `failedEventId`。

独立 Runtime 暴露的 `window.__happySeedMatchVisualEvents` 仅用于实验页验收：

- `play(eventOrId)`
- `reset()`
- `getSnapshot()`

正式 React 调用继续收口在 `src/services/happySeedMatchRuntime.js`：

- `getMatchVisualEventSnapshot()`
- `playMatchVisualEvent(eventId)`
- `playRepresentativeMatchVisualEvents()`
- `resetRepresentativeMatchVisualEvents()`

## CoachDecisionEvent 适配

`createMatchVisualEventFromCoachDecision()` 把五个既有教练决策场景映射到 V1 事件。适配器优先使用原决策的 `keyPlayers.primary/support.id`，然后在当前在场 actor 中解析完全一致的业务身份；结果的比分变化、播报和来源元数据也沿同一事件传递。

这保证教练模式不会再次选择另一套“看起来相似”的球员，也不会让文字说某人射门、场上却高亮另一人。

## 网络与后续边界

- `networking: none`，五事件桥必须离线运行。
- 火山引擎 AI 后续只能增强事件已有的解说、建议或复盘，并保留本地 fallback；AI 不能产生权威比分或阻塞比赛。
- 阶段 6 的正式比赛页、弹幕播报与换人入口消费本合同，不另建表现事件格式。
- 阶段 7 的限时教练决策把前奏、选择结果和恢复比赛接到同一串行队列。

## 阶段 5 关闭门槛

- 五个事件合同和 Coach 适配测试通过。
- 干净浏览器中五个事件按固定顺序完成，无并发、无瞬移、无重复结算。
- Runtime 事件桥自身不改原生记分牌；权威样板结算为红队 1:0，五个事件各消费一次。
- 事件开始、完成顺序可从页面与浏览器事件流核对，console error 为 0。
- 全量测试、lint、三套资源审计、build 和包体记录通过后才能将阶段标记为完成。
