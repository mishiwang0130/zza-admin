import { aiAgentApi } from '@/api/request';
import type { PageResp } from '@/types/api';
import type { ConversationAdminVO, ConversationMessageVO, ConversationPageQuery } from '@/types/aiAgent';

/**
 * 会话记录接口：/api/ai-agent/admin-api/conversation/**
 *
 * <p>只读：智能客服不做人工接管，后台的作用是排查「用户投诉的那次回答是怎么来的」。
 */

/**
 * 分页查询会话记录
 */
export function pageConversation(data: ConversationPageQuery): Promise<PageResp<ConversationAdminVO>> {
  return aiAgentApi.post<PageResp<ConversationAdminVO>>('/conversation/page', data);
}

/**
 * 查询会话消息明细：按时间正序返回，含命中的知识来源、模型与耗时
 *
 * @param conversationId 会话 ID
 */
export function listConversationMessages(conversationId: string): Promise<ConversationMessageVO[]> {
  return aiAgentApi.get<ConversationMessageVO[]>('/conversation/messages', { conversationId });
}
