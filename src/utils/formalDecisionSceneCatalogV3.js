import { DECISION_LIBRARY } from '../data/decisionLibrary.js'

export const FORMAL_DECISION_SCENE_CATALOG_V3_SCHEMA = 'formal-decision-scene-catalog-v3'

export const DECISION_PRESENTATION_MODES = Object.freeze({
  LIVE: 'freeze-live',
  STAGED: 'blackout-stage',
  INCIDENT: 'freeze-incident',
  MATCH_STATE: 'freeze-match-state',
})

const A = (kind, intent, extra = {}) => Object.freeze({ kind, intent, ...extra })
const B = (intent, side, role, extra = {}) => A('ball-path', intent, { side, role, ...extra })
const R = (intent, role = 'primary') => A('run-lane', intent, { role })
const scene = (mode, triggerId, safeChoiceId, choices, extra = {}) => Object.freeze({
  schemaVersion: FORMAL_DECISION_SCENE_CATALOG_V3_SCHEMA,
  mode,
  triggerId,
  safeChoiceId,
  choices: Object.freeze(Object.fromEntries(Object.entries(choices).map(([id, affordances]) => [
    id,
    Object.freeze(affordances),
  ]))),
  ...extra,
})

/**
 * 正式 V3 目录刻意逐项登记 53 个场景的每个 choice。
 * 共享的只有绘制原语；场景、触发条件和 choice 语义均不得从文案或 ID 猜测。
 */
export const FORMAL_DECISION_SCENE_CATALOG_V3 = Object.freeze({
  solo_run_penalty: scene('freeze-live', 'solo-breakaway', 'pass_to_teammate', {
    shoot_near_post: [B('shoot-near-post', 'home', 'primary')],
    far_post_shot: [B('shoot-far-post', 'home', 'primary')],
    pass_to_teammate: [
      B('pass-support', 'home', 'primary', { targetRole: 'support' }),
      R('solo-square-run', 'support'),
    ],
  }),
  penalty_area_cross: scene('freeze-live', 'wide-cross-window', 'cutback', {
    low_cross: [B('cross-low', 'home', 'primary', { targetRole: 'support' })],
    high_cross: [B('cross-high', 'home', 'primary', { targetRole: 'aerialTarget' })],
    cutback: [B('cutback', 'home', 'primary', { targetRole: 'support' })],
  }),
  counter_attack_3v2: scene('freeze-live', 'counter-overload', 'one_two_pass', {
    sprint_shoot: [R('carry-goal'), B('shoot-far-post', 'home', 'primary')],
    one_two_pass: [B('one-two', 'home', 'primary', { targetRole: 'support' }), R('support-overlap', 'support')],
    wide_spread: [
      B('switch-wide', 'home', 'primary', { targetRole: 'support' }),
      B('cross-high', 'home', 'support', { startRole: 'support', targetRole: 'aerialTarget' }),
      R('wide-overlap', 'support'),
    ],
  }, {
    outcomeTerminalOverrides: { wide_spread: { corner: 'away-corner-out' } },
    outcomeEffects: { wide_spread: { corner: 'queue-corner-red' } },
  }),
  freekick_dangerous: scene('blackout-stage', 'dangerous-free-kick', 'short_freekick', {
    direct_freekick: [B('free-kick-near', 'home', 'setPieceTaker')],
    freekick_cross: [B('free-kick-cross', 'home', 'setPieceTaker', { targetRole: 'setPieceTarget' })],
    short_freekick: [B('pass-support', 'home', 'setPieceTaker', { targetRole: 'setPieceShortSupport' })],
  }, { sourceEventTypes: ['foul'], sourceEventSide: 'blue', attackingSide: 'red' }),
  penalty_kick: scene('blackout-stage', 'penalty-awarded', 'penalty_placement', {
    penalty_power: [B('penalty-power', 'home', 'setPieceTaker')],
    penalty_placement: [B('penalty-placement', 'home', 'setPieceTaker')],
    penalty_panenka: [B('penalty-panenka', 'home', 'setPieceTaker')],
  }, { sourceEventTypes: ['foul', 'penalty'], sourceEventSide: 'blue', attackingSide: 'red' }),
  long_shot_opportunity: scene('freeze-live', 'long-shot-window', 'control_advance', {
    shoot_now: [B('shoot-far-post', 'home', 'primary')],
    control_advance: [R('carry-forward')],
  }, {
    outcomeTerminalOverrides: { control_advance: { corner_won: 'away-corner-out' } },
    outcomeEffects: { control_advance: { corner_won: 'queue-corner-red' } },
  }),
  header_corner: scene('blackout-stage', 'attacking-corner', 'short_corner', {
    near_post_corner: [B('corner-near', 'home', 'setPieceTaker', { targetRole: 'support' })],
    far_post_corner: [B('corner-far', 'home', 'setPieceTaker', { targetRole: 'setPieceTarget' })],
    short_corner: [B('pass-support', 'home', 'setPieceTaker', { targetRole: 'setPieceShortSupport' })],
  }, { sourceEventTypes: ['corner'], sourceEventSide: 'red', attackingSide: 'red' }),
  through_ball_chance: scene('freeze-live', 'through-run-window', 'hold_ball', {
    play_through: [B('through-run', 'home', 'primary', { targetRole: 'support' }), R('support-run', 'support')],
    hold_ball: [A('zone', 'hold-possession')],
  }, {
    outcomeTerminalOverrides: { hold_ball: { corner_won: 'away-corner-out' } },
    outcomeEffects: { hold_ball: { corner_won: 'queue-corner-red' } },
  }),
  penalty_area_foul_risk: scene('freeze-live', 'box-tackle-window', 'contain_delay', {
    slide_tackle: [A('duel-vector', 'slide-contact')],
    contain_delay: [A('zone', 'contain-channel')],
    tactical_foul_outside: [A('duel-vector', 'tactical-contact')],
  }, {
    outcomeBallResponses: {
      contain_delay: {
        terminals: ['goal-against'],
        affordance: B('opponent-shot', 'away', 'opponent', { startRole: 'opponent' }),
      },
    },
  }),
  gk_one_on_one: scene('freeze-live', 'goalkeeper-one-on-one', 'gk_hold_line', {
    gk_rush_out: [R('keeper-rush', 'homeGoalkeeper'), B('opponent-shot', 'away', 'opponent', { startRole: 'opponent' })],
    gk_hold_line: [A('zone', 'keeper-line'), B('opponent-shot', 'away', 'opponent', { startRole: 'opponent' })],
  }, {
    primaryRole: 'homeGoalkeeper',
    outcomeTerminalOverrides: {
      gk_hold_line: { goal_saved_post: 'home-goalkeeper' },
    },
  }),
  last_defender_tackle: scene('freeze-live', 'last-defender-duel', 'jockey_to_corner', {
    last_man_tackle: [A('duel-vector', 'last-man-tackle')],
    jockey_to_corner: [R('show-touchline'), R('carry-to-corner', 'opponent')],
  }, {
    outcomeTerminalOverrides: { jockey_to_corner: { forced_corner: 'home-corner-out' } },
    outcomeBallResponses: {
      jockey_to_corner: {
        terminals: ['goal-against'],
        affordance: B('opponent-shot', 'away', 'opponent', { startRole: 'opponent' }),
      },
    },
    outcomeEffects: { jockey_to_corner: { forced_corner: 'queue-corner-blue' } },
  }),
  midfield_press_trigger: scene('freeze-live', 'midfield-press-window', 'drop_and_defend', {
    press_immediately: [R('press-carrier'), A('zone', 'press-trap')],
    drop_and_defend: [A('formation', 'mid-block')],
  }),
  tactical_foul_counter: scene('freeze-live', 'counter-contact-window', 'chase_back', {
    tactical_foul_commit: [A('duel-vector', 'tactical-contact')],
    chase_back: [R('recovery-run')],
  }),
  aerial_duel_corner_defending: scene('blackout-stage', 'defending-corner', 'zone_defense_corner', {
    man_mark_striker: [A('duel-vector', 'mark-aerial-target'), B('opponent-cross', 'away', 'setPieceTaker', { targetRole: 'setPieceTarget' })],
    zone_defense_corner: [A('zone', 'six-yard-zone'), B('opponent-cross', 'away', 'setPieceTaker', { targetRole: 'setPieceTarget' })],
  }, { sourceEventTypes: ['corner'], sourceEventSide: 'blue', attackingSide: 'blue' }),
  offside_trap: scene('freeze-live', 'offside-line-window', 'track_runner', {
    offside_trap_spring: [
      A('formation', 'step-offside-line'),
      B('opponent-through', 'away', 'opponent', { targetRole: 'awaySupport' }),
      R('offside-run', 'awaySupport'),
    ],
    track_runner: [R('track-runner')],
  }),
  stamina_collapse_sub: scene('freeze-incident', 'stamina-dead-ball', 'sub_now', {
    sub_now: [A('actor', 'substitution-out')],
    push_through: [A('actor', 'fatigued-player')],
  }, {
    sourceEventTypes: ['corner', 'throw-in', 'goal-kick', 'ball-out'],
    choiceEffects: { sub_now: 'auto-substitute-primary' },
  }),
  trailing_last_ten: scene('freeze-match-state', 'trailing-final-ten', 'structured_pressure', {
    all_out_attack: [A('formation', 'all-out-attack')],
    structured_pressure: [A('formation', 'structured-pressure')],
    accept_defeat: [A('formation', 'hold-shape')],
  }),
  leading_protect: scene('freeze-match-state', 'leading-final-ten', 'time_waste', {
    time_waste: [A('formation', 'possession-shell')],
    keep_pressing: [A('formation', 'continued-press')],
  }),
  extra_time_penalty_shootout_prep: scene('freeze-match-state', 'extra-time-penalty-prep', 'conserve_for_penalties', {
    last_attack: [A('formation', 'last-attack')],
    conserve_for_penalties: [A('formation', 'penalty-conserve')],
  }, { matchPhases: ['extra-time'] }),
  indirect_freekick_box: scene('blackout-stage', 'box-indirect-free-kick', 'pass_out_reload', {
    quick_pass_shot: [B('one-two-shot', 'home', 'setPieceTaker')],
    pass_out_reload: [B('recycle-midfield', 'home', 'setPieceTaker', { targetRole: 'setPieceShortSupport' })],
    dink_cross: [B('dink-far-post', 'home', 'setPieceTaker', { targetRole: 'setPieceTarget' })],
  }, { sourceEventTypes: ['foul'], sourceEventSide: 'blue', attackingSide: 'red' }),
  match_penalty: scene('blackout-stage', 'penalty-awarded', 'penalty_left', {
    penalty_left: [B('penalty-left', 'home', 'setPieceTaker')],
    penalty_right: [B('penalty-right', 'home', 'setPieceTaker')],
    penalty_center: [B('penalty-panenka', 'home', 'setPieceTaker')],
  }, { sourceEventTypes: ['penalty', 'foul'], sourceEventSide: 'blue', attackingSide: 'red' }),
  defender_last_ditch: scene('freeze-live', 'last-ditch-shot', 'stand_ground', {
    commit_tackle: [A('duel-vector', 'shot-block')],
    stand_ground: [A('zone', 'block-angle')],
  }, {
    outcomeTerminalOverrides: { stand_ground: { deflected_corner: 'home-corner-out' } },
    outcomeBallResponses: {
      stand_ground: {
        terminals: ['goal-against', 'blocker', 'home-corner-out'],
        affordance: B('opponent-shot', 'away', 'opponent', { startRole: 'opponent' }),
      },
    },
    outcomeEffects: { stand_ground: { deflected_corner: 'queue-corner-blue' } },
  }),
  throwin_attack: scene('blackout-stage', 'attacking-throw-in', 'short_throw', {
    long_throw: [B('throw-long', 'home', 'setPieceTaker', { targetRole: 'aerialTarget' })],
    short_throw: [B('pass-support', 'home', 'setPieceTaker', { targetRole: 'setPieceShortSupport' })],
    fake_throw: [A('actor', 'throw-feint', { role: 'setPieceTaker' })],
  }, { sourceEventTypes: ['throw-in'], sourceEventSide: 'red', attackingSide: 'red' }),
  var_goal_review: scene('freeze-incident', 'goal-var-review', 'stay_calm', {
    stay_calm: [A('actor', 'scorer-calm')],
    captain_talk: [A('actor', 'captain-referee')],
    restart_focus: [A('formation', 'restart-shape')],
  }, { sourceEventTypes: ['goal', 'var-review'] }),
  keeper_distribution: scene('freeze-live', 'keeper-in-hands', 'short_build_up', {
    short_build_up: [B('keeper-short', 'home', 'homeGoalkeeper', { targetRole: 'support' })],
    long_kick_target: [B('keeper-long', 'home', 'homeGoalkeeper', { targetRole: 'aerialTarget' })],
    slow_release: [A('actor', 'keeper-hold')],
  }),
  midfield_second_ball: scene('freeze-live', 'midfield-loose-ball', 'shield_and_turn', {
    first_touch_forward: [B('first-touch-forward', 'home', 'primary', { targetRole: 'support' })],
    shield_and_turn: [A('actor', 'shield-turn')],
    tactical_bump: [A('duel-vector', 'shoulder-contact')],
  }),
  box_scramble_clearance: scene('freeze-live', 'box-scramble', 'clear_far_side', {
    clear_far_side: [B('clearance-wide', 'home', 'primary', { targetRole: 'support' })],
    body_block: [A('zone', 'goal-line-block'), B('opponent-shot', 'away', 'opponent', { startRole: 'opponent' })],
    keeper_leave: [R('keeper-claim', 'homeGoalkeeper'), B('opponent-shot', 'away', 'opponent', { startRole: 'opponent' })],
  }, {
    outcomeTerminalOverrides: {
      clear_far_side: { corner: 'home-corner-out' },
      keeper_leave: { safe: 'home-goalkeeper' },
    },
    outcomeEffects: { clear_far_side: { corner: 'queue-corner-blue' } },
  }),
  penalty_area_dive: scene('freeze-live', 'box-contact-attack', 'keep_dribbling', {
    keep_dribbling: [R('carry-forward')],
    simulate_contact: [A('duel-vector', 'simulate-contact')],
    shield_for_cutback: [B('cutback', 'home', 'primary', { targetRole: 'support' })],
  }, {
    outcomeTerminalOverrides: { keep_dribbling: { corner_won: 'away-corner-out' } },
    outcomeEffects: { keep_dribbling: { corner_won: 'queue-corner-red' } },
  }),
  var_penalty_review: scene('freeze-incident', 'penalty-var-review', 'reset_shape', {
    calm_appeal: [A('actor', 'captain-referee')],
    surround_referee: [A('actor', 'team-appeal')],
    reset_shape: [A('formation', 'restart-shape')],
  }, {
    sourceEventTypes: ['tackle-contact', 'handball-review', 'var-review'],
    requiresPenaltyArea: true,
  }),
  defend_dangerous_freekick: scene('blackout-stage', 'defending-dangerous-free-kick', 'mark_far_post', {
    tall_wall: [A('formation', 'tall-wall'), B('opponent-free-kick', 'away', 'setPieceTaker')],
    keeper_shift: [R('keeper-shift', 'homeGoalkeeper'), B('opponent-free-kick', 'away', 'setPieceTaker')],
    mark_far_post: [A('duel-vector', 'mark-far-post'), B('opponent-free-kick', 'away', 'setPieceTaker')],
  }, { sourceEventTypes: ['foul'], sourceEventSide: 'red', attackingSide: 'blue' }),
  box_second_ball_chaos: scene('freeze-live', 'box-second-ball', 'clear_first_time', {
    clear_first_time: [B('clearance-wide', 'home', 'primary', { targetRole: 'support' })],
    body_on_line: [A('zone', 'goal-line-block'), B('opponent-shot', 'away', 'opponent', { startRole: 'opponent' })],
    launch_counter: [B('counter-release', 'home', 'primary', { targetRole: 'support' })],
  }, {
    outcomeTerminalOverrides: {
      clear_first_time: { corner_against: 'home-corner-out' },
      body_on_line: { deflected_corner: 'home-corner-out' },
    },
    outcomeEffects: {
      clear_first_time: { corner_against: 'queue-corner-blue' },
      body_on_line: { deflected_corner: 'queue-corner-blue' },
    },
  }),
  penalty_shootout_round: scene('blackout-stage', 'shootout-round', 'shoot_center', {
    shoot_left: [B('penalty-left', 'home', 'setPieceTaker')],
    shoot_right: [B('penalty-right', 'home', 'setPieceTaker')],
    shoot_center: [B('penalty-center', 'home', 'setPieceTaker')],
  }, { matchPhases: ['shootout'] }),
  wing_overlap_cross: scene('freeze-live', 'wing-overlap', 'release_overlap', {
    release_overlap: [B('pass-overlap', 'home', 'primary', { targetRole: 'support' }), R('wide-overlap', 'support')],
    cut_inside_wing: [R('cut-inside'), B('shoot-far-post', 'home', 'primary')],
  }),
  central_cutback_press: scene('freeze-live', 'cutback-window', 'cutback_penalty_spot', {
    cutback_penalty_spot: [B('cutback', 'home', 'primary', { targetRole: 'support' })],
    near_post_smash: [B('shoot-near-post', 'home', 'primary')],
  }),
  half_space_through_run: scene('freeze-live', 'half-space-run', 'recycle_midfield', {
    thread_half_space: [B('through-run', 'home', 'primary', { targetRole: 'support' }), R('support-run', 'support')],
    recycle_midfield: [B('recycle-midfield', 'home', 'primary', { targetRole: 'support' })],
  }),
  low_block_counter_launch: scene('freeze-live', 'defensive-turnover', 'carry_counter_ball', {
    direct_counter_ball: [B('counter-release', 'home', 'primary', { targetRole: 'support' })],
    carry_counter_ball: [R('carry-forward')],
  }, {
    outcomeTerminalOverrides: { carry_counter_ball: { corner_won: 'away-corner-out' } },
    outcomeEffects: { carry_counter_ball: { corner_won: 'queue-corner-red' } },
  }),
  high_press_trap: scene('freeze-live', 'high-press-window', 'shadow_press', {
    press_trap_sideline: [R('press-carrier'), A('zone', 'sideline-ball-trap')],
    shadow_press: [R('shadow-pass-lane')],
  }),
  midfield_switch_play: scene('freeze-live', 'switch-play-window', 'keep_short_triangle', {
    switch_far_side: [B('switch-wide', 'home', 'primary', { targetRole: 'farSideSupport' })],
    keep_short_triangle: [A('formation', 'short-triangle')],
  }),
  fullback_recovery_run: scene('freeze-live', 'fullback-recovery', 'sprint_inside_lane', {
    sprint_inside_lane: [R('recovery-run')],
    slide_touchline: [A('duel-vector', 'touchline-slide')],
  }, {
    outcomeTerminalOverrides: { sprint_inside_lane: { forced_corner: 'home-corner-out' } },
    outcomeEffects: { sprint_inside_lane: { forced_corner: 'queue-corner-blue' } },
  }),
  keeper_sweeper_claim: scene('freeze-live', 'sweeper-window', 'hold_keeper_line', {
    sweeper_claim: [R('keeper-rush', 'homeGoalkeeper'), B('opponent-through', 'away', 'opponent', { targetRole: 'awaySupport' })],
    hold_keeper_line: [A('zone', 'keeper-line'), B('opponent-through', 'away', 'opponent', { targetRole: 'awaySupport' })],
  }, { primaryRole: 'homeGoalkeeper' }),
  var_offside_goal: scene('freeze-incident', 'offside-goal-review', 'hold_celebration', {
    hold_celebration: [A('actor', 'scorer-calm')],
    argue_offside_line: [A('formation', 'offside-review-line')],
  }, { sourceEventTypes: ['goal', 'offside', 'var-review'] }),
  defensive_line_handball_var: scene('freeze-incident', 'defensive-handball-review', 'hands_behind_back', {
    hands_behind_back: [A('actor', 'defender-explain')],
    block_line_anyway: [A('zone', 'goal-line-block')],
  }, { sourceEventTypes: ['shot', 'handball-review'], requiresPenaltyArea: true }),
  handball_penalty_claim: scene('freeze-incident', 'attacking-handball-claim', 'calm_handball_claim', {
    calm_handball_claim: [A('actor', 'captain-referee', { centerKey: 'origin' })],
    crowd_ref_handball: [A('actor', 'team-appeal', { centerKey: 'origin' })],
  }, { sourceEventTypes: ['shot', 'handball-review'], requiresPenaltyArea: true }),
  second_ball_corner_attack: scene('freeze-live', 'corner-second-ball', 'chip_back_post', {
    volley_second_ball: [B('volley-goal', 'home', 'primary')],
    chip_back_post: [B('dink-far-post', 'home', 'primary', { targetRole: 'aerialTarget' })],
  }),
  opponent_dangerous_freekick_wall: scene('blackout-stage', 'defending-dangerous-free-kick', 'jump_wall_timing', {
    jump_wall_timing: [A('formation', 'wall-jump'), B('opponent-free-kick', 'away', 'setPieceTaker')],
    keeper_cheat_far: [R('keeper-shift', 'homeGoalkeeper'), B('opponent-free-kick', 'away', 'setPieceTaker')],
  }, { sourceEventTypes: ['foul'], sourceEventSide: 'red', attackingSide: 'blue' }),
  opponent_short_corner_defense: scene('blackout-stage', 'defending-corner', 'hold_box_shape', {
    rush_short_corner: [R('press-short-corner'), B('opponent-cross', 'away', 'setPieceTaker', { targetRole: 'setPieceTarget' })],
    hold_box_shape: [A('zone', 'six-yard-zone'), B('opponent-cross', 'away', 'setPieceTaker', { targetRole: 'setPieceTarget' })],
  }, {
    sourceEventTypes: ['corner'],
    sourceEventSide: 'blue',
    attackingSide: 'blue',
    outcomeTerminalOverrides: {
      rush_short_corner: { goal_short_corner: 'goal-against' },
    },
  }),
  set_piece_rebound_shot: scene('freeze-live', 'set-piece-rebound', 'rebound_fake_pass', {
    rebound_first_time: [B('volley-goal', 'home', 'primary')],
    rebound_fake_pass: [B('pass-support', 'home', 'primary', { targetRole: 'support' })],
  }),
  penalty_rebound_followup: scene('freeze-live', 'penalty-rebound', 'hold_for_rebound_cutback', {
    follow_rebound: [R('rebound-run'), B('shoot-near-post', 'home', 'primary')],
    hold_for_rebound_cutback: [A('zone', 'rebound-cutback')],
  }),
  injury_play_on: scene('freeze-incident', 'injury-contact', 'sub_injured_player', {
    sub_injured_player: [A('actor', 'substitution-out')],
    play_through_knock: [A('actor', 'injured-player')],
  }, {
    // 只在真实伤病事件时触发（任何对抗都触发会让"带伤坚持"每场都出现）
    sourceEventTypes: ['injury'],
    choiceEffects: { sub_injured_player: 'auto-substitute-primary' },
  }),
  yellow_card_dissent_control: scene('freeze-incident', 'yellow-card-dissent', 'captain_calm_team', {
    captain_calm_team: [A('actor', 'captain-calm-team')],
    keep_arguing_call: [A('actor', 'team-appeal')],
  }, { sourceEventTypes: ['foul', 'card'] }),
  second_yellow_warning: scene('freeze-live', 'booked-defender-duel', 'stand_off_marking', {
    stand_off_marking: [A('zone', 'contain-channel')],
    risk_second_tackle: [A('duel-vector', 'last-man-tackle')],
  }),
  late_keeper_up_corner: scene('blackout-stage', 'late-attacking-corner', 'normal_corner_late', {
    send_keeper_up: [R('keeper-to-box', 'homeGoalkeeper'), B('corner-far', 'home', 'setPieceTaker', { targetRole: 'homeGoalkeeper' })],
    normal_corner_late: [B('corner-near', 'home', 'setPieceTaker', { targetRole: 'support' })],
  }, { sourceEventTypes: ['corner'], sourceEventSide: 'red', attackingSide: 'red' }),
  weather_slippery_tackle: scene('freeze-live', 'wet-pitch-tackle', 'stay_feet_slippery', {
    stay_feet_slippery: [A('zone', 'contain-channel')],
    slide_in_rain: [A('duel-vector', 'slide-contact')],
  }),
})

/**
 * V3 的 outcome 终点是正式执行合同的一部分。这里逐项列出 171 个业务结果，
 * 不再从旧版通用场景桥继承，也不根据 ID 或播报文字猜测。
 * 同一个 outcome 在特定场景需要不同方向时，由该场景的
 * outcomeTerminalOverrides 进一步收紧（例如本方/对方角球）。
 */
export const FORMAL_OUTCOME_TERMINALS_V3 = Object.freeze({
  'ball_cleared': 'blocker',
  'ball_intercepted': 'opponent-transition',
  'ball_out': 'out',
  'blocked_second_ball': 'blocker',
  'blocked_short': 'blocker',
  'blocked_wall': 'blocker',
  'calm_shootout': 'hold',
  'caught_up_delay': 'hold',
  'caught_up_tackle': 'opponent-transition',
  'chance_created': 'support',
  'chance_missed': 'out',
  'claim_cross': 'home-goalkeeper',
  'clean_catch_gk': 'home-goalkeeper',
  'cleared': 'blocker',
  'cleared_far': 'blocker',
  'cleared_header': 'blocker',
  'cleared_low': 'blocker',
  'cleared_near': 'blocker',
  'cleared_second_ball': 'blocker',
  'clutch_moment_saves': 'hold',
  'comeback_goal': 'goal-for',
  'complete_drop_off': 'hold',
  'corner': 'support',
  'corner_against': 'hold',
  'corner_won': 'support',
  'counter_chance': 'hold',
  'counter_equalizer': 'goal-against',
  'counter_fast': 'opponent-transition',
  'counter_golden_goal': 'goal-against',
  'counter_risk': 'opponent-transition',
  'counter_sealed': 'goal-against',
  'cross_attempt': 'support',
  'deflected': 'blocker',
  'deflected_corner': 'blocker',
  'delay_success': 'hold',
  'forced_corner': 'support',
  'foul': 'hold',
  'foul_not_called': 'hold',
  'freekick_against': 'hold',
  'gk_claim': 'away-goalkeeper',
  'gk_claim_ball': 'home-goalkeeper',
  'gk_claims': 'away-goalkeeper',
  'gk_punches': 'home-goalkeeper',
  'gk_reaction_save': 'home-goalkeeper',
  'gk_save_rush': 'home-goalkeeper',
  'goal': 'goal-for',
  'goal_against': 'goal-against',
  'goal_assist': 'goal-for',
  'goal_chip': 'goal-for',
  'goal_chip_over': 'goal-against',
  'goal_closer': 'goal-for',
  'goal_combo': 'goal-for',
  'goal_corner': 'goal-against',
  'goal_cross': 'goal-for',
  'goal_far_header': 'goal-for',
  'goal_freekick': 'goal-for',
  'goal_header': 'goal-for',
  'goal_long': 'goal-for',
  'goal_near_post': 'goal-for',
  'goal_panenka': 'goal-for',
  'goal_placement': 'goal-for',
  'goal_power': 'goal-for',
  'goal_reorganized': 'goal-for',
  'goal_saved_post': 'goal-for',
  'goal_second_ball': 'goal-for',
  'goal_short_corner': 'goal-for',
  'goal_tap_in': 'goal-for',
  'goal_through': 'goal-for',
  'goal_tight_angle': 'goal-against',
  'goal_volley': 'goal-for',
  'goal_zone_gap': 'goal-against',
  'golden_goal': 'goal-for',
  'headed_clear': 'blocker',
  'header_cleared': 'blocker',
  'header_over': 'out',
  'held_off': 'hold',
  'held_scoreline': 'hold',
  'hit_wall': 'blocker',
  'intercept': 'blocker',
  'intercept_later': 'blocker',
  'into_penalties': 'hold',
  'keeper_save_freekick': 'home-goalkeeper',
  'late_equalizer': 'goal-for',
  'lost_ball': 'opponent-transition',
  'lost_runner_chance': 'opponent-transition',
  'lucky_chance': 'support',
  'maintains_level': 'hold',
  'miss_crossbar': 'out',
  'miss_near': 'out',
  'miss_over': 'out',
  'miss_over_against': 'out',
  'miss_panenka': 'out',
  'miss_post': 'out',
  'miss_teammate': 'out',
  'miss_wide': 'out',
  'miss_wide_power': 'out',
  'missed_chances': 'out',
  'no_change': 'hold',
  'no_more_goals': 'hold',
  'offside': 'out',
  'offside_fail_solo': 'out',
  'offside_success': 'hold',
  'opponent_builds_up': 'opponent-transition',
  'opponent_counter': 'opponent-transition',
  'opponent_goal_freekick': 'goal-against',
  'opponent_goal_header': 'goal-against',
  'opponent_goal_scramble': 'goal-against',
  'opponent_header_saved': 'home-goalkeeper',
  'opponent_last_gasp': 'goal-against',
  'opponent_shoots': 'opponent-transition',
  'opponent_stumbles': 'hold',
  'pass_intercepted': 'blocker',
  'pass_wrong': 'out',
  'penalties_fresh': 'hold',
  'penalty_awarded': 'hold',
  'penalty_won': 'hold',
  'play_continues': 'hold',
  'play_on_lost': 'hold',
  'possession_kept': 'support',
  'possession_lost': 'opponent-transition',
  'possession_maintained': 'support',
  'press_failed_space': 'opponent-transition',
  'press_success_counter': 'hold',
  'red_card_penalty': 'hold',
  'red_card_second_yellow': 'hold',
  'safe': 'hold',
  'saved_chip': 'away-goalkeeper',
  'saved_close': 'away-goalkeeper',
  'saved_far': 'away-goalkeeper',
  'saved_freekick': 'away-goalkeeper',
  'saved_freekick_against': 'home-goalkeeper',
  'saved_header': 'away-goalkeeper',
  'saved_long': 'away-goalkeeper',
  'saved_low': 'away-goalkeeper',
  'saved_near': 'away-goalkeeper',
  'saved_panenka': 'away-goalkeeper',
  'saved_placement': 'away-goalkeeper',
  'saved_power': 'away-goalkeeper',
  'saved_rush': 'away-goalkeeper',
  'sealed_win': 'goal-for',
  'second_ball_chance': 'support',
  'second_ball_risk': 'opponent-transition',
  'shape_held': 'hold',
  'shot_blocked': 'blocker',
  'shot_blocked_body': 'blocker',
  'shot_created': 'support',
  'shot_on_target': 'away-goalkeeper',
  'shot_wide': 'out',
  'solo_against_gk': 'opponent-transition',
  'sub_disrupts_flow': 'hold',
  'sub_neutral': 'hold',
  'sub_positive_impact': 'hold',
  'tackle_hero': 'blocker',
  'tackle_miss': 'opponent-transition',
  'tackle_partial': 'opponent-transition',
  'tackle_success': 'blocker',
  'tackled': 'blocker',
  'tackled_advance': 'blocker',
  'teammate_helps': 'hold',
  'through_success': 'support',
  'throw_violation': 'out',
  'time_killed': 'hold',
  'tracked_successfully': 'hold',
  'wall_block': 'blocker',
  'yellow_card': 'hold',
  'yellow_card_dissent': 'hold',
  'yellow_card_dive': 'hold',
  'yellow_card_opponent': 'hold',
  'yellow_card_penalty': 'hold',
  'yellow_card_stop': 'hold',
  'zone_cleared': 'blocker',
})

export const FORMAL_DECISION_MODE_COUNTS_V3 = Object.freeze(Object.values(
  FORMAL_DECISION_SCENE_CATALOG_V3,
).reduce((counts, entry) => ({
  ...counts,
  [entry.mode]: Number(counts[entry.mode] || 0) + 1,
}), {}))

export function validateFormalDecisionSceneCatalogV3() {
  const libraryById = new Map(DECISION_LIBRARY.map((scenario) => [scenario.id, scenario]))
  const configuredIds = Object.keys(FORMAL_DECISION_SCENE_CATALOG_V3)
  const libraryOutcomeIds = Array.from(new Set(DECISION_LIBRARY.flatMap((scenario) => (
    scenario.choices.flatMap((choice) => choice.possible_outcomes || [])
  ))))
  const configuredOutcomeIds = Object.keys(FORMAL_OUTCOME_TERMINALS_V3)
  const errors = []
  for (const scenario of DECISION_LIBRARY) {
    const contract = FORMAL_DECISION_SCENE_CATALOG_V3[scenario.id]
    if (!contract) {
      errors.push(`${scenario.id}.missing`)
      continue
    }
    if (!scenario.choices.some((choice) => choice.id === contract.safeChoiceId)) {
      errors.push(`${scenario.id}.safeChoiceId`)
    }
    for (const choice of scenario.choices) {
      const affordances = contract.choices[choice.id]
      if (!affordances?.length) errors.push(`${scenario.id}.${choice.id}.affordances`)
      for (const affordance of affordances || []) {
        if (!['ball-path', 'run-lane', 'duel-vector', 'zone', 'actor', 'formation'].includes(affordance.kind)) {
          errors.push(`${scenario.id}.${choice.id}.kind`)
        }
        if (affordance.kind === 'ball-path') {
          if (!['home', 'away'].includes(affordance.side)) errors.push(`${scenario.id}.${choice.id}.side`)
          if (!affordance.role) errors.push(`${scenario.id}.${choice.id}.role`)
          if (affordance.targetRole == null && ![
            'shoot-near-post', 'shoot-far-post', 'chip-goalkeeper', 'free-kick-near',
            'penalty-power', 'penalty-placement', 'penalty-panenka', 'penalty-left',
            'penalty-right', 'penalty-center', 'opponent-shot', 'opponent-free-kick',
            'volley-goal', 'one-two-shot',
          ].includes(affordance.intent)) errors.push(`${scenario.id}.${choice.id}.targetRole`)
        }
        if (affordance.kind === 'run-lane' && !affordance.role) {
          errors.push(`${scenario.id}.${choice.id}.runRole`)
        }
      }
    }
    const unknownChoices = Object.keys(contract.choices).filter((choiceId) => (
      !scenario.choices.some((choice) => choice.id === choiceId)
    ))
    unknownChoices.forEach((choiceId) => errors.push(`${scenario.id}.${choiceId}.unknown`))
  }
  configuredIds.filter((id) => !libraryById.has(id)).forEach((id) => errors.push(`${id}.unknown`))
  libraryOutcomeIds
    .filter((id) => !configuredOutcomeIds.includes(id))
    .forEach((id) => errors.push(`outcome.${id}.missing`))
  configuredOutcomeIds
    .filter((id) => !libraryOutcomeIds.includes(id))
    .forEach((id) => errors.push(`outcome.${id}.unknown`))
  if (FORMAL_DECISION_MODE_COUNTS_V3['freeze-live'] !== 30) errors.push('mode.freeze-live')
  if (FORMAL_DECISION_MODE_COUNTS_V3['blackout-stage'] !== 12) errors.push('mode.blackout-stage')
  if (FORMAL_DECISION_MODE_COUNTS_V3['freeze-incident'] !== 8) errors.push('mode.freeze-incident')
  if (FORMAL_DECISION_MODE_COUNTS_V3['freeze-match-state'] !== 3) errors.push('mode.freeze-match-state')
  return {
    valid: errors.length === 0,
    scenarioCount: configuredIds.length,
    outcomeCount: configuredOutcomeIds.length,
    modeCounts: FORMAL_DECISION_MODE_COUNTS_V3,
    errors,
  }
}

export function getFormalDecisionSceneContractV3(scenarioId) {
  return FORMAL_DECISION_SCENE_CATALOG_V3[scenarioId] || null
}
