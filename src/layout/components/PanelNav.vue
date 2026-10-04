<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import AppIcon from '@/components/AppIcon.vue';
import PanelNavList from '@/layout/components/PanelNavList.vue';
import { usePermissionStore } from '@/store/permission';

/**
 * 二级菜单面板：展示当前一级模块的菜单树。
 *
 * <p>这里只放菜单，不放账号信息、不放退出登录 —— 那些都在右上角的头像下拉里。
 */
defineOptions({ name: 'PanelNav' });

const route = useRoute();
const permission = usePermissionStore();

const currentModule = computed(
  () => permission.modules.find((item) => item.path === permission.activeModule) ?? permission.modules[0],
);
</script>

<template>
  <aside class="panel">
    <div class="panel-head">
      <AppIcon :name="currentModule?.icon" :size="16" />
      <span>{{ currentModule?.name ?? '导航' }}</span>
    </div>

    <nav class="panel-body">
      <PanelNavList
        v-if="currentModule"
        :items="currentModule.children"
        :current-path="route.meta.activePath ?? route.path"
      />
      <div v-else class="empty-block">暂无可用菜单</div>
    </nav>
  </aside>
</template>
