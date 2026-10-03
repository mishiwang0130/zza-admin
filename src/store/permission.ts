import { ref } from 'vue';
import { defineStore } from 'pinia';
import { listMenus } from '@/api/auth';
import { buildNavigation, type NavModule } from '@/router/dynamic';
import type { MenuNode } from '@/types/api';

/**
 * 菜单与动态路由：登录后按后端返回的菜单树生成路由与双栏导航数据。
 *
 * <p>这里只负责「算」，不负责「装」：真正的 router.addRoute 由路由守卫执行，
 * 避免 store 与 router 互相 import 形成死循环。
 */
export const usePermissionStore = defineStore('permission', () => {
  /** 后端返回的原始菜单树 */
  const menus = ref<MenuNode[]>([]);

  /** 图标栏模块（含静态的「概览」） */
  const modules = ref<NavModule[]>([]);

  /** 是否已经生成过动态路由 */
  const generated = ref(false);

  /** 当前高亮的一级模块，进入工具页（如个人中心）时保持上一次的值，避免图标栏闪烁 */
  const activeModule = ref('/dashboard');

  /**
   * 拉取菜单并生成路由与导航数据
   *
   * @returns 需要注册到 router 的路由数组
   */
  async function loadNavigation() {
    const tree = await listMenus();
    const built = buildNavigation(tree ?? []);
    menus.value = tree ?? [];
    modules.value = built.modules;
    generated.value = true;
    return built.routes;
  }

  /**
   * 设置当前高亮模块
   *
   * @param path 模块绝对路径
   */
  function setActiveModule(path: string): void {
    activeModule.value = path;
  }

  /** 重置：退出登录或换账号时调用 */
  function reset(): void {
    menus.value = [];
    modules.value = [];
    generated.value = false;
    activeModule.value = '/dashboard';
  }

  return { menus, modules, generated, activeModule, loadNavigation, setActiveModule, reset };
});
