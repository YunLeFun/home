<script lang="ts" setup>
import type { Item } from '~/types'

defineProps<{
  item: Item
}>()
</script>

<template>
  <RouterLink
    class="item-card inline-grid shadow transition"
    w="full"
    bg="white" rounded="xl" h="30" hover="shadow-lg"
    p="4"
    :to="`/items/${item.key}`"
  >
    <div />
    <h1 font-sans op="80">
      {{ item.emoji }}
      <!-- {{ item.name }} -->
    </h1>
    <p>{{ item.description }}</p>
  </RouterLink>
</template>
