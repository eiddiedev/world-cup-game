import { getDecisionRuntimeSceneType } from '../utils/decisionRuntimeScene.js'

const DYNAMIC_SUCCESS_FORMULA = Object.freeze({
  model: 'weighted-player-context-v1',
  expression: 'clamp((0.25 + weightedAbility / 99 * 0.55) * fitness * clutch * golden * opponent + teamDepth + difficulty, 0.10, 0.90)',
  contextFactors: [
    'playerAbilities',
    'fitness',
    'knockoutClutch',
    'opponentDefense',
    'teamDepth',
    'teamDifficulty',
  ],
  clamp: [0.10, 0.90],
})

export const COACH_DECISION_EVENT_DEFINITIONS = Object.freeze([
  {
    id: 'coach.regular-attack.v1',
    type: 'regular_attack',
    sourceScenarioId: 'penalty_area_cross',
    timeoutSeconds: 6,
    successFormula: DYNAMIC_SUCCESS_FORMULA,
    riskTags: ['open-play', 'cross-selection', 'counter-risk'],
    rewardTags: ['box-entry', 'shot-chance', 'second-ball'],
    animationPrelude: {
      animationType: 'attack_cross',
      eventTag: 'coach.regular-attack.prelude',
    },
    animationResult: {
      animationType: 'attack_cross',
      eventTagPrefix: 'coach.regular-attack.result',
    },
    commentaryTemplates: {
      prelude: [
        '{minute}分钟，{player}推进到边路，{player2}已经进入禁区。',
        '{player}获得传中空间，{player2}在门前等待接应。',
      ],
      results: {
        goal_tap_in: ['{player}送出低平球，{player2}包抄破门！'],
        saved_low: ['{player2}迎球推射，被门将挡出。'],
        cleared_low: ['低平球被防守球员抢先解围。'],
        goal_header: ['{player2}力压后卫，头球破门！'],
        saved_header: ['{player2}完成头球攻门，门将将球抱住。'],
        header_over: ['{player2}的头球高出横梁。'],
        cleared_header: ['高空传中被中卫顶出禁区。'],
        goal_volley: ['回传弧顶，跟进球员凌空抽射得分！'],
        shot_blocked: ['弧顶射门被防守球员封堵。'],
        shot_wide: ['远射偏出球门。'],
      },
    },
    postMatchReviewTag: '常规进攻/传中',
  },
  {
    id: 'coach.solo-shot.v1',
    type: 'solo_run',
    sourceScenarioId: 'solo_run_penalty',
    timeoutSeconds: 4,
    successFormula: DYNAMIC_SUCCESS_FORMULA,
    riskTags: ['one-on-one', 'shot-selection', 'counter-risk'],
    rewardTags: ['high-xg', 'goal-chance'],
    animationPrelude: {
      animationType: 'attack_solo',
      eventTag: 'coach.solo-shot.prelude',
    },
    animationResult: {
      animationType: 'attack_solo',
      eventTagPrefix: 'coach.solo-shot.result',
    },
    commentaryTemplates: {
      prelude: [
        '{minute}分钟，{player}形成单刀，门将已经出击！',
        '{player}甩开最后一名后卫，单独面对门将。',
      ],
      results: {
        goal: ['{player}打穿近角，单刀破门！'],
        saved_near: ['门将封住近角，扑出{player}的射门。'],
        miss_near: ['{player}追求近角，皮球滑门而出。'],
        goal_chip: ['{player}冷静挑射，皮球越过门将入网！'],
        miss_over: ['{player}的挑射高出横梁。'],
        saved_chip: ['门将没有倒地，稳稳接住{player}的挑射。'],
        goal_assist: ['{player}横传，{player2}推射空门得手！'],
        pass_intercepted: ['横传线路被识破，单刀机会被化解。'],
        miss_teammate: ['{player2}包抄稍慢，横传滑过门前。'],
      },
    },
    postMatchReviewTag: '单刀射门',
  },
  {
    id: 'coach.corner.v1',
    type: 'corner',
    sourceScenarioId: 'header_corner',
    timeoutSeconds: 6,
    successFormula: DYNAMIC_SUCCESS_FORMULA,
    riskTags: ['set-piece', 'aerial-duel', 'counter-risk'],
    rewardTags: ['header-chance', 'second-ball', 'box-pressure'],
    animationPrelude: {
      animationType: 'attack_corner',
      eventTag: 'coach.corner.prelude',
    },
    animationResult: {
      animationType: 'attack_corner',
      eventTagPrefix: 'coach.corner.result',
    },
    commentaryTemplates: {
      prelude: [
        '{minute}分钟，{player}站到角旗区，{player2}进入禁区争顶。',
        '角球机会，{player}观察禁区内的跑位。',
      ],
      results: {
        goal_near_post: ['近点抢射得手，角球战术奏效！'],
        goal_second_ball: ['第一点制造混乱，二点补射破门！'],
        cleared_near: ['近点传中被防守球员解围。'],
        counter_fast: ['角球被解围，对手立即发动反击。'],
        goal_far_header: ['{player2}在远点头球破门！'],
        saved_far: ['远点头球被门将扑出。'],
        cleared_far: ['防守球员抢先将远点球顶出。'],
        goal_short_corner: ['短角球拉开角度，传中后完成破门！'],
        blocked_short: ['短角球后的传中被封堵。'],
        possession_lost: ['短角球配合失误，球权易手。'],
      },
    },
    postMatchReviewTag: '角球进攻',
  },
  {
    id: 'coach.dangerous-free-kick.v1',
    type: 'dangerous_free_kick',
    sourceScenarioId: 'freekick_dangerous',
    timeoutSeconds: 6,
    successFormula: DYNAMIC_SUCCESS_FORMULA,
    riskTags: ['set-piece', 'wall', 'counter-risk'],
    rewardTags: ['direct-goal', 'box-entry', 'possession'],
    animationPrelude: {
      animationType: 'attack_freekick',
      eventTag: 'coach.dangerous-free-kick.prelude',
    },
    animationResult: {
      animationType: 'attack_freekick',
      eventTagPrefix: 'coach.dangerous-free-kick.result',
    },
    commentaryTemplates: {
      prelude: [
        '{minute}分钟，距门约22米的危险任意球，{player}站到球前。',
        '前场定位球机会，人墙已经排好，{player}等待教练指令。',
      ],
      results: {
        goal_freekick: ['{player}的弧线球绕过人墙，直入死角！'],
        saved_freekick: ['门将横身扑出{player}的直接任意球。'],
        hit_wall: ['射门打在人墙上，防守方挡下任意球。'],
        miss_over: ['{player}的任意球越过人墙，也高出横梁。'],
        goal_header: ['任意球传入禁区，{player2}抢点头球破门！'],
        saved_header: ['{player2}完成头球攻门，门将把球抱住。'],
        cleared_header: ['防守球员抢到第一点，将传中解围。'],
        counter_risk: ['任意球传中被解围，对手立即发动反击。'],
        goal_reorganized: ['短传配合拉开人墙，随后射门得分！'],
        shot_blocked: ['短传后的射门被禁区前沿封堵。'],
        possession_kept: ['短传重新组织，本方继续控制球权。'],
      },
    },
    postMatchReviewTag: '危险任意球',
  },
  {
    id: 'coach.penalty-area-foul.v1',
    type: 'penalty_area_foul',
    sourceScenarioId: 'penalty_area_foul_risk',
    timeoutSeconds: 4,
    successFormula: DYNAMIC_SUCCESS_FORMULA,
    riskTags: ['penalty-risk', 'discipline', 'last-defender'],
    rewardTags: ['stop-shot', 'win-possession', 'delay-attack'],
    animationPrelude: {
      animationType: 'defend_penalty_risk',
      eventTag: 'coach.penalty-area-foul.prelude',
    },
    animationResult: {
      animationType: 'defend_penalty_risk',
      eventTagPrefix: 'coach.penalty-area-foul.result',
    },
    commentaryTemplates: {
      prelude: [
        '{minute}分钟，{opponent}突入禁区，{player}必须立即选择防守动作。',
        '禁区内一对一，{player}是球门前最后一道屏障。',
      ],
      results: {
        tackle_success: ['{player}先碰到球，干净地化解禁区险情。'],
        yellow_card_penalty: ['裁判指向点球点，{player}吃到黄牌！'],
        tackle_miss: ['{player}放铲落空，对手继续控制皮球。'],
        red_card_penalty: ['红牌加点球，{player}被罚出场！'],
        delay_success: ['{player}保持重心，把对手逼向边路。'],
        opponent_shoots: ['对手获得射门空间，门将准备扑救。'],
        goal_against: ['退守未能封住角度，对手在禁区内破门。'],
        teammate_helps: ['{player}拖延成功，队友回防完成包夹。'],
        ball_out: ['{player}用身体卡住位置，把球护出底线。'],
        freekick_against: ['犯规发生在禁区线外，对方获得危险任意球。'],
        opponent_stumbles: ['对手失去平衡，裁判示意比赛继续。'],
      },
    },
    postMatchReviewTag: '禁区防守/点球风险',
  },
  {
    id: 'coach.penalty-kick.v1',
    type: 'penalty_kick',
    sourceScenarioId: 'match_penalty',
    timeoutSeconds: 4,
    successFormula: DYNAMIC_SUCCESS_FORMULA,
    riskTags: ['penalty', 'composure', 'shot-selection'],
    rewardTags: ['high-xg', 'goal-chance', 'momentum'],
    animationPrelude: {
      animationType: 'penalty_shootout',
      eventTag: 'coach.penalty-kick.prelude',
    },
    animationResult: {
      animationType: 'penalty_shootout',
      eventTagPrefix: 'coach.penalty-kick.result',
    },
    commentaryTemplates: {
      prelude: [
        '{minute}分钟，裁判指向点球点，{player}将承担主罚。',
        '十二码决胜时刻，{player}把球摆到点球点。',
      ],
      results: {
        goal_placement: ['{player}冷静推入死角，点球命中！'],
        saved_placement: ['门将判断正确，扑出{player}的低射。'],
        miss_post: ['{player}的推射击中门柱弹出。'],
        goal_power: ['{player}大力抽射，皮球直入网窝！'],
        saved_power: ['门将飞身挡出这记重炮。'],
        miss_wide_power: ['大力射门偏出立柱。'],
        goal_panenka: ['{player}用勺子点球骗过门将！'],
        saved_panenka: ['门将没有移动，稳稳抱住勺子点球。'],
        miss_panenka: ['勺子点球高出横梁。'],
      },
    },
    postMatchReviewTag: '比赛点球',
  },
])

const DEFINITION_BY_SCENARIO_ID = new Map(
  COACH_DECISION_EVENT_DEFINITIONS.map(definition => [definition.sourceScenarioId, definition]),
)

const EXPLICIT_OUTCOME_COMMENTARY_GROUPS = Object.freeze([
  ['足球越过门线，进球结果成立。', [
    'goal', 'goal_assist', 'goal_chip', 'goal_closer', 'goal_combo', 'goal_cross',
    'goal_far_header', 'goal_freekick', 'goal_header', 'goal_long', 'goal_near_post',
    'goal_panenka', 'goal_placement', 'goal_power', 'goal_reorganized', 'goal_second_ball',
    'goal_short_corner', 'goal_tap_in', 'goal_through', 'goal_tight_angle', 'goal_volley',
    'golden_goal', 'comeback_goal', 'late_equalizer', 'sealed_win',
  ]],
  ['对方完成终结，足球越过我方门线。', [
    'goal_against', 'goal_chip_over', 'goal_corner', 'goal_zone_gap',
    'opponent_goal_freekick', 'opponent_goal_header', 'opponent_goal_scramble',
    'counter_equalizer', 'counter_golden_goal', 'opponent_last_gasp',
  ]],
  ['门将完成扑救并把球控制住。', [
    'clean_catch_gk', 'gk_claim', 'gk_claim_ball', 'gk_claims', 'gk_reaction_save',
    'gk_save_rush', 'keeper_save_freekick', 'saved_chip', 'saved_close', 'saved_far',
    'saved_freekick', 'saved_freekick_against', 'saved_header', 'saved_long', 'saved_low',
    'saved_near', 'saved_panenka', 'saved_placement', 'saved_power', 'saved_rush',
    'opponent_header_saved', 'goal_saved_post', 'clutch_moment_saves',
  ]],
  ['门将出击将传中球击出危险区域。', ['claim_cross', 'gk_punches']],
  ['防守方完成封堵，足球没有穿过防线。', [
    'blocked_second_ball', 'blocked_short', 'blocked_wall', 'hit_wall', 'shot_blocked',
    'shot_blocked_body', 'wall_block',
  ]],
  ['防守球员抢到落点并完成解围。', [
    'ball_cleared', 'cleared', 'cleared_far', 'cleared_header', 'cleared_low',
    'cleared_near', 'cleared_second_ball', 'headed_clear', 'header_cleared', 'zone_cleared',
  ]],
  ['传球线路被识破，球权被对方截下。', [
    'ball_intercepted', 'intercept', 'pass_intercepted',
  ]],
  ['足球出了边界，比赛进入死球。', ['ball_out']],
  ['防守方把球挡出底线，形成角球。', [
    'corner', 'corner_against', 'corner_won', 'deflected_corner', 'forced_corner',
  ]],
  ['足球发生折射后改变方向。', ['deflected']],
  ['球队继续控制球权，重新组织下一次进攻。', [
    'possession_kept', 'possession_maintained', 'maintains_level',
  ]],
  ['处理失误导致球权易手。', ['lost_ball', 'possession_lost', 'play_on_lost']],
  ['传球没有找到目标，球权被对方接管。', ['pass_wrong', 'miss_teammate']],
  ['这次处理制造了新的进攻机会。', [
    'chance_created', 'second_ball_chance', 'shot_created', 'through_success',
  ]],
  ['进攻推进到传中环节，接应球员正在包抄。', ['cross_attempt']],
  ['射门打在门框后弹出。', ['miss_crossbar', 'miss_post']],
  ['射门高出横梁。', ['header_over', 'miss_over', 'miss_over_against', 'miss_panenka']],
  ['射门偏出立柱。', ['miss_near', 'miss_wide', 'miss_wide_power', 'shot_wide']],
  ['这次机会没有转化为有效射门。', ['chance_missed', 'missed_chances']],
  ['射门命中门框范围，门将必须作出处理。', ['shot_on_target']],
  ['逼抢成功，球队在前场夺回球权并发动反击。', ['press_success_counter']],
  ['逼抢没有合拢，对方从空当推进。', ['press_failed_space']],
  ['对方继续从后场组织推进。', ['opponent_builds_up']],
  ['球队保持防守结构，没有失去关键区域。', [
    'shape_held', 'held_scoreline', 'held_off', 'no_more_goals', 'safe',
  ]],
  ['防守球员延缓了进攻，队友获得回位时间。', [
    'caught_up_delay', 'delay_success', 'teammate_helps', 'tracked_successfully',
  ]],
  ['防守球员追回持球者并完成抢断。', ['caught_up_tackle', 'tackle_success', 'tackle_hero']],
  ['放铲没有碰到球，对手继续推进。', ['tackle_miss']],
  ['铲球只改变了来球方向，危险仍未完全解除。', ['tackle_partial']],
  ['持球推进被对手拦截。', ['tackled', 'tackled_advance']],
  ['对方获得直接面对门将的机会。', ['solo_against_gk']],
  ['对方获得射门空间并完成起脚。', ['opponent_shoots']],
  ['对手失去平衡，裁判示意比赛继续。', ['opponent_stumbles']],
  ['攻守转换展开，本方获得反击机会。', ['counter_chance', 'counter_fast']],
  ['定位球被解围，对方立即发动反击。', ['counter_risk']],
  ['对手利用转换进攻锁定比赛。', ['counter_sealed']],
  ['球队回防及时，拦下后续推进。', ['intercept_later']],
  ['裁判认定发生犯规并鸣哨。', ['foul', 'freekick_against']],
  ['身体接触不足以构成犯规，比赛继续。', ['foul_not_called']],
  ['边裁举旗，进攻球员越位。', ['offside', 'offside_fail_solo']],
  ['越位陷阱奏效，边裁举旗终止进攻。', ['offside_success']],
  ['裁判判罚点球。', ['penalty_awarded', 'penalty_won']],
  ['裁判示意比赛继续，没有追加判罚。', ['play_continues', 'no_change']],
  ['裁判向相关球员出示黄牌。', ['yellow_card', 'yellow_card_dissent', 'yellow_card_dive', 'yellow_card_penalty', 'yellow_card_stop']],
  ['对方球员因犯规被出示黄牌。', ['yellow_card_opponent']],
  ['裁判出示红牌并判罚点球。', ['red_card_penalty']],
  ['球员吃到第二张黄牌，两黄变一红被罚下。', ['red_card_second_yellow']],
  ['界外球动作违规，球权判给对方。', ['throw_violation']],
  ['换人后球队强度得到提升。', ['sub_positive_impact']],
  ['换人完成，球队结构保持稳定。', ['sub_neutral']],
  ['换人后短时间内出现配合生疏。', ['sub_disrupts_flow']],
  ['带伤球员继续比赛，但竞技状态明显下降。', ['complete_drop_off']],
  ['球队消耗比赛时间，比分没有变化。', ['time_killed']],
  ['球队为点球大战保留了体能。', ['penalties_fresh', 'calm_shootout']],
  ['比赛进入点球大战。', ['into_penalties']],
  ['禁区二点球仍存在不确定风险。', ['second_ball_risk']],
  ['进攻球员跑位失败，防线身后出现机会。', ['lost_runner_chance']],
  ['对方获得快速反击空间。', ['opponent_counter']],
  ['比赛继续，当前战术没有造成即时比分变化。', ['lucky_chance']],
])

const EXPLICIT_OUTCOME_COMMENTARY = Object.freeze(Object.fromEntries(
  EXPLICIT_OUTCOME_COMMENTARY_GROUPS.flatMap(([template, outcomes]) => (
    outcomes.map((outcome) => [outcome, template])
  )),
))

const SCENARIO_OUTCOME_COMMENTARY = Object.freeze({
  var_goal_review: Object.freeze({
    goal: 'VAR复核结束：进球有效，比分成立。',
    possession_kept: 'VAR复核结束：进攻犯规在先，进球无效，由防守方恢复比赛。',
    no_change: 'VAR复核结束：维持进球判罚，比分成立。',
    yellow_card: 'VAR确认进球有效，但裁判向抗议判罚的球员出示黄牌。',
  }),
  var_offside_goal: Object.freeze({
    goal: 'VAR画线结束：进攻球员没有越位，进球有效。',
    no_change: 'VAR画线结束：进攻球员越位，进球无效。',
    shape_held: 'VAR确认越位，进球无效；球队已经完成重开站位。',
    yellow_card_dissent: 'VAR确认越位，进球无效；抗议球员另被出示黄牌。',
  }),
  var_penalty_review: Object.freeze({
    penalty_awarded: 'VAR复核结束：犯规发生在禁区内，裁判判罚点球。',
    play_continues: 'VAR复核结束：接触不足以构成犯规，比赛继续。',
    possession_maintained: 'VAR复核结束：没有点球，本方继续控制皮球。',
    yellow_card_dissent: 'VAR复核结束：没有点球，裁判向过度抗议的球员出示黄牌。',
    shape_held: 'VAR复核结束：没有点球，球队保持防守站位。',
    opponent_counter: 'VAR复核结束：没有点球，对方已经发动反击。',
  }),
  handball_penalty_claim: Object.freeze({
    penalty_awarded: 'VAR确认防守球员禁区内手球，裁判判罚点球。',
    play_continues: 'VAR确认手臂处于自然位置，没有点球，比赛继续。',
    possession_maintained: 'VAR没有判罚手球，本方继续控制皮球。',
    yellow_card_dissent: 'VAR没有判罚手球，裁判向过度抗议的球员出示黄牌。',
  }),
  defensive_line_handball_var: Object.freeze({
    play_continues: 'VAR确认手臂处于自然位置，没有点球，比赛继续。',
    shape_held: 'VAR没有判罚手球，防线保持站位。',
    yellow_card_penalty: 'VAR确认禁区手球，裁判判罚点球并出示黄牌。',
    red_card_penalty: 'VAR确认门线手球，裁判判罚点球并出示红牌。',
  }),
})

function explicitOutcomeTemplate(scenarioId, outcome) {
  const template = SCENARIO_OUTCOME_COMMENTARY[scenarioId]?.[outcome]
    || EXPLICIT_OUTCOME_COMMENTARY[outcome]
  if (!template) throw new Error(`决策结果缺少显式中文播报：${scenarioId}/${outcome}`)
  return template
}

function buildGeneratedDefinition(scenario) {
  if (!scenario?.id) return null
  const animationType = scenario.animationTag || scenario.animation_type || 'midfield_press'
  const sceneType = getDecisionRuntimeSceneType(scenario)
  if (!sceneType) return null
  const outcomes = Array.from(new Set(
    (scenario.choices || []).flatMap(choice => choice.possible_outcomes || []),
  ))
  return {
    id: `coach.${scenario.id}.v1`,
    type: sceneType,
    sourceScenarioId: scenario.id,
    timeoutSeconds: scenario.countdownSeconds || 6,
    successFormula: DYNAMIC_SUCCESS_FORMULA,
    riskTags: Array.from(new Set([
      ...(scenario.replayTags || []),
      `risk:${scenario.riskLevel || 'medium'}`,
    ])),
    rewardTags: Array.from(new Set([
      ...(scenario.replayTags || []),
      `reward:${scenario.rewardLevel || 'medium'}`,
    ])),
    animationPrelude: {
      animationType,
      eventTag: `coach.${scenario.id}.prelude`,
    },
    animationResult: {
      animationType,
      eventTagPrefix: `coach.${scenario.id}.result`,
    },
    commentaryTemplates: {
      prelude: scenario.situation_variants || [
        '{minute}分钟，{player}正在等待教练的临场指令。',
      ],
      results: Object.fromEntries(outcomes.map(outcome => [
        outcome,
        [explicitOutcomeTemplate(scenario.id, outcome)],
      ])),
    },
    postMatchReviewTag: scenario.trigger || scenario.id,
  }
}

export function getCoachDecisionDefinition(sourceScenarioId, scenario = null) {
  return DEFINITION_BY_SCENARIO_ID.get(sourceScenarioId)
    || buildGeneratedDefinition(scenario)
    || null
}
