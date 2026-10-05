<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { listConversationMessages, pageConversation } from '@/api/aiAgentConversation';
import type { ConversationAdminVO, ConversationMessageVO } from '@/types/aiAgent';
import { senderLabel, scoreText } from '@/utils/ai-agent-options';
import { formatDateTime, toNumber } from '@/utils/format';

/**
 * 会话记录：只读排查页。
 *
 * <p>智能客服不做人工接管，后台的价值是回答「用户投诉的那次回答是怎么来的」：
 * 列表能按用户 ID 与标题定位会话，明细里能看到每轮回答命中的知识来源、模型与耗时。
 *
 * <p>消息只存 App 用户 ID，infra 侧没有按 ID 查昵称的接口，所以这里只展示「用户 #ID」。
 *
 * <p>组件名必须与 {@code cacheNameOf('ai-agent/conversation/index')} 推导出的
 * {@code AiAgentConversationIndex} 逐字一致，否则标签页的 keep-alive 缓存匹配不上。
 */
defineOptions({ name: 'AiAgentConversationIndex' });

/** 消息发送方：1 用户、2 智能客服 */
const SENDER_AI = 2;

const loading = ref(false);
const list = ref<ConversationAdminVO[]>([]);
const total = ref(0);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  userId: '',
  keyword: '',
});

/**
 * 加载会话分页
 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageConversation({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      userId: query.userId.trim() || undefined,
      keyword: query.keyword.trim() || undefined,
    });
    list.value = page.records ?? [];
    total.value = toNumber(page.total);
  } finally {
    loading.value = false;
  }
}

function handleSearch(): void {
  query.pageNum = 1;
  loadList();
}

function resetQuery(): void {
  query.userId = '';
  query.keyword = '';
  query.pageNum = 1;
  loadList();
}

function handlePageChange(pageNum: number): void {
  query.pageNum = pageNum;
  loadList();
}

function handlePageSizeChange(pageSize: number): void {
  query.pageSize = pageSize;
  query.pageNum = 1;
  loadList();
}

/* -------------------------------- 消息明细 -------------------------------- */

const detailVisible = ref(false);
const detailLoading = ref(false);
const currentConversation = ref<ConversationAdminVO | null>(null);
const messages = ref<ConversationMessageVO[]>([]);

/**
 * 打开会话详情抽屉：元信息直接用列表行，消息按会话 ID 现拉
 *
 * @param row 会话行
 */
async function openDetail(row: ConversationAdminVO): Promise<void> {
  currentConversation.value = row;
  messages.value = [];
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    messages.value = (await listConversationMessages(row.id)) ?? [];
  } catch {
    // 请求层已提示失败原因，这里保持空列表
  } finally {
    detailLoading.value = false;
  }
}

/** 抽屉关闭时清空，避免下次打开先闪一下上一条会话的消息 */
function handleDetailClosed(): void {
  currentConversation.value = null;
  messages.value = [];
}

/**
 * 会话标题展示名
 *
 * @param title 会话标题
 */
function titleText(title?: string | null): string {
  return title?.trim() ? title : '（无标题）';
}

/**
 * 回答耗时展示文本
 *
 * @param latencyMs 耗时（毫秒），用户消息为 null
 */
function latencyText(latencyMs?: number | null): string {
  return latencyMs === null || latencyMs === undefined ? '—' : `${latencyMs} ms`;
}

onMounted(loadList);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">会话记录</div>
        <div class="page-desc">只读：用于排查某次回答的来源、模型与耗时；智能客服不做人工接管</div>
      </div>
      <div class="page-head-actions">
        <el-button :loading="loading" @click="loadList">
          <el-icon :size="14" style="margin-right: 4px"><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-field">
        <span class="filter-label">用户 ID</span>
        <el-input
          v-model="query.userId"
          placeholder="按 App 用户 ID 精确查"
          clearable
          @keyup.enter="handleSearch"
        />
      </div>
      <div class="filter-field">
        <span class="filter-label">标题关键字</span>
        <el-input v-model="query.keyword" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
      </div>
      <div class="filter-actions">
        <el-button @click="resetQuery">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="list" row-key="id" style="width: 100%">
        <el-table-column label="会话标题" min-width="240">
          <template #default="{ row }">
            <div class="cell-user-name">{{ titleText(row.title) }}</div>
            <div class="cell-user-account">会话 ID {{ row.id }}</div>
          </template>
        </el-table-column>
        <el-table-column label="所属用户" min-width="180">
          <template #default="{ row }">
            <div class="cell-user">
              <span class="cell-user-avatar">用</span>
              <div>
                <div class="cell-user-name">用户 #{{ row.userId }}</div>
                <div class="cell-user-account">App 用户 ID</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="消息条数" width="100">
          <template #default="{ row }">{{ row.messageCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="最后消息时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.lastMessageTime) }}</template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button type="button" @click="openDetail(row)">详情</button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">没有符合条件的会话记录</div>
        </template>
      </el-table>

      <div class="pager">
        <el-pagination
          :current-page="query.pageNum"
          :page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </div>

    <el-drawer v-model="detailVisible" title="会话详情" size="560px" @closed="handleDetailClosed">
      <template v-if="currentConversation">
        <div class="detail-section">
          <div class="detail-section-title">{{ titleText(currentConversation.title) }}</div>
          <div class="meta-row">
            <div class="meta-row-label">所属用户</div>
            <div class="meta-row-value">用户 #{{ currentConversation.userId }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">消息条数</div>
            <div class="meta-row-value">{{ currentConversation.messageCount ?? 0 }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">最后消息</div>
            <div class="meta-row-value">{{ formatDateTime(currentConversation.lastMessageTime) }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">创建时间</div>
            <div class="meta-row-value">{{ formatDateTime(currentConversation.createTime) }}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">消息明细</div>
          <div v-loading="detailLoading" class="message-list">
            <template v-if="messages.length">
              <div
                v-for="message in messages"
                :key="message.id"
                class="message-item"
                :class="message.senderType === SENDER_AI ? 'is-ai' : 'is-user'"
              >
                <div class="message-meta">
                  <span class="message-sender">{{ senderLabel(message.senderType) }}</span>
                  <span class="text-muted">{{ formatDateTime(message.createTime) }}</span>
                </div>
                <div class="message-bubble">{{ message.content }}</div>

                <div v-if="message.senderType === SENDER_AI" class="message-ai-extra">
                  <div class="message-ai-tags">
                    <span class="status-tag">模型 {{ message.model || '未记录' }}</span>
                    <span class="status-tag">耗时 {{ latencyText(message.latencyMs) }}</span>
                  </div>
                  <div v-if="message.sources?.length" class="message-sources">
                    <div
                      v-for="(source, index) in message.sources"
                      :key="`${source.documentId}-${index}`"
                      class="message-source"
                    >
                      <div class="message-source-head">
                        <span class="text-strong">{{ source.fileName || '未命名文档' }}</span>
                        <span class="text-muted">相似度 {{ scoreText(source.score) }}</span>
                      </div>
                      <div class="message-source-snippet">{{ source.snippet }}</div>
                    </div>
                  </div>
                  <div v-else class="form-tip">本轮没有命中知识库（纯模型回答或检索降级）</div>
                </div>
              </div>
            </template>
            <div v-else-if="!detailLoading" class="empty-block">该会话还没有消息</div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped>
.message-list {
  display: flex;
  min-height: 120px;
  flex-direction: column;
  gap: 14px;
}

.message-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
}

.is-user .message-meta {
  flex-direction: row-reverse;
}

.message-sender {
  color: var(--zz-text);
  font-weight: 500;
}

.message-bubble {
  max-width: 92%;
  padding: 9px 12px;
  border-radius: 10px;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.is-ai .message-bubble {
  border: 1px solid var(--zz-border);
  background: #fff;
}

.is-user .message-bubble {
  align-self: flex-end;
  background: var(--zz-primary-soft);
  color: var(--zz-primary-ink);
}

.message-ai-extra {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 92%;
}

.message-ai-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.message-sources {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px dashed var(--zz-border);
  border-radius: 8px;
  background: #fafafa;
}

.message-source-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}

.message-source-snippet {
  margin-top: 4px;
  color: #4b5563;
  font-size: 12px;
  line-height: 1.65;
  word-break: break-word;
}
</style>
