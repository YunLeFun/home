import { acceptHMRUpdate, defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export type AcMode = 'cold' | 'hot'

export const useAcStore = defineStore('ac', () => {
  const status = useStorage('ac:status', false)
  const mode = useStorage<AcMode>('ac:mode', 'cold')
  const temperature = useStorage('ac:temperature', 26)

  return {
    status,
    mode,
    temperature,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAcStore, import.meta.hot))
