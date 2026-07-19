# 商业化与火山引擎 AI 包装：第一阶段设计

日期：2026-07-11

## 1. 范围与边界

本阶段只交付可见入口、数据契约和本地 fallback，不连接真实服务。

- 不做实时联机、WebSocket 或实时 PVP。
- 联网预留只面向火山引擎 AI，当前版本不发起 AI 网络请求。
- 不接真实广告 SDK，不接真实支付。
- 不修改 Match Runtime、决策成功率和像素人物工作流。
- AI 是外围增强能力，核心单机流程永远可以独立运行。
- 商业化不出售进球、胜利、判罚偏向或决策成功率。

## 2. AI 分层

```text
场景入口
  -> createAiEnhancementRequest()
  -> requestAiEnhancement()
      -> Phase 1: local fallback templates
      -> Phase 2: Volcengine adapter over HTTPS
          -> failed/invalid/timeout
          -> local fallback templates
```

页面不直接组装供应商请求，也不保存火山引擎密钥。第二阶段应由服务端代理或平台云函数保管凭据，浏览器只调用受控 HTTPS 接口。

## 3. AiEnhancementRequest

所有场景只接收以下统一结构：

```js
{
  scene,
  matchSnapshot,
  playerTeam,
  opponentTeam,
  recentEvents,
  locale,
}
```

字段说明：

| 字段 | 用途 | 约束 |
| --- | --- | --- |
| `scene` | 选择提示词、输出结构与 fallback 模板 | 只能是六种已登记场景 |
| `matchSnapshot` | 比分、统计、阵型、阶段等只读快照 | 不包含 Runtime 实例 |
| `playerTeam` | 玩家球队的轻量摘要 | 不修改球队数据 |
| `opponentTeam` | 对手球队的轻量摘要 | 缺失时允许占位名称 |
| `recentEvents` | 最近事件或决策摘要 | 最多保留 12 条 |
| `locale` | 文案语言 | 默认 `zh-CN` |

## 4. AI 场景挂载点

| 场景 | 第一入口 | 本地 fallback | 后续火山引擎职责 |
| --- | --- | --- | --- |
| AI 赛前球探报告 | 排兵布阵页 | 球队标签、阵型与球探模板 | 生成对手强弱侧摘要 |
| AI 对手战术模拟 | 排兵布阵页 | 阵型与情境规则 | 输出开局、领先、落后三段预案 |
| AI 动态解说 | 比赛播报栏 | 最近事件与播报模板 | 批量润色候选播报，不阻塞 Runtime |
| AI 教练建议 | 排兵布阵页 / 中场入口 | 体能、位置和阵型规则 | 生成轮换与风险建议 |
| AI 赛后复盘 | 赛后结算页 | 比赛统计与决策模板 | 总结关键回合和下一场重点 |
| AI 生成挑战赛 | 赛程页 / 每日挑战 | 本地挑战规则池 | 生成单机挑战主题与限制 |

动态解说只消费已经产生的事件文本。即使 AI 请求超时，比赛时间、球员动作、比分和播报栏都继续使用现有本地逻辑。

## 5. Fallback 机制

`requestAiEnhancement()` 统一处理以下情况：

1. 未配置 provider：返回 `provider_not_configured` 本地结果。
2. provider 报错或网络失败：返回 `provider_request_failed` 本地结果。
3. provider 响应缺字段：返回 `invalid_provider_response` 本地结果。
4. 本地响应统一标记 `source: local-fallback`，页面可以明确展示来源。

本地模板不依赖随机数、网络或 Match Runtime，因此可测试、可复现。

## 6. 商业化入口

| 入口 | 建议页面 | 使用时机 | 第一阶段行为 |
| --- | --- | --- | --- |
| 赞助商加码 | 赛后结算 | 基础奖励后 | 显示未来软奖励类型 |
| 品牌补给站 | 首页 / 赛程 | 两场之间 | 展示库存字段 |
| 训练道具 | 排兵布阵 | 赛前 | 展示使用时机与效果意图 |
| 球鞋装备 | 球员详情 / 排兵布阵 | 赛前 | 展示装备槽和标签 |
| 赛后奖励 | 赛后结算 | 比赛结束 | 展示奖金、声望、掉落和恢复接口 |

所有按钮均为占位，不发起广告、支付或领取请求。

## 7. 道具效果接口

本阶段只定义 `effectIntent`，不实现公式：

| 道具 | 使用时机 | effectIntent | 公平限制 |
| --- | --- | --- | --- |
| 运动饮料 | 赛前 / 两场之间 | `restore_stamina` | 单人、封顶、单场限用 |
| 冰袋 | 赛后 | `reduce_minor_injury_duration` | 重伤不能立即复出 |
| 球鞋 | 赛前装备 | `equipment_tag` | 必须有体能或次数取舍 |
| 门将手套 | 赛前装备 | `equipment_tag` | 不保证扑救成功 |
| 战术板 | 赛前 | `team_readiness_tag` | 不自动选择决策 |
| 训练器材 | 两场之间 | `training_progress` | 消耗时间并可能累积疲劳 |

后续如果要让效果进入比赛，必须由独立道具效果适配器读取 `effectIntent`，并由比赛规则负责人审核；本模块不修改决策成功率。

## 8. 存档扩展

新增顶层字段：

- `aiEnhancement`：供应商状态、fallback 开关、缓存占位。
- `commercialization.wallet`：球队基金、声望、球探券。
- `commercialization.inventory`：六类道具数量。
- `commercialization.equipment`：球鞋和门将手套装备槽。
- `commercialization.sponsor`：赞助任务占位。
- `commercialization.rewardLedger`：未来赛后奖励流水。

`loadSaveData()` 对旧存档执行逐层合并，不会要求玩家重开存档。

## 9. 第二阶段火山引擎接入点

第二阶段新增 `src/services/volcengineAiAdapter.js`，实现统一的 `generate(request)`：

- 输入只接受 `AiEnhancementRequest`。
- 通过 HTTPS 调用服务端代理或云函数。
- 设置超时、场景级输出校验和有限重试。
- 失败直接抛给 `requestAiEnhancement()`，由本地模板兜底。
- 动态解说采用事件批次和缓存，不接 WebSocket，不阻塞比赛。
- 不把模型输出直接写入比分、判罚、胜负或成功率字段。

## 10. 第一阶段验证

```bash
npm test -- --run
npm run build
npm run lint
```

手工检查：从首页进入“AI与赞助”，依次运行六个本地预览，切换商业化入口，并确认没有网络请求、支付弹窗或广告 SDK 行为。
