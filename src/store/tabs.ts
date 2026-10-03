import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

/** 标签页项 */
export interface TabItem {
  /** 路由完整路径，作为唯一键 */
  path: string;
  title: string;
  /** keep-alive 使用的组件名 */
  cacheName?: string;
  /** 固定标签不可关闭 */
  affix?: boolean;
}

const HOME_TAB: TabItem = { path: '/dashboard', title: '概览', cacheName: 'Dashboard', affix: true };

/**
 * 标签页：记录访问过的页面，驱动 keep-alive 的 include 列表。
 */
export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<TabItem[]>([{ ...HOME_TAB }]);

  /** keep-alive 只缓存标签页里还开着的页面 */
  const cachedNames = computed(() =>
    Array.from(
      new Set(tabs.value.map((tab) => tab.cacheName).filter((name): name is string => Boolean(name))),
    ),
  );

  /**
   * 记录一个页面标签
   *
   * @param route 当前路由
   */
  function addTab(route: RouteLocationNormalizedLoaded): void {
    if (!route.path || route.meta?.public || route.path === '/login') {
      return;
    }
    const exist = tabs.value.find((tab) => tab.path === route.path);
    if (exist) {
      exist.title = route.meta?.title ?? exist.title;
      return;
    }
    tabs.value.push({
      path: route.path,
      title: route.meta?.title ?? route.path,
      cacheName: route.meta?.cacheName,
    });
  }

  /**
   * 关闭标签
   *
   * @param path 要关闭的标签路径
   * @returns 关闭的是当前标签时返回应跳转的相邻标签路径，否则返回 undefined
   */
  function closeTab(path: string): string | undefined {
    const index = tabs.value.findIndex((tab) => tab.path === path);
    if (index < 0 || tabs.value[index].affix) {
      return undefined;
    }
    tabs.value.splice(index, 1);
    if (tabs.value.length === 0) {
      tabs.value.push({ ...HOME_TAB });
    }
    const neighbor = tabs.value[Math.min(index, tabs.value.length - 1)];
    return neighbor?.path;
  }

  /**
   * 关闭除指定标签与固定标签之外的全部标签
   *
   * @param path 保留的标签路径
   */
  function closeOthers(path: string): void {
    tabs.value = tabs.value.filter((tab) => tab.affix || tab.path === path);
  }

  /** 关闭全部标签并回到首页 */
  function closeAll(): string {
    tabs.value = tabs.value.filter((tab) => tab.affix);
    if (!tabs.value.some((tab) => tab.path === HOME_TAB.path)) {
      tabs.value.unshift({ ...HOME_TAB });
    }
    return HOME_TAB.path;
  }

  /** 退出登录时清空，避免换账号后还留着上一个人的标签 */
  function reset(): void {
    tabs.value = [{ ...HOME_TAB }];
  }

  return { tabs, cachedNames, addTab, closeTab, closeOthers, closeAll, reset };
});
