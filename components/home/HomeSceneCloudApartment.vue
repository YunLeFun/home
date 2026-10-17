<script setup lang="ts">
import SceneBasket from './scene/SceneBasket.vue'
import SceneBed from './scene/SceneBed.vue'
import SceneClock from './scene/SceneClock.vue'
import SceneCoffeeTable from './scene/SceneCoffeeTable.vue'
import SceneConsole from './scene/SceneConsole.vue'
import SceneLampGlow from './scene/SceneLampGlow.vue'
import SceneLaundry from './scene/SceneLaundry.vue'
import SceneNightstand from './scene/SceneNightstand.vue'
import ScenePendant from './scene/ScenePendant.vue'
import ScenePlant from './scene/ScenePlant.vue'
import SceneRoomShell from './scene/SceneRoomShell.vue'
import SceneRug from './scene/SceneRug.vue'
import SceneShelf from './scene/SceneShelf.vue'
import SceneSofa from './scene/SceneSofa.vue'
import SceneSunbeam from './scene/SceneSunbeam.vue'
import SceneTableLamp from './scene/SceneTableLamp.vue'
import SceneWindow from './scene/SceneWindow.vue'
</script>

<template>
  <g data-template-id="cloud-apartment">
    <rect data-layer="backdrop" width="1600" height="800" fill="url(#sc-backdrop)" />

    <g data-layer="shell">
      <SceneRoomShell :x0="18" :x1="620" divider />
      <SceneRoomShell :x0="620" :x1="1205" accent="sage" divider />
      <SceneRoomShell :x0="1205" :x1="1582" accent="clay" />
      <rect x="18" y="30" width="1564" height="760" rx="6" fill="none" style="stroke: var(--sc-partition)" stroke-width="10" />
    </g>

    <g data-room-id="living-room">
      <g data-furniture-id="living-window">
        <SceneWindow :x="70" :y="110" :w="210" :h="255" />
      </g>
      <g data-furniture-id="living-media-console">
        <SceneConsole :x="330" :y="384" :s="0.96" />
        <SceneTableLamp :x="508" :y="314" />
      </g>
      <g data-furniture-id="living-plant">
        <ScenePlant :x="522" :y="372" :delay="-2" />
      </g>
      <g data-furniture-id="living-rug">
        <SceneRug :x="96" :y="636" :w="430" :h="116" />
      </g>
      <g data-furniture-id="living-sofa">
        <SceneSofa :x="98" :y="414" :s="0.97" />
      </g>
      <g data-furniture-id="living-table">
        <SceneCoffeeTable :x="205" :y="528" :s="0.96" />
      </g>
    </g>

    <g data-room-id="bedroom">
      <SceneClock :cx="722" :cy="196" :r="32" />
      <g data-furniture-id="bedroom-window">
        <SceneWindow :x="830" :y="100" :w="240" :h="215" />
      </g>
      <ScenePendant :x="1110" :y="340" />
      <g data-furniture-id="bedroom-rug">
        <SceneRug :x="650" :y="712" :w="540" :h="64" />
      </g>
      <g data-furniture-id="bed">
        <SceneBed :x="685" :y="352" />
      </g>
      <g data-furniture-id="bedroom-side-table">
        <SceneNightstand :x="1058" :y="500" :s="0.95" />
      </g>
    </g>

    <g data-room-id="utility-room">
      <g data-furniture-id="utility-shelf">
        <SceneShelf :x="1262" :y="96" />
      </g>
      <g data-furniture-id="utility-cabinet">
        <SceneLaundry :x="1232" :y="388" />
      </g>
      <g data-furniture-id="utility-baskets">
        <SceneBasket :x="1268" :y="622" />
      </g>
    </g>

    <g data-layer="light">
      <SceneSunbeam :x0="82" :x1="268" :y="353" :slant="170" />
      <SceneSunbeam :x0="842" :x1="1058" :y="303" :slant="-120" />
    </g>
    <rect class="sc-night" data-layer="night" width="1600" height="800" />
    <g data-layer="glow">
      <SceneLampGlow :x="530" :y="336" :r="110" />
      <SceneLampGlow :x="1110" :y="350" :r="150" />
      <SceneLampGlow :x="1397" :y="340" :r="100" />
    </g>

    <g data-layer="labels">
      <text class="scene-room-label" x="54" y="70">客厅</text>
      <text class="scene-room-label" x="1186" y="70" text-anchor="end">卧室</text>
      <text class="scene-room-label" x="1236" y="70">家政区</text>
    </g>
  </g>
</template>
