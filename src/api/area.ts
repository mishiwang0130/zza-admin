import { api } from '@/api/request';
import type { AreaVO } from '@/types/api';

/**
 * 行政区划接口：/api/infra/admin-api/area/**
 *
 * <p>这两个接口只要求登录、不挂权限标识（省市区是所有业务表单共用的基础数据），
 * 所以不需要 v-has-perm 控制。
 */

/**
 * 查询某一级下的子级区划
 *
 * @param parentId 上级区划 ID，不传表示取省级
 */
export function listAreaChildren(parentId?: string): Promise<AreaVO[]> {
  return api.get<AreaVO[]>('/area/listChildren', parentId ? { parentId } : undefined);
}

/**
 * 查询完整的省市区树：一次拿到三级，前端可本地缓存
 */
export function listAreaTree(): Promise<AreaVO[]> {
  return api.get<AreaVO[]>('/area/listTree');
}
