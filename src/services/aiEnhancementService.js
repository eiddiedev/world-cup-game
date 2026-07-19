import {
  VOLCENGINE_AI_PLACEHOLDER,
  createAiEnhancementRequest,
} from '../data/aiEnhancement.js'
import { buildLocalAiFallback } from '../data/aiFallbackTemplates.js'

function isUsableProviderResponse(response) {
  return Boolean(
    response
      && typeof response === 'object'
      && typeof response.title === 'string'
      && typeof response.summary === 'string'
      && Array.isArray(response.items),
  )
}

/**
 * Phase-one AI boundary. With no injected provider this always returns local text.
 * A future Volcengine adapter may expose generate(request) and be injected here.
 */
export async function requestAiEnhancement(rawRequest, { provider } = {}) {
  const request = createAiEnhancementRequest(rawRequest)

  if (!provider || typeof provider.generate !== 'function') {
    return buildLocalAiFallback(request, 'provider_not_configured')
  }

  try {
    const response = await provider.generate(request)
    if (!isUsableProviderResponse(response)) {
      return buildLocalAiFallback(request, 'invalid_provider_response')
    }
    return {
      ...response,
      scene: request.scene,
      source: 'volcengine-ai',
      provider: VOLCENGINE_AI_PLACEHOLDER.provider,
      locale: request.locale,
    }
  } catch {
    return buildLocalAiFallback(request, 'provider_request_failed')
  }
}

export function getAiEnhancementCapability() {
  return {
    ...VOLCENGINE_AI_PLACEHOLDER,
    activeOutput: 'local-fallback',
    coreGameDependency: false,
  }
}
