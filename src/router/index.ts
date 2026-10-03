import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';
import { useAuthStore } from '@/store/auth';
import { usePermissionStore } from '@/store/permission';
import { useTabsStore } from '@/store/tabs';

/** 免登录路径：错误页也放进来，否则凭证失效时连 404 都打不开 */
const WHITE_LIST = ['/login', '/403', '/404'];

/**
 * 静态路由：登录、错误页，以及不进菜单表的「概览」「个人中心」。
 *
 * <p>业务页面不写在这里 —— 它们由 {@code /auth/listMenus} 的菜单树动态生成。
 */
export const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/403.vue'),
    meta: { title: '无访问权限', public: true },
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', public: true },
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: {
          title: '概览',
          icon: 'Odometer',
          cacheName: 'Dashboard',
          modulePath: '/dashboard',
        },
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/index.vue'),
        // 个人中心不是一级模块：只从右上角头像下拉进入，图标栏沿用「概览」的高亮
        meta: {
          title: '个人中心',
          icon: 'UserFilled',
          cacheName: 'Profile',
          modulePath: '/dashboard',
        },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'CatchAll',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '页面不存在', public: true },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: staticRoutes,
  scrollBehavior: () => ({ top: 0 }),
});

/** 已注册的动态路由名，退出登录时按名字摘掉，避免换账号后残留上一个人的页面 */
let dynamicRouteNames: string[] = [];

/**
 * 注册菜单生成的动态路由
 *
 * @param routes 由菜单树构建出的路由
 */
export function registerDynamicRoutes(routes: RouteRecordRaw[]): void {
  routes.forEach((route) => {
    router.addRoute(route);
    if (typeof route.name === 'string') {
      dynamicRouteNames.push(route.name);
    }
  });
}

/** 摘掉全部动态路由 */
export function resetDynamicRoutes(): void {
  dynamicRouteNames.forEach((name) => {
    if (router.hasRoute(name)) {
      router.removeRoute(name);
    }
  });
  dynamicRouteNames = [];
}

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  const permission = usePermissionStore();

  if (WHITE_LIST.includes(to.path)) {
    // 已登录还去登录页，直接回首页
    if (to.path === '/login' && auth.accessToken && auth.userInfo) {
      return { path: '/' };
    }
    return true;
  }

  if (!auth.accessToken) {
    return { path: '/login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } };
  }

  if (!permission.generated) {
    try {
      await auth.loadUserInfo();
      const routes = await permission.loadNavigation();
      registerDynamicRoutes(routes);
      // 动态路由刚加上，重新匹配一次当前地址
      return { path: to.path, query: to.query, hash: to.hash, replace: true };
    } catch {
      auth.reset();
      permission.reset();
      resetDynamicRoutes();
      return { path: '/login' };
    }
  }

  if (to.meta.perms && !auth.can(to.meta.perms)) {
    return { path: '/403' };
  }
  return true;
});

router.afterEach((to) => {
  const appTitle = import.meta.env.VITE_APP_TITLE || '住住安管理后台';
  document.title = to.meta.title ? `${to.meta.title} · ${appTitle}` : appTitle;

  if (to.meta.public) {
    return;
  }
  useTabsStore().addTab(to);
  if (to.meta.modulePath) {
    usePermissionStore().setActiveModule(to.meta.modulePath);
  }
});

export default router;
