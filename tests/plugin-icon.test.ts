import { describe, expect, it } from 'vitest'
import { HOME_DEVICES } from '~/constants/home'
import { createFanState } from '~/devices/fan/state'
import { isPluginIconPaint, normalizePluginIcon, PLUGIN_ICON_LIMITS } from '~/devices/icon'
import { createDefaultDeviceState, getDeviceMotionSpeed } from '~/utils/device'

describe('plugin icons', () => {
  it.each(Object.values(HOME_DEVICES).map(device => [device.id, device.appIcon] as const))('ships a valid icon for %s', (_id, icon) => {
    const result = normalizePluginIcon(icon)
    expect(result.errors).toEqual([])
    expect(result.icon).toEqual(icon)
  })

  it('accepts hex colours and host tokens only', () => {
    expect(isPluginIconPaint('#7fbfe9')).toBe(true)
    expect(isPluginIconPaint('tone')).toBe(true)
    expect(isPluginIconPaint('url(https://evil.example/x.svg)')).toBe(false)
    expect(isPluginIconPaint('red;background:url(x)')).toBe(false)
  })

  it('drops markup, handlers and external references from untrusted icons', () => {
    const { icon, errors } = normalizePluginIcon({
      background: ['#ffffff', '#000000'],
      shapes: [
        { type: 'script', d: 'alert(1)' },
        { type: 'path', d: 'M0 0L10 10"/><script>alert(1)</script>', fill: 'url(#x)', onclick: 'alert(1)', href: 'https://evil.example' },
        { type: 'circle', cx: 32, cy: 32, r: 10, fill: 'tone', transform: 'rotate(10) url(x)', motion: 'explode' },
      ],
    })
    expect(icon?.shapes).toEqual([{ type: 'path' }, { type: 'circle', cx: 32, cy: 32, r: 10, fill: 'tone' }])
    expect(JSON.stringify(icon)).not.toMatch(/script|onclick|href|url/)
    expect(errors.length).toBeGreaterThanOrEqual(5)
  })

  it('rejects icons without a usable background or shapes', () => {
    expect(normalizePluginIcon({ background: ['red', 'blue'], shapes: [{ type: 'circle', r: 4 }] }).icon).toBeNull()
    expect(normalizePluginIcon({ background: ['#fff', '#000'], shapes: [] }).icon).toBeNull()
    expect(normalizePluginIcon('<svg/>').icon).toBeNull()
  })

  it('caps the number of shapes and nesting depth', () => {
    const many = Array.from({ length: PLUGIN_ICON_LIMITS.shapes + 5 }, () => ({ type: 'circle', r: 1 }))
    expect(normalizePluginIcon({ background: ['#fff', '#000'], shapes: many }).icon?.shapes).toHaveLength(PLUGIN_ICON_LIMITS.shapes)
    let nested: Record<string, unknown> = { type: 'circle', r: 1 }
    for (let level = 0; level < 8; level++)
      nested = { type: 'group', children: [nested] }
    const result = normalizePluginIcon({ background: ['#fff', '#000'], shapes: [nested] })
    expect(result.errors.some(error => error.includes('nested too deeply'))).toBe(true)
  })
})

describe('icon motion speed', () => {
  it('spins the fan icon faster at higher speeds', () => {
    const fan = createFanState('2026-01-01T00:00:00.000Z')
    const speeds = ([1, 2, 3] as const).map(speed => getDeviceMotionSpeed('fan', { ...fan, power: true, speed }))
    expect(speeds).toEqual([1, 1.6, 2.2])
  })

  it('defaults to 1 for plugins without a motion speed', () => {
    expect(getDeviceMotionSpeed('television', createDefaultDeviceState('television'))).toBe(1)
  })
})
