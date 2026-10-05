<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox, type UploadFile, type UploadInstance } from 'element-plus';
import { Plus, Refresh, Search } from '@element-plus/icons-vue';
import {
  deleteKnowledgeDocument,
  pageKnowledgeDocument,
  rebuildKnowledgeDocument,
  searchKnowledge,
  uploadKnowledgeDocument,
} from '@/api/aiAgentKnowledge';
import type { KnowledgeDocumentVO, KnowledgeSearchItemVO } from '@/types/aiAgent';
import {
  DOCUMENT_STATUS_OPTIONS,
  DOCUMENT_STATUS_PENDING,
  documentStatusClass,
  scoreText,
} from '@/utils/ai-agent-options';
import { COMMON_CITY, listCityLabels } from '@/utils/city-options';
import { formatDateTime, formatFileSize, toNumber } from '@/utils/format';

/**
 * 知识库管理：文档列表与检索调试两个标签页。
 *
 * <p>解析是后端 MQ 异步的：上传与重建索引接口只落库 + 投递消息就返回，文档先显示「待索引」，
 * 消费者在后台解析切片并向量化。所以页面在有「待索引」文档时会按固定间隔静默刷新列表，
 * 用户不用一直点刷新也能看到最终的「已索引 / 索引失败」。
 *
 * <p>检索调试复用线上同一套检索逻辑，但刻意不设相似度阈值：排查「为什么没召回」时，
 * 看到低分片段比看到空列表有用。
 *
 * <p>组件名必须与 {@code cacheNameOf('ai-agent/knowledge/index')} 推导出的
 * {@code AiAgentKnowledgeIndex} 逐字一致，否则标签页的 keep-alive 缓存匹配不上。
 */
defineOptions({ name: 'AiAgentKnowledgeIndex' });

/** 上传文件大小上限（MB），与 spring.servlet.multipart.max-file-size 保持一致 */
const MAX_FILE_SIZE_MB = 20;

/** 支持的文件扩展名：与后端 DocumentParserFactory 覆盖的解析器一致 */
const ALLOWED_EXTENSIONS = ['md', 'txt', 'pdf', 'doc', 'docx', 'html', 'htm'];

/** el-upload 的 accept 字符串 */
const UPLOAD_ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/** 有文档停在「待索引」时的轮询间隔（毫秒）：太密会一直打后端，太疏用户等得久 */
const PENDING_POLL_INTERVAL_MS = 3000;

/** 当前标签页：文档管理 / 检索调试 */
const activeTab = ref('documents');

/* ============================== 文档管理 ============================== */

const loading = ref(false);
const list = ref<KnowledgeDocumentVO[]>([]);
const total = ref(0);

/** 区划树里的标准城市标签：上传文档时只能从这里选，保证与小程序端传的城市名逐字一致 */
const standardCityLabels = ref<string[]>([]);

/** 城市下拉是否在加载：区划树是一次拉全量，慢的时候给下拉一个 loading */
const cityLabelsLoading = ref(false);

/**
 * 加载城市标签选项
 *
 * <p>区划树拉不到不该让整页不可用：列表照常展示，上传弹窗打开时会再触发一次重试。
 */
async function loadCityLabels(): Promise<void> {
  cityLabelsLoading.value = true;
  try {
    standardCityLabels.value = await listCityLabels();
  } catch {
    standardCityLabels.value = [];
  } finally {
    cityLabelsLoading.value = false;
  }
}

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  fileName: '',
  city: '',
  status: null as number | null,
});

/** 正在重建索引的文档 ID：按行锁按钮，避免同一行重复提交 */
const rebuildingId = ref('');

/**
 * 筛选与检索调试的城市下拉：标准城市打底，再并入已加载文档里出现过的城市值。
 *
 * <p>并历史值是为了兼容早期手填时代留下的脏数据 —— 比如「杭州」这种对不上的标签，
 * 得先能筛出来才能重建索引。
 */
const cityOptions = computed(() => {
  const fromDocuments = list.value.map((item) => item.city).filter((city) => Boolean(city));
  return Array.from(new Set([COMMON_CITY, ...standardCityLabels.value, ...fromDocuments]));
});

/**
 * 加载文档分页
 *
 * @param silent 静默刷新：轮询时不要闪表格的 loading 遮罩
 */
async function loadList(silent = false): Promise<void> {
  if (!silent) {
    loading.value = true;
  }
  try {
    const page = await pageKnowledgeDocument({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      fileName: query.fileName.trim() || undefined,
      city: query.city.trim() || undefined,
      status: query.status,
    });
    list.value = page.records ?? [];
    total.value = toNumber(page.total);
  } finally {
    if (!silent) {
      loading.value = false;
    }
  }
}

function handleSearch(): void {
  query.pageNum = 1;
  loadList();
}

function resetQuery(): void {
  query.fileName = '';
  query.city = '';
  query.status = null;
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

/* ------------------------------ 待索引轮询 ------------------------------ */

/** 当前页还有几篇文档在等消费者解析 */
const pendingCount = computed(
  () => list.value.filter((row) => row.status === DOCUMENT_STATUS_PENDING).length,
);

/** 轮询定时器：没有待索引文档时不占资源 */
let pendingTimer: ReturnType<typeof setInterval> | undefined;

function startPendingPolling(): void {
  if (pendingTimer) {
    return;
  }
  pendingTimer = setInterval(() => {
    // 静默刷新：状态变化本来就会改「索引状态」列，不必每 3 秒盖一层加载遮罩
    void loadList(true);
  }, PENDING_POLL_INTERVAL_MS);
}

function stopPendingPolling(): void {
  if (pendingTimer) {
    clearInterval(pendingTimer);
    pendingTimer = undefined;
  }
}

// 有待索引文档才轮询，全都出结果（已索引 / 索引失败）后自动停
watch(pendingCount, (count) => {
  if (count > 0) {
    startPendingPolling();
  } else {
    stopPendingPolling();
  }
});

/** 页面被 keep-alive 缓存 / 恢复时同步暂停与重启轮询，别在后台一直打接口 */
onActivated(() => {
  if (pendingCount.value > 0) {
    startPendingPolling();
  }
});

onDeactivated(stopPendingPolling);
onBeforeUnmount(stopPendingPolling);

/* ------------------------------ 上传文档 ------------------------------ */

const uploadVisible = ref(false);
const uploading = ref(false);
const uploadPercent = ref(0);
const uploadRef = ref<UploadInstance>();
const uploadFile = ref<File | null>(null);
const uploadCity = ref(COMMON_CITY);

/** 上传按钮文案：接口只等文件传完 + 投递消息，网络传完之后很快就返回 */
const uploadButtonText = computed(() =>
  uploadPercent.value < 100 ? `上传中 ${uploadPercent.value}%` : '提交中…',
);

/** el-upload 选中文件：缓存原始 File，同时清空内部列表，避免多次选择后残留 */
function handleFileChange(file: UploadFile): void {
  uploadFile.value = (file.raw as File | undefined) ?? null;
  uploadRef.value?.clearFiles();
}

function openUpload(): void {
  uploadFile.value = null;
  uploadCity.value = COMMON_CITY;
  uploadPercent.value = 0;
  uploadRef.value?.clearFiles();
  // 首次进页面时区划树可能还没回来，或者上次拉失败了：打开弹窗再补一次
  if (!standardCityLabels.value.length) {
    void loadCityLabels();
  }
  uploadVisible.value = true;
}

/**
 * 本地校验：类型与大小后端都会再校验一次，这里只是让用户早点知道
 *
 * @param file 待上传文件
 */
function validateFile(file: File): string {
  const ext = file.name.includes('.') ? (file.name.split('.').pop()?.toLowerCase() ?? '') : '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `仅支持 ${ALLOWED_EXTENSIONS.join(' / ')} 格式的文档`;
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `文件不能超过 ${MAX_FILE_SIZE_MB}MB`;
  }
  return '';
}

async function submitUpload(): Promise<void> {
  const file = uploadFile.value;
  if (!file) {
    ElMessage.warning('请先选择要上传的文档');
    return;
  }
  const invalid = validateFile(file);
  if (invalid) {
    ElMessage.error(invalid);
    return;
  }
  uploading.value = true;
  uploadPercent.value = 0;
  try {
    await uploadKnowledgeDocument(file, uploadCity.value, (percent) => {
      uploadPercent.value = percent;
    });
    ElMessage.success('上传成功，正在后台解析入库，稍后自动刷新');
    uploadVisible.value = false;
    // 新文档 ID 最大、列表按 ID 倒序，所以回到第一页就能看到
    query.pageNum = 1;
    await loadList();
  } catch {
    // 请求层已提示失败原因（如解析失败）；弹窗保留，用户可以直接重试或换文件
  } finally {
    uploading.value = false;
  }
}

/* --------------------------- 重建索引 / 删除 --------------------------- */

async function handleRebuild(row: KnowledgeDocumentVO): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `将提交重建任务：后台先删除《${row.fileName}》的旧向量，再重新解析入库，期间该文档不可被检索。确定重建吗？`,
      '重建索引',
      { type: 'warning', confirmButtonText: '重建', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  rebuildingId.value = row.id;
  try {
    await rebuildKnowledgeDocument(row.id);
    ElMessage.success('已提交重建任务，正在后台处理');
    await loadList();
  } finally {
    rebuildingId.value = '';
  }
}

async function handleDelete(row: KnowledgeDocumentVO): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除《${row.fileName}》会同时清理它的向量与原始文件，且无法恢复。确定删除吗？`,
      '删除文档',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  await deleteKnowledgeDocument(row.id);
  ElMessage.success('删除成功');
  // 删掉当前页最后一条时回退一页，避免停在一个空页
  if (list.value.length === 1 && query.pageNum > 1) {
    query.pageNum -= 1;
  }
  await loadList();
}

/* ============================== 检索调试 ============================== */

const searching = ref(false);
const searched = ref(false);
const searchHits = ref<KnowledgeSearchItemVO[]>([]);

const searchForm = reactive({
  query: '',
  topK: null as number | null,
  city: '',
});

/**
 * 执行语义检索调试
 */
async function submitSearch(): Promise<void> {
  const question = searchForm.query.trim();
  if (!question) {
    ElMessage.warning('请输入检索问题');
    return;
  }
  searching.value = true;
  try {
    searchHits.value =
      (await searchKnowledge({
        query: question,
        topK: searchForm.topK,
        city: searchForm.city.trim() || undefined,
      })) ?? [];
    searched.value = true;
  } finally {
    searching.value = false;
  }
}

function resetSearch(): void {
  searchForm.query = '';
  searchForm.topK = null;
  searchForm.city = '';
  searchHits.value = [];
  searched.value = false;
}

onMounted(() => {
  void loadList();
  void loadCityLabels();
});
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">知识库管理</div>
        <div class="page-desc">维护智能客服回答依据的文档；上传与重建由后台异步切片并向量化入库</div>
      </div>
      <div class="page-head-actions">
        <el-button :loading="loading" @click="loadList">
          <el-icon :size="14" style="margin-right: 4px"><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button v-has-perm="'ai-agent:knowledge:create'" type="primary" @click="openUpload">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          上传文档
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="文档管理" name="documents">
        <div class="filter-bar" style="margin-bottom: 16px">
          <div class="filter-field">
            <span class="filter-label">文件名</span>
            <el-input v-model="query.fileName" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
          </div>
          <div class="filter-field">
            <span class="filter-label">城市标签</span>
            <el-select
              v-model="query.city"
              placeholder="全部城市"
              clearable
              filterable
              allow-create
              default-first-option
            >
              <el-option v-for="city in cityOptions" :key="city" :label="city" :value="city" />
            </el-select>
          </div>
          <div class="filter-field">
            <span class="filter-label">索引状态</span>
            <el-select v-model="query.status" placeholder="全部" clearable>
              <el-option
                v-for="item in DOCUMENT_STATUS_OPTIONS"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
          <div class="filter-actions">
            <el-button @click="resetQuery">重置</el-button>
            <el-button type="primary" @click="handleSearch">查询</el-button>
          </div>
        </div>

        <div class="table-card">
          <el-table v-loading="loading" :data="list" row-key="id" style="width: 100%">
            <el-table-column label="文件名" min-width="240">
              <template #default="{ row }">
                <div class="cell-user-name">{{ row.fileName }}</div>
                <div class="cell-user-account">{{ row.contentType || '未知类型' }}</div>
              </template>
            </el-table-column>
            <el-table-column label="城市标签" width="120">
              <template #default="{ row }">
                <span class="status-tag">{{ row.city || '通用' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="切片数" width="90">
              <template #default="{ row }">{{ row.chunkCount ?? 0 }}</template>
            </el-table-column>
            <el-table-column label="文件大小" width="110">
              <template #default="{ row }">{{ formatFileSize(row.fileSize) }}</template>
            </el-table-column>
            <el-table-column label="索引状态" width="120">
              <template #default="{ row }">
                <el-tooltip
                  :disabled="!row.errorMessage"
                  :content="row.errorMessage"
                  placement="top"
                  effect="dark"
                >
                  <span :class="documentStatusClass(row.status)">
                    {{ row.statusName || '待索引' }}
                  </span>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column label="更新时间" min-width="170">
              <template #default="{ row }">{{ formatDateTime(row.updateTime) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="180" align="right">
              <template #default="{ row }">
                <div class="cell-actions">
                  <button
                    v-has-perm="'ai-agent:knowledge:rebuild'"
                    type="button"
                    :disabled="rebuildingId === row.id"
                    @click="handleRebuild(row)"
                  >
                    {{ rebuildingId === row.id ? '重建中…' : '重建索引' }}
                  </button>
                  <button
                    v-has-perm="'ai-agent:knowledge:delete'"
                    type="button"
                    class="is-danger"
                    @click="handleDelete(row)"
                  >
                    删除
                  </button>
                </div>
              </template>
            </el-table-column>
            <template #empty>
              <div class="empty-block">还没有知识库文档，先上传一份租赁规则文档</div>
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
      </el-tab-pane>

      <el-tab-pane label="检索调试" name="search">
        <div class="filter-bar" style="margin-bottom: 16px">
          <div class="filter-field question-field">
            <span class="filter-label">检索问题</span>
            <el-input
              v-model="searchForm.query"
              type="textarea"
              :rows="2"
              maxlength="500"
              show-word-limit
              placeholder="如：押金怎么算"
              @keyup.ctrl.enter="submitSearch"
            />
          </div>
          <div class="filter-field">
            <span class="filter-label">召回条数</span>
            <el-input-number
              v-model="searchForm.topK"
              :min="1"
              :max="20"
              controls-position="right"
              placeholder="默认"
              style="width: 130px"
            />
          </div>
          <div class="filter-field">
            <span class="filter-label">城市标签</span>
            <el-select
              v-model="searchForm.city"
              placeholder="不过滤城市"
              clearable
              filterable
              allow-create
              default-first-option
            >
              <el-option v-for="city in cityOptions" :key="city" :label="city" :value="city" />
            </el-select>
          </div>
          <div class="filter-actions">
            <el-button @click="resetSearch">清空</el-button>
            <el-button type="primary" :loading="searching" @click="submitSearch">
              <el-icon :size="14" style="margin-right: 4px"><Search /></el-icon>
              检索
            </el-button>
          </div>
        </div>

        <div class="card" style="margin-bottom: 16px">
          <div class="page-desc" style="margin-top: 0">
            调试检索与线上同一套链路，但刻意不设相似度阈值：低于线上阈值的片段也会返回，
            命中为空说明向量库里确实没有相关内容。选城市时按「选中城市 + 通用」过滤。
          </div>
        </div>

        <div v-loading="searching" class="search-hits">
          <template v-if="searchHits.length">
            <div v-for="(hit, index) in searchHits" :key="`${hit.documentId}-${index}`" class="search-hit">
              <div class="search-hit-head">
                <div class="search-hit-title">
                  <span class="search-hit-index">{{ index + 1 }}</span>
                  <span class="cell-user-name">{{ hit.fileName || '未命名文档' }}</span>
                  <span class="status-tag">{{ hit.city || '通用' }}</span>
                </div>
                <div class="search-hit-score">
                  <span class="search-hit-score-value">{{ scoreText(hit.score) }}</span>
                  <span class="text-muted">相似度</span>
                </div>
              </div>
              <div class="search-hit-text">{{ hit.text }}</div>
              <div class="search-hit-foot text-muted">文档 ID：{{ hit.documentId }}</div>
            </div>
          </template>
          <div v-else-if="searched" class="empty-block">没有命中任何片段，换个问法或去掉城市过滤再试</div>
          <div v-else class="empty-block">输入一个用户常问的问题，看看知识库能召回什么</div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="uploadVisible"
      title="上传知识库文档"
      width="520px"
      :close-on-click-modal="false"
      :close-on-press-escape="!uploading"
      :show-close="!uploading"
    >
      <div class="filter-field upload-file-field">
        <span class="filter-label">文档文件</span>
        <div class="upload-picker">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :show-file-list="false"
            :accept="UPLOAD_ACCEPT"
            :disabled="uploading"
            :on-change="handleFileChange"
          >
            <el-button :disabled="uploading">选择文件</el-button>
          </el-upload>
          <span v-if="uploadFile" class="upload-file-name">{{ uploadFile.name }}</span>
          <span v-else class="text-muted">未选择文件</span>
        </div>
        <div class="form-tip">
          支持 {{ ALLOWED_EXTENSIONS.join(' / ') }}，单个文件不超过 {{ MAX_FILE_SIZE_MB }}MB
        </div>
      </div>

      <div class="filter-field upload-city">
        <span class="filter-label">城市标签</span>
        <el-select
          v-model="uploadCity"
          :loading="cityLabelsLoading"
          filterable
          :disabled="uploading"
          placeholder="请选择城市"
        >
          <el-option :label="`${COMMON_CITY}（平台级）`" :value="COMMON_CITY" />
          <el-option v-for="city in standardCityLabels" :key="city" :label="city" :value="city" />
        </el-select>
        <div class="form-tip">
          城市只能选、不能填：小程序提问时传的是城市选择器里的城市名，后台按「选中城市 + 通用」
          精确匹配，手填「深圳」「杭州」这类写法与「深圳市」「杭州市」对不上，文档会被静默过滤掉。
          平台级通用条款选「通用」即可，任何城市提问都会一起召回。
        </div>
      </div>

      <div class="upload-tip">
        提交后由后台异步解析并向量化入库，可以关闭页面；列表里会先显示「待索引」，出结果后自动刷新。
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button :disabled="uploading" @click="uploadVisible = false">取消</el-button>
          <el-button type="primary" :loading="uploading" @click="submitUpload">
            {{ uploading ? uploadButtonText : '上传' }}
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 全局 .filter-field 把输入框限宽到 150px，检索问题与上传城市需要占满整行 */
.question-field {
  width: 100%;
  max-width: 560px;
}

.upload-file-field {
  width: 100%;
  margin-bottom: 14px;
}

.upload-city {
  width: 100%;
}

.upload-city :deep(.el-input),
.upload-city :deep(.el-select) {
  width: 100%;
}

.upload-picker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.upload-file-name {
  color: var(--zz-text);
  font-size: 13px;
  word-break: break-all;
}

.upload-tip {
  margin-top: 14px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--zz-primary-soft);
  color: var(--zz-primary-ink);
  font-size: 12.5px;
}

.search-hits {
  display: flex;
  min-height: 120px;
  flex-direction: column;
  gap: 12px;
}

.search-hit {
  padding: 14px 16px;
  border: 1px solid var(--zz-border);
  border-radius: var(--zz-radius-lg);
  background: #fff;
}

.search-hit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.search-hit-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.search-hit-index {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  border-radius: 6px;
  background: var(--zz-primary-soft);
  color: var(--zz-primary-ink);
  font-size: 12px;
  place-items: center;
}

.search-hit-score {
  display: flex;
  flex: 0 0 auto;
  align-items: baseline;
  gap: 6px;
  font-size: 12px;
}

.search-hit-score-value {
  color: var(--zz-primary-ink);
  font-size: 15px;
  font-weight: 600;
}

.search-hit-text {
  max-height: 220px;
  margin-top: 10px;
  overflow: auto;
  color: #4b5563;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.search-hit-foot {
  margin-top: 8px;
  font-size: 11.5px;
}
</style>
