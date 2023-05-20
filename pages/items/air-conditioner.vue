<script lang="ts" setup>
const ac = useAcStore()
</script>

<template>
  <div>
    <AcBorder>
      <Transition>
        <AcDisplay :mode="ac.mode" />
      </Transition>

      <AcLogo />
      <AcAirOutlet />
      <AcStatus :status="ac.status" />
      <AcEnergyLabel :title-length="6" />
      <EnergySavingLabel />
    </AcBorder>
  <!-- <Fade in="{props.status}">
    <WindEffect />
  </Fade> -->
  </div>
</template>

<style lang="scss">
:root {
  --ac-c-border: #e0e0e0;
  --ac-c-display: #cccccc;
  --ac-c-wind: #bbbbbb;

  --ac-c-text-dot: black;

}

@font-face {
  font-family: "Digital-7 Mono";
  src: url("https://ac.yunyoujun.cn/assets/fonts/digital-7-mono.ttf") format("truetype");
}

.font-digit {
  font-family: "Digital-7 Mono";
}

.ac-text {
  color: var(--ac-text-color);
}

.ac-temperature {
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.1);
}

.wind-effect {
  opacity: 0.3;
}

.text-dot {
  background-color: var(--ac-c-text-dot);
}

.energy-label-level {
  margin-top: 2px;
  height: 3px;
}

.energy-saving-label {
  color: black;
  opacity: 0.8;
  position: absolute;
  top: 10px;
  left: 63px;
  background-color: #4caf50;
  padding: 12px;
  border-radius: 2px;
  transform: scale(0.22);
  transform-origin: left top;

  &_bg {
    padding: 10px;
    width: 200px;
    border-radius: 15px;
    background-color: #fafafa;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  &_title {
    font-size: 20px;
    display: block;
    margin: 2px auto;
  }

  &_description {
    font-size: 12px;
  }
}

.adsense-text-link {
  color: #63a5ef;
  text-decoration: none;
  cursor: pointer;
}

.adsense-logo {
  margin-bottom: 10px;
  font-size: 3.5rem;

  &.animated {
    animation: iconAnimate 1.5s ease-in-out infinite;
  }
}

@keyframes iconAnimate {
  0%,
  100% {
    transform: scale(1);
  }

  10%,
  30% {
    transform: scale(0.9);
  }

  20%,
  40%,
  60%,
  80% {
    transform: scale(1.1);
  }

  50%,
  70% {
    transform: scale(1.1);
  }
}
</style>
