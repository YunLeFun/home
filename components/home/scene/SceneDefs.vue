<template>
  <defs>
    <linearGradient id="sc-backdrop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-backdrop-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-backdrop-2)" />
    </linearGradient>
    <linearGradient id="sc-wall-paper" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-wall-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-wall-2)" />
    </linearGradient>
    <linearGradient id="sc-wall-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-sky-wall-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-sky-wall-2)" />
    </linearGradient>
    <linearGradient id="sc-wall-clay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-clay-wall-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-clay-wall-2)" />
    </linearGradient>
    <linearGradient id="sc-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-floor-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-floor-2)" />
    </linearGradient>
    <pattern id="sc-planks" width="180" height="44" patternUnits="userSpaceOnUse">
      <path d="M0 43.5H180M60 0V44M150 0V22" fill="none" style="stroke: var(--sc-plank)" stroke-width="1.2" />
    </pattern>
    <linearGradient id="sc-floor-occlusion" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b2418" stop-opacity=".16" />
      <stop offset="1" stop-color="#2b2418" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="sc-ceiling-shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b2418" stop-opacity=".1" />
      <stop offset="1" stop-color="#2b2418" stop-opacity="0" />
    </linearGradient>

    <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-sky-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-sky-2)" />
    </linearGradient>
    <linearGradient id="sc-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset=".28" stop-color="#fff" stop-opacity="0" />
      <stop offset=".34" stop-color="#fff" stop-opacity=".32" />
      <stop offset=".42" stop-color="#fff" stop-opacity="0" />
      <stop offset=".5" stop-color="#fff" stop-opacity=".14" />
      <stop offset=".54" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="sc-beam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-beam)" stop-opacity=".9" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-beam)" stop-opacity="0" />
    </linearGradient>

    <linearGradient id="sc-fabric" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-fabric-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-fabric-2)" />
    </linearGradient>
    <linearGradient id="sc-fabric-deep" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-fabric-2)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-fabric-3)" />
    </linearGradient>
    <linearGradient id="sc-oat" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-oat-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-oat-2)" />
    </linearGradient>
    <linearGradient id="sc-linen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-linen-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-linen-2)" />
    </linearGradient>
    <linearGradient id="sc-duvet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-duvet-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-duvet-2)" />
    </linearGradient>
    <linearGradient id="sc-wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-wood-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-wood-2)" />
    </linearGradient>
    <linearGradient id="sc-wood-light" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-wood-light-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-wood-light-2)" />
    </linearGradient>
    <linearGradient id="sc-brass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbe2a8" />
      <stop offset=".5" stop-color="#f2a93b" />
      <stop offset="1" stop-color="#c47f22" />
    </linearGradient>
    <linearGradient id="sc-ceramic" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" class="sc-stop" style="stop-color: var(--sc-ceramic-1)" />
      <stop offset="1" class="sc-stop" style="stop-color: var(--sc-ceramic-2)" />
    </linearGradient>

    <radialGradient id="sc-contact" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#1f1a12" stop-opacity=".34" />
      <stop offset="1" stop-color="#1f1a12" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="sc-lamp-glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffe2a8" stop-opacity=".95" />
      <stop offset=".35" stop-color="#ffcf7a" stop-opacity=".4" />
      <stop offset="1" stop-color="#ffcf7a" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="sc-glow-cool" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#9fd6e0" stop-opacity=".55" />
      <stop offset="1" stop-color="#9fd6e0" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="sc-glow-heat" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#f4b083" stop-opacity=".55" />
      <stop offset="1" stop-color="#f4b083" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="sc-glow-warm" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#f6cf86" stop-opacity=".6" />
      <stop offset="1" stop-color="#f6cf86" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="sc-glow-screen" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#b9d4f2" stop-opacity=".5" />
      <stop offset="1" stop-color="#b9d4f2" stop-opacity="0" />
    </radialGradient>
  </defs>
</template>
