import { api } from '@/api/request';
import type { LoginReq, MenuNode, TokenResp, UserInfo } from '@/types/api';

/**
 * 管理后台认证接口：路径最终是 {@code /api/infra/admin-api/auth/**}。
 */

/**
 * 登录
 *
 * @param data 用户名与密码
 */
export function login(data: LoginReq): Promise<TokenResp> {
  return api.post<TokenResp>('/auth/login', data);
}

/**
 * 登出：当前凭证与同一会话的续期凭证一起失效
 */
export function logout(): Promise<void> {
  return api.post<void>('/auth/logout');
}

/**
 * 查询当前登录用户信息（昵称、角色编码、权限标识）
 */
export function getUserInfo(): Promise<UserInfo> {
  return api.get<UserInfo>('/auth/getUserInfo');
}

/**
 * 查询当前登录用户的导航菜单树（只含目录与菜单）
 */
export function listMenus(): Promise<MenuNode[]> {
  return api.get<MenuNode[]>('/auth/listMenus');
}

/**
 * 修改当前登录用户密码：成功后该用户全部凭证失效，必须重新登录
 *
 * @param data 原密码与新密码
 */
export function updatePassword(data: { oldPassword: string; newPassword: string }): Promise<void> {
  return api.post<void>('/auth/updatePassword', data);
}
