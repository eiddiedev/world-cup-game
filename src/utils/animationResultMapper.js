import { ANIMATION_TEMPLATES } from './animationTemplates.js'

const RESULT_CANDIDATES = {
  goal: ['goal', 'goal_left', 'goal_center', 'good_impact'],
  goal_against: ['goal_against', 'counter_against', 'opponent_goal'],
  saved: ['saved', 'save', 'counter_saved', 'saved_left', 'saved_right', 'safe'],
  miss: ['miss', 'post', 'safe', 'no_change'],
  safe: ['safe', 'intercept', 'counter_chance', 'no_change'],
  foul: ['foul', 'yellow_card'],
  yellow_card: ['yellow_card', 'foul'],
  red_card: ['red_card', 'foul'],
  intercept: ['intercept', 'safe'],
  opponent_escape: ['opponent_escape', 'goal_against'],
  good_impact: ['good_impact', 'safe'],
  no_change: ['no_change', 'safe', 'miss'],
}

function classifyOutcome(outcome) {
  if (['counter_sealed', 'counter_golden_goal', 'goal_against', 'counter_equalizer'].includes(outcome)) return 'goal_against'
  if (outcome.startsWith('goal')) return 'goal'
  if (outcome.includes('red_card')) return 'red_card'
  if (outcome.includes('yellow_card')) return 'yellow_card'
  if (outcome.includes('foul') || outcome.includes('penalty')) return 'foul'
  if (outcome.includes('save') || outcome.includes('saved') || outcome.includes('claim') || outcome.includes('catch') || outcome.includes('punch')) return 'saved'
  if (outcome.includes('miss') || outcome.includes('wide') || outcome.includes('over') || outcome.includes('post') || outcome.includes('blocked') || outcome.includes('wall')) return 'miss'
  if (outcome.includes('cleared') || outcome.includes('intercept') || outcome.includes('offside') || outcome.includes('tackle') || outcome.includes('success')) return 'safe'
  if (outcome.includes('fail') || outcome.includes('lost') || outcome.includes('risk') || outcome.includes('against')) return 'opponent_escape'
  if (outcome.includes('press')) return 'intercept'
  if (outcome.includes('sub_positive') || outcome.includes('fresh') || outcome.includes('maintains')) return 'good_impact'
  return 'no_change'
}

export function getResultAnimationKey(eventType, outcome) {
  const animations = ANIMATION_TEMPLATES[eventType]?.result_animations
  if (!animations) return null
  if (animations[outcome]) return outcome
  const family = classifyOutcome(outcome)
  return RESULT_CANDIDATES[family]?.find(key => animations[key]) || Object.keys(animations)[0] || null
}
