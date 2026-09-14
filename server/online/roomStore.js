import { createClient } from 'redis'

const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value))

export class MemoryRoomStore {
  constructor() {
    this.rooms = new Map()
  }

  async connect() {}
  async close() { this.rooms.clear() }
  async get(code) { return clone(this.rooms.get(code) || null) }
  async set(code, room) { this.rooms.set(code, clone(room)) }
  async delete(code) { this.rooms.delete(code) }
  async count() { return this.rooms.size }
}

export class RedisRoomStore {
  constructor({ url, prefix = 'happyseed:room:', ttlSeconds = 7200 } = {}) {
    this.client = createClient({ url })
    this.prefix = prefix
    this.ttlSeconds = ttlSeconds
    this.client.on('error', (error) => console.error('[online-room-store]', error))
  }

  key(code) { return `${this.prefix}${code}` }
  async connect() { if (!this.client.isOpen) await this.client.connect() }
  async close() { if (this.client.isOpen) await this.client.quit() }
  async get(code) {
    const raw = await this.client.get(this.key(code))
    return raw ? JSON.parse(raw) : null
  }
  async set(code, room) {
    await this.client.set(this.key(code), JSON.stringify(room), { EX: this.ttlSeconds })
  }
  async delete(code) { await this.client.del(this.key(code)) }
  async count() {
    let cursor = '0'
    let count = 0
    do {
      const result = await this.client.scan(cursor, { MATCH: `${this.prefix}*`, COUNT: 200 })
      cursor = String(result.cursor)
      count += result.keys.length
    } while (cursor !== '0')
    return count
  }
}

export function createRoomStore(environment = process.env) {
  return environment.REDIS_URL
    ? new RedisRoomStore({ url: environment.REDIS_URL })
    : new MemoryRoomStore()
}
