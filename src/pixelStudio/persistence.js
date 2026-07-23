const DATABASE_NAME = 'happyseed-pixel-player-studio'
const DATABASE_VERSION = 1
const STORE_NAME = 'drafts'

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      resolve(null)
      return
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveStudioDraft(recipe) {
  const record = { id: 'active-player', recipe, savedAt: new Date().toISOString() }
  const database = await openDatabase()
  if (!database) {
    localStorage.setItem(`${DATABASE_NAME}:active-player`, JSON.stringify(record))
    return record
  }
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(record)
    transaction.oncomplete = resolve
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
  return record
}

export async function loadStudioDraft() {
  const database = await openDatabase()
  if (!database) {
    const stored = localStorage.getItem(`${DATABASE_NAME}:active-player`)
    return stored ? JSON.parse(stored) : null
  }
  const record = await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get('active-player')
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return record
}
