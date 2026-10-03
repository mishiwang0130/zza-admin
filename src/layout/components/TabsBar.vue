<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Close } from '@element-plus/icons-vue';
import { useTabsStore } from '@/store/tabs';

/**
 * 标签页：记录访问过的页面，支持关闭与右键「关闭其他 / 关闭全部」。
 */
defineOptions({ name: 'TabsBar' });

const route = useRoute();
const router = useRouter();
const tabs = useTabsStore();

/** 右键菜单状态 */
const contextMenu = ref({ visible: false, x: 0, y: 0, path: '' });

/** 跳转并高亮 */
function goTo(path: string): void {
  if (path !== route.path) {
    router.push(path);
  }
}

/** 关闭标签：关的是当前标签时就跳到相邻标签 */
function closeTab(path: string): void {
  const isActive = route.path === path;
  const neighbor = tabs.closeTab(path);
  if (isActive && neighbor) {
    router.push(neighbor);
  }
}

function openContextMenu(event: MouseEvent, path: string): void {
  event.preventDefault();
  contextMenu.value = { visible: true, x: event.clientX, y: event.clientY, path };
}

function hideContextMenu(): void {
  contextMenu.value.visible = false;
}

function closeCurrent(): void {
  const target = contextMenu.value.path;
  hideContextMenu();
  closeTab(target);
}

function closeOthers(): void {
  const target = contextMenu.value.path;
  hideContextMenu();
  tabs.closeOthers(target);
  if (route.path !== target) {
    router.push(target);
  }
}

function closeAll(): void {
  hideContextMenu();
  router.push(tabs.closeAll());
}

onMounted(() => {
  window.addEventListener('click', hideContextMenu);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', hideContextMenu);
});
</script>

<template>
  <div class="tabsbar">
    <div class="tabs-scroll">
      <span
        v-for="tab in tabs.tabs"
        :key="tab.path"
        class="tab-item"
        :class="{ 'is-active': tab.path === route.path }"
        @click="goTo(tab.path)"
        @contextmenu="openContextMenu($event, tab.path)"
      >
        <i class="tab-dot" />
        <span>{{ tab.title }}</span>
        <span v-if="!tab.affix" class="tab-close" @click.stop="closeTab(tab.path)">
          <el-icon :size="11"><Close /></el-icon>
        </span>
      </span>
    </div>

    <teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="tab-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
      >
        <button
          type="button"
          :disabled="tabs.tabs.find((tab) => tab.path === contextMenu.path)?.affix"
          @click="closeCurrent"
        >
          关闭当前
        </button>
        <button type="button" @click="closeOthers">关闭其他</button>
        <button type="button" @click="closeAll">关闭全部</button>
      </div>
    </teleport>
  </div>
</template>
