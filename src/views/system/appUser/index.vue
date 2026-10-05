<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { pageAppUser } from '@/api/appUser';
import DictSelect from '@/components/DictSelect.vue';
import type { AppUserVO } from '@/types/api';
import { avatarText, formatDateTime, toNumber } from '@/utils/format';

/**
 * App 用户：只读列表。
 *
 * <p>账号由 App 端注册，后台只做查看，所以没有新增 / 修改 / 删除按钮。
 * 菜单与路由由后端菜单数据下发（component = system/appUser/index），这里不需要注册路由，
 * 页面放在组件路径对应的目录下即可被 import.meta.glob 自动挂上。
 *
 * <p>状态筛选复用 infra 的字典 common_status；表格里的状态标签不依赖字典，直接按值着色，
 * 免得字典接口异常时列表也显示不出状态。
 */
defineOptions({ name: 'SystemAppUserIndex' });

/** 字典类型编码：0 启用 / 1 停用 */
const DICT_COMMON_STATUS = 'common_status';

const loading = ref(false);
const list = ref<AppUserVO[]>([]);
const total = ref(0);

const query = reactive({
  pageNum: 1,
  pageSize: 20,
  keyword: '',
  /** 字典下拉回传的是字符串，空串表示不限 */
  status: '',
});

/** 拉取列表：keyword 匹配昵称或手机号，空值不发 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageAppUser({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      keyword: query.keyword.trim() || undefined,
      status: query.status === '' ? null : Number(query.status),
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
  query.keyword = '';
  query.status = '';
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

/** 状态标签配色：0 启用=绿，1 停用=灰 */
function statusTagClass(status: number): string {
  return status === 0 ? 'status-tag is-on' : 'status-tag';
}

function statusLabel(status: number): string {
  return status === 0 ? '启用' : '停用';
}

onMounted(loadList);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">App 用户</div>
        <div class="page-desc">App 端注册用户，后台仅支持查询</div>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-field">
        <span class="filter-label">关键字</span>
        <el-input
          v-model="query.keyword"
          placeholder="昵称或手机号"
          clearable
          @keyup.enter="handleSearch"
        />
      </div>
      <div class="filter-field">
        <span class="filter-label">状态</span>
        <DictSelect v-model="query.status" :dict-type="DICT_COMMON_STATUS" placeholder="全部" />
      </div>
      <div class="filter-actions">
        <el-button @click="resetQuery">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="list" row-key="id" style="width: 100%">
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column label="昵称" min-width="200">
          <template #default="{ row }">
            <div class="cell-user">
              <span class="cell-user-avatar">{{ avatarText(row.nickname) }}</span>
              <div class="cell-user-name">{{ row.nickname || '—' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="mobile" label="手机号" min-width="140">
          <template #default="{ row }">{{ row.mobile || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <span :class="statusTagClass(row.status)">{{ statusLabel(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">没有符合条件的 App 用户</div>
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
  </div>
</template>
