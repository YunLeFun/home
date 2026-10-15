import type { AcDeviceSnapshot, AirConditionerState } from '~/types'
import type { AcCommand } from './home-assistant'
import { planAcCommands } from './home-assistant'

interface Intent {
  revision: number
  target: AirConditionerState
  fields: Partial<AirConditionerState>
}

interface AcControllerOptions {
  execute: (command: AcCommand) => Promise<unknown>
  read: () => Promise<AcDeviceSnapshot>
  render: (state: AirConditionerState, pending: boolean, error: string | null, rawMode: string) => void
  report: (snapshot: AcDeviceSnapshot) => void
}

export function createAcController(options: AcControllerOptions) {
  let confirmed: AcDeviceSnapshot | null = null
  let draft: Partial<AirConditionerState> = {}
  let queued: Intent | null = null
  let active: Intent | null = null
  let executing = false
  let disposed = false
  let revision = 0
  let debounce: ReturnType<typeof setTimeout> | undefined
  let confirmation: ReturnType<typeof setTimeout> | undefined
  let error: string | null = null
  let debounceUntil = 0

  function render() {
    if (confirmed) {
      const requestedMode = queued?.fields.mode ?? active?.fields.mode ?? draft.mode
      const rawMode = requestedMode ? (requestedMode === 'hot' ? 'heat' : 'cool') : confirmed.rawMode
      options.render({ ...confirmed.state, ...draft, ...active?.fields, ...queued?.fields }, Boolean(active || queued), error, rawMode)
    }
  }

  function matches(intent: Intent) {
    if (!confirmed?.available)
      return false
    return Object.entries(intent.fields).every(([key, value]) => {
      if (key === 'mode')
        return confirmed?.rawMode === (value === 'hot' ? 'heat' : 'cool')
      if (key === 'temperature')
        return confirmed?.targetTemperature === value
      return confirmed?.state.status === value
    })
  }

  function receive(snapshot: AcDeviceSnapshot) {
    if (disposed || (confirmed && Date.parse(snapshot.reportedAt) < Date.parse(confirmed.reportedAt)))
      return
    if (snapshot.state.status && !active && !queued)
      draft = {}
    confirmed = snapshot
    options.report(snapshot)
    if (active && !executing && matches(active)) {
      active = null
      clearTimeout(confirmation)
      void flush()
    }
    render()
  }

  async function verify(intent: Intent, failed = false) {
    try {
      const snapshot = await options.read()
      if (disposed || active?.revision !== intent.revision)
        return
      receive(snapshot)
      if (active?.revision === intent.revision) {
        const accepted = matches(intent)
        active = null
        error = accepted ? null : failed ? '指令下发失败，已显示最新读取的设备状态' : '设备未确认操作，已显示最新读取的状态'
        render()
        void flush()
      }
    }
    catch {
      if (!disposed && active?.revision === intent.revision) {
        active = null
        error = '无法确认操作结果，已恢复上次设备状态，请检查设备'
        render()
        void flush()
      }
    }
  }

  async function flush() {
    if (disposed || executing || active || !queued || !confirmed)
      return
    if (Date.now() < debounceUntil) {
      clearTimeout(debounce)
      debounce = setTimeout(() => void flush(), debounceUntil - Date.now())
      return
    }
    const intent = queued
    queued = null
    active = intent
    executing = true
    try {
      const commands = planAcCommands(confirmed, intent.target, intent.fields)
      for (const command of commands) {
        if (disposed || intent.revision !== revision)
          break
        await options.execute(command)
      }
      if (disposed || active?.revision !== intent.revision)
        return
      if (intent.revision !== revision || matches(intent) || commands.length === 0) {
        active = null
      }
      else {
        confirmation = setTimeout(() => void verify(intent), 5000)
      }
    }
    catch {
      if (!disposed && active?.revision === intent.revision) {
        if (!queued)
          await verify(intent, true)
        else
          active = null
      }
    }
    finally {
      executing = false
      if (!disposed) {
        render()
        if (!active && queued)
          void flush()
      }
    }
  }

  function request(target: AirConditionerState, fields: Partial<AirConditionerState>, temperatureOnly: boolean) {
    if (!confirmed || disposed)
      return
    error = null
    revision += 1
    clearTimeout(debounce)
    clearTimeout(confirmation)
    const merged = { ...active?.fields, ...queued?.fields, ...fields }
    if (!executing)
      active = null
    if (!target.status && !confirmed.state.status && !executing) {
      queued = null
      draft = { ...draft, ...fields }
      delete draft.status
      render()
      return
    }
    if (target.status && !confirmed.state.status) {
      Object.assign(merged, { status: true, mode: target.mode })
      if (confirmed.capabilities.supportsTemperature)
        merged.temperature = target.temperature
      draft = {}
    }
    if (!target.status) {
      draft = { ...draft, ...merged }
      delete draft.status
      delete merged.mode
      delete merged.temperature
      merged.status = false
    }
    queued = { revision, target: { ...target }, fields: merged }
    debounceUntil = temperatureOnly ? Date.now() + 600 : 0
    render()
    if (temperatureOnly)
      debounce = setTimeout(() => void flush(), 600)
    else
      void flush()
  }

  function cancel(message: string | null = null) {
    revision += 1
    clearTimeout(debounce)
    clearTimeout(confirmation)
    queued = null
    active = null
    draft = {}
    debounceUntil = 0
    error = message
    render()
  }

  return {
    receive,
    request,
    cancel,
    dispose() {
      cancel()
      disposed = true
    },
  }
}
