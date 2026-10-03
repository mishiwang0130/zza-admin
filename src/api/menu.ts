import { api } from '@/api/request';
import type { MenuFormReq, MenuVO } from '@/types/api';

/** 菜单管理接口：/api/infra/admin-api/menu/** */

/**
 * 查询完整菜单树（含按钮权限节点）
 */
export function listMenuTree(): Promise<MenuVO[]> {
  return api.get<MenuVO[]>('/menu/list');
}

/**
 * 查询菜单详情
 *
 * @param id 菜单 ID
 */
export function getMenu(id: string): Promise<MenuVO> {
  return api.get<MenuVO>('/menu/getById', { id });
}

/**
 * 新增菜单
 */
export function createMenu(data: MenuFormReq): Promise<string> {
  return api.post<string>('/menu/create', data);
}

/**
 * 修改菜单
 */
export function updateMenu(data: MenuFormReq): Promise<void> {
  return api.post<void>('/menu/update', data);
}

/**
 * 删除菜单：有子菜单或被角色引用时后端会拒绝
 *
 * @param id 菜单 ID
 */
export function deleteMenu(id: string): Promise<void> {
  return api.post<void>('/menu/delete', undefined, { params: { id } });
}
