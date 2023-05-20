<script lang="ts" setup>
const ac = useAcStore()
</script>

<template>
  <h4 class="text-center text-4xl">
    <span class="ac-temperature font-digit">{{ ac.temperature }}</span>
    <small class="font-digit">°C</small>
  </h4>
</template>
