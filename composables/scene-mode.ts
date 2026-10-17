import { computed, onMounted } from 'vue'

/** How the home scene is drawn: the 3D diorama or the nostalgic 2D plan. */
export type SceneMode = '3d' | '2d'

/**
 * What draws the home right now: the 3D diorama, the 2D plan when chosen, or
 * a pre-rendered poster of the diorama while 3D cannot run (server render,
 * first paint, no WebGL2, or a lost context).
 */
export type SceneRenderer = '3d' | '2d' | 'poster'

const STORAGE_KEY = 'yun-home:scene-mode'

function readPreference(): SceneMode | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === '3d' || value === '2d' ? value : null
  }
  catch {
    return null
  }
}

function supportsWebGL2() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  }
  catch {
    return false
  }
}

/**
 * The scene mode preference. 3D is the default, reduced motion included (it
 * renders on demand then). The server and the first client paint show the
 * poster; the client starts 3D once it knows WebGL2 is available.
 */
export function useSceneMode() {
  const preference = useState<SceneMode | null>('scene-mode-preference', () => null)
  const supported = useState('scene-mode-3d-supported', () => false)
  const resolved = useState('scene-mode-resolved', () => false)

  onMounted(() => {
    if (resolved.value)
      return
    supported.value = supportsWebGL2()
    preference.value = readPreference()
    resolved.value = true
  })

  const renderer = computed<SceneRenderer>(() => {
    if (preference.value === '2d')
      return '2d'
    return resolved.value && supported.value ? '3d' : 'poster'
  })
  const mode = computed<SceneMode>(() => renderer.value === '2d' ? '2d' : '3d')

  function setMode(next: SceneMode) {
    preference.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    }
    catch {
      // Storage can be unavailable in private windows; the choice still applies to this visit.
    }
  }

  /** Fall back to the poster for this visit, for example after losing the WebGL context. */
  function disable3d() {
    supported.value = false
  }

  return { mode, renderer, supported, resolved, setMode, disable3d }
}
