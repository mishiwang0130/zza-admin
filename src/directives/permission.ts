import type { Directive } from 'vue';
import { useAuthStore } from '@/store/auth';

/**
 * 按钮权限指令：没有权限时把元素从 DOM 里移除。
 *
 * <p>用移除而不是隐藏：隐藏的元素还在 DOM 里，容易被误当成"有这个功能"；
 * 权限标识与后端 {@code @RequiresPermission} 用的是同一份字符串（如 infra:user:create）。
 */
export const hasPerm: Directive<HTMLElement, string | string[]> = {
  mounted(el, binding) {
    if (!useAuthStore().can(binding.value)) {
      el.remove();
    }
  },
};
