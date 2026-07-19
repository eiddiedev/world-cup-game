# 方案B模块化像素小人工作流验证

> 2026-07-13 阶段 2 状态：骨架兼容性技术切片已通过。下文以 HappySeed 原运行时的 `player.json` 为正式比赛规格；早期 `32x40` CSS 小人只保留为构图草案，不再作为 Match Runtime 资产合同。

## 当前验证范围

- 部件结构：头、身体、左右手臂、左右腿、球衣、球裤、球袜、球鞋、号码。
- 球队样板：法国普通球员、巴西普通球员、法国门将。
- 动作样板：`idle`、`run`、`sprint`、`dribble`、`pass`、`shoot`、`slide`、`fall`、`stand_up`、`celebrate`、`goalkeeper_save`。
- 接入边界：正式比赛页与现有 `MatchScreen` 不动；只在独立验证入口、适配层和可改的 `standalone-match.js` 启动壳接入，第三方 `match.rebuilt.js` 保持不变。
- 新复赛约束：包体目标 `80-120MB`，最多不超过 `150MB`；不做实时联机；联网只服务火山引擎 AI 接入。

## 共用 2.5D Match Runtime 边界

后续三种模式必须共用同一套运行时资产：

- 教练模式：当前决策玩法，只把决策结果映射到同一套小人动作和球路。
- 球员模式：玩家自己控制移动、传球、射门、抢断，输入层不同，资产层不复制。
- 点球演示模式：单机/AI 对战，可独立进入，但仍复用球员、门将、足球、球门和射门/扑救动画。

复用清单：

- `pitch`：球场底图、线层、球门、阴影、深度遮挡。
- `paperDollPlayer`：纸娃娃小人部件和动作帧。
- `ball`：足球、带球吸附点、传球/射门轨迹。
- `animationTimelines`：跑动、带球、传球、射门、抢断、扑救。
- `teamKits`：球队 palette、主客场切换、门将服。
- `teamData`：球队、球员、号码、阵型、状态。

禁止事项：

- 不为教练模式、球员模式、点球模式分别复制一套球员素材。
- 不为了某一个模式把动作、球衣或球员坐标写死。
- 不做 WebSocket，不做实时 PVP，不把点球大战做成实时联机。

## 2026-07-13 锁定的运行时兼容合同

| 项目 | 锁定值 |
| --- | --- |
| 骨架源 | `/match-runtime-min/data/player.json` |
| Spine 数据版本 | `2.1.27` |
| 骨架边界 | `123.69 x 202.3` |
| 骨骼 / 插槽 | `17 / 32`，名称和顺序必须与源文件一致 |
| 锚点 | 原 `root` 脚底线；不为单个动作增加补偿坐标 |
| 正背面 | 复用原骨架 `facingCamera`，切换 `head_front/back` 与 `shirt_front/back` |
| 左右方向 | 复用 Spine `scaleX` 翻转，不复制左右贴图 |
| 遮挡 | 保留运行时 slot draw order，隐藏原动物五官/毛发 slots |
| 三模式复用 | `coach`、`player`、`penalty` 共用同一 recipe 和动作资产 |

当前技术样板为法国 10 号、巴西 9 号、法国 1 号门将。旧 Pixi 的多个额外 `PlayerRenderer` 会竞争 RenderTexture 并产生黑块，因此实验入口使用一个共享骨架实例切换三套 recipe；正式 22 人仍使用运行时已有的 22 个 actor，不按模式或球员复制骨架。

## 纸娃娃结构

正式比赛部件不使用统一 `32x40` 画布，而是严格沿用各 slot 的原附件尺寸。关键尺寸为：头部 `81x77`、球衣 `56x52`、号码 `33x18`、左/右手套 `26x24` 与 `26x25`；完整表由 `HAPPYSEED_SLOT_TEXTURE_SIZES` 管理并由审计脚本校验。

锚点：保留原骨架的 `root/pelvis` 世界坐标和附件的 `x/y/rotation`。后续导出不能改变透明画布尺寸或自行裁边，否则动作时会跳位。

图层顺序：

1. `shadow`
2. `leftLeg` / `rightLeg`
3. `shorts`
4. `boots`
5. `leftArm` / `rightArm`
6. `shirt`
7. `shirtAccent`
8. `neck`
9. `head`
10. `hair`
11. `eyes`
12. `number`
13. `gloves`，仅门将启用

## 资产命名规范

```text
pixel/player/{partSetId}/{profileId}/{part}.png
pixel/kits/{teamId}/{kitType}/{partSetId}/{part}.png
pixel/numbers/{partSetId}/{number}.png
pixel/recipes/{teamId}/{profileId}.json
```

示例：

```text
pixel/player/happyseed-human-v4/france-outfield/head_front.png
pixel/kits/france/home/happyseed-human-v4/shirt_front.png
pixel/kits/france/goalkeeper/happyseed-human-v4/hand_left.png
pixel/numbers/happyseed-human-v4/10.png
pixel/recipes/france/france-outfield.json
```

## spriteRecipe 字段

```json
{
  "schemaVersion": "happyseed-human-runtime-recipe-v1",
  "partSetId": "happyseed-human-v4",
  "id": "france-outfield",
  "teamId": "france",
  "role": "outfield",
  "number": 10,
  "kitType": "home",
  "palette": {
    "shirt": "#1F4AA8",
    "accent": "#D9E5FF",
    "shorts": "#F4F0E8",
    "socks": "#B34235",
    "boots": "#111111",
    "skin": "#D49A62",
    "hair": "#161412"
  },
  "compatibility": {
    "sourceSkeleton": "/match-runtime-min/data/player.json",
    "anchor": "root-footline",
    "modeScope": ["coach", "player", "penalty"]
  }
}
```

Match Runtime 后续只需要读取 `spriteRecipe`，根据 `teamId`、`role`、`number`、`action` 选择对应部件或预烘焙帧。教练模式、球员模式、点球模式都传同一类 recipe；不同模式只改变控制输入和 AI 策略。

## 资源体积预算

总包体：

- 平台上限：`200MB`。
- 复赛目标：`80-120MB`。
- 强制上限：最多 `150MB`，超过后必须删资源或降级导出规格。

球员资源预算：

| 资源项 | 预算 | 说明 |
| --- | ---: | --- |
| 纸娃娃基础部件 | 0.8-1.2MB | 头、身体、四肢、鞋、阴影、手套、号码字形 |
| 10 队球衣 palette 和少量模板 | 0.3-0.8MB | 主场、客场、门将服尽量用调色板生成 |
| 7 个基础动作预烘焙帧 | 1.5-2.5MB | `idle/run/dribble/pass/shoot/tackle/save`，先 front，后续补方向 |
| spriteRecipe JSON | <0.2MB | 10 队 35-40 人也只是一批小 JSON |
| 预留压缩余量 | 0.5MB | 给后续发型、胡子、庆祝动作 |
| 合计目标 | 3-5MB | 不随球员数量线性增长 |

现有旧 PNG 粗算：

- 当前 `public/assets` 内 `slice_*.png/gk.png/gk2.png` 共 `154` 张，约 `10.99MB`，平均 `73.1KB/张`。
- 如果未来 10 队按 35-40 人都继续做整张 PNG，约 `380` 人，仅球员整图就会接近 `27MB`，并且还没算动作帧。
- 纸娃娃方案把 380 人压到约 `3-5MB` 的共享部件/动作/recipe，和继续整图相比预计节省 `80-88%`。

包体控制规则：

1. 球员不能每人一张完整大图，更不能每人一套完整动作大图。
2. 大图只保留少数 UI 立绘或宣传图，比赛内一律使用纸娃娃小人。
3. 新动作先复用骨架动画，只有进入核心手感验证后再预烘焙帧。
4. 所有 PNG 要跑无损压缩；大面积纯色部件优先考虑 palette/Canvas/SVG-like data 生成。
5. 每次新增球队或动作，都要记录新增资源 MB，不能只看功能完成。

阶段 2 实测：`56` 个生成文件共 `15,001 bytes / 14.65 KiB`，包括三套 recipe、身体部件、两队球衣、门将手套和号码；该数字由 `public/pixel/human-runtime-slice-manifest.json` 记录，不含原有 Runtime 资产。

## 批量生产规则

1. 头和球衣必须同时提供 `front/back`；左右方向由骨架翻转，不生成重复贴图。
2. 普通球员和门将共用头、腿、鞋、号码；门将额外启用 `gloves` 和 goalkeeper shirt palette。
3. 每队只维护 palette 和少量球衣模板，不为每个球员手画完整动作。
4. 动作优先复用原 Spine 时间线，不预烘焙整人帧；只有原骨架无法表达且通过包体评审后才新增动画资源。
5. 导出后先运行 `npm run assets:human-slice`，再运行 `npm run audit:human-slice` 检查 slot 尺寸、骨骼、动作和 recipe 漂移。
6. 号码使用独立 `0-9` 数字层，双位数居中压缩，不直接画死在球衣上。
7. 球衣撞色时走 `getMatchKits()` 的主客场切换逻辑，不改球队数据。
8. 所有导出帧必须标注可被 `coach/player/penalty` 三种模式复用，不能出现模式专属命名。

## 后续美术资源清单

- 头部：front、left、right、back 四方向。
- 肤色：至少 5 档。
- 发型：短发、卷发、寸头、长发、光头、金发、爆炸头。
- 胡子：无、短胡、络腮胡。
- 普通球员：球衣、球裤、球袜、左右手臂、左右腿、球鞋。
- 门将：门将服、门将手套、ready、save、diveLeft、diveRight、catch。
- 号码：0-9 独立像素字形，白/深两套描边。
- 动作：`idle`、`run`、`dribble`、`pass`、`shoot`、`tackle`、`save` 先完成；再扩 `sprint`、`cross`、`header`、`block`、`fall`、`celebrate`。

## 验收方式

- [x] 独立入口进入“人类骨架兼容切片”。
- [x] 逐项切换 11 类动作，并通过自动巡检。
- [x] 法国与巴西普通球员使用同一骨架、不同球衣和外观 recipe。
- [x] 法国门将启用门将服、手套和扑救动作。
- [x] 正背面头部、球衣和号码层可切换，左右继续由骨架翻转。
- [x] `npm run audit:human-slice` 校验 17 骨骼、32 插槽、3 样板、11 动作、56 文件和资源字节数。
- [x] 文档保持 `80-120MB` 目标包体、`150MB` 强制上限和三模式共用 Runtime。
