import type { App } from 'vue';
import { hasPerm } from '@/directives/permission';

/**
 * 注册全局指令
 *
 * @param app Vue 应用实例
 */
export function setupDirectives(app: App): void {
  app.directive('has-perm', hasPerm);
}
