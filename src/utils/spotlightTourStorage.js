const STORAGE_KEY = 'targeting-2026:spotlight-tours:v1'
const fallbackCompletedTours = new Set()

function getStorage() {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : null
    return storage
      && typeof storage.getItem === 'function'
      && typeof storage.setItem === 'function'
      ? storage
      : null
  } catch {
    return null
  }
}

function readCompletedTours() {
  const storage = getStorage()
  if (!storage) return new Set(fallbackCompletedTours)

  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(value)) return new Set()
    return new Set(value.filter((id) => typeof id === 'string' && id))
  } catch {
    return new Set(fallbackCompletedTours)
  }
}

export function hasCompletedSpotlightTour(id) {
  return Boolean(id) && readCompletedTours().has(id)
}

export function markSpotlightTourComplete(id) {
  if (!id) return
  const completedTours = readCompletedTours()
  completedTours.add(id)

  const storage = getStorage()
  if (!storage) {
    fallbackCompletedTours.add(id)
    return
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify([...completedTours]))
  } catch {
    fallbackCompletedTours.add(id)
  }
}
