<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppIcon from '@/components/AppIcon.vue';
import { usePermissionStore } from '@/store/permission';
import type { NavModule } from '@/router/dynamic';

/**
 * 图标栏（一级导航）：一个模块一个图标，点击进入该模块的第一个页面。
 */
defineOptions({ name: 'RailNav' });

const router = useRouter();
const permission = usePermissionStore();

/** 模块的落点：优先第一个子菜单，一级本身就是页面时用它自己的路径 */
function targetOf(module: NavModule): string {
  return module.children[0]?.path ?? module.path;
}
</script>

<template>
  <aside class="rail">
    <div class="rail-brand" title="住住安">住</div>
    <div class="rail-items">
      <el-tooltip
        v-for="module in permission.modules"
        :key="module.id"
        :content="module.name"
        placement="right"
        :show-after="200"
      >
        <button
          type="button"
          class="rail-item"
          :class="{ 'is-active': module.path === permission.activeModule }"
          @click="router.push(targetOf(module))"
        >
          <AppIcon :name="module.icon" :size="18" />
        </button>
      </el-tooltip>
    </div>
  </aside>
</template>
