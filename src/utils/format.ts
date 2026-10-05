/**
 * 展示层格式化工具。
 */

/**
 * 格式化后端返回的时间字符串（形如 {@code 2026-10-03T21:07:59}）。
 *
 * @param value 原始时间字符串
 * @returns 形如 {@code 2026-10-03 21:07:59} 的文本，空值时返回占位符
 */
export function formatDateTime(value?: string | null): string {
  if (!value) {
    return '—';
  }
  return value.replace('T', ' ').slice(0, 19);
}

/**
 * 取昵称首字作为头像文案。
 *
 * @param nickname 昵称
 * @returns 单个字符，昵称为空时返回 "?"
 */
export function avatarText(nickname?: string | null): string {
  const text = (nickname ?? '').trim();
  return text ? text.slice(0, 1) : '?';
}

/**
 * 把 Long 字符串安全转成数字，用于分页等需要数值的场景。
 *
 * @param value 后端返回的字符串数字
 * @returns 数值，无法解析时返回 0
 */
export function toNumber(value?: string | number | null): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 字节与更大单位的换算基数 */
const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;

/**
 * 格式化文件大小（后端把 Long 序列化成字符串，所以入参可能是 string）。
 *
 * @param value 文件字节数
 * @returns 形如 {@code 512 B} / {@code 12.3 KB} / {@code 2.4 MB} 的文本，空值时返回占位符
 */
export function formatFileSize(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const bytes = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  if (bytes < BYTES_PER_KB) {
    return `${bytes} B`;
  }
  if (bytes < BYTES_PER_MB) {
    return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  }
  return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
}
