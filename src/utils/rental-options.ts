/**
 * rental 服务的枚举选项与状态机：与后端 rental-biz 的枚举一一对应。
 *
 * <p>这些值后端只在实体字段上返回数字，前端要展示中文与做状态流转按钮，所以在这里集中维护一份，
 * 避免每个页面各写一遍字符串。
 */

/** 下拉选项 */
export interface ValueOption {
  label: string;
  value: number;
}

/** 发布状态 */
export const PUBLISH_STATUS_OPTIONS: ValueOption[] = [
  { label: '未发布', value: 0 },
  { label: '已发布', value: 1 },
];

/** 付款方式 */
export const PAYMENT_METHOD_OPTIONS: ValueOption[] = [
  { label: '月付', value: 1 },
  { label: '季付', value: 2 },
  { label: '半年付', value: 3 },
  { label: '年付', value: 4 },
];

/** 租约状态 */
export const LEASE_STATUS_OPTIONS: ValueOption[] = [
  { label: '签约待确认', value: 1 },
  { label: '已签约', value: 2 },
  { label: '已取消', value: 3 },
  { label: '已到期', value: 4 },
  { label: '退租待确认', value: 5 },
  { label: '已退租', value: 6 },
  { label: '续约待确认', value: 7 },
];

/** 租约来源 */
export const LEASE_SOURCE_OPTIONS: ValueOption[] = [
  { label: '新签', value: 1 },
  { label: '续约', value: 2 },
];

/** 看房预约状态 */
export const APPOINTMENT_STATUS_OPTIONS: ValueOption[] = [
  { label: '待看房', value: 1 },
  { label: '已取消', value: 2 },
  { label: '已看房', value: 3 },
];

/** 房间入住状态（后端按生效中租约派生，不入库） */
export const CHECK_IN_STATUS_OPTIONS: ValueOption[] = [
  { label: '空置', value: 0 },
  { label: '在租', value: 1 },
];

/** 租约终态：这三个状态只能改合同文件与备注，不能改条款、也不能再流转 */
const LEASE_FINAL_STATUS = [3, 4, 6];

/** 租约状态流转表：与后端 RentalLeaseStatusEnum.canTransitionTo 保持一致 */
const LEASE_TRANSITIONS: Record<number, number[]> = {
  1: [2, 3],
  2: [4, 5, 7],
  5: [2, 6],
  7: [2],
  3: [],
  4: [],
  6: [],
};

/**
 * 取选项中文名
 *
 * @param options 选项列表
 * @param value 入库值
 */
export function optionLabel(options: ValueOption[], value?: number | null): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return options.find((item) => item.value === value)?.label ?? String(value);
}

/**
 * 取租约当前状态允许流转到的目标状态
 *
 * @param status 当前状态
 */
export function leaseTransitions(status: number): ValueOption[] {
  const targets = LEASE_TRANSITIONS[status] ?? [];
  return LEASE_STATUS_OPTIONS.filter((item) => targets.includes(item.value));
}

/**
 * 判断租约是否处于终态
 *
 * @param status 当前状态
 */
export function isLeaseFinal(status: number): boolean {
  return LEASE_FINAL_STATUS.includes(status);
}

/**
 * 租约状态下拉/标签的配色：待确认类用主色，已取消用灰，已退租/到期用中性
 *
 * @param status 租约状态
 */
export function leaseStatusClass(status: number): string {
  if (status === 2) {
    return 'status-tag is-on';
  }
  if (status === 1 || status === 5 || status === 7) {
    return 'status-tag is-warn';
  }
  return 'status-tag';
}

/**
 * 看房预约状态配色
 *
 * @param status 预约状态
 */
export function appointmentStatusClass(status: number): string {
  if (status === 3) {
    return 'status-tag is-on';
  }
  if (status === 1) {
    return 'status-tag is-warn';
  }
  return 'status-tag';
}
