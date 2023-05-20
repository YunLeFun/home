<script lang="ts" setup>
defineProps<{
  status: boolean
}>()
</script>

<template>
  <div
    class="absolute right-2 top-32 h-1 w-1 rounded-full"
    :style="{
      backgroundColor: (status ? '#38F709' : 'var(--ac-c-border)') || 'transparent',
    }"
  />
</template>
