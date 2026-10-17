<script setup lang="ts">
/** Upholstered bed seen from the foot; canonical 380 × 356, floor at y 352. */
withDefaults(defineProps<{ x: number, y: number, s?: number, sy?: number }>(), { s: 1, sy: undefined })
</script>

<template>
  <g class="sc-bed" :transform="`translate(${x} ${y}) scale(${s} ${sy ?? s})`">
    <ellipse cx="190" cy="350" rx="200" ry="12" fill="url(#sc-contact)" />
    <path d="M20 92V36C20 14 36 0 58 0h264c22 0 38 14 38 36v56Z" fill="url(#sc-oat)" />
    <path d="M70 10v78M110 8v80M150 8v80M190 8v80M230 8v80M270 8v80M310 10v78" style="stroke: var(--sc-line)" stroke-width="2" />
    <rect x="0" y="80" width="380" height="262" rx="18" fill="url(#sc-wood)" />
    <rect x="12" y="86" width="356" height="246" rx="14" fill="url(#sc-linen)" />
    <rect x="34" y="96" width="140" height="62" rx="24" fill="url(#sc-linen)" />
    <rect x="206" y="96" width="140" height="62" rx="24" fill="url(#sc-linen)" />
    <path d="M44 104c36-6 84-6 120 0M216 104c36-6 84-6 120 0" fill="none" style="stroke: var(--sc-trim-shade)" stroke-width="2" />
    <rect x="150" y="120" width="80" height="44" rx="16" style="fill: var(--sc-accent)" />
    <path d="M12 176c90-14 260-14 356 0v142c0 8-6 14-14 14H26c-8 0-14-6-14-14Z" fill="url(#sc-duvet)" />
    <path d="M12 176c90-14 260-14 356 0v20c-96-12-266-12-356 0Z" fill="url(#sc-linen)" />
    <path d="M60 230c40 16 90 10 120 26M210 240c40-6 90 6 130-2" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3" stroke-linecap="round" />
    <path d="M12 272c120-10 236-10 356 0v46c0 8-6 14-14 14H26c-8 0-14-6-14-14Z" fill="url(#sc-oat)" />
    <path d="M24 290h332M24 304h332" style="stroke: var(--sc-accent)" stroke-opacity=".45" stroke-width="2" />
    <path d="M16 340l2 12h10l2-12M350 340l2 12h10l2-12" style="fill: var(--sc-wood-2)" />
  </g>
</template>
