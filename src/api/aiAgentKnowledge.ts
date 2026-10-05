import { aiAgentApi } from '@/api/request';
import type { PageResp } from '@/types/api';
import type {
  KnowledgeDocumentPageQuery,
  KnowledgeDocumentVO,
  KnowledgeSearchItemVO,
  KnowledgeSearchReq,
} from '@/types/aiAgent';

/** 知识库接口：/api/ai-agent/admin-api/knowledge/** */

/**
 * 上传文件的传输超时：解析已改成 MQ 异步，接口只等「文件传完 + 元数据落库 + 投递消息」，
 * 不再等解析与向量化，所以给 60 秒足够传完 20MB 的文件。
 */
const UPLOAD_TIMEOUT = 60000;

/**
 * 检索调试的请求超时：检索要先把检索问题做 embedding 得到查询向量，再查向量库，比普通查询慢。
 */
const SEARCH_TIMEOUT = 60000;

/**
 * 分页查询知识库文档
 */
export function pageKnowledgeDocument(
  data: KnowledgeDocumentPageQuery,
): Promise<PageResp<KnowledgeDocumentVO>> {
  return aiAgentApi.post<PageResp<KnowledgeDocumentVO>>('/knowledge/document/page', data);
}

/**
 * 上传知识库文档
 *
 * <p>表单字段名固定为 file，城市标签走 query 参数（为空时后端按「通用」处理）；
 * 返回新文档 ID，此时文档状态是「待索引」，解析与向量化由 MQ 消费者在后台完成，
 * 前端刷新列表即可看到最终的「已索引」或「索引失败」。
 *
 * @param file 文档文件
 * @param city 城市标签，可留空
 * @param onProgress 上传进度回调（0~100）
 */
export function uploadKnowledgeDocument(
  file: File,
  city?: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  return aiAgentApi.post<string>('/knowledge/document/upload', formData, {
    params: { city: city?.trim() || undefined },
    timeout: UPLOAD_TIMEOUT,
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) {
        return;
      }
      onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });
}

/**
 * 重建文档索引：接口只投递一条索引任务，消费者在后台先删旧向量再重新解析入库
 *
 * @param id 文档 ID
 */
export function rebuildKnowledgeDocument(id: string): Promise<void> {
  return aiAgentApi.post<void>('/knowledge/document/rebuild', { id });
}

/**
 * 删除知识库文档：清理向量与原始文件，文档行逻辑删除
 *
 * @param id 文档 ID
 */
export function deleteKnowledgeDocument(id: string): Promise<void> {
  return aiAgentApi.post<void>('/knowledge/document/delete', { id });
}

/**
 * 语义检索调试：返回 TopK 命中片段与相似度，不设相似度阈值（低分片段也会返回）
 */
export function searchKnowledge(data: KnowledgeSearchReq): Promise<KnowledgeSearchItemVO[]> {
  return aiAgentApi.post<KnowledgeSearchItemVO[]>('/knowledge/search', data, {
    timeout: SEARCH_TIMEOUT,
  });
}
