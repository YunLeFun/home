<script setup lang="ts">
import SceneBed from './scene/SceneBed.vue'
import SceneClock from './scene/SceneClock.vue'
import SceneDesk from './scene/SceneDesk.vue'
import SceneFloorLamp from './scene/SceneFloorLamp.vue'
import SceneLampGlow from './scene/SceneLampGlow.vue'
import ScenePlant from './scene/ScenePlant.vue'
import SceneRoomShell from './scene/SceneRoomShell.vue'
import SceneRug from './scene/SceneRug.vue'
import SceneShelf from './scene/SceneShelf.vue'
import SceneSofa from './scene/SceneSofa.vue'
import SceneSunbeam from './scene/SceneSunbeam.vue'
import SceneWindow from './scene/SceneWindow.vue'
</script>

<template>
  <g data-template-id="studio">
    <rect data-layer="backdrop" width="1600" height="800" fill="url(#sc-backdrop)" />

    <g data-layer="shell">
      <SceneRoomShell :x0="18" :x1="1582" />
      <rect x="18" y="30" width="1564" height="760" rx="6" fill="none" style="stroke: var(--sc-partition)" stroke-width="10" />
    </g>

    <g data-room-id="studio-room">
      <g data-furniture-id="studio-window">
        <SceneWindow :x="105" :y="100" :w="270" :h="230" />
      </g>
      <SceneClock :cx="1530" :cy="118" :r="30" />
      <g data-furniture-id="studio-shelf">
        <SceneShelf :x="1100" :y="120" :s="0.8" />
      </g>
      <g data-furniture-id="studio-rug">
        <SceneRug :x="60" :y="682" :w="1480" :h="92" />
      </g>
      <g data-furniture-id="studio-sofa">
        <SceneSofa :x="190" :y="431" :s="1.2" :sy="1.05" />
      </g>
      <g data-furniture-id="studio-floor-lamp">
        <SceneFloorLamp :x="230" :y="300" flip />
      </g>
      <g data-furniture-id="studio-bed">
        <SceneBed :x="685" :y="409" :s="0.86" />
      </g>
      <g data-furniture-id="studio-desk">
        <SceneDesk :x="1030" :y="440" :s="1.03" />
      </g>
      <g data-furniture-id="studio-plant">
        <ScenePlant :x="1432" :y="370" :delay="-4" />
      </g>
    </g>

    <g data-layer="light">
      <SceneSunbeam :x0="117" :x1="363" :y="318" :slant="190" />
    </g>
    <rect class="sc-night" data-layer="night" width="1600" height="800" />
    <g data-layer="glow">
      <SceneLampGlow :x="194" :y="350" :r="130" />
      <SceneLampGlow :x="1298" :y="352" :r="110" />
    </g>

    <g data-layer="labels">
      <text class="scene-room-label" x="54" y="70">云朵单间</text>
    </g>
  </g>
</template>
