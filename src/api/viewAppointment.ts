import { rentalApi } from '@/api/request';
import type { PageResp } from '@/types/api';
import type { ViewAppointmentPageQuery, ViewAppointmentVO } from '@/types/rental';

/** 看房预约接口：/api/rental/admin-api/view-appointment/** 只有列表与状态流转 */

/**
 * 分页查询看房预约：返回的就是列表与详情弹窗要的全部字段
 */
export function pageViewAppointment(data: ViewAppointmentPageQuery): Promise<PageResp<ViewAppointmentVO>> {
  return rentalApi.post<PageResp<ViewAppointmentVO>>('/view-appointment/page', data);
}

/**
 * 看房预约状态流转：只允许 1 待看房 → 3 已看房 / 2 已取消
 *
 * @param id 预约 ID
 * @param status 目标状态
 */
export function updateViewAppointmentStatus(id: string, status: number): Promise<void> {
  return rentalApi.post<void>('/view-appointment/updateStatus', { id, status });
}
