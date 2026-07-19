import {
  getFallbackKnockoutOpponents,
  sanitizeKnockoutOpponents,
} from '../utils/knockoutResolver'

export async function generateKnockoutOpponents(context) {
  const fallback = getFallbackKnockoutOpponents(context)
  return sanitizeKnockoutOpponents(null, fallback, context.teamName)
}
