import { api } from '@/api/request';
import type { PageResp, RoleFormReq, RolePageQuery, RoleSimpleVO, RoleVO, StatusReq } from '@/types/api';

/** 角色管理接口：/api/infra/admin-api/role/** */

/**
 * 分页查询角色
 */
export function pageRole(data: RolePageQuery): Promise<PageResp<RoleVO>> {
  return api.post<PageResp<RoleVO>>('/role/page', data);
}

/**
 * 查询角色详情（含已分配菜单 ID）
 *
 * @param id 角色 ID
 */
export function getRole(id: string): Promise<RoleVO> {
  return api.get<RoleVO>('/role/getById', { id });
}

/**
 * 查询启用中的角色精简列表，供用户表单的角色下拉使用
 */
export function listRole(): Promise<RoleSimpleVO[]> {
  return api.get<RoleSimpleVO[]>('/role/list');
}

/**
 * 新增角色
 */
export function createRole(data: RoleFormReq): Promise<string> {
  return api.post<string>('/role/create', data);
}

/**
 * 修改角色：菜单权限按提交的 menuIds 全量覆盖
 */
export function updateRole(data: RoleFormReq): Promise<void> {
  return api.post<void>('/role/update', data);
}

/**
 * 删除角色
 */
export function deleteRole(id: string): Promise<void> {
  return api.post<void>('/role/delete', undefined, { params: { id } });
}

/**
 * 启用 / 停用角色
 */
export function updateRoleStatus(data: StatusReq): Promise<void> {
  return api.post<void>('/role/updateStatus', data);
}
