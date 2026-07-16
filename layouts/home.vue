<template>
  <main class="home-layout">
    <slot />
  </main>
</template>

<style scoped>
.home-layout {
  min-height: 100dvh;
  background: radial-gradient(circle at 18% 0%, rgba(222, 232, 255, 0.95), transparent 30%), linear-gradient(155deg, #f8faff 0%, #edf2fc 55%, #f7f4fb 100%);
}
</style>
