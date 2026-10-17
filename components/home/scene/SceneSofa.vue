<script setup lang="ts">
/** Three-seat linen sofa; canonical 320 × 180, floor contact at y = 176. */
withDefaults(defineProps<{ x: number, y: number, s?: number, sy?: number }>(), { s: 1, sy: undefined })
</script>

<template>
  <g class="sc-sofa" :transform="`translate(${x} ${y}) scale(${s} ${sy ?? s})`">
    <ellipse cx="160" cy="176" rx="176" ry="13" fill="url(#sc-contact)" />
    <rect x="16" y="2" width="288" height="96" rx="32" fill="url(#sc-fabric-deep)" />
    <rect x="30" y="10" width="128" height="88" rx="28" fill="url(#sc-fabric)" />
    <rect x="162" y="10" width="128" height="88" rx="28" fill="url(#sc-fabric)" />
    <path d="M44 18c30-6 70-6 100 0M176 18c30-6 70-6 100 0" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="3" stroke-linecap="round" />
    <rect x="8" y="84" width="304" height="76" rx="24" fill="url(#sc-fabric-deep)" />
    <rect x="34" y="88" width="126" height="46" rx="18" fill="url(#sc-fabric)" />
    <rect x="160" y="88" width="126" height="46" rx="18" fill="url(#sc-fabric)" />
    <path d="M160 92v38" style="stroke: var(--sc-line)" stroke-width="2" />
    <rect x="0" y="54" width="48" height="110" rx="23" fill="url(#sc-fabric-deep)" />
    <rect x="272" y="54" width="48" height="110" rx="23" fill="url(#sc-fabric-deep)" />
    <path d="M6 66c10-8 26-8 36 0M278 66c10-8 26-8 36 0" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3" stroke-linecap="round" />
    <rect x="48" y="44" width="66" height="48" rx="16" fill="url(#sc-oat)" transform="rotate(7 81 68)" />
    <rect x="204" y="40" width="68" height="50" rx="16" style="fill: var(--sc-accent)" transform="rotate(-8 238 65)" />
    <path d="M214 58c14 4 30 4 46-2" fill="none" style="stroke: var(--sc-accent-deep)" stroke-opacity=".5" stroke-width="2" transform="rotate(-8 238 65)" />
    <path d="M266 60c22-4 40 4 44 14v70c-10 6-30 4-40-4Z" fill="url(#sc-oat)" />
    <path d="M276 84l30-2M276 100l31-1M276 116l30 1" style="stroke: var(--sc-accent)" stroke-opacity=".55" stroke-width="2" />
    <path d="M28 160l4 16h8l2-16M278 160l2 16h8l4-16" fill="url(#sc-wood)" />
  </g>
</template>
