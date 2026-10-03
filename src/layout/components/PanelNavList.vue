<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppIcon from '@/components/AppIcon.vue';
import type { NavItem } from '@/router/dynamic';

/**
 * 二级菜单列表，支持继续往下嵌套（目录渲染成分组标题，页面渲染成可点击项）。
 */
defineOptions({ name: 'PanelNavList' });

withDefaults(
  defineProps<{
    items: NavItem[];
    /** 当前路由路径，用于高亮 */
    currentPath: string;
    /** 嵌套层级：大于 0 时缩进 */
    depth?: number;
  }>(),
  { depth: 0 },
);

const router = useRouter();
</script>

<template>
  <template v-for="item in items" :key="item.id">
    <template v-if="item.children?.length">
      <div class="panel-group" :class="{ 'is-child': depth > 0 }">{{ item.name }}</div>
      <PanelNavList :items="item.children" :current-path="currentPath" :depth="depth + 1" />
    </template>
    <div
      v-else
      class="panel-link"
      :class="{ 'is-active': item.path === currentPath, 'is-child': depth > 0 }"
      @click="router.push(item.path)"
    >
      <AppIcon :name="item.icon" :size="15" />
      <span>{{ item.name }}</span>
    </div>
  </template>
</template>
