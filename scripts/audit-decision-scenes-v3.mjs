import { DECISION_LIBRARY } from '../src/data/decisionLibrary.js'
import {
  buildFormalCoachDecision,
  resolveFormalCoachDecisionRule,
} from '../src/utils/formalCoachDecision.js'
import {
  FORMAL_DECISION_SCENE_CATALOG_V3,
  validateFormalDecisionSceneCatalogV3,
} from '../src/utils/formalDecisionSceneCatalogV3.js'
import {
  buildFormalDecisionSceneScriptV3,
  validateDecisionSceneScriptV3,
} from '../src/utils/decisionSceneScriptV3.js'
import { createDangerousFreeKickRuntimeMomentFixture } from '../src/utils/decisionSceneScriptV2.js'
import { buildHappySeedRuntimeActorConfig } from '../src/utils/happySeedRuntimeActors.js'

const actorSource = buildHappySeedRuntimeActorConfig()
const seed = buildFormalCoachDecision({ actorSource, scenarioId: 'freekick_dangerous', minute: 44 })
const runtimeMoment = {
  ...createDangerousFreeKickRuntimeMomentFixture(actorSource, seed),
  runtimeState: 'Match',
  ballOutOfPlay: false,
  ownerIsGoalkeeper: false,
  weather: 'clear',
}
const sourceEvent = {
  id: 'audit.runtime.source',
  type: 'foul',
  sourceEventId: 'audit.runtime.contact',
}

const catalogAudit = validateFormalDecisionSceneCatalogV3()
if (!catalogAudit.valid) throw new Error(`V3 catalog audit failed: ${catalogAudit.errors.join(', ')}`)

let choiceCount = 0
let outcomeCount = 0
let pathCount = 0
let runtimeEffectCount = 0
let ruleResultCount = 0
let passFinishCount = 0
const explicitOutcomeIds = new Set()
const CORNER_OUTCOMES = new Set([
  'corner', 'corner_won', 'corner_against', 'deflected_corner', 'forced_corner',
])
const rows = []

for (const [index, scenario] of DECISION_LIBRARY.entries()) {
  const decision = buildFormalCoachDecision({ actorSource, scenarioId: scenario.id, minute: 44 })
  const script = buildFormalDecisionSceneScriptV3(
    decision,
    actorSource,
    runtimeMoment,
    sourceEvent,
  )
  const validation = validateDecisionSceneScriptV3(script, decision)
  if (!validation.valid) throw new Error(`${scenario.id}: ${validation.errors.join(', ')}`)

  const contract = FORMAL_DECISION_SCENE_CATALOG_V3[scenario.id]
  if (script.mode === 'blackout-stage') {
    const taker = script.actors.setPieceTaker
    const stagedTaker = script.stagedActorPositions.find((entry) => (
      entry.runtimeActorId === taker.runtimeActorId
    ))
    if (!stagedTaker || taker.side !== (contract.attackingSide || 'red')) {
      throw new Error(`${scenario.id}: set-piece taker side/position mismatch`)
    }
    const distance = Math.hypot(
      stagedTaker.normalized[0] - script.ball.normalized[0],
      stagedTaker.normalized[1] - script.ball.normalized[1],
    )
    if (distance >= 0.04) throw new Error(`${scenario.id}: taker is not anchored to the ball`)
  }

  for (const choice of script.choices) {
    choiceCount += 1
    let expectedBallStart = script.ball.normalized
    for (const affordance of choice.affordances) {
      if (affordance.kind !== 'ball-path') continue
      pathCount += 1
      const expectedSide = affordance.side === 'home' ? 'red' : 'blue'
      if (script.actors[affordance.role]?.side !== expectedSide) {
        throw new Error(`${scenario.id}/${choice.id}: ball source side mismatch`)
      }
      if (JSON.stringify(affordance.points[0]) !== JSON.stringify(expectedBallStart)) {
        throw new Error(`${scenario.id}/${choice.id}: ball path chain is discontinuous`)
      }
      expectedBallStart = affordance.points.at(-1)
      if (affordance.runtimeEventType === 'pass' && !affordance.targetRole) {
        throw new Error(`${scenario.id}/${choice.id}: pass receiver is inferred instead of explicit`)
      }
    }
    for (const [outcomeId, outcome] of Object.entries(choice.outcomes)) {
      outcomeCount += 1
      explicitOutcomeIds.add(outcomeId)
      if (!['runtime-fact', 'rule-result'].includes(outcome.feedbackMode)) {
        throw new Error(`${scenario.id}/${choice.id}: missing explicit outcome feedback mode`)
      }
      if (outcome.feedbackMode === 'rule-result') ruleResultCount += 1
      if (outcome.runtimeEffect) runtimeEffectCount += 1
      if (CORNER_OUTCOMES.has(outcomeId) && !String(outcome.runtimeEffect || '').startsWith('queue-corner-')) {
        throw new Error(`${scenario.id}/${choice.id}/${outcomeId}: corner has no native restart effect`)
      }
      const endpoint = outcome.path?.at(-1)
      if (endpoint && outcome.terminal === 'goal-for'
        && JSON.stringify(endpoint) !== JSON.stringify(script.fieldAnchors.homeAttackGoal)) {
        throw new Error(`${scenario.id}/${choice.id}: goal-for targets the wrong goal`)
      }
      if (endpoint && outcome.terminal === 'goal-against'
        && JSON.stringify(endpoint) !== JSON.stringify(script.fieldAnchors.homeDefendGoal)) {
        throw new Error(`${scenario.id}/${choice.id}: goal-against targets the wrong goal`)
      }
      if (outcome.terminal === 'hold' && choice.runtimeBallEventType === 'shot' && outcome.path) {
        throw new Error(`${scenario.id}/${choice.id}: unrealized shot still moves the football`)
      }
      const isPassFinish = outcome.runtimeBallEventType === 'pass'
        && ['goal-for', 'goal-against'].includes(outcome.terminal)
      if (isPassFinish) {
        passFinishCount += 1
        if (!['pass-then-shot', 'pass-sequence-then-shot'].includes(outcome.executionMode)) {
          throw new Error(`${scenario.id}/${choice.id}: pass finish collapsed into a direct shot`)
        }
        if (outcome.secondaryRuntimeEvents.at(-1)?.type !== 'shot') {
          throw new Error(`${scenario.id}/${choice.id}: pass finish has no receiving shot event`)
        }
      }
    }
    for (const outcomeId of new Set(
      decision.choices.find((candidate) => candidate.id === choice.id).possible_outcomes,
    )) {
      const resolution = resolveFormalCoachDecisionRule(decision, choice.id, {
        outcomeOverride: outcomeId,
      })
      if (!resolution.resultText || resolution.resultText.includes('场上局面随之更新')) {
        throw new Error(`${scenario.id}/${choice.id}/${outcomeId}: generic commentary fallback`)
      }
    }
  }
  rows.push(`${String(index + 1).padStart(2, '0')} ${scenario.id} · ${scenario.trigger}`)
}

console.log('DecisionSceneScriptV3 semantic audit passed.')
rows.forEach((row) => console.log(`✓ ${row}`))
console.log(`${DECISION_LIBRARY.length} scenes / ${choiceCount} choices / ${outcomeCount} outcome branches / ${pathCount} authored paths`)
console.log(`${passFinishCount} pass-to-finish branches / ${ruleResultCount} rule-result branches / ${runtimeEffectCount} runtime-effect branches`)
console.log(`${explicitOutcomeIds.size} unique outcomes with explicit Chinese commentary`)
