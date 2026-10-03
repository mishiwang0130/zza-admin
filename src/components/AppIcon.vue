<script setup lang="ts">
import { computed } from 'vue';
import { resolveIcon } from '@/utils/icons';

/**
 * 图标渲染组件：把后端菜单里的图标名渲染成 Element Plus 图标。
 */
defineOptions({ name: 'AppIcon' });

const props = withDefaults(
  defineProps<{
    /** 图标名，取值同 Element Plus 图标组件名 */
    name?: string;
    /** 尺寸（px） */
    size?: number;
  }>(),
  { name: '', size: 16 },
);

const icon = computed(() => resolveIcon(props.name));
</script>

<template>
  <el-icon :size="props.size" class="app-icon">
    <component :is="icon" />
  </el-icon>
</template>
