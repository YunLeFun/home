import { computed, onMounted } from 'vue'

/** How the home scene is drawn: the 3D diorama or the nostalgic 2D plan. */
export type SceneMode = '3d' | '2d'

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
 * The scene mode preference. 3D is the default where WebGL2 is available and
 * reduced motion is off; the server and the first client paint draw 2D, then
 * the client switches once it knows what the device supports.
 */
export function useSceneMode() {
  const preference = useState<SceneMode | null>('scene-mode-preference', () => null)
  const supported = useState('scene-mode-3d-supported', () => false)
  const reducedMotion = useState('scene-mode-reduced-motion', () => false)
  const resolved = useState('scene-mode-resolved', () => false)

  onMounted(() => {
    if (resolved.value)
      return
    supported.value = supportsWebGL2()
    reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    preference.value = readPreference()
    resolved.value = true
  })

  const mode = computed<SceneMode>(() => {
    if (!resolved.value || !supported.value)
      return '2d'
    return preference.value ?? (reducedMotion.value ? '2d' : '3d')
  })

  function setMode(next: SceneMode) {
    preference.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    }
    catch {
      // Storage can be unavailable in private windows; the choice still applies to this visit.
    }
  }

  /** Fall back to 2D for this visit, for example after losing the WebGL context. */
  function disable3d() {
    supported.value = false
  }

  return { mode, supported, resolved, reducedMotion, setMode, disable3d }
}
