// 云端风扇 for the Yun Home sandbox: same state and actions as the web fan
// (devices/fan/state.ts), without the auto-off timer the sandbox cannot run.
(function () {
  const SPEEDS = [1, 2, 3]
  const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value)

  function create() {
    return { power: false, speed: 1, oscillating: false }
  }

  function normalize(value) {
    const state = isRecord(value) ? value : {}
    return {
      power: typeof state.power === 'boolean' ? state.power : false,
      speed: SPEEDS.includes(state.speed) ? state.speed : 1,
      oscillating: typeof state.oscillating === 'boolean' ? state.oscillating : false,
    }
  }

  function isAction(action) {
    if (!isRecord(action) || typeof action.type !== 'string')
      return false
    switch (action.type) {
      case 'toggle':
      case 'toggle-oscillation':
        return true
      case 'set-speed':
        return SPEEDS.includes(action.speed)
      case 'set-oscillation':
        return typeof action.oscillating === 'boolean'
      default:
        return false
    }
  }

  // Picking a speed also powers the fan on.
  function reduce(value, action) {
    const state = normalize(value)
    switch (action.type) {
      case 'toggle': return { ...state, power: !state.power }
      case 'set-speed': return { ...state, power: true, speed: action.speed }
      case 'toggle-oscillation': return { ...state, oscillating: !state.oscillating }
      case 'set-oscillation': return { ...state, oscillating: action.oscillating }
      default: throw new Error('Unexpected fan action')
    }
  }

  function present(value) {
    const state = normalize(value)
    const mode = `${state.speed} 档${state.oscillating ? ' · 摇头' : ''}`
    return { active: state.power, tone: state.power ? 'active' : 'idle', summary: state.power ? mode : `待机 · ${mode}` }
  }

  globalThis.plugin = { create, normalize, isAction, reduce, present }
})()
