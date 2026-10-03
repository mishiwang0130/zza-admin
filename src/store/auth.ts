import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import * as authApi from '@/api/auth';
import { clearTokens, getAccessToken, setTokens } from '@/utils/storage';
import type { LoginReq, UserInfo } from '@/types/api';

/** 超级管理员角色编码：后端对该角色跳过权限校验，前端也按同一规则放行 */
export const SUPER_ADMIN_ROLE = 'super_admin';

/**
 * 登录态：凭证、当前用户信息与权限判断。
 *
 * <p>accessToken 的初始值直接从 localStorage 取，保证刷新页面后 axios 拦截器立刻能带上令牌；
 * 用户信息每次刷新都重新拉一次，避免权限被后台改过之后前端还拿着旧权限。
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(getAccessToken());
  const userInfo = ref<UserInfo | null>(null);

  const nickname = computed(() => userInfo.value?.nickname ?? '');
  const username = computed(() => userInfo.value?.username ?? '');
  const roleCodes = computed(() => userInfo.value?.roleCodes ?? []);
  const perms = computed(() => userInfo.value?.perms ?? []);
  const isSuperAdmin = computed(() => roleCodes.value.includes(SUPER_ADMIN_ROLE));

  /**
   * 判断是否具备权限：超级管理员与未声明权限要求的场景一律放行
   *
   * @param required 权限标识，支持传数组表示「满足其一即可」
   */
  function can(required?: string | string[] | null): boolean {
    if (!required || (Array.isArray(required) && required.length === 0)) {
      return true;
    }
    if (isSuperAdmin.value) {
      return true;
    }
    const list = Array.isArray(required) ? required : [required];
    return list.some((item) => perms.value.includes(item));
  }

  /**
   * 登录并保存凭证
   *
   * @param payload 用户名与密码
   */
  async function loginAction(payload: LoginReq) {
    const token = await authApi.login(payload);
    setTokens(token.accessToken, token.refreshToken);
    accessToken.value = token.accessToken;
    return token;
  }

  /** 拉取当前登录用户信息 */
  async function loadUserInfo(): Promise<UserInfo> {
    const info = await authApi.getUserInfo();
    userInfo.value = info;
    return info;
  }

  /** 清空本地登录态 */
  function reset(): void {
    clearTokens();
    accessToken.value = '';
    userInfo.value = null;
  }

  /** 登出：先通知后端作废凭证，无论成功与否都清本地，避免用户卡在登录态里出不去 */
  async function logoutAction(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // 后端不可用也要让用户退得出去
    }
    reset();
  }

  return {
    accessToken,
    userInfo,
    nickname,
    username,
    roleCodes,
    perms,
    isSuperAdmin,
    can,
    loginAction,
    loadUserInfo,
    logoutAction,
    reset,
  };
});
