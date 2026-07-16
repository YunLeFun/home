<script setup lang="ts">
import { onMounted } from 'vue'

const { refresh } = useYunleSession()

onMounted(() => {
  refresh()
})
</script>

<template>
  <main class="px-4 text-center">
    <AppMenu />
    <slot />
    <AppFooter mt="4" />
  </main>
</template>
