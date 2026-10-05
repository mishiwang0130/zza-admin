import { api } from '@/api/request';
import type { AppUserPageQuery, AppUserVO, PageResp } from '@/types/api';

/** App 用户接口：/api/infra/admin-api/app-user/** ，后台只提供只读分页查询 */

/**
 * 分页查询 App 用户
 *
 * <p>keyword 同时匹配昵称（前后模糊）与手机号（前缀模糊），两个条件都可不传。
 * 租约页的承租人远程搜索复用的也是这个接口。
 */
export function pageAppUser(data: AppUserPageQuery): Promise<PageResp<AppUserVO>> {
  return api.post<PageResp<AppUserVO>>('/app-user/page', data);
}
