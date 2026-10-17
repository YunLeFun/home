import type { Ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { phaseForHour, useSceneTime } from '~/composables/scene-time'

describe('scene time', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps hours to lighting phases', () => {
    expect(phaseForHour(6)).toBe('dawn')
    expect(phaseForHour(10)).toBe('day')
    expect(phaseForHour(18)).toBe('dusk')
    expect(phaseForHour(23)).toBe('night')
    expect(phaseForHour(2)).toBe('night')
  })

  it('renders daytime before mount in dark mode, then night', async () => {
    const states = new Map<string, Ref<unknown>>()
    vi.stubGlobal('useState', (key: string, init: () => unknown) => {
      if (!states.has(key))
        states.set(key, ref(init()))
      return states.get(key)
    })
    vi.stubGlobal('useColorMode', () => ref('dark'))

    let phase: ReturnType<typeof useSceneTime>['phase'] | undefined
    const Scene = defineComponent(() => {
      phase = useSceneTime().phase
      return () => h('div', { 'data-phase': phase!.value })
    })

    // The server and the hydrating client cannot tell dark mode apart yet.
    expect(await renderToString(createSSRApp(Scene))).toContain('data-phase="day"')

    states.get('scene-time-mounted')!.value = true
    expect(phase!.value).toBe('night')
  })
})
