import { rentalApi } from '@/api/request';
import type { PageResp } from '@/types/api';
import type { RoomDetail, RoomFormReq, RoomPageItem, RoomPageQuery, RoomSimple } from '@/types/rental';

/** 房间接口：/api/rental/admin-api/room/** */

/**
 * 分页查询房间
 */
export function pageRoom(data: RoomPageQuery): Promise<PageResp<RoomPageItem>> {
  return rentalApi.post<PageResp<RoomPageItem>>('/room/page', data);
}

/**
 * 查询房间详情
 *
 * @param id 房间 ID
 */
export function getRoom(id: string): Promise<RoomDetail> {
  return rentalApi.get<RoomDetail>('/room/getById', { id });
}

/**
 * 查询某个公寓下的房间下拉列表（租约表单用）
 *
 * @param apartmentId 公寓 ID
 */
export function listRoomSimpleByApartment(apartmentId: string): Promise<RoomSimple[]> {
  return rentalApi.get<RoomSimple[]>('/room/listSimpleByApartment', { apartmentId });
}

/**
 * 新增房间：房间号在同一公寓内唯一
 */
export function createRoom(data: RoomFormReq): Promise<string> {
  return rentalApi.post<string>('/room/create', data);
}

/**
 * 修改房间
 */
export function updateRoom(data: RoomFormReq): Promise<void> {
  return rentalApi.post<void>('/room/update', data);
}

/**
 * 房间上架 / 下架：下架前后端会校验房间是否存在生效中的租约
 *
 * @param id 房间 ID
 * @param publishStatus 0 未发布、1 已发布
 */
export function updateRoomPublishStatus(id: string, publishStatus: number): Promise<void> {
  return rentalApi.post<void>('/room/updatePublishStatus', { id, publishStatus });
}
