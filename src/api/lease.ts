import { rentalApi } from '@/api/request';
import type { PageResp } from '@/types/api';
import type {
  LeaseCreateReq,
  LeaseDetail,
  LeasePageItem,
  LeasePageQuery,
  LeaseUpdateReq,
} from '@/types/rental';

/** 租约接口：/api/rental/admin-api/lease/** 没有删除接口，作废用状态 3 已取消 */

/**
 * 分页查询租约
 */
export function pageLease(data: LeasePageQuery): Promise<PageResp<LeasePageItem>> {
  return rentalApi.post<PageResp<LeasePageItem>>('/lease/page', data);
}

/**
 * 查询租约详情
 *
 * @param id 租约 ID
 */
export function getLease(id: string): Promise<LeaseDetail> {
  return rentalApi.get<LeaseDetail>('/lease/getById', { id });
}

/**
 * 新增租约：房间必须存在且属于提交的公寓，且不能已有生效中的租约
 */
export function createLease(data: LeaseCreateReq): Promise<string> {
  return rentalApi.post<string>('/lease/create', data);
}

/**
 * 修改租约：只允许改条款；已取消 / 已到期 / 已退租只能改合同文件与备注
 */
export function updateLease(data: LeaseUpdateReq): Promise<void> {
  return rentalApi.post<void>('/lease/update', data);
}

/**
 * 租约状态流转：严格按状态机执行，非法迁移后端会拒绝
 *
 * @param id 租约 ID
 * @param status 目标状态
 */
export function updateLeaseStatus(id: string, status: number): Promise<void> {
  return rentalApi.post<void>('/lease/updateStatus', { id, status });
}
