# CoachDecisionEvent 第一阶段接口与事件盘点

> 2026-07-14 状态更新：本文前半部分保留第一阶段的历史边界。当前实现已完成 53/53 场景迁移；统一场景分类位于 `src/utils/decisionRuntimeScene.js`，正式视觉桥位于 `src/utils/matchVisualEvent.js`，完整浏览器验收目录使用 `decisionCatalog=1&decisionStart=0..52`。

## 范围

本阶段只标准化三个代表事件：`solo_run_penalty`、`freekick_dangerous`、`penalty_area_foul_risk`。现有比赛仍可继续使用旧决策库；其他事件暂不迁移到新接口，也不改 Match Runtime 渲染、球员图片、商业化或 AI。

## 当前链路

- `src/data/decisionLibrary.js`：旧场景、选项、能力权重和结果池。
- `src/utils/decisionSystem.js`：场景选择、关键球员、动态成功率和结果解析。
- `src/components/MatchScreen.jsx`：倒计时、结果应用、红牌离场、点球连锁、统计和决策记录。
- `src/utils/commentaryEngine.js`：常规比赛、犯规、红黄牌和定位球播报。
- `src/utils/postMatchInsights.js`：赛后关键决策复盘。
- `src/utils/matchEngine.js`：当前仅是对手阵容生成的薄封装，不拥有决策规则。
- `src/utils/penaltyShootout.js`：独立点球大战逻辑，不属于本阶段三事件接口。

## 现有决策盘点

当前旧库共 53 个场景，按 Runtime 动画族分组如下：

- 单刀/直塞/反击：`solo_run_penalty`、`var_goal_review`、`through_ball_chance`、`half_space_through_run`、`counter_attack_3v2`、`low_block_counter_launch`。
- 传中/角球：`penalty_area_cross`、`throwin_attack`、`wing_overlap_cross`、`central_cutback_press`、`header_corner`、`second_ball_corner_attack`、`late_keeper_up_corner`。
- 任意球/定位球：`freekick_dangerous`、`indirect_freekick_box`、`set_piece_rebound_shot`、`defend_dangerous_freekick`、`opponent_dangerous_freekick_wall`。
- 点球/禁区风险：`penalty_kick`、`match_penalty`、`penalty_shootout_round`、`penalty_rebound_followup`、`penalty_area_foul_risk`、`weather_slippery_tackle`、`penalty_area_dive`。
- 门将/最后防线：`gk_one_on_one`、`keeper_distribution`、`keeper_sweeper_claim`、`last_defender_tackle`、`defender_last_ditch`、`fullback_recovery_run`、`second_yellow_warning`、`offside_trap`。
- 中场/压迫：`midfield_press_trigger`、`midfield_second_ball`、`high_press_trap`、`midfield_switch_play`、`long_shot_opportunity`。
- 禁区混战/角球防守：`box_second_ball_chaos`、`aerial_duel_corner_defending`、`box_scramble_clearance`、`opponent_short_corner_defense`。
- VAR/裁判：`var_penalty_review`、`var_offside_goal`、`defensive_line_handball_var`、`handball_penalty_claim`、`tactical_foul_counter`、`yellow_card_dissent_control`。
- 体能/比赛管理：`stamina_collapse_sub`、`injury_play_on`、`trailing_last_ten`、`leading_protect`、`extra_time_penalty_shootout_prep`。

第一阶段历史状态：当时只有代表场景输出标准 `CoachDecisionEvent`。2026-07-14 当前状态为 53/53 全部输出标准事件；6 个代表场景保留专用定义和精修文案，其余场景由本地通用定义生成器补齐同一合同。

## CoachDecisionEvent v1

```js
{
  id,
  type,
  minute,
  team,
  keyPlayers,
  options,
  timeoutSeconds,
  successFormula,
  riskTags,
  rewardTags,
  animationPrelude,
  animationResult,
  commentaryTemplates,
  postMatchReviewTag,
}
```

补充兼容字段为 `schemaVersion`、`sourceScenarioId`、`opponent` 和 `situation`。

- `options[].successProbability` 是按本次球员能力、体能、淘汰赛压力、对手防守、球队深度和难度计算的数值，不写死。
- `animationPrelude` 输出 `{ animationType, eventTag }`。
- `animationResult.outcomeTags` 为每个可能结果输出 `{ animationType, outcome, eventTag }`。
- 现有 Runtime 继续消费 `animationType + outcome`；`eventTag` 留给共用 2.5D Runtime 的统一事件桥。
- 播报使用本地模板，赛后记录保存 `postMatchReviewTag`、风险/收益标签和本次动画结果。

## 扩展到 50+（2026-07-14 已完成）

当前 53 个场景全部通过现有 `executeDecision()` 生成运行时实例，并映射到 21 个 Runtime 场景族。每个可能结果均有本地播报 fallback、动画结果标签和赛后复盘标签；自动测试逐项校验事件合同、动态概率、actor、球权角色、连续球路、镜头、动作配置和视觉 schema。旧字段的 UI 直读路径仍保留兼容，待正式版本完成 Runtime 接入后再单独删除。
