import { DECISION_LIBRARY } from '../data/decisionLibrary.js'

export const FORMAL_DECISION_SCENE_CATALOG_SCHEMA = 'formal-decision-scene-catalog-v1'

const SCENE_GROUPS = Object.freeze([
  Object.freeze({
    ids: [
      'solo_run_penalty',
      'penalty_area_cross',
      'freekick_dangerous',
      'penalty_kick',
      'long_shot_opportunity',
      'header_corner',
      'through_ball_chance',
      'indirect_freekick_box',
      'match_penalty',
      'throwin_attack',
      'var_goal_review',
      'penalty_area_dive',
      'var_penalty_review',
      'wing_overlap_cross',
      'central_cutback_press',
      'half_space_through_run',
      'handball_penalty_claim',
      'second_ball_corner_attack',
      'set_piece_rebound_shot',
      'penalty_rebound_followup',
      'late_keeper_up_corner',
    ],
    possession: 'red',
    zone: 'attacking-third',
    display: 'trajectory',
    primaryAction: 'shoot',
  }),
  Object.freeze({
    ids: [
      'penalty_area_foul_risk',
      'gk_one_on_one',
      'last_defender_tackle',
      'tactical_foul_counter',
      'aerial_duel_corner_defending',
      'offside_trap',
      'defender_last_ditch',
      'box_scramble_clearance',
      'defend_dangerous_freekick',
      'box_second_ball_chaos',
      'fullback_recovery_run',
      'keeper_sweeper_claim',
      'var_offside_goal',
      'defensive_line_handball_var',
      'opponent_dangerous_freekick_wall',
      'opponent_short_corner_defense',
      'weather_slippery_tackle',
    ],
    possession: 'blue',
    zone: 'defensive-third',
    display: 'zone',
    primaryAction: 'jump',
  }),
  Object.freeze({
    ids: [
      'counter_attack_3v2',
      'midfield_press_trigger',
      'keeper_distribution',
      'midfield_second_ball',
      'low_block_counter_launch',
      'high_press_trap',
      'midfield_switch_play',
    ],
    possession: 'either',
    zone: 'middle-third',
    display: 'trajectory',
    primaryAction: 'shoot',
  }),
  Object.freeze({
    ids: [
      'stamina_collapse_sub',
      'trailing_last_ten',
      'leading_protect',
      'extra_time_penalty_shootout_prep',
      'penalty_shootout_round',
      'injury_play_on',
      'yellow_card_dissent_control',
      'second_yellow_warning',
    ],
    possession: 'either',
    zone: 'anywhere',
    display: 'actor',
    primaryAction: 'jump',
  }),
])

function createSceneCatalog() {
  const entries = SCENE_GROUPS.flatMap((group) => group.ids.map((scenarioId) => [
    scenarioId,
    Object.freeze({
      schemaVersion: FORMAL_DECISION_SCENE_CATALOG_SCHEMA,
      scenarioId,
      possession: group.possession,
      zone: group.zone,
      display: group.display,
      primaryAction: group.primaryAction,
    }),
  ]))
  return Object.freeze(Object.fromEntries(entries))
}

export const FORMAL_DECISION_SCENE_CATALOG = createSceneCatalog()

const OUTCOME_GROUPS = Object.freeze({
  'goal-for': Object.freeze([
    'comeback_goal', 'goal', 'goal_assist', 'goal_chip', 'goal_closer', 'goal_combo',
    'goal_cross', 'goal_far_header', 'goal_freekick', 'goal_header', 'goal_long',
    'goal_near_post', 'goal_panenka', 'goal_placement', 'goal_power', 'goal_reorganized',
    'goal_saved_post', 'goal_second_ball', 'goal_short_corner', 'goal_tap_in',
    'goal_through', 'goal_volley', 'golden_goal', 'late_equalizer', 'sealed_win',
  ]),
  'goal-against': Object.freeze([
    'counter_equalizer', 'counter_golden_goal', 'counter_sealed', 'goal_against',
    'goal_chip_over', 'goal_corner', 'goal_tight_angle', 'goal_zone_gap',
    'opponent_goal_freekick', 'opponent_goal_header', 'opponent_goal_scramble',
    'opponent_last_gasp',
  ]),
  'away-goalkeeper': Object.freeze([
    'gk_claims', 'saved_chip', 'saved_close', 'saved_far', 'saved_freekick',
    'saved_header', 'saved_long', 'saved_low', 'saved_near', 'saved_panenka',
    'saved_placement', 'saved_power', 'saved_rush', 'shot_on_target',
  ]),
  'home-goalkeeper': Object.freeze([
    'claim_cross', 'clean_catch_gk', 'gk_claim', 'gk_claim_ball', 'gk_punches',
    'gk_reaction_save', 'gk_save_rush', 'keeper_save_freekick',
    'opponent_header_saved', 'saved_freekick_against',
  ]),
  blocker: Object.freeze([
    'ball_cleared', 'blocked_second_ball', 'blocked_short', 'blocked_wall', 'cleared',
    'cleared_far', 'cleared_header', 'cleared_low', 'cleared_near',
    'cleared_second_ball', 'deflected', 'deflected_corner', 'headed_clear',
    'header_cleared', 'hit_wall', 'intercept', 'intercept_later', 'pass_intercepted',
    'shot_blocked', 'shot_blocked_body', 'tackle_hero', 'tackle_success',
    'tackled', 'tackled_advance', 'wall_block', 'zone_cleared',
  ]),
  out: Object.freeze([
    'ball_out', 'chance_missed', 'header_over', 'miss_crossbar', 'miss_near',
    'miss_over', 'miss_over_against', 'miss_panenka', 'miss_post', 'miss_teammate',
    'miss_wide', 'miss_wide_power', 'missed_chances', 'offside', 'offside_fail_solo',
    'pass_wrong', 'shot_wide', 'throw_violation',
  ]),
  support: Object.freeze([
    'chance_created', 'corner', 'corner_won', 'cross_attempt', 'forced_corner',
    'lucky_chance', 'possession_kept', 'possession_maintained',
    'second_ball_chance', 'shot_created', 'through_success',
  ]),
  'opponent-transition': Object.freeze([
    'ball_intercepted', 'caught_up_tackle', 'counter_fast', 'counter_risk',
    'lost_ball', 'lost_runner_chance', 'opponent_builds_up', 'opponent_counter',
    'opponent_shoots', 'possession_lost', 'press_failed_space', 'second_ball_risk',
    'solo_against_gk', 'tackle_miss', 'tackle_partial',
  ]),
  hold: Object.freeze([
    'calm_shootout', 'caught_up_delay', 'clutch_moment_saves', 'complete_drop_off',
    'corner_against', 'counter_chance', 'delay_success', 'foul', 'foul_not_called',
    'freekick_against', 'held_off', 'held_scoreline', 'into_penalties', 'maintains_level',
    'no_change', 'no_more_goals', 'offside_success', 'opponent_stumbles',
    'penalties_fresh', 'penalty_awarded', 'penalty_won', 'play_continues',
    'play_on_lost', 'press_success_counter', 'red_card_penalty', 'red_card_second_yellow',
    'safe', 'shape_held', 'sub_disrupts_flow', 'sub_neutral', 'sub_positive_impact',
    'teammate_helps', 'time_killed', 'tracked_successfully', 'yellow_card',
    'yellow_card_dissent', 'yellow_card_dive', 'yellow_card_opponent',
    'yellow_card_penalty', 'yellow_card_stop',
  ]),
})

function createOutcomeCatalog() {
  const entries = Object.entries(OUTCOME_GROUPS).flatMap(([terminal, outcomes]) => (
    outcomes.map((outcomeId) => [outcomeId, terminal])
  ))
  return Object.freeze(Object.fromEntries(entries))
}

export const FORMAL_OUTCOME_VISUAL_TERMINALS = createOutcomeCatalog()

function inZone(zone, ballX) {
  if (zone === 'attacking-third') return ballX >= 0.53
  if (zone === 'defensive-third') return ballX <= 0.47
  if (zone === 'middle-third') return ballX >= 0.24 && ballX <= 0.76
  return true
}

export function isFormalDecisionMomentEligible(scenarioId, runtimeMoment) {
  const contract = FORMAL_DECISION_SCENE_CATALOG[scenarioId]
  const ball = runtimeMoment?.ball?.normalized
  if (!contract || !Array.isArray(ball) || runtimeMoment.ballOutOfPlay) return false
  if (scenarioId === 'freekick_dangerous') {
    return Boolean(
      runtimeMoment.ownerRuntimeActorId
      && runtimeMoment.attackingSide === 'red'
      && Number(ball[0]) >= 0.54
      && Number(ball[0]) <= 0.84
      && Number(ball[1]) >= 0.12
      && Number(ball[1]) <= 0.88
    )
  }
  if (contract.possession !== 'either' && runtimeMoment.attackingSide !== contract.possession) {
    return false
  }
  return inZone(contract.zone, Number(ball[0]))
}

export function validateFormalDecisionSceneCatalog() {
  const scenarioIds = DECISION_LIBRARY.map((scenario) => scenario.id)
  const configuredIds = Object.keys(FORMAL_DECISION_SCENE_CATALOG)
  const outcomeIds = Array.from(new Set(DECISION_LIBRARY.flatMap((scenario) => (
    scenario.choices.flatMap((choice) => choice.possible_outcomes || [])
  ))))
  const configuredOutcomeIds = Object.keys(FORMAL_OUTCOME_VISUAL_TERMINALS)
  const duplicateScenarioIds = SCENE_GROUPS.flatMap((group) => group.ids)
    .filter((id, index, all) => all.indexOf(id) !== index)
  const duplicateOutcomeIds = Object.values(OUTCOME_GROUPS).flat()
    .filter((id, index, all) => all.indexOf(id) !== index)
  const missingScenarios = scenarioIds.filter((id) => !configuredIds.includes(id))
  const unknownScenarios = configuredIds.filter((id) => !scenarioIds.includes(id))
  const missingOutcomes = outcomeIds.filter((id) => !configuredOutcomeIds.includes(id))
  const unknownOutcomes = configuredOutcomeIds.filter((id) => !outcomeIds.includes(id))

  return {
    valid: !duplicateScenarioIds.length
      && !duplicateOutcomeIds.length
      && !missingScenarios.length
      && !unknownScenarios.length
      && !missingOutcomes.length
      && !unknownOutcomes.length,
    scenarioCount: scenarioIds.length,
    outcomeCount: outcomeIds.length,
    duplicateScenarioIds,
    duplicateOutcomeIds,
    missingScenarios,
    unknownScenarios,
    missingOutcomes,
    unknownOutcomes,
  }
}
