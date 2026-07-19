# 阶段 4：角色系统与 Runtime 球员实体接入

日期：2026-07-13  
状态：技术切片通过；阶段 5 可开始。

## 本阶段锁定结果

- 法国与巴西各从 38 人候选池生成合法 23 人征召名单，并按默认 4-3-3 / 4-2-3-1 产生首发和 12 人替补。
- 22 个业务 `playerId` 一一绑定既有 HappySeed Runtime actor：红队 index 0-10，蓝队 index 11-21；未创建第二套正式比赛物理实体。
- 每个 actor 可追踪号码、自然位置、阵型位置、主客场球衣、门将服、`visualRecipeId`、身体样板、隐藏特质、操作属性和 Runtime entity ID。
- 10 队模板均具备 home、away、goalkeeper、away-goalkeeper 球衣；共享号码层覆盖 1-99。
- 体力、伤病、黄牌、红牌和停赛精确作用于目标 actor；红牌与停赛通过 Runtime `removePlayer` 离场。
- 精确换人复用原物理槽位并替换业务身份与贴图；门将只与门将互换，已换下球员进入 inactive，不返回候选席。
- 共享 `MatchScreen` 同步禁止已换下球员再次上场，并在替补席标记“已换下”。
- 角色合同明确 `networking: none` 与 `scoreMutationAllowed: false`，未改第三方 `match.rebuilt.js` 或比赛权威判定。

## 资源体积

| 项目 | 数值 |
| --- | ---: |
| 角色支持包引用文件 | 459 |
| 角色支持包资源字节 | 74,494 bytes / 72.75 KiB |
| 相比阶段 2 净新增文件 | 430 |
| 相比阶段 2 净新增资源 | 69,672 bytes / 68.04 KiB |
| 阶段关闭时 `dist` 磁盘占用 | 64,320 KiB（约 62.81 MiB） |
| `dist` 文件逻辑体积 | 48,479,376 bytes（约 46.23 MiB） |
| 相比阶段 3 的 `dist` 磁盘占用 | +1,784 KiB，主要来自 430 个小 PNG 的文件系统块开销 |
| 项目包体目标 | 80-120 MB，尽量不超过 150 MB |

明细由 `public/pixel/runtime-actor-assets-manifest.json` 记录。实际新增像素数据只有 68.04 KiB；后续若平台文件索引开销成为瓶颈，再在不改 actor 合同的前提下把号码与球衣合并为 atlas。

## 验收证据

- `audit:runtime-actors`：10 队、4 套球衣类型、1-99 号码、459 文件、74,494 bytes 全部通过。
- `audit:human-slice`：17 骨骼、32 插槽、3 样板、11 动作、56 文件继续通过。
- `audit:stadium-slice`：8 层、6 镜头、8 文件继续通过；碰撞、动态球网、相机和深度排序保持不变。
- 全量测试：7 个测试文件、101 项测试全部通过。
- ESLint：全仓通过，无 error。
- Vite 生产构建：通过；仅保留既有 Phaser 大 chunk 非阻塞提示。
- 浏览器干净启动：`MAPPING · READY`、22/22 映射、22/22 唯一、22 人在场，3 个 canvas，Vite overlay 为 false，console error 为 0。
- 浏览器状态验收：所选 `red-01` 体力由 85 降至 75；精确换人后同一槽位由 #2 钢铁后卫更新为 #5 边路悍将，法国替补从 12 降至 11。
- 浏览器红牌验收：active actor 从 22 降至 21，阵容由 11v11 变 10v11，比分在操作前后保持不变。

## 下一个验收节点

阶段 5 定义统一 `MatchVisualEvent`，先把常规进攻、单刀、角球、任意球、禁区犯规/点球五个代表事件绑定到本阶段锁定的 `playerId` / `runtimeActorId`。人物动作、足球位置、比分、统计和播报必须消费同一事件，动画完成后才能进入下一事件；Runtime 只表演一次，权威玩法层继续写比赛状态。
