<template>
  <div
    class="absolute p-1"
    bg="#4ea5f5"
    border="rounded-2px"
    top="10px"
    left="10px"
    h="70px"
    w="50px"
  >
    <AcTextLabel :num="6" :size="4" :mx="2" :my="0" color="white" />
    <div
      class="my-1 h-7 w-full bg-white"
      p="y-2px x-8px"
    >
      <div class="flex">
        <div :style="{ backgroundColor: 'green', width: '40%' }" />
        <div
          :style="{
            marginLeft: '40%',
            borderTopColor: 'transparent',
            borderRightColor: 'green',
            borderBottomColor: 'transparent',
            borderLeftColor: 'transparent',
            borderStyle: 'solid',
          }"
          border="t-1.5px r-2px b-1.5px l-0"
          h="3px"
        />
        <div :style="{ backgroundColor: 'green', width: '10%' }" />
      </div>
      <div class="energy-label-level" :style="{ backgroundColor: 'lightgreen', width: '50%' }" />
      <div class="energy-label-level" :style="{ backgroundColor: '#ffc107', width: '60%' }" />
      <div class="energy-label-level" :style="{ backgroundColor: 'orange', width: '70%' }" />
      <div class="energy-label-level" :style="{ backgroundColor: 'red', width: '80%' }" />
    </div>
    <div
      class="h-5 w-full bg-white"
      mb="2px" pt="0.8px"
    >
      <AcTextLabel :num="11" :size="2" :mx="0.8" :my="2" color="black" />
      <div class="h-0 w-full" :style="{ borderTop: '1px solid', margin: '0.8px 0' }" />
      <AcTextLabel :num="9" :size="1.5" :mx="0.8" :my="2" color="black" />
      <AcTextLabel :num="10" :size="1.2" :mx="0.8" :my="0" color="black" />
    </div>
    <AcTextLabel :num="8" :size="2" :mx="0.8" :my="0" color="white" />
  </div>
</template>
