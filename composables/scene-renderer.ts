import { computed, onMounted } from 'vue'

/**
 * What draws the home: the 3D diorama, or a pre-rendered poster of it while
 * 3D cannot run (server render, first paint, no WebGL2, or a lost context).
 */
export type SceneRenderer = '3d' | 'poster'

function supportsWebGL2() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'))
  }
  catch {
    return false
  }
}

/**
 * Whether the home can be drawn in 3D. The server and the first client paint
 * show the poster; the client starts 3D once it knows WebGL2 is available.
 */
export function useSceneRenderer() {
  const supported = useState('scene-3d-supported', () => false)
  const resolved = useState('scene-3d-resolved', () => false)

  onMounted(() => {
    if (resolved.value)
      return
    supported.value = supportsWebGL2()
    resolved.value = true
  })

  const renderer = computed<SceneRenderer>(() => resolved.value && supported.value ? '3d' : 'poster')

  /** Fall back to the poster for this visit, for example after losing the WebGL context. */
  function disable3d() {
    supported.value = false
  }

  return { renderer, supported, resolved, disable3d }
}
