<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import RailNav from '@/layout/components/RailNav.vue';
import PanelNav from '@/layout/components/PanelNav.vue';
import TopBar from '@/layout/components/TopBar.vue';
import TabsBar from '@/layout/components/TabsBar.vue';
import { useTabsStore } from '@/store/tabs';

/**
 * 应用外壳：左侧双栏导航（图标栏 + 二级菜单）+ 右侧顶栏 / 标签页 / 内容区。
 *
 * <p>窄屏时双栏导航收进抽屉，靠顶栏的菜单按钮唤出。
 */
defineOptions({ name: 'AppLayout' });

const route = useRoute();
const tabs = useTabsStore();

/** 窄屏导航抽屉 */
const navDrawer = ref(false);

// 跳转后自动收起抽屉，否则点完菜单还要手动关一次
watch(
  () => route.fullPath,
  () => {
    navDrawer.value = false;
  },
);
</script>

<template>
  <div class="app-shell">
    <RailNav />
    <PanelNav />

    <div class="app-main">
      <TopBar @toggle-nav="navDrawer = true" />
      <TabsBar />
      <section class="app-content">
        <router-view v-slot="{ Component, route: current }">
          <transition name="fade-slide" mode="out-in">
            <keep-alive :include="tabs.cachedNames">
              <component :is="Component" :key="current.path" />
            </keep-alive>
          </transition>
        </router-view>
      </section>
    </div>

    <el-drawer
      v-model="navDrawer"
      class="nav-drawer"
      direction="ltr"
      size="244px"
      :with-header="false"
      append-to-body
    >
      <RailNav />
      <PanelNav />
    </el-drawer>
  </div>
</template>
