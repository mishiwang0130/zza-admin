import { api } from '@/api/request';
import type { DictTypeFormReq, DictTypePageQuery, DictTypeSimpleVO, DictTypeVO, PageResp } from '@/types/api';

/** 字典类型接口：/api/infra/admin-api/dict-type/** */

/**
 * 分页查询字典类型
 */
export function pageDictType(data: DictTypePageQuery): Promise<PageResp<DictTypeVO>> {
  return api.post<PageResp<DictTypeVO>>('/dict-type/page', data);
}

/**
 * 查询字典类型详情
 *
 * @param id 字典类型 ID
 */
export function getDictType(id: string): Promise<DictTypeVO> {
  return api.get<DictTypeVO>('/dict-type/getById', { id });
}

/**
 * 查询启用中的字典类型列表，供字典数据的类型下拉使用（值为编码）
 */
export function listDictType(): Promise<DictTypeSimpleVO[]> {
  return api.get<DictTypeSimpleVO[]>('/dict-type/list');
}

/**
 * 新增字典类型
 */
export function createDictType(data: DictTypeFormReq): Promise<string> {
  return api.post<string>('/dict-type/create', data);
}

/**
 * 修改字典类型：改编码时后端会同步刷新该类型下的字典数据
 */
export function updateDictType(data: DictTypeFormReq): Promise<void> {
  return api.post<void>('/dict-type/update', data);
}

/**
 * 删除字典类型：类型下还有字典数据时后端会拒绝
 *
 * @param id 字典类型 ID
 */
export function deleteDictType(id: string): Promise<void> {
  return api.post<void>('/dict-type/delete', undefined, { params: { id } });
}
