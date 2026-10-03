<script setup lang="ts">
/**
 * 根组件：只留一个出口，布局与页面全部由路由决定。
 */
defineOptions({ name: 'App' });
</script>

<template>
  <router-view />
</template>
