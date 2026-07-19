# HappySeed Runtime 22 人角色映射合同

## 目的与边界

阶段 4 把球队业务数据中的 `playerId` 一一绑定到 HappySeed 11v11 Runtime 已有的 22 个物理 actor。它不创建第二套球员物理、不修改 `match.rebuilt.js`，也不拥有比分、赛果或判定权。

权威边界：

- 业务名单、23 人征召、首发和替补来自 `teams`、`rosterRules` 与 `lineupFormation`。
- `happySeedRuntimeActors.js` 只生成映射、视觉 recipe、状态和换人合同。
- HappySeed Runtime 继续拥有移动、碰撞、足球、球门、球网、相机和在场实体。
- 角色状态层不可写比分；红牌和停赛只通过 Runtime 的 `removePlayer` 移除对应物理实体。
- 联网为 `none`；本合同不引入 WebSocket、实时 PVP 或联网依赖。

## 固定槽位

Runtime 原生 22 个 renderer 直接复用，不额外创建正式比赛 actor：

| 业务侧 | Runtime actor | Runtime index | 数量 |
| --- | --- | ---: | ---: |
| 红队 | `red-00` - `red-10` | 0 - 10 | 11 |
| 蓝队 | `blue-00` - `blue-10` | 11 - 21 | 11 |

每个槽位至少携带：

- `runtimeActorId`、`runtimeIndex`、`runtimeEntityId`
- `playerId`、姓名、号码、自然位置、当前阵型位置
- 球队、主客场球衣、门将身份和门将服
- `visualRecipeId`、身体样板、球衣路径、号码路径
- 隐藏特质和直接操作属性
- 体力、伤病、黄牌、红牌、在场与已换下状态

换人时，进入球员继承被换球员的 Runtime 槽位和阵型位置，物理实体不重建；业务身份、号码、贴图、recipe 和状态一次性替换。门将槽只允许门将互换。

## 在场资格

- 同一 `playerId` 不得同时占用两个 active actor。
- 已换下球员进入 `inactive`，不返回 `bench`。
- 红牌和停赛球员调用 Runtime `removePlayer`，`onPitch` 永久变为 `false`。
- 受伤状态绑定到具体 actor，可继续等待权威玩法层触发换人。
- 黄牌和体力只更新目标 actor，不影响其他槽位。
- 已换下、红牌、停赛和不可用球员不得重新进入比赛。

共享 `MatchScreen` 的替补工具也执行相同规则：换下历史加入禁用集合，候选席可显示“已换下”，但不能拖拽或再次选中。

## 资源合同

`runtime-actor-assets-manifest.json` 覆盖当前 10 队模板：

- 每队 home、away、goalkeeper、away-goalkeeper 四套球衣。
- 号码 1-99。
- 身体继续复用阶段 2 的三套兼容样板，不复制骨架或动作。
- 全包 459 个引用文件、74,494 bytes；相对阶段 2 净新增 430 个文件、69,672 bytes。

生成与审计入口：

- `scripts/generate-runtime-actor-assets.mjs`
- `scripts/audit-runtime-actor-assets.mjs`
- `npm run assets:runtime-actors`
- `npm run audit:runtime-actors`

## 适配器接口与事件

正式调用收口在 `happySeedMatchRuntime.js`：

- `getRuntimeActorSnapshot()`
- `selectRuntimeActor(runtimeActorId)`
- `setRuntimeActorState(runtimeActorId, patch)`
- `substituteRuntimeActor(side, outPlayerId, inPlayerId)`

独立 Runtime 暴露三个阶段事件：

- `ab-runtime-actors-ready`
- `ab-runtime-actor-state`
- `ab-runtime-substitution`

这些事件只用于验收与后续表现层消费。阶段 5 的 `MatchVisualEvent` 必须引用这里的 `playerId` / `runtimeActorId`，但比分、红黄牌、伤停和换人仍由权威玩法层写入。

## 阶段 4 验收基线

- 初始 22/22 映射、22/22 唯一、红蓝各 11 人。
- 法国 4-3-3、巴西 4-2-3-1，双方各有 12 名替补。
- 状态操作可追踪到所选 actor。
- 精确换人后 Runtime 槽位不变，业务球员和贴图改变，替补数减一。
- 红牌后 active actor 从 22 变 21，诊断阵容从 11v11 变 10v11，比分不变。
- 旧人类骨架、像素球场、碰撞、动态球网、相机和深度排序回归通过。
