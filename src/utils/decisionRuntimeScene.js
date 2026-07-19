export const DECISION_RUNTIME_SCENE_SCHEMA_VERSION = 'decision-runtime-scene-v1'

export const DECISION_RUNTIME_SCENE_TYPES = Object.freeze([
  'regular_attack',
  'solo_run',
  'counter_attack',
  'dangerous_free_kick',
  'penalty_kick',
  'long_shot',
  'corner',
  'through_ball',
  'penalty_area_foul',
  'goalkeeper_action',
  'defensive_duel',
  'midfield_battle',
  'tactical_foul',
  'defending_corner',
  'offside_trap',
  'substitution',
  'tactical_shape',
  'tactical_pause',
  'var_review',
  'defending_free_kick',
  'box_scramble',
])

const SCENARIO_OVERRIDES = Object.freeze({
  solo_run_penalty: 'solo_run',
  penalty_area_cross: 'regular_attack',
  header_corner: 'corner',
  freekick_dangerous: 'dangerous_free_kick',
  penalty_area_foul_risk: 'penalty_area_foul',
  var_goal_review: 'var_review',
  var_offside_goal: 'var_review',
  defensive_line_handball_var: 'var_review',
  handball_penalty_claim: 'var_review',
  penalty_kick: 'penalty_kick',
  match_penalty: 'penalty_kick',
  penalty_shootout_round: 'penalty_kick',
  extra_time_penalty_shootout_prep: 'tactical_pause',
})

const ANIMATION_TAG_TO_SCENE = Object.freeze({
  attack_solo: 'solo_run',
  attack_cross: 'regular_attack',
  attack_counter: 'counter_attack',
  attack_freekick: 'dangerous_free_kick',
  penalty_shootout: 'penalty_kick',
  attack_long_shot: 'long_shot',
  attack_corner: 'corner',
  attack_through_ball: 'through_ball',
  defend_penalty_risk: 'penalty_area_foul',
  defend_gk_rush: 'goalkeeper_action',
  defend_last_man: 'defensive_duel',
  midfield_press: 'midfield_battle',
  tactical_foul: 'tactical_foul',
  defend_corner: 'defending_corner',
  defend_offside: 'offside_trap',
  substitution: 'substitution',
  tactical_all_out: 'tactical_shape',
  tactical_time_waste: 'tactical_shape',
  tactical_penalty_prep: 'tactical_pause',
  attack_dive: 'penalty_area_foul',
  var_penalty: 'var_review',
  defend_freekick: 'defending_free_kick',
  box_chaos: 'box_scramble',
})

export function getDecisionRuntimeSceneType(scenarioOrEvent) {
  const sourceScenarioId = scenarioOrEvent?.sourceScenarioId || scenarioOrEvent?.id
  const animationTag = scenarioOrEvent?.animationTag
    || scenarioOrEvent?.animation_type
    || scenarioOrEvent?.animationPrelude?.animationType
  return SCENARIO_OVERRIDES[sourceScenarioId]
    || ANIMATION_TAG_TO_SCENE[animationTag]
    || null
}

export function validateDecisionRuntimeSceneCoverage(scenarios = []) {
  const missing = scenarios
    .filter(scenario => !getDecisionRuntimeSceneType(scenario))
    .map(scenario => scenario.id)
  return {
    valid: missing.length === 0,
    covered: scenarios.length - missing.length,
    total: scenarios.length,
    missing,
  }
}

export function getDecisionRuntimeSceneAnimationTags() {
  return { ...ANIMATION_TAG_TO_SCENE }
}
