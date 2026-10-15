export function climate(state = 'cool', temperature: number | null = 26, reportedAt = '2026-10-15T10:00:00.000Z') {
  return {
    entity_id: 'climate.living_room', state, last_updated: reportedAt,
    attributes: { temperature, min_temp: 16, max_temp: 32, target_temp_step: 0.5, temperature_unit: '°C', hvac_modes: ['off', 'cool', 'heat', 'dry', 'fan_only'], supported_features: 1, friendly_name: '客厅空调' },
  }
}

export class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

export class FakeHaWebSocket extends EventTarget {
  static instances: FakeHaWebSocket[] = []
  static calls: { service: string, service_data: { temperature?: number, hvac_mode?: string } }[] = []
  static entities = [climate()]
  static invalidAuth = false
  static OPEN = 1
  static CLOSED = 3
  OPEN = 1
  CLOSED = 3
  readyState = 0
  haVersion = ''
  subscriptionId = 0

  constructor(public url: string) {
    super()
    FakeHaWebSocket.instances.push(this)
    queueMicrotask(() => {
      this.readyState = 1
      this.dispatchEvent(new Event('open'))
    })
  }

  receive(message: object) {
    queueMicrotask(() => {
      if (this.readyState === 1)
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }))
    })
  }

  push() {
    const states = Object.fromEntries(FakeHaWebSocket.entities.map(entity => [entity.entity_id, {
      s: entity.state, a: entity.attributes, lc: Date.parse(entity.last_updated) / 1000,
      c: { id: 'context', parent_id: null, user_id: null },
    }]))
    this.receive({ id: this.subscriptionId, type: 'event', event: { a: states } })
  }

  send(data: string) {
    const message = JSON.parse(data)
    if (message.type === 'auth') {
      this.receive(FakeHaWebSocket.invalidAuth ? { type: 'auth_invalid' } : { type: 'auth_ok', ha_version: '2026.10.0' })
      return
    }
    if (message.type === 'ping') {
      this.receive({ id: message.id, type: 'pong' })
      return
    }
    this.receive({ id: message.id, type: 'result', success: true, result: message.type === 'get_states' ? FakeHaWebSocket.entities : null })
    if (message.type === 'subscribe_entities') {
      this.subscriptionId = message.id
      this.push()
    }
    if (message.type === 'call_service')
      FakeHaWebSocket.calls.push(message)
  }

  close() {
    this.readyState = 3
    this.dispatchEvent(new Event('close'))
  }

  static reset() {
    this.instances = []
    this.calls = []
    this.entities = [climate()]
    this.invalidAuth = false
  }
}
