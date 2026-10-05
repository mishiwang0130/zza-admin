/**
 * ai-agent 服务的枚举选项与展示工具：与后端 ai-agent-biz 的枚举一一对应。
 *
 * <p>索引状态后端在列表里已经回填了中文名，但筛选下拉与标签配色仍需要一份本地枚举，
 * 所以在这里集中维护，避免页面里散落魔法数字。
 */

/** 下拉选项 */
export interface ValueOption {
  label: string;
  value: number;
}

/** 消息发送方：1 用户、2 智能客服 */
const SENDER_USER = 1;

/** 索引状态：0 待索引、1 已索引、2 索引失败 */
export const DOCUMENT_STATUS_PENDING = 0;
export const DOCUMENT_STATUS_INDEXED = 1;
export const DOCUMENT_STATUS_FAILED = 2;

/** 知识库文档索引状态下拉 */
export const DOCUMENT_STATUS_OPTIONS: ValueOption[] = [
  { label: '待索引', value: DOCUMENT_STATUS_PENDING },
  { label: '已索引', value: DOCUMENT_STATUS_INDEXED },
  { label: '索引失败', value: DOCUMENT_STATUS_FAILED },
];

/**
 * 索引状态标签配色：已索引用主色，索引失败用红色，待索引用橙色
 *
 * @param status 索引状态
 */
export function documentStatusClass(status?: number | null): string {
  if (status === DOCUMENT_STATUS_INDEXED) {
    return 'status-tag is-on';
  }
  if (status === DOCUMENT_STATUS_FAILED) {
    return 'status-tag is-danger';
  }
  return 'status-tag is-warn';
}

/**
 * 消息发送方中文名
 *
 * @param senderType 发送方：1 用户、2 智能客服
 */
export function senderLabel(senderType?: number | null): string {
  return senderType === SENDER_USER ? '用户' : '智能客服';
}

/**
 * 相似度得分转百分比文本
 *
 * <p>向量库返回的余弦相似度在 0~1 之间；调试检索可能返回低分片段，
 * 这里统一保留一位小数，避免不同片段之间看不出差距。
 *
 * @param score 相似度得分
 * @returns 形如 {@code 82.3%} 的文本，空值时返回占位符
 */
export function scoreText(score?: number | null): string {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return '—';
  }
  return `${(score * 100).toFixed(1)}%`;
}
