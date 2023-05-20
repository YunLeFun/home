<script lang="ts" setup>
defineProps<{
  mode: 'cold' | 'hot'
}>()
</script>

<template>
  <div
    class="absolute right-8 top-6"
    color="$ac-c-display"
  >
    <h6 class="text-left text-sm">
      <span>{{ mode === 'cold' ? '❄' : '☀️' }}</span>️️
    </h6>
    <AcTemperature />
  </div>
</template>
