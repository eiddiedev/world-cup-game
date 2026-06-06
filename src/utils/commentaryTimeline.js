export function appendCommentaryEntry(entries, entry, limit = 40) {
  const previous = entries.at(-1)
  if (previous?.text === entry.text) return entries

  const next = [...entries, entry]
  return next.length > limit ? next.slice(-limit) : next
}

export function openChainedDecision(nextDecision, {
  setDecisionResult,
  setCurrentDecision,
}) {
  setDecisionResult(null)
  setCurrentDecision(nextDecision)
}
