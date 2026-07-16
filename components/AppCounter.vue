<script setup lang="ts">
const { count, inc, dec } = useCount()
</script>

<template>
  <div inline-flex m="y-3">
    <button rounded-full p-2 btn aria-label="减少计数" @click="dec()">
      <div i-carbon-subtract />
    </button>
    <div font="mono" w="15" m-auto inline-block aria-live="polite">
      {{ count }}
    </div>
    <button rounded-full p-2 btn aria-label="增加计数" @click="inc()">
      <div i-carbon-add />
    </button>
  </div>
</template>
