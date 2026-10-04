import { rentalApi } from '@/api/request';
import type { FeeItemFormReq, FeeItemVO } from '@/types/rental';

/** 费用项接口：/api/rental/admin-api/fee-item/** 小配置表，不分页 */

/**
 * 查询全部费用项
 */
export function listFeeItem(): Promise<FeeItemVO[]> {
  return rentalApi.get<FeeItemVO[]>('/fee-item/list');
}

/**
 * 新增费用项：名称唯一
 */
export function createFeeItem(data: FeeItemFormReq): Promise<string> {
  return rentalApi.post<string>('/fee-item/create', data);
}

/**
 * 修改费用项：改动会同时影响引用它的公寓
 */
export function updateFeeItem(data: FeeItemFormReq): Promise<void> {
  return rentalApi.post<void>('/fee-item/update', data);
}

/**
 * 删除费用项：已被公寓引用时后端会拒绝
 *
 * @param id 费用项 ID
 */
export function deleteFeeItem(id: string): Promise<void> {
  return rentalApi.post<void>('/fee-item/delete', { id });
}
