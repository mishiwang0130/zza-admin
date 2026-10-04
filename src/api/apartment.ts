import { rentalApi } from '@/api/request';
import type { PageResp } from '@/types/api';
import type {
  ApartmentDetail,
  ApartmentFormReq,
  ApartmentPageItem,
  ApartmentPageQuery,
  ApartmentSimple,
} from '@/types/rental';

/** 公寓接口：/api/rental/admin-api/apartment/** */

/**
 * 分页查询公寓
 */
export function pageApartment(data: ApartmentPageQuery): Promise<PageResp<ApartmentPageItem>> {
  return rentalApi.post<PageResp<ApartmentPageItem>>('/apartment/page', data);
}

/**
 * 查询公寓详情
 *
 * @param id 公寓 ID
 */
export function getApartment(id: string): Promise<ApartmentDetail> {
  return rentalApi.get<ApartmentDetail>('/apartment/getById', { id });
}

/**
 * 查询公寓下拉列表（房间表单用）
 */
export function listApartmentSimple(): Promise<ApartmentSimple[]> {
  return rentalApi.get<ApartmentSimple[]>('/apartment/listSimple');
}

/**
 * 新增公寓：标签、配套、费用项、图片随表单一次提交
 */
export function createApartment(data: ApartmentFormReq): Promise<string> {
  return rentalApi.post<string>('/apartment/create', data);
}

/**
 * 修改公寓：入参为 null 的字段表示不改动；费用项与图片按提交的列表覆盖写
 */
export function updateApartment(data: ApartmentFormReq): Promise<void> {
  return rentalApi.post<void>('/apartment/update', data);
}

/**
 * 公寓上架 / 下架：下架前后端会校验公寓下是否还有已发布房间
 *
 * @param id 公寓 ID
 * @param publishStatus 0 未发布、1 已发布
 */
export function updateApartmentPublishStatus(id: string, publishStatus: number): Promise<void> {
  return rentalApi.post<void>('/apartment/updatePublishStatus', { id, publishStatus });
}
