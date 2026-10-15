import type { AcCapabilities, AcDeviceSnapshot, AirConditionerState, DeviceBinding } from '~/types'
import { isUnknownRecord } from './cloud-sync'

export interface HomeAssistantEntity {
  entity_id: string
  state: string
  attributes: Record<string, unknown>
  last_updated: string
}

export interface AcCommand {
  service: 'set_hvac_mode' | 'set_temperature'
  data: { hvac_mode?: string, temperature?: number }
}

export const DEFAULT_AC_CAPABILITIES: AcCapabilities = {
  minTemperature: 16,
  maxTemperature: 31,
  temperatureStep: 1,
  hvacModes: ['off', 'cool', 'heat'],
  supportsTemperature: true,
  unsupportedReason: null,
}

export function normalizeHaBaseUrl(value: string, securePage = false) {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !/^\/*$/.test(url.pathname))
    throw new Error('请输入不带路径、凭据或参数的 HTTP(S) HA 地址')
  if (securePage && url.protocol !== 'https:')
    throw new Error('HTTPS 页面需要可通过 WSS 访问的 HTTPS HA 地址')
  return url.origin
}

export function normalizeDeviceBinding(value: unknown): DeviceBinding | null {
  if (!isUnknownRecord(value) || value.provider !== 'home-assistant' || typeof value.baseUrl !== 'string' || typeof value.entityId !== 'string')
    return null
  if (!/^climate\.[a-z0-9_]+$/.test(value.entityId))
    return null
  try {
    return { provider: 'home-assistant', baseUrl: normalizeHaBaseUrl(value.baseUrl), entityId: value.entityId }
  }
  catch {
    return null
  }
}

export function haTokenStorageKey(ownerId: string, baseUrl: string) {
  return `yun-home:ha-token:${encodeURIComponent(ownerId)}:${normalizeHaBaseUrl(baseUrl)}`
}

export function haBindingKey(binding: DeviceBinding) {
  return `${binding.baseUrl}/${binding.entityId}`
}

function finite(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function clampAcTemperature(value: number, capabilities: AcCapabilities) {
  const { minTemperature: min, maxTemperature: max, temperatureStep: step } = capabilities
  const rounded = Math.round((value - min) / step) * step + min
  return Number(Math.max(min, Math.min(max, rounded)).toFixed(4))
}

export function climateToAcState(entity: HomeAssistantEntity, previous?: AirConditionerState): AcDeviceSnapshot {
  const a = entity.attributes
  const min = finite(a.min_temp, 7)
  const max = Math.max(min, finite(a.max_temp, 35))
  const modes = Array.isArray(a.hvac_modes) ? a.hvac_modes.filter((mode): mode is string => typeof mode === 'string') : []
  const capabilities: AcCapabilities = {
    minTemperature: min,
    maxTemperature: max,
    temperatureStep: Math.max(0.01, finite(a.target_temp_step, 1)),
    hvacModes: modes,
    supportsTemperature: (finite(a.supported_features, 0) & 1) !== 0,
    unsupportedReason: a.temperature_unit !== '°C'
      ? '目前仅支持使用摄氏度的实体'
      : !modes.includes('off') || !modes.some(mode => mode === 'cool' || mode === 'heat')
          ? '目前仅支持具有关闭及制冷或制热模式的空调'
          : null,
  }
  const temperature = typeof a.temperature === 'number' && Number.isFinite(a.temperature)
    ? Math.min(max, Math.max(min, a.temperature))
    : null
  const available = !['unknown', 'unavailable'].includes(entity.state)
  return {
    state: {
      status: available && entity.state !== 'off',
      mode: entity.state === 'heat' ? 'hot' : entity.state === 'cool' ? 'cold' : previous?.mode ?? 'cold',
      temperature: temperature ?? previous?.temperature ?? 26,
    },
    reportedAt: entity.last_updated,
    rawMode: entity.state,
    name: typeof a.friendly_name === 'string' ? a.friendly_name : entity.entity_id,
    available,
    targetTemperature: temperature,
    capabilities,
  }
}

export function acModeLabel(rawMode: string) {
  return ({ cool: '制冷', heat: '制热', dry: '除湿', fan_only: '送风', auto: '自动', heat_cool: '自动冷暖', off: '待机', unknown: '状态未知', unavailable: '设备不可用' } as Record<string, string>)[rawMode] ?? rawMode
}

export function planAcCommands(previous: AcDeviceSnapshot, next: AirConditionerState, fields: Partial<AirConditionerState>): AcCommand[] {
  if (!next.status)
    return previous.state.status || fields.status === false ? [{ service: 'set_hvac_mode', data: { hvac_mode: 'off' } }] : []
  const mode = next.mode === 'hot' ? 'heat' : 'cool'
  const turningOn = !previous.state.status
  const commands: AcCommand[] = []
  if (turningOn || fields.status === true || fields.mode !== undefined) {
    if (!previous.capabilities.hvacModes.includes(mode))
      throw new Error('设备不支持所选运行模式')
    commands.push({ service: 'set_hvac_mode', data: { hvac_mode: mode } })
  }
  if (previous.capabilities.supportsTemperature && (turningOn || fields.status === true || fields.temperature !== undefined))
    commands.push({ service: 'set_temperature', data: { temperature: clampAcTemperature(next.temperature, previous.capabilities) } })
  return commands
}

export function nextSnapshotTimestamp(local: string | null, remote: string | null, now = Date.now()) {
  return new Date(Math.max(now, Date.parse(local ?? '') + 1 || 0, Date.parse(remote ?? '') + 1 || 0)).toISOString()
}
