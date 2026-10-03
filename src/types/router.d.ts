import 'vue-router';

/** 路由 meta 的字段约定：后端菜单生成路由时按这里的字段落数据 */
declare module 'vue-router' {
  interface RouteMeta {
    /** 页面标题，用于面包屑、标签页与浏览器标题 */
    title?: string;
    /** Element Plus 图标名 */
    icon?: string;
    /** 访问该页面需要的权限标识 */
    perms?: string;
    /** keep-alive 用的组件名（由组件路径推导，页面里用 defineOptions 声明同名） */
    cacheName?: string;
    /** 所属一级模块的绝对路径，图标栏据此高亮 */
    modulePath?: string;
    /** 免登录页面 */
    public?: boolean;
  }
}
