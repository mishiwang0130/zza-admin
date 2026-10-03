/**
 * 登录凭证的本地存储。
 *
 * <p>单独抽出来是为了让 axios 拦截器不必依赖 Pinia：拦截器在模块初始化阶段就要读令牌，
 * 如果它去 import store，会形成 request → store → api → request 的循环依赖。
 */

const ACCESS_TOKEN_KEY = 'zza-admin:access-token';

const REFRESH_TOKEN_KEY = 'zza-admin:refresh-token';

/** 读取访问令牌，没有时返回空串 */
export function getAccessToken(): string {
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? '';
}

/** 读取续期凭证，没有时返回空串 */
export function getRefreshToken(): string {
  return localStorage.getItem(REFRESH_TOKEN_KEY) ?? '';
}

/** 覆盖保存一对凭证：续期成功后旧的 refreshToken 已失效，必须一起更新 */
export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/** 清空凭证 */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}
