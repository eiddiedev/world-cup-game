# ADR: Decision System V2

Date: 2026-07-06

Updated: 2026-07-07

## Context

The semifinal roadmap asks the match layer to remain a runtime renderer while game rules, timed choices, risk/reward, ability impact, and post-match review stay in the decision system.

## Decision

Decision System V2 keeps `src/data/decisionLibrary.js` as the data source and enriches every scenario with:

- `countdownSeconds`
- `riskLevel`
- `rewardLevel`
- `abilityImpact`
- `animationTag`
- `replayTags`

The Match Runtime receives only event and animation labels such as `animation_type` and `animationTag`. It does not own football rules, probability formulas, cards, penalties, VAR, or replay logic.

Decision System V2 is scoped to coach mode. It does not implement direct player movement, direct passing input, direct shooting input, WebSocket transport, or realtime PVP. Player mode and penalty mode may reuse the same pitch, players, ball, animation assets, team data, and runtime labels, but they must own their own input layer.

The core decision loop must run locally. Volcano Engine AI can later provide dynamic commentary, coach suggestions, and richer post-match writing, but AI calls cannot be required for resolving decisions, football rules, cards, penalties, VAR, xG, or balance simulation.

The package target for semifinal delivery is 80-120MB. 150MB is the hard upper bound for release builds; 200MB is treated only as a platform ceiling, not an acceptable target.

## Rules Scope

The V2 library covers 50+ key scenarios, including penalty-area fouls, VAR handball and offside reviews, diving, corner second balls, dangerous opponent free kicks, second-yellow risk, injury decisions, and late goalkeeper-up corners.

High-risk results are still possible, but severe card outcomes are weighted as rare tail events inside the failed-result pool. Three-outcome high-risk choices are split so that the first result is the clean success, ordinary failure comes next, and red-card outcomes remain the extreme tail.

## Consequences

- Post-match review can group decisions by replay tags such as `penalty`, `var`, `set-piece`, `discipline`, `transition`, and `fitness`.
- Timed decisions can auto-resolve to a conservative option without changing match rendering.
- Balance simulation can run from the same decision library and formulas used by the app.
- Every decision declares `modeScope: coach` and a runtime contract that marks the shared 2.5D runtime, local-core logic, no network dependency, and optional Volcano AI enhancement.
