import { api } from '@/api/request';
import type { PageResp, StatusReq, UserCreateReq, UserPageQuery, UserUpdateReq, UserVO } from '@/types/api';

/** 用户管理接口：/api/infra/admin-api/user/** */

/**
 * 分页查询用户
 */
export function pageUser(data: UserPageQuery): Promise<PageResp<UserVO>> {
  return api.post<PageResp<UserVO>>('/user/page', data);
}

/**
 * 查询用户详情（含已分配角色 ID）
 *
 * @param id 用户 ID（字符串，后端 Long 转字符串）
 */
export function getUser(id: string): Promise<UserVO> {
  return api.get<UserVO>('/user/getById', { id });
}

/**
 * 新增用户
 */
export function createUser(data: UserCreateReq): Promise<string> {
  return api.post<string>('/user/create', data);
}

/**
 * 修改用户（用户名不可改）
 */
export function updateUser(data: UserUpdateReq): Promise<void> {
  return api.post<void>('/user/update', data);
}

/**
 * 删除用户（逻辑删除）
 */
export function deleteUser(id: string): Promise<void> {
  return api.post<void>('/user/delete', undefined, { params: { id } });
}

/**
 * 启用 / 停用用户
 */
export function updateUserStatus(data: StatusReq): Promise<void> {
  return api.post<void>('/user/updateStatus', data);
}

/**
 * 重置指定用户的密码
 */
export function resetUserPassword(data: { id: string; newPassword: string }): Promise<void> {
  return api.post<void>('/user/resetPassword', data);
}
