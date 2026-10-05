import type { PageQuery } from '@/types/api';

/**
 * ai-agent 服务（智能客服）管理端的接口类型。
 *
 * <p>与 infra / rental 一样，后端把 {@code Long} 序列化成字符串，
 * 所以 id、userId、文件字节数都是 string；Integer / Double 不受影响，仍是数字。
 */

/* ------------------------------ 知识库文档 ------------------------------ */

/** 知识库文档列表行 */
export interface KnowledgeDocumentVO {
  id: string;
  /** 原始文件名，回答引用来源时展示 */
  fileName: string;
  /** 文件类型（Content-Type） */
  contentType: string;
  /** 城市标签：平台级通用文档为「通用」 */
  city: string;
  /** 文件字节数 */
  fileSize: string;
  /** 切片数量：索引成功后由后端回写 */
  chunkCount: number;
  /** 索引状态：0 待索引、1 已索引、2 索引失败 */
  status: number;
  /** 索引状态中文名，由后端回填 */
  statusName: string;
  /** 索引失败原因，只在 status = 2 时有值 */
  errorMessage: string;
  createTime: string;
  updateTime: string;
}

/** 知识库文档分页入参 */
export interface KnowledgeDocumentPageQuery extends PageQuery {
  /** 文件名关键字，模糊匹配 */
  fileName?: string;
  /** 城市标签，精确匹配 */
  city?: string;
  status?: number | null;
}

/* ------------------------------ 检索调试 ------------------------------ */

/** 语义检索调试入参 */
export interface KnowledgeSearchReq {
  /** 检索问题 */
  query: string;
  /** 召回条数 1~20，不传用后端配置的默认值 */
  topK?: number | null;
  /** 城市标签，为空表示不按城市过滤 */
  city?: string;
}

/** 语义检索命中的单条片段 */
export interface KnowledgeSearchItemVO {
  /** 知识库文档 ID（字符串形式） */
  documentId: string;
  /** 来源文件名 */
  fileName: string;
  /** 城市标签 */
  city: string;
  /** 相似度得分，越大越相似 */
  score: number;
  /** 片段正文 */
  text: string;
}

/* ------------------------------ 会话记录 ------------------------------ */

/** 管理端会话列表行 */
export interface ConversationAdminVO {
  id: string;
  /** 所属 App 用户 ID */
  userId: string;
  /** 会话标题：取首条用户问题截断 */
  title: string;
  /** 消息条数：用户消息与 AI 消息都计入 */
  messageCount: number;
  lastMessageTime: string;
  createTime: string;
}

/** 管理端会话分页入参 */
export interface ConversationPageQuery extends PageQuery {
  /** 所属用户 ID，精确匹配 */
  userId?: string;
  /** 标题关键字，模糊匹配 */
  keyword?: string;
}

/** 本轮回答命中的知识库来源片段 */
export interface ChatSourceVO {
  /** 知识库文档 ID（字符串形式） */
  documentId: string;
  fileName: string;
  /** 相似度得分 */
  score: number;
  /** 片段摘要 */
  snippet: string;
}

/** 管理端会话消息明细：比小程序端多带 userId，便于按用户排查 */
export interface ConversationMessageVO {
  id: string;
  userId: string;
  /** 发送方：1 用户、2 智能客服 */
  senderType: number;
  content: string;
  /** 命中的知识来源；用户消息为 null */
  sources: ChatSourceVO[] | null;
  /** 本次回答使用的模型；用户消息为 null */
  model: string | null;
  /** 本次回答耗时（毫秒）；用户消息为 null */
  latencyMs: number | null;
  createTime: string;
}
