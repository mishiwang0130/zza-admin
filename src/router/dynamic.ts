import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';
import type { MenuNode } from '@/types/api';

/** 两级导航里的一项（二级菜单面板用，支持再往下嵌套） */
export interface NavItem {
  id: string;
  name: string;
  icon: string;
  /** 该菜单的绝对路径 */
  path: string;
  children?: NavItem[];
}

/** 图标栏里的一个一级模块 */
export interface NavModule {
  id: string;
  name: string;
  icon: string;
  /** 模块绝对路径 */
  path: string;
  children: NavItem[];
}

/** 构建结果 */
export interface BuiltNavigation {
  routes: RouteRecordRaw[];
  modules: NavModule[];
}

/**
 * 所有页面组件：用 glob 一次性登记，菜单表里的 component 直接按相对路径取。
 * 菜单管理里新增页面时不需要改这里，只要路径对得上就能自动挂上。
 */
const viewModules = import.meta.glob('../views/**/*.vue');

/** 静态「概览」模块：不进数据库菜单表，但要有和其它模块一致的导航结构 */
const DASHBOARD_MODULE: NavModule = {
  id: 'dashboard',
  name: '概览',
  icon: 'Odometer',
  path: '/dashboard',
  children: [{ id: 'dashboard', name: '概览', icon: 'Odometer', path: '/dashboard' }],
};

/**
 * 把菜单表里的 component 解析成页面组件
 *
 * @param component 组件相对路径，如 system/user/index
 * @returns 懒加载函数；没配或路径写错时返回 undefined（该菜单不注册路由，落到 404）
 */
function resolveView(component: string): (() => Promise<unknown>) | undefined {
  const normalized = (component ?? '').replace(/^\/+/, '');
  if (!normalized) {
    return undefined;
  }
  return viewModules[`../views/${normalized}.vue`];
}

/**
 * 由组件路径推导 keep-alive 用的组件名
 *
 * <p>约定：页面组件用 defineOptions 声明同名，例如 system/user/index → SystemUserIndex。
 */
export function cacheNameOf(component: string): string | undefined {
  const parts = (component ?? '').split('/').filter(Boolean);
  if (!parts.length) {
    return undefined;
  }
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

/** 去掉路径首尾斜杠 */
function segmentOf(path: string): string {
  return (path ?? '').replace(/^\/+|\/+$/g, '');
}

/** 菜单排序：先按 sort，再按 id，保证每次渲染顺序一致 */
function sortNodes(nodes: MenuNode[]): MenuNode[] {
  return [...nodes].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || Number(a.id) - Number(b.id));
}

/** 构建过程中共享的上下文 */
interface BuildContext {
  routes: RouteRecordRaw[];
  modulePath: string;
}

/**
 * 递归处理某个模块下的菜单
 *
 * <p>路由一律拍平到模块路由的子级（用相对路径拼接，如 user/detail），
 * 这样不依赖中间目录组件渲染 {@code <router-view>}；导航仍按原层级展示。
 *
 * @param node 当前菜单节点
 * @param absPath 当前节点对应的绝对路径
 * @param relPath 当前节点相对模块根路径的相对路径
 * @param ctx 构建上下文
 * @returns 导航项；该节点及其子孙都没有可跳转页面时返回 null
 */
function walk(node: MenuNode, absPath: string, relPath: string, ctx: BuildContext): NavItem | null {
  const segment = segmentOf(node.path);
  const abs = segment ? `${absPath}/${segment}` : absPath;
  const rel = segment ? (relPath ? `${relPath}/${segment}` : segment) : relPath;
  const children = sortNodes(node.children ?? []);

  if (children.length === 0) {
    const view = resolveView(node.component);
    if (!view || !segment) {
      return null;
    }
    ctx.routes.push({
      path: rel,
      name: `menu-${node.id}`,
      component: view as RouteRecordRaw['component'],
      meta: {
        title: node.name,
        icon: node.icon,
        perms: node.perms,
        cacheName: cacheNameOf(node.component),
        modulePath: ctx.modulePath,
      },
    } as RouteRecordRaw);
    return { id: node.id, name: node.name, icon: node.icon, path: abs };
  }

  const navChildren = children
    .map((child) => walk(child, abs, rel, ctx))
    .filter((item): item is NavItem => item !== null);

  if (!navChildren.length) {
    return null;
  }
  return { id: node.id, name: node.name, icon: node.icon, path: navChildren[0].path, children: navChildren };
}

/**
 * 由菜单树生成路由与双栏导航
 *
 * <p>图标栏 = 一级菜单；二级菜单面板 = 该一级菜单的子树。
 * 一级菜单本身是叶子时，面板只列它自己。
 *
 * @param menus 后端返回的菜单树（已按用户权限过滤）
 */
export function buildNavigation(menus: MenuNode[]): BuiltNavigation {
  const modules: NavModule[] = [{ ...DASHBOARD_MODULE }];
  const routes: RouteRecordRaw[] = [];

  sortNodes(menus)
    .filter((node) => node.type !== 3)
    .forEach((node) => {
      const segment = segmentOf(node.path);
      if (!segment) {
        return;
      }
      const modulePath = `/${segment}`;
      const children = sortNodes(node.children ?? []).filter((child) => child.type !== 3);
      const ctx: BuildContext = { routes: [], modulePath };

      if (!children.length) {
        // 一级就是叶子菜单：模块路由下挂一个空路径子路由，面板只列它自己
        const view = resolveView(node.component);
        if (!view) {
          return;
        }
        routes.push({
          path: modulePath,
          name: `module-${node.id}`,
          component: Layout,
          children: [
            {
              path: '',
              name: `menu-${node.id}`,
              component: view as RouteRecordRaw['component'],
              meta: {
                title: node.name,
                icon: node.icon,
                perms: node.perms,
                cacheName: cacheNameOf(node.component),
                modulePath,
              },
            },
          ],
        } as RouteRecordRaw);
        modules.push({
          id: node.id,
          name: node.name,
          icon: node.icon,
          path: modulePath,
          children: [{ id: node.id, name: node.name, icon: node.icon, path: modulePath }],
        });
        return;
      }

      const navChildren = children
        .map((child) => walk(child, modulePath, '', ctx))
        .filter((item): item is NavItem => item !== null);

      if (!navChildren.length) {
        return;
      }
      routes.push({
        path: modulePath,
        name: `module-${node.id}`,
        component: Layout,
        children: ctx.routes,
      } as RouteRecordRaw);
      modules.push({
        id: node.id,
        name: node.name,
        icon: node.icon,
        path: modulePath,
        children: navChildren,
      });
    });

  return { routes, modules };
}
