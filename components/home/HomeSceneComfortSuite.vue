<script setup lang="ts">
import SceneBed from './scene/SceneBed.vue'
import SceneCoffeeTable from './scene/SceneCoffeeTable.vue'
import SceneConsole from './scene/SceneConsole.vue'
import SceneFloorLamp from './scene/SceneFloorLamp.vue'
import SceneLampGlow from './scene/SceneLampGlow.vue'
import SceneMoonGate from './scene/SceneMoonGate.vue'
import SceneNightstand from './scene/SceneNightstand.vue'
import ScenePendant from './scene/ScenePendant.vue'
import ScenePlant from './scene/ScenePlant.vue'
import SceneRoomShell from './scene/SceneRoomShell.vue'
import SceneRug from './scene/SceneRug.vue'
import SceneSofa from './scene/SceneSofa.vue'
import SceneSunbeam from './scene/SceneSunbeam.vue'
import SceneWindow from './scene/SceneWindow.vue'
</script>

<template>
  <g data-template-id="comfort-suite">
    <rect data-layer="backdrop" width="1600" height="800" fill="url(#sc-backdrop)" />

    <g data-layer="shell">
      <SceneRoomShell :x0="18" :x1="805" divider />
      <SceneRoomShell :x0="805" :x1="1582" accent="sage" />
      <rect x="18" y="30" width="1564" height="760" rx="6" fill="none" style="stroke: var(--sc-partition)" stroke-width="10" />
    </g>

    <g data-room-id="suite-living">
      <g data-furniture-id="suite-window">
        <SceneWindow :x="60" :y="110" :w="165" :h="285" arch />
      </g>
      <g data-furniture-id="suite-media-unit">
        <SceneConsole :x="505" :y="330" />
      </g>
      <g data-furniture-id="suite-plant">
        <ScenePlant :x="80" :y="400" :s="0.85" :delay="-3" />
      </g>
      <g data-furniture-id="suite-floor-lamp">
        <SceneFloorLamp :x="690" :y="290" />
      </g>
      <g data-furniture-id="suite-rug">
        <SceneRug :x="230" :y="640" :w="470" :h="120" />
      </g>
      <g data-furniture-id="suite-sofa">
        <SceneSofa :x="260" :y="418" :s="1.3" :sy="1.12" />
      </g>
      <g data-furniture-id="suite-coffee-table">
        <SceneCoffeeTable :x="250" :y="528" :s="1.14" />
      </g>
    </g>

    <g data-room-id="suite-bedroom">
      <SceneMoonGate :cx="1010" :cy="210" :r="64" />
      <g data-furniture-id="suite-bedroom-window">
        <SceneWindow :x="1180" :y="95" :w="308" :h="220" />
      </g>
      <ScenePendant :x="905" :y="400" />
      <g data-furniture-id="suite-bedroom-rug">
        <SceneRug :x="860" :y="726" :w="640" :h="54" />
      </g>
      <g data-furniture-id="suite-bed">
        <SceneBed :x="920" :y="366" :s="1.25" :sy="1" />
      </g>
      <g data-furniture-id="suite-side-table">
        <SceneNightstand :x="845" :y="505" :s="1.1" />
      </g>
      <g data-furniture-id="suite-bedroom-plant">
        <ScenePlant :x="1490" :y="470" :s="0.9" variant="bush" :delay="-5" />
      </g>
    </g>

    <g data-layer="light">
      <SceneSunbeam :x0="72" :x1="213" :y="383" :slant="150" />
      <SceneSunbeam :x0="1192" :x1="1476" :y="303" :slant="-160" />
    </g>
    <rect class="sc-night" data-layer="night" width="1600" height="800" />
    <g data-layer="glow">
      <SceneLampGlow :x="726" :y="340" :r="130" />
      <SceneLampGlow :x="905" :y="412" :r="150" />
    </g>

    <g data-layer="labels">
      <text class="scene-room-label" x="54" y="70">套房客厅</text>
      <text class="scene-room-label" x="1562" y="70" text-anchor="end">套房卧室</text>
    </g>
  </g>
</template>
