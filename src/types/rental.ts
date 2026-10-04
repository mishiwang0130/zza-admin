import type { PageQuery } from '@/types/api';

/**
 * rental 服务（租房管理）的接口类型。
 *
 * <p>与 infra 一样，后端把 {@code Long} 序列化成字符串，所以 id、fileId 都是 string；
 * {@code BigDecimal}（金额、面积）不受影响，仍是数字。
 */

/* ------------------------------- 公共 ------------------------------- */

/** 字典项：编码 + 中文名 */
export interface DictItemVO {
  label: string;
  value: string;
}

/** 图片提交项：只提交文件 ID 与排序号，地址是预签名的、落库会变脏 */
export interface ImageItemReq {
  fileId: string;
  sort?: number;
}

/** 图片返回项 */
export interface ImageVO {
  id: string;
  fileId: string;
  sort: number;
  /** 查询时按 fileId 重新签发的预签名地址 */
  url: string;
}

/** 发布状态：0 未发布、1 已发布；房源没有删除接口，下架即不再对外展示 */
export const PUBLISH_UNPUBLISHED = 0;

export const PUBLISH_PUBLISHED = 1;

/** 费用项：列表与公寓详情共用的字段 */
export interface FeeItemVO {
  id: string;
  name: string;
  /** 费用金额（元） */
  amount: number;
  /** 计价单位，如 吨 / 度 / 月，无单位时为空串 */
  unit: string;
}

/* ------------------------------- 公寓 ------------------------------- */

/** 公寓列表行 */
export interface ApartmentPageItem {
  id: string;
  name: string;
  districtId: string;
  /** 所在区县名称，由后端查 infra 区划回填 */
  districtName: string;
  addressDetail: string;
  minLeaseMonths: number;
  depositMonths: number;
  /** 付款方式：1 月付、2 季付、3 半年付、4 年付 */
  paymentMethod: number;
  publishStatus: number;
  roomCount: number;
  vacantRoomCount: number;
}

/** 公寓详情 */
export interface ApartmentDetail {
  id: string;
  name: string;
  introduction: string;
  districtId: string;
  districtName: string;
  addressDetail: string;
  phone: string;
  minLeaseMonths: number;
  depositMonths: number;
  paymentMethod: number;
  paymentMethodName: string;
  publishStatus: number;
  labelCodes: DictItemVO[];
  facilityCodes: DictItemVO[];
  feeItems: FeeItemVO[];
  images: ImageVO[];
  createTime: string;
  updateTime: string;
}

/** 公寓下拉项 */
export interface ApartmentSimple {
  id: string;
  name: string;
  addressDetail: string;
}

/** 公寓分页入参 */
export interface ApartmentPageQuery extends PageQuery {
  name?: string;
  /** 所在市 ID：后端会展开成区县 ID 列表 */
  cityId?: string;
  districtId?: string;
  paymentMethod?: number | null;
  publishStatus?: number | null;
}

/** 公寓新增 / 修改入参：标签与配套提交字典编码列表 */
export interface ApartmentFormReq {
  id?: string;
  name: string;
  introduction: string;
  districtId: string;
  addressDetail: string;
  phone: string;
  minLeaseMonths: number;
  depositMonths: number;
  paymentMethod: number;
  labelCodes: string[];
  facilityCodes: string[];
  feeItemIds: string[];
  images: ImageItemReq[];
}

/* ------------------------------- 房间 ------------------------------- */

/** 房间列表行 */
export interface RoomPageItem {
  id: string;
  apartmentId: string;
  apartmentName: string;
  roomNumber: string;
  rent: number;
  area: number;
  /** 户型室数 */
  roomCount: number;
  orientation: string;
  orientationName: string;
  floorNo: string;
  publishStatus: number;
  /** 入住状态：0 空置、1 在租，由后端按生效中租约派生 */
  checkInStatus: number;
}

/** 房间详情 */
export interface RoomDetail {
  id: string;
  apartmentId: string;
  apartmentName: string;
  roomNumber: string;
  rent: number;
  area: number;
  roomCount: number;
  orientation: string;
  floorNo: string;
  labelCodes: DictItemVO[];
  facilityCodes: DictItemVO[];
  images: ImageVO[];
  publishStatus: number;
  createTime: string;
  updateTime: string;
}

/** 房间下拉项：租约表单选房用 */
export interface RoomSimple {
  id: string;
  roomNumber: string;
  rent: number;
  publishStatus: number;
}

/** 房间分页入参 */
export interface RoomPageQuery extends PageQuery {
  apartmentId?: string;
  roomNumber?: string;
  publishStatus?: number | null;
  minRent?: number | null;
  maxRent?: number | null;
  /** 只看空置房间 */
  vacantOnly?: boolean;
}

/** 房间新增 / 修改入参 */
export interface RoomFormReq {
  id?: string;
  apartmentId: string;
  roomNumber: string;
  rent: number | null;
  area: number | null;
  roomCount: number;
  orientation: string;
  floorNo: string;
  labelCodes: string[];
  facilityCodes: string[];
  images: ImageItemReq[];
}

/* ------------------------------- 费用项 ------------------------------- */

/** 费用项新增 / 修改入参 */
export interface FeeItemFormReq {
  id?: string;
  name: string;
  amount: number | null;
  unit: string;
}

/* ------------------------------- 租约 ------------------------------- */

/** 租约列表行 */
export interface LeasePageItem {
  id: string;
  userId: string;
  userNickname: string;
  userMobile: string;
  apartmentId: string;
  apartmentName: string;
  roomId: string;
  roomNumber: string;
  leaseStartDate: string;
  leaseEndDate: string;
  rent: number;
  deposit: number;
  /** 租约状态：1 签约待确认 ~ 7 续约待确认 */
  status: number;
  statusName: string;
  /** 来源：1 新签、2 续约 */
  sourceType: number;
  createTime: string;
}

/** 租约详情 */
export interface LeaseDetail {
  id: string;
  userId: string;
  userNickname: string;
  userMobile: string;
  apartmentId: string;
  apartmentName: string;
  roomId: string;
  roomNumber: string;
  /** 合同文件 ID，0 表示尚未上传 */
  contractFileId: string;
  leaseStartDate: string;
  leaseEndDate: string;
  rent: number;
  deposit: number;
  status: number;
  statusName: string;
  sourceType: number;
  remark: string;
  createTime: string;
  updateTime: string;
}

/** 租约分页入参 */
export interface LeasePageQuery extends PageQuery {
  userId?: string;
  apartmentId?: string;
  roomId?: string;
  status?: number | null;
  sourceType?: number | null;
  leaseEndDateStart?: string;
  leaseEndDateEnd?: string;
}

/** 租约新增入参：押金不传时后端按「租金 × 公寓押金月数」计算 */
export interface LeaseCreateReq {
  userId: string;
  apartmentId: string;
  roomId: string;
  contractFileId: string;
  leaseStartDate: string;
  leaseEndDate: string;
  rent: number | null;
  deposit: number | null;
  sourceType: number;
  remark: string;
}

/** 租约修改入参：签约主体不可改 */
export interface LeaseUpdateReq {
  id: string;
  contractFileId?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  rent?: number;
  deposit?: number;
  remark?: string;
}

/* ------------------------------ 看房预约 ------------------------------ */

/** 看房预约：列表与详情弹窗共用 */
export interface ViewAppointmentVO {
  id: string;
  userId: string;
  userNickname: string;
  apartmentId: string;
  apartmentName: string;
  /** 预约人姓名（下单时快照） */
  name: string;
  mobile: string;
  appointmentTime: string;
  /** 1 待看房、2 已取消、3 已看房 */
  status: number;
  statusName: string;
  remark: string;
  createTime: string;
}

/** 看房预约分页入参 */
export interface ViewAppointmentPageQuery extends PageQuery {
  userId?: string;
  apartmentId?: string;
  status?: number | null;
  name?: string;
  mobile?: string;
  appointmentTimeStart?: string;
  appointmentTimeEnd?: string;
}
