import * as ElIcons from '@element-plus/icons-vue';
import type { Component } from 'vue';

/**
 * Element Plus 图标注册表。
 *
 * <p>后端菜单表里 {@code icon} 存的就是 Element Plus 的图标名（种子数据用了
 * {@code Setting}、{@code User}、{@code Avatar}、{@code Menu}），所以按名字取组件即可，
 * 取不到时统一回退到 {@code Grid}，避免菜单配了个错别字就渲染成空白。
 */
export const iconRegistry = ElIcons as unknown as Record<string, Component>;

/** 图标名列表：供菜单管理页的图标选择器使用 */
export const iconNames: string[] = Object.keys(iconRegistry)
  .filter((name) => /^[A-Z]/.test(name))
  .sort((a, b) => a.localeCompare(b));

/**
 * 按名称取图标组件
 *
 * @param name 后端返回的图标名
 * @returns 图标组件，未命中时返回 Grid
 */
export function resolveIcon(name?: string | null): Component {
  if (name && iconRegistry[name]) {
    return iconRegistry[name];
  }
  return iconRegistry.Grid;
}
