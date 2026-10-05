<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Refresh } from '@element-plus/icons-vue';
import { pageViewAppointment, updateViewAppointmentStatus } from '@/api/viewAppointment';
import { listApartmentSimple } from '@/api/apartment';
import type { ApartmentSimple, ViewAppointmentVO } from '@/types/rental';
import { APPOINTMENT_STATUS_OPTIONS, appointmentStatusClass } from '@/utils/rental-options';
import { formatDateTime, toNumber } from '@/utils/format';

/**
 * 看房预约管理：预约由 App 端发起，管理端只做查看与状态流转。
 *
 * <p>后端只提供列表与状态流转两个接口（列表字段就是详情字段），所以不搭详情页，
 * 详情用抽屉展示同一行数据即可；状态流转只允许「待看房 → 已看房 / 已取消」。
 *
 * <p>预约表只存预约人 ID，昵称与手机号由后端按 ID 查 infra 用户表回填，
 * 所以筛选条件里没有姓名/手机号（infra 不提供按手机号搜索），只能按用户 ID 精确查。
 */
defineOptions({ name: 'RentalViewAppointmentIndex' });

/** 只有待看房可以流转，与后端 RentalAppointmentStatusEnum 的规则一致 */
const STATUS_PENDING = 1;
const STATUS_CANCELED = 2;
const STATUS_VIEWED = 3;

const loading = ref(false);
const list = ref<ViewAppointmentVO[]>([]);
const total = ref(0);
const apartments = ref<ApartmentSimple[]>([]);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  apartmentId: '',
  status: null as number | null,
  userId: '',
  timeRange: [] as string[],
});

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageViewAppointment({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      apartmentId: query.apartmentId || undefined,
      status: query.status,
      userId: query.userId.trim() || undefined,
      appointmentTimeStart: query.timeRange?.[0] || undefined,
      appointmentTimeEnd: query.timeRange?.[1] || undefined,
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
  query.apartmentId = '';
  query.status = null;
  query.userId = '';
  query.timeRange = [];
  query.pageNum = 1;
  loadList();
}

/**
 * 预约人展示名：用户被删掉或查不到时退化成「用户 #ID」
 *
 * @param row 预约行
 */
function personName(row: ViewAppointmentVO): string {
  return row.userNickname || `用户 #${row.userId}`;
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

/* ------------------------------ 状态流转 ------------------------------ */

/**
 * 流转预约状态
 *
 * @param row 预约行
 * @param status 目标状态
 * @param confirmText 二次确认文案
 */
async function changeStatus(row: ViewAppointmentVO, status: number, confirmText: string): Promise<void> {
  try {
    await ElMessageBox.confirm(confirmText, '状态流转', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await updateViewAppointmentStatus(row.id, status);
  ElMessage.success('状态已更新');
  await loadList();
}

/* -------------------------------- 详情 -------------------------------- */

const detailVisible = ref(false);
const detail = ref<ViewAppointmentVO | null>(null);

function openDetail(row: ViewAppointmentVO): void {
  detail.value = row;
  detailVisible.value = true;
}

onMounted(async () => {
  listApartmentSimple()
    .then((data) => {
      apartments.value = data ?? [];
    })
    .catch(() => undefined);
  await loadList();
});
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">看房预约</div>
        <div class="page-desc">用户在小程序/App 提交的看房预约，这里做接待与结果登记</div>
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
        <span class="filter-label">预约公寓</span>
        <el-select v-model="query.apartmentId" placeholder="全部公寓" clearable filterable>
          <el-option v-for="item in apartments" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </div>
      <div class="filter-field">
        <span class="filter-label">预约状态</span>
        <el-select v-model="query.status" placeholder="全部" clearable>
          <el-option
            v-for="item in APPOINTMENT_STATUS_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <div class="filter-field">
        <span class="filter-label">预约用户 ID</span>
        <el-input
          v-model="query.userId"
          placeholder="按 App 用户 ID 精确查"
          clearable
          @keyup.enter="handleSearch"
        />
      </div>
      <div class="filter-field">
        <span class="filter-label">看房时间</span>
        <el-date-picker
          v-model="query.timeRange"
          type="datetimerange"
          value-format="YYYY-MM-DD HH:mm:ss"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          style="width: 340px"
        />
      </div>
      <div class="filter-actions">
        <el-button @click="resetQuery">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="list" row-key="id" style="width: 100%">
        <el-table-column label="预约公寓" min-width="160">
          <template #default="{ row }">{{ row.apartmentName || '—' }}</template>
        </el-table-column>
        <el-table-column label="预约人" min-width="200">
          <template #default="{ row }">
            <div class="cell-user">
              <span class="cell-user-avatar">{{ personName(row).slice(0, 1) }}</span>
              <div>
                <div class="cell-user-name">{{ personName(row) }}</div>
                <div class="cell-user-account">
                  {{ row.userMobile || '手机号不可用' }}
                  <span class="text-muted">· ID {{ row.userId }}</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="看房时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.appointmentTime) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <span :class="appointmentStatusClass(row.status)">{{ row.statusName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="提交时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="210" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button type="button" @click="openDetail(row)">详情</button>
              <template v-if="row.status === STATUS_PENDING">
                <button
                  v-has-perm="'rental:view-appointment:update-status'"
                  type="button"
                  @click="changeStatus(row, STATUS_VIEWED, `确认「${personName(row)}」已完成看房？`)"
                >
                  标记已看房
                </button>
                <button
                  v-has-perm="'rental:view-appointment:update-status'"
                  type="button"
                  class="is-danger"
                  @click="changeStatus(row, STATUS_CANCELED, `确认取消「${personName(row)}」的看房预约？`)"
                >
                  取消
                </button>
              </template>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">没有符合条件的看房预约</div>
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

    <el-drawer v-model="detailVisible" title="看房预约详情" size="440px">
      <template v-if="detail">
        <div class="detail-section">
          <div class="detail-section-title">预约信息</div>
          <div class="meta-row">
            <div class="meta-row-label">预约公寓</div>
            <div class="meta-row-value">{{ detail.apartmentName || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">看房时间</div>
            <div class="meta-row-value">{{ formatDateTime(detail.appointmentTime) }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">状态</div>
            <div class="meta-row-value">
              <span :class="appointmentStatusClass(detail.status)">{{ detail.statusName }}</span>
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">提交时间</div>
            <div class="meta-row-value">{{ formatDateTime(detail.createTime) }}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">预约人</div>
          <div class="meta-row">
            <div class="meta-row-label">昵称</div>
            <div class="meta-row-value">{{ detail.userNickname || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">手机号</div>
            <div class="meta-row-value">{{ detail.userMobile || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">App 用户</div>
            <div class="meta-row-value">ID {{ detail.userId }}</div>
          </div>
          <div v-if="!detail.userNickname && !detail.userMobile" class="form-tip" style="margin-bottom: 8px">
            该用户已注销或查不到，昵称与手机号无法回填；预约记录本身不受影响。
          </div>
          <div class="meta-row">
            <div class="meta-row-label">备注</div>
            <div class="meta-row-value">{{ detail.remark || '—' }}</div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>
