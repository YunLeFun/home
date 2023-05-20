<script lang="ts" setup>
interface TextLabelProps {
  num: number
  color: string
  /**
   * 宽高尺寸
   */
  size: number
  mx: number
  my: number
}

defineProps<TextLabelProps>()
</script>

<template>
  <div
    class="flex justify-center" :style="{
      '--ac-c-text-dot': color,
    }"
  >
    <span
      v-for="n in num"
      :key="n"
      class="text-dot rounded-full"
      :style="{
        width: `${size}px`,
        height: `${size}px`,
        margin: `${my || 0}px ${mx}px`,
      }"
    />
  </div>
</template>
