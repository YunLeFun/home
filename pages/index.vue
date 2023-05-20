<script setup lang="ts">
import { items } from '~/constants/items'

const online = useOnline()
</script>

<template>
  <div>
    <Logos mb-6 />
    <Suspense>
      <ClientOnly>
        <PageView v-if="online" />
        <div v-else text-gray:80>
          You're offline
        </div>
      </ClientOnly>
      <template #fallback>
        <div italic op50>
          <span animate-pulse>Loading...</span>
        </div>
      </template>
    </Suspense>
    <InputEntry />
    <div grid grid-cols-2 gap="2">
      <div v-for="item in items" :key="item.key">
        <ItemCard :item="item" />
      </div>
    </div>
  </div>
</template>
