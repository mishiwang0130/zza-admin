import { api } from '@/api/request';
import type { DictDataFormReq, DictDataPageQuery, DictDataSimpleVO, DictDataVO, PageResp } from '@/types/api';

/** 字典数据接口：/api/infra/admin-api/dict-data/** */

/**
 * 分页查询字典数据
 */
export function pageDictData(data: DictDataPageQuery): Promise<PageResp<DictDataVO>> {
  return api.post<PageResp<DictDataVO>>('/dict-data/page', data);
}

/**
 * 查询字典数据详情
 *
 * @param id 字典数据 ID
 */
export function getDictData(id: string): Promise<DictDataVO> {
  return api.get<DictDataVO>('/dict-data/getById', { id });
}

/**
 * 按类型编码查询启用的字典数据（按排序号升序）
 *
 * @param dictType 字典类型编码
 */
export function listDictDataByType(dictType: string): Promise<DictDataSimpleVO[]> {
  return api.get<DictDataSimpleVO[]>('/dict-data/listByType', { dictType });
}

/**
 * 新增字典数据
 */
export function createDictData(data: DictDataFormReq): Promise<string> {
  return api.post<string>('/dict-data/create', data);
}

/**
 * 修改字典数据：可以改所属类型，后端会校验新类型下字典值不重复
 */
export function updateDictData(data: DictDataFormReq): Promise<void> {
  return api.post<void>('/dict-data/update', data);
}

/**
 * 删除字典数据
 *
 * @param id 字典数据 ID
 */
export function deleteDictData(id: string): Promise<void> {
  return api.post<void>('/dict-data/delete', undefined, { params: { id } });
}
