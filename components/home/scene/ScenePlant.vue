<script setup lang="ts">
/**
 * Potted plants with a slow sway. `tall` is a fiddle-leaf fig (canonical
 * 90 × 220), `bush` a low leafy plant (90 × 120), `trailing` a pothos for
 * shelves (80 × 90). The pot base sits on y = height.
 */
withDefaults(defineProps<{ x: number, y: number, s?: number, variant?: 'tall' | 'bush' | 'trailing', delay?: number }>(), {
  s: 1,
  variant: 'tall',
  delay: 0,
})
</script>

<template>
  <g class="sc-plant" :transform="`translate(${x} ${y}) scale(${s})`">
    <template v-if="variant === 'tall'">
      <ellipse cx="45" cy="220" rx="40" ry="7" fill="url(#sc-contact)" />
      <g class="sc-sway" :style="{ '--sc-sway': '9s', '--sc-delay': `${delay}s` }">
        <path d="M45 170V30M45 120c-10-20-18-30-26-38M45 92c10-16 20-26 32-30" fill="none" style="stroke: var(--sc-wood-2)" stroke-width="3" />
        <path d="M45 24c-18-4-22-24-6-30 18 4 18 26 6 30Z" style="fill: var(--sc-leaf-1)" />
        <path d="M44 58c-26 0-34-26-14-34 22 2 26 30 14 34Z" style="fill: var(--sc-leaf-2)" />
        <path d="M48 52c20-8 34 8 22 26-20 4-30-14-22-26Z" style="fill: var(--sc-leaf-3)" />
        <path d="M20 86c-20-6-20-32 2-32 18 8 14 30-2 32Z" style="fill: var(--sc-leaf-1)" />
        <path d="M76 64c22 2 24 28 4 32-18-4-20-26-4-32Z" style="fill: var(--sc-leaf-2)" />
        <path d="M42 108c-22 2-30-22-12-30 20 0 26 24 12 30Z" style="fill: var(--sc-leaf-3)" />
        <path d="M50 100c18-10 34 4 24 22-18 6-30-10-24-22Z" style="fill: var(--sc-leaf-1)" />
        <path d="M26 132c-18-4-20-26-2-28 16 6 14 26 2 28Z" style="fill: var(--sc-leaf-2)" />
      </g>
      <path d="M18 170h54l-7 50H25Z" style="fill: var(--sc-pot)" />
      <path d="M16 166h58v10H16Z" style="fill: var(--sc-accent-deep)" />
    </template>
    <template v-else-if="variant === 'bush'">
      <ellipse cx="45" cy="120" rx="38" ry="6" fill="url(#sc-contact)" />
      <g class="sc-sway" :style="{ '--sc-sway': '7s', '--sc-delay': `${delay}s` }">
        <path d="M44 70c-30-4-38-36-14-40 20 6 24 34 14 40Z" style="fill: var(--sc-leaf-2)" />
        <path d="M46 68c26-12 44 10 30 30-24 4-36-16-30-30Z" style="fill: var(--sc-leaf-1)" />
        <path d="M40 76c-26 8-40-14-26-30 24 0 34 20 26 30Z" style="fill: var(--sc-leaf-3)" />
        <path d="M48 50c-4-24 18-36 30-20 0 22-20 28-30 20Z" style="fill: var(--sc-leaf-1)" />
      </g>
      <path d="M22 78h46l-6 42H28Z" fill="url(#sc-ceramic)" />
    </template>
    <template v-else>
      <path d="M14 0h52l-5 34H19Z" fill="url(#sc-ceramic)" />
      <g class="sc-sway" :style="{ '--sc-sway': '10s', '--sc-delay': `${delay}s` }" style="transform-origin: 50% 0%">
        <path d="M24 8c-12 20-6 48-18 74M56 8c10 18 4 40 14 62" fill="none" style="stroke: var(--sc-leaf-2)" stroke-width="2" />
        <path d="M18 28c-10-2-10-12 0-12 8 2 6 12 0 12ZM10 52c-10-2-10-12 0-12 8 2 6 12 0 12ZM8 78c-10-2-10-12 0-12 8 2 6 12 0 12Z" style="fill: var(--sc-leaf-1)" />
        <path d="M62 26c10 0 10 10 0 12-8-2-6-12 0-12ZM68 50c10 0 10 10 0 12-8-2-6-12 0-12ZM20 6c-6-8 6-14 12-6-2 8-8 10-12 6ZM46 4c4-8 16-4 12 6-6 4-12 2-12-6Z" style="fill: var(--sc-leaf-3)" />
      </g>
    </template>
  </g>
</template>
