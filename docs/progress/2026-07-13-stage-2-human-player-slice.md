# 阶段 2：人类像素球员骨架兼容性切片

日期：2026-07-13  
状态：技术切片通过；阶段 3 可开始。

## 本阶段锁定结果

- 以 `/match-runtime-min/data/player.json` 为唯一骨架源，锁定 Spine `2.1.27`、`17` 骨骼、`32` 插槽、`123.69 x 202.3` 边界和 `root-footline` 锚点。
- 完成法国普通球员、巴西普通球员、法国门将三套 `happyseed-human-v1` recipe。
- 验证 `idle/run/sprint/dribble/pass/shoot/slide/fall/stand_up/celebrate/goalkeeper_save` 共 11 类动作。
- 正背面切换头部与球衣附件；左右方向沿用骨架翻转；号码和门将手套保持独立层。
- 教练、球员、点球三模式共享同一套 recipe、球衣和动作合同。
- 第三方 `match.rebuilt.js` 未修改，正式 `MatchScreen` 未接入实验 UI。

## 资源体积

| 项目 | 数值 |
| --- | ---: |
| 新增生成文件 | 56 |
| 新增资源字节 | 15,001 bytes |
| 新增资源体积 | 14.65 KiB |
| 阶段关闭时 `dist` | 62,380 KiB（约 60.92 MiB） |
| 项目包体目标 | 80-120 MB，尽量不超过 150 MB |

资源明细由 `/public/pixel/human-runtime-slice-manifest.json` 记录。阶段 2 没有为每名球员预烘焙整套动作帧，因此角色数量不会使美术资源线性增长。

## 验收证据

- `npm run assets:human-slice`：成功生成 56 个文件。
- `npm run audit:human-slice`：17 骨骼、32 插槽、3 样板、11 动作、56 文件全部通过。
- `npm test -- --run`：5 个测试文件、90 项测试全部通过。
- `npm run lint`：通过，无 ESLint error。
- `npm run build`：通过；Vite 产物为 62,380 KiB。仅保留 Phaser 大 chunk 的既有构建提示。
- 浏览器：三套角色、11 动作、正背面、自动巡检均可操作；无 console error。
- 已知第三方噪声：旧 Pixi RenderTexture 与文字 API 的弃用 warning，属于原运行时兼容层，不影响本阶段通过。

## 下一个验收节点

阶段 3 使用本阶段锁定的人物尺度制作分层像素球场、看台、观众、广告牌、球门和球网切片；保留现有碰撞、深度排序和相机。它仍不是首个完整可玩竖切终点，后续还需完成 22 人 actor 映射、5 个代表事件、弹幕播报、换人入口与限时决策闭环。
