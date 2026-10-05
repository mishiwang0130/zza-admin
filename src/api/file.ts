import { api } from '@/api/request';
import { FileSizeExceededError, uploadFileInChunks } from '@/api/fileChunk';
import type { FileUploadRespVO } from '@/types/api';

/**
 * 通用文件上传接口（在 infra 服务上）。
 *
 * <p>业务表引用文件时只存 {@code fileId}，展示地址按需重新签发，所以上传后要把 fileId 存下来。
 *
 * <p>小文件走 {@code POST /file/upload}（一次请求传完），大文件走分片链路
 * （{@code init → upload × N → complete}，见 {@code src/api/fileChunk.ts}）：
 * 服务端容器对单请求有 10MB 上限，超过的文件走老接口必然失败，所以在这里按大小自动分流，
 * 调用方（ImageUploader / FileUploader）不需要知道自己走的是哪条链路。
 */

/** 取消与超限错误由调用方识别，从本模块统一对外导出，调用方不必关心实现放在哪个文件 */
export { FileSizeExceededError, UploadCanceledError } from '@/api/fileChunk';

/** 分流阈值：与后端 zza.infra.file.multipart-threshold 对应，≤ 10MiB 走老接口 */
const MULTIPART_THRESHOLD = 10 * 1024 * 1024;

/** 单文件上限：与后端 zza.infra.file.max-file-size 对应，超过本地直接拦截 */
const MAX_FILE_SIZE = 200 * 1024 * 1024;

/** uploadFile 的可选参数 */
export interface UploadFileOptions {
  /** 取消信号：取消时中断在途分片并调用后端的 abort 释放会话 */
  signal?: AbortSignal;
}

/**
 * 上传单个文件
 *
 * @param file 文件，表单字段名固定为 file
 * @param onProgress 上传进度回调（0~100）
 * @param options 取消信号等可选参数
 */
export function uploadFile(
  file: File,
  onProgress?: (percent: number) => void,
  options?: UploadFileOptions,
): Promise<FileUploadRespVO> {
  if (file.size > MAX_FILE_SIZE) {
    return Promise.reject(new FileSizeExceededError());
  }
  if (file.size > MULTIPART_THRESHOLD) {
    return uploadFileInChunks(file, { onProgress, signal: options?.signal });
  }
  const formData = new FormData();
  formData.append('file', file);
  return api.post<FileUploadRespVO>('/file/upload', formData, {
    signal: options?.signal,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) {
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
}
