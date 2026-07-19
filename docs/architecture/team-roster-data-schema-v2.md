# 球队、大名单与阵型数据结构 V2

## 范围与边界

本结构服务 48 支国家队目录、35-40 人大名单、23 人征召、默认阵型、战术标签、本地模拟和 AI 分析。它只定义数据与阵容规则，不修改 Match Runtime、决策系统或像素人物生产流程。

权威入口：

- `src/data/teamDataSchema.js`：最终版结构常量、视觉配方 ID 规则和校验器。
- `src/data/teams.js`：当前可玩球队实例。
- `src/data/playerBalance.js`：球员规范化、占位球员扩编和价格处理。
- `src/data/rosterRules.js`：23 人征召校验与推荐。
- `src/data/teamFormations.js`：球队默认阵型和风格标签。
- `src/utils/lineupFormation.js`：一键布阵和阵型切换适配。
- `src/data/schedules.js`：赛程引用球队 ID/名称，不复制球队或球员数据。

## 顶层球队结构

```js
{
  schemaVersion: 'team-roster-v2',
  id: 'france',
  name: '法国',
  nameEn: 'France',
  group: 'I 组',
  budget: 2300,
  difficulty: 1,
  defaultFormation: '4-3-3',
  styleTags: ['速度冲击', '防守反击', '前场压迫'],
  gameModel: '用速度撕开身后空间，三前锋轮流冲击禁区。',
  dataStage: 'sample-complete',
  tournamentTeamCapacity: 48,
  rosterConfig: {
    minimum: 35,
    target: 38,
    maximum: 40,
    nationalSquadSize: 23,
    nationalSquadMinimums: { GK: 2, DF: 6, MF: 6, FW: 3 },
    positionTargets: { GK: 4, DF: 12, MF: 12, FW: 10 }
  },
  rosterSummary: {
    poolSize: 38,
    sourcePlayers: 23,
    placeholderPlayers: 15,
    nationalSquadSize: 23
  },
  visualRecipeRule: {
    version: 'pixel-player-recipe-v1',
    idPattern: 'pixel/recipes/{teamId}/{playerId}.json'
  },
  players: []
}
```

`dataStage` 当前有两档：法国、库拉索为 `sample-complete`，其余首批可玩队为 `playable-seed`。后续真实数据替换完占位球员后，可以统一提升为 `complete`，不影响消费者读取。

## 球员结构

每个进入 `teams[].players` 的球员都经过统一规范化，最终至少包含：

```js
{
  id: 'france_法国超跑',
  teamId: 'france',
  name: '法国超跑',
  nickname: '法国超跑',
  number: 10,
  position: 'FW',
  secondaryPositions: ['MF'],
  age: 28,
  height: '182cm',
  weight: '75kg',
  foot: '双脚',
  clubTag: '豪门主力',
  rating: 97,
  potential: 99,
  price: 198,
  status: 'available',
  stamina: 82,
  morale: 80,
  form: 79,
  speed: 97,
  physical: 78,
  technique: 88,
  defense: 40,
  shooting: 92,
  passing: 88,
  dribbling: 90,
  setPiece: 86,
  penalty: 79,
  goalkeeper: 10,
  operationAttributes: {
    ballControl: 90,
    turning: 89,
    sprint: 91,
    passing: 87,
    shooting: 89,
    tackling: 55,
    saving: 16
  },
  hiddenTraits: [],
  visualRecipeId: 'pixel/recipes/france/france_%E6%B3%95%E5%9B%BD%E8%B6%85%E8%B7%91.json',
  spriteRecipe: {},
  portraitRecipe: {},
  dataOrigin: 'source',
  isPlaceholder: false
}
```

`visualRecipeId` 由 `buildVisualRecipeId(teamId, playerId)` 确定性生成。名称中的非 ASCII 字符会进行 URI 编码，因此 48 队批量导入时不会因文件名字符产生歧义。该字段只是数据绑定键，不改变像素人物工作流或渲染实现。

## 当前 10 支可玩队

| 球队 | 默认阵型 | 风格标签 | 当前人数 | 数据阶段 |
| --- | --- | --- | ---: | --- |
| 法国 | 4-3-3 | 速度冲击 / 防守反击 / 前场压迫 | 38 | 样板完成 |
| 巴西 | 4-2-3-1 | 传控 / 个人盘带 / 速度冲击 | 38 | 首批种子 |
| 阿根廷 | 4-3-3 | 传控 / 定位球 / 核心串联 | 38 | 首批种子 |
| 葡萄牙 | 4-2-3-1 | 定位球 / 速度冲击 / 边路传中 | 38 | 首批种子 |
| 德国 | 4-2-3-1 | 传控 / 高位压迫 / 定位球 | 38 | 首批种子 |
| 日本 | 3-4-2-1 | 高位压迫 / 传控 / 速度冲击 | 38 | 首批种子 |
| 挪威 | 4-3-3 | 定位球 / 速度冲击 / 高空冲击 | 38 | 首批种子 |
| 摩洛哥 | 5-3-2 | 防守反击 / 速度冲击 / 低位防守 | 38 | 首批种子 |
| 新西兰 | 5-3-2 | 防守反击 / 定位球 / 高空冲击 | 38 | 首批种子 |
| 库拉索 | 4-4-1-1 | 防守反击 / 速度冲击 / 点球奇兵 | 38 | 样板完成 |

法国和库拉索均保留原有 23 名球员，并各自生成 15 名字段完整的占位球员。占位球员使用稳定 ASCII ID、唯一扩编号码、`generated-placeholder` 来源标记和完整视觉绑定，后续可以逐人替换成真实数据。

## 23 人征召

- 必须正好 23 人且总价不超过球队预算。
- 最低位置结构：2 门将、6 后卫、6 中场、3 前锋。
- 推荐征召会结合默认阵型增加相应位置深度，再按状态、潜力、能力价值和价格升级名单。
- 征召结果只保存球员 ID；球队主数据仍是唯一来源，避免模式间复制球员对象。

## 阵型切换适配

1. 读取目标阵型的 `GK/DF/MF/FW` 人数。
2. 当前门将可用时固定保留，不因替补门将评分更高自动换人。
3. 后卫线优先保留；人数减少时按防守、身体、体能、总评和位置适配综合分移除最低者。
4. 中场和前锋按相同的位置适配分保留到目标人数。
5. 新增位置先选主位置匹配者，再选副位置匹配者。
6. 极端名单缺位时才启用跨位置应急人选，保证阵型尽量保持完整 11 人。
7. 受伤、停赛、不可用和红牌离场状态不会被自动选入。

## 一键布阵

- 只从当前 23 人征召名单中的可用球员选择。
- 按目标阵型逐线填入 1 名门将和对应数量的后卫、中场、前锋。
- 评分不是只看总评：门将重扑救，后卫重防守与身体，中场重技术、传球与体能，前锋重射门、速度与技术。
- 主位置优先，副位置可竞争；只有位置储备不足时才跨位置应急。
- 同一球员最多进入一个槽位，输出固定为 `{ slotId, playerId, position }`，可直接交给现有阵容页面和本地模拟读取。

## 扩展到 48 队

后续每新增一队，只需：

1. 在 `src/data/players/` 增加该队原始球员模块，并加入 `players/index.js`。
2. 在 `teams.js` 添加球队元数据、预算、组别、资源引用和 `prepareTeamPlayers(...)`。
3. 在 `teamFormations.js` 添加默认阵型、风格标签与 `gameModel`。
4. 首轮可先录入核心球员，由规范化器补到 38 人；正式交付前逐步替换 `generated-placeholder`。
5. 运行 `validateTeamCatalog(teams)`；达到 48 队时 `completeTournament` 应为 `true`。
6. 运行回归测试、构建和 lint，确认征召、一键布阵、AI 序列化与现有消费者未破坏。
