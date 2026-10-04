import { api } from '@/api/request';
import type { FileUploadRespVO } from '@/types/api';

/**
 * 通用文件上传接口（在 infra 服务上）：/api/infra/admin-api/file/upload
 *
 * <p>业务表引用文件时只存 {@code fileId}，展示地址按需重新签发，所以上传后要把 fileId 存下来。
 */

/**
 * 上传单个文件
 *
 * @param file 文件，表单字段名固定为 file
 * @param onProgress 上传进度回调（0~100）
 */
export function uploadFile(file: File, onProgress?: (percent: number) => void): Promise<FileUploadRespVO> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post<FileUploadRespVO>('/file/upload', formData, {
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) {
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
}
