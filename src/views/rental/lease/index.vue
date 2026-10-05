<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { pageAppUser } from '@/api/appUser';
import { createLease, getLease, pageLease, updateLease, updateLeaseStatus } from '@/api/lease';
import { listApartmentSimple } from '@/api/apartment';
import { listRoomSimpleByApartment } from '@/api/room';
import FileUploader from '@/components/FileUploader.vue';
import type { AppUserVO } from '@/types/api';
import type { ApartmentSimple, LeaseDetail, LeasePageItem, RoomSimple } from '@/types/rental';
import {
  LEASE_SOURCE_OPTIONS,
  LEASE_STATUS_OPTIONS,
  isLeaseFinal,
  leaseStatusClass,
  leaseTransitions,
  optionLabel,
} from '@/utils/rental-options';
import { formatDateTime, toNumber } from '@/utils/format';

/**
 * 租约管理：房间与租客之间的合同。
 *
 * <p>两个业务规则来自后端：没有删除接口，作废靠状态置为「已取消」；
 * 状态流转必须按状态机走（枚举里定义），所以这里的按钮只列当前状态允许的目标状态，
 * 不让用户点了才被后端拒绝。
 */
defineOptions({ name: 'RentalLeaseIndex' });

const loading = ref(false);
const list = ref<LeasePageItem[]>([]);
const total = ref(0);
const apartments = ref<ApartmentSimple[]>([]);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  apartmentId: '',
  roomId: '',
  status: null as number | null,
  sourceType: null as number | null,
  dateRange: [] as string[],
});

/** 筛选用的房间下拉：选了公寓才去查该公寓的房间 */
const queryRooms = ref<RoomSimple[]>([]);

async function loadQueryRooms(apartmentId: string): Promise<void> {
  query.roomId = '';
  queryRooms.value = [];
  if (!apartmentId) {
    return;
  }
  try {
    queryRooms.value = (await listRoomSimpleByApartment(apartmentId)) ?? [];
  } catch {
    queryRooms.value = [];
  }
}

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageLease({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      apartmentId: query.apartmentId || undefined,
      roomId: query.roomId || undefined,
      status: query.status,
      sourceType: query.sourceType,
      leaseEndDateStart: query.dateRange?.[0] || undefined,
      leaseEndDateEnd: query.dateRange?.[1] || undefined,
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
  query.roomId = '';
  query.status = null;
  query.sourceType = null;
  query.dateRange = [];
  queryRooms.value = [];
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

/** 租期展示：起 ~ 止 + 共几个月 */
function leaseTerm(row: LeasePageItem): string {
  return `${row.leaseStartDate} ~ ${row.leaseEndDate}`;
}

/* -------------------------------- 新增 -------------------------------- */

const createVisible = ref(false);
const createLoading = ref(false);
const createRef = ref<FormInstance>();
const createRooms = ref<RoomSimple[]>([]);

const createForm = reactive({
  userId: '',
  apartmentId: '',
  roomId: '',
  contractFileId: '',
  leaseStartDate: '',
  leaseEndDate: '',
  rent: null as number | null,
  deposit: null as number | null,
  sourceType: 1,
  remark: '',
});

const createRules: FormRules = {
  userId: [{ required: true, message: '请选择承租人', trigger: 'change' }],
  apartmentId: [{ required: true, message: '请选择签约公寓', trigger: 'change' }],
  roomId: [{ required: true, message: '请选择签约房间', trigger: 'change' }],
  leaseStartDate: [{ required: true, message: '请选择租约开始日期', trigger: 'change' }],
  leaseEndDate: [
    { required: true, message: '请选择租约结束日期', trigger: 'change' },
    {
      validator: (_rule, value: string, callback) => {
        if (value && createForm.leaseStartDate && value <= createForm.leaseStartDate) {
          callback(new Error('结束日期必须晚于开始日期'));
          return;
        }
        callback();
      },
      trigger: 'change',
    },
  ],
  rent: [{ required: true, message: '请输入签约月租金', trigger: 'blur' }],
  remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }],
};

/* ---------------------------- 承租人远程搜索 ---------------------------- */

/**
 * 承租人选择器：调 infra 的 App 用户分页接口远程搜索，选项文本「昵称（手机号）」、值为 id。
 *
 * <p>这个接口在 infra 上，需要 infra:app-user:query 权限；超管不受限，
 * 普通角色要在「角色管理」里勾上「App 用户」菜单，否则搜索会 403。
 */
const tenantOptions = ref<AppUserVO[]>([]);
const tenantLoading = ref(false);
/** 已选中的用户：搜索结果会整批替换，把它单独留着，选中项才不会退化成裸 ID */
const selectedTenant = ref<AppUserVO | null>(null);
/** 请求序号：只认最后一次输入的结果，避免慢请求覆盖新结果 */
let tenantSearchSeq = 0;

/**
 * 承租人展示文本：昵称（手机号）
 *
 * @param nickname 昵称
 * @param mobile 手机号
 * @returns 拼好的文本，两者都为空时返回占位符
 */
function tenantTextOf(nickname?: string | null, mobile?: string | null): string {
  const name = (nickname ?? '').trim();
  const phone = (mobile ?? '').trim();
  if (name && phone) {
    return `${name}（${phone}）`;
  }
  return name || phone || '—';
}

/** 下拉选项文本：都为空时退化成用户 ID，保证选项仍可辨认 */
function tenantOptionLabel(user: AppUserVO): string {
  const text = tenantTextOf(user.nickname, user.mobile);
  return text === '—' ? `用户 #${user.id}` : text;
}

/** 选项列表：把选中项并进来，远程搜索换掉结果后选中项仍能显示文本 */
const tenantOptionList = computed<AppUserVO[]>(() => {
  const selected = selectedTenant.value;
  if (!selected || tenantOptions.value.some((item) => item.id === selected.id)) {
    return tenantOptions.value;
  }
  return [selected, ...tenantOptions.value];
});

/** 远程搜索承租人：输入昵称或手机号，一次取 20 条 */
async function searchTenants(keyword: string): Promise<void> {
  const seq = ++tenantSearchSeq;
  tenantLoading.value = true;
  try {
    const page = await pageAppUser({
      pageNum: 1,
      pageSize: 20,
      keyword: keyword.trim() || undefined,
      status: null,
    });
    if (seq === tenantSearchSeq) {
      tenantOptions.value = page.records ?? [];
    }
  } catch {
    // 请求层已经弹过后端错误（例如缺少 infra:app-user:query 的 403），这里只清空下拉
    if (seq === tenantSearchSeq) {
      tenantOptions.value = [];
    }
  } finally {
    if (seq === tenantSearchSeq) {
      tenantLoading.value = false;
    }
  }
}

/** 展开下拉且还没结果时先拉一页，省得必须打字才看得到用户 */
function handleTenantVisible(visible: boolean): void {
  if (visible && !tenantOptions.value.length) {
    searchTenants('');
  }
}

/** 选中 / 清空承租人：记住选中项用于文本回显 */
function handleTenantChange(userId: string): void {
  selectedTenant.value = userId
    ? (tenantOptionList.value.find((item) => item.id === userId) ?? null)
    : null;
}

/** 选择公寓后加载该公寓的房间，并把房间选择清掉 */
async function handleCreateApartmentChange(apartmentId: string): Promise<void> {
  createForm.roomId = '';
  createRooms.value = [];
  if (!apartmentId) {
    return;
  }
  try {
    createRooms.value = (await listRoomSimpleByApartment(apartmentId)) ?? [];
  } catch {
    createRooms.value = [];
  }
}

/** 选中房间后把租金带出来，省得再手输一遍 */
function handleCreateRoomChange(roomId: string): void {
  const room = createRooms.value.find((item) => item.id === roomId);
  if (room && !createForm.rent) {
    createForm.rent = room.rent;
  }
}

/** 默认租期：今天起、一年止 */
function openCreate(): void {
  const today = new Date();
  const end = new Date(today);
  end.setFullYear(end.getFullYear() + 1);
  createForm.userId = '';
  createForm.apartmentId = query.apartmentId || '';
  createForm.roomId = '';
  createForm.contractFileId = '';
  createForm.leaseStartDate = formatDate(today);
  createForm.leaseEndDate = formatDate(end);
  createForm.rent = null;
  createForm.deposit = null;
  createForm.sourceType = 1;
  createForm.remark = '';
  createRooms.value = [];
  tenantOptions.value = [];
  selectedTenant.value = null;
  if (createForm.apartmentId) {
    handleCreateApartmentChange(createForm.apartmentId);
  }
  createRef.value?.clearValidate();
  createVisible.value = true;
}

/** Date → yyyy-MM-dd */
function formatDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function submitCreate(): Promise<void> {
  const valid = await createRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  createLoading.value = true;
  try {
    await createLease({
      userId: createForm.userId,
      apartmentId: createForm.apartmentId,
      roomId: createForm.roomId,
      contractFileId: createForm.contractFileId || '0',
      leaseStartDate: createForm.leaseStartDate,
      leaseEndDate: createForm.leaseEndDate,
      rent: createForm.rent,
      // 不填押金时后端按「租金 × 公寓押金月数」算，所以这里传 null 而不是 0
      deposit: createForm.deposit,
      sourceType: createForm.sourceType,
      remark: createForm.remark,
    });
    ElMessage.success('租约已创建，状态为「签约待确认」');
    createVisible.value = false;
    await loadList();
  } finally {
    createLoading.value = false;
  }
}

/* -------------------------------- 编辑 -------------------------------- */

const editVisible = ref(false);
const editLoading = ref(false);
const editRef = ref<FormInstance>();
const editing = ref<LeaseDetail | null>(null);
const editLocked = computed(() => (editing.value ? isLeaseFinal(editing.value.status) : false));

/** 编辑回显：承租人用昵称 + 手机号拼展示文本，不显示裸 ID */
const editingTenantText = computed(() =>
  editing.value ? tenantTextOf(editing.value.userNickname, editing.value.userMobile) : '—',
);

const editForm = reactive({
  contractFileId: '',
  leaseStartDate: '',
  leaseEndDate: '',
  rent: null as number | null,
  deposit: null as number | null,
  remark: '',
});

const editRules: FormRules = {
  leaseEndDate: [
    {
      validator: (_rule, value: string, callback) => {
        if (value && editForm.leaseStartDate && value <= editForm.leaseStartDate) {
          callback(new Error('结束日期必须晚于开始日期'));
          return;
        }
        callback();
      },
      trigger: 'change',
    },
  ],
  remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }],
};

async function openEdit(row: LeasePageItem): Promise<void> {
  const detail = await getLease(row.id);
  editing.value = detail;
  editForm.contractFileId = detail.contractFileId === '0' ? '' : detail.contractFileId;
  editForm.leaseStartDate = detail.leaseStartDate;
  editForm.leaseEndDate = detail.leaseEndDate;
  editForm.rent = detail.rent;
  editForm.deposit = detail.deposit;
  editForm.remark = detail.remark ?? '';
  editRef.value?.clearValidate();
  editVisible.value = true;
}

async function submitEdit(): Promise<void> {
  const valid = await editRef.value?.validate().catch(() => false);
  if (!valid || !editing.value) {
    return;
  }
  editLoading.value = true;
  try {
    // 终态只能改合同文件与备注：条款字段一律不传，避免后端判定成「改条款」被拒
    const payload = editLocked.value
      ? {
          id: editing.value.id,
          contractFileId: editForm.contractFileId || '0',
          remark: editForm.remark,
        }
      : {
          id: editing.value.id,
          contractFileId: editForm.contractFileId || '0',
          leaseStartDate: editForm.leaseStartDate,
          leaseEndDate: editForm.leaseEndDate,
          rent: editForm.rent ?? undefined,
          deposit: editForm.deposit ?? undefined,
          remark: editForm.remark,
        };
    await updateLease(payload);
    ElMessage.success('修改成功');
    editVisible.value = false;
    await loadList();
  } finally {
    editLoading.value = false;
  }
}

/* ------------------------------ 状态流转 ------------------------------ */

const transitionVisible = ref(false);
const transitionLoading = ref(false);
const transitionRow = ref<LeasePageItem | null>(null);
const transitionTarget = ref<number | null>(null);

/** 当前行允许流转到的目标状态 */
const transitionOptions = computed(() =>
  transitionRow.value ? leaseTransitions(transitionRow.value.status) : [],
);

function openTransition(row: LeasePageItem): void {
  transitionRow.value = row;
  transitionTarget.value = null;
  transitionVisible.value = true;
}

async function submitTransition(): Promise<void> {
  if (!transitionRow.value || transitionTarget.value === null) {
    ElMessage.warning('请选择目标状态');
    return;
  }
  const targetLabel = optionLabel(LEASE_STATUS_OPTIONS, transitionTarget.value);
  try {
    await ElMessageBox.confirm(
      `确定把该租约流转为「${targetLabel}」吗？状态流转后不可回退（除退租驳回与续约完成外）。`,
      '状态流转确认',
      { type: 'warning', confirmButtonText: '确定流转', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  transitionLoading.value = true;
  try {
    await updateLeaseStatus(transitionRow.value.id, transitionTarget.value);
    ElMessage.success('状态已更新');
    transitionVisible.value = false;
    await loadList();
  } finally {
    transitionLoading.value = false;
  }
}

/* -------------------------------- 详情 -------------------------------- */

const detailVisible = ref(false);
const detail = ref<LeaseDetail | null>(null);

async function openDetail(row: LeasePageItem): Promise<void> {
  detail.value = await getLease(row.id);
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
        <div class="page-title">租约管理</div>
        <div class="page-desc">签约与状态流转；作废用「已取消」，合同不删除</div>
      </div>
      <div class="page-head-actions">
        <el-button :loading="loading" @click="loadList">
          <el-icon :size="14" style="margin-right: 4px"><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button v-has-perm="'rental:lease:create'" type="primary" @click="openCreate">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          新建租约
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-field">
        <span class="filter-label">签约公寓</span>
        <el-select
          v-model="query.apartmentId"
          placeholder="全部公寓"
          clearable
          filterable
          @change="loadQueryRooms"
        >
          <el-option v-for="item in apartments" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </div>
      <div class="filter-field">
        <span class="filter-label">签约房间</span>
        <el-select v-model="query.roomId" placeholder="全部房间" clearable :disabled="!query.apartmentId">
          <el-option v-for="item in queryRooms" :key="item.id" :label="item.roomNumber" :value="item.id" />
        </el-select>
      </div>
      <div class="filter-field">
        <span class="filter-label">租约状态</span>
        <el-select v-model="query.status" placeholder="全部" clearable>
          <el-option
            v-for="item in LEASE_STATUS_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <div class="filter-field">
        <span class="filter-label">租约来源</span>
        <el-select v-model="query.sourceType" placeholder="全部" clearable>
          <el-option
            v-for="item in LEASE_SOURCE_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <div class="filter-field">
        <span class="filter-label">到期时间</span>
        <el-date-picker
          v-model="query.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 260px"
        />
      </div>
      <div class="filter-actions">
        <el-button @click="resetQuery">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="list" row-key="id" style="width: 100%">
        <el-table-column label="签约房间" min-width="160">
          <template #default="{ row }">
            <div class="cell-user-name">{{ row.roomNumber || '—' }}</div>
            <div class="cell-user-account">{{ row.apartmentName || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="承租人" min-width="160">
          <template #default="{ row }">
            <div class="cell-user-name">{{ row.userNickname || '—' }}</div>
            <div v-if="row.userMobile" class="cell-user-account">{{ row.userMobile }}</div>
          </template>
        </el-table-column>
        <el-table-column label="租期" min-width="190">
          <template #default="{ row }">{{ leaseTerm(row) }}</template>
        </el-table-column>
        <el-table-column label="租金 / 押金" width="150">
          <template #default="{ row }">
            <span class="amount">¥ {{ row.rent }} / ¥ {{ row.deposit }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <span :class="leaseStatusClass(row.status)">{{ row.statusName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="90">
          <template #default="{ row }">
            <span class="status-tag">{{ optionLabel(LEASE_SOURCE_OPTIONS, row.sourceType) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button type="button" @click="openDetail(row)">详情</button>
              <button v-has-perm="'rental:lease:update'" type="button" @click="openEdit(row)">编辑</button>
              <button
                v-if="leaseTransitions(row.status).length"
                v-has-perm="'rental:lease:update-status'"
                type="button"
                @click="openTransition(row)"
              >
                状态流转
              </button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">没有符合条件的租约</div>
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

    <el-dialog
      v-model="createVisible"
      title="新建租约"
      width="640px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="createRef" :model="createForm" :rules="createRules" label-width="112px">
        <el-form-item label="承租人" prop="userId">
          <el-select
            v-model="createForm.userId"
            placeholder="输入昵称或手机号搜索"
            filterable
            remote
            clearable
            :remote-method="searchTenants"
            :loading="tenantLoading"
            style="width: 300px"
            @visible-change="handleTenantVisible"
            @change="handleTenantChange"
          >
            <el-option
              v-for="item in tenantOptionList"
              :key="item.id"
              :label="tenantOptionLabel(item)"
              :value="item.id"
            />
          </el-select>
          <div class="form-tip">
            输入昵称或手机号搜索 App 用户；账号需要「App 用户」菜单权限，否则搜索会被拒绝
          </div>
        </el-form-item>
        <el-form-item label="签约公寓" prop="apartmentId">
          <el-select
            v-model="createForm.apartmentId"
            placeholder="请选择公寓"
            filterable
            style="width: 100%"
            @change="handleCreateApartmentChange"
          >
            <el-option v-for="item in apartments" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="签约房间" prop="roomId">
          <el-select
            v-model="createForm.roomId"
            placeholder="请先选择公寓"
            :disabled="!createForm.apartmentId"
            style="width: 100%"
            @change="handleCreateRoomChange"
          >
            <el-option
              v-for="item in createRooms"
              :key="item.id"
              :label="`${item.roomNumber}（¥${item.rent}）${item.publishStatus === 1 ? '' : ' · 未发布'}`"
              :value="item.id"
            />
          </el-select>
          <div class="form-tip">房间已存在生效中租约时后端会拒绝签约</div>
        </el-form-item>
        <el-form-item label="租约起止">
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
            <el-date-picker
              v-model="createForm.leaseStartDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="开始日期"
              style="width: 160px"
            />
            <span class="text-muted">至</span>
            <el-date-picker
              v-model="createForm.leaseEndDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="结束日期"
              style="width: 160px"
            />
          </div>
        </el-form-item>
        <el-form-item label="租金 / 押金" prop="rent">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
            <el-input-number
              v-model="createForm.rent"
              :min="0"
              :precision="2"
              :step="100"
              :controls="false"
              placeholder="月租金"
              style="width: 130px"
            />
            <span class="form-tip">元/月</span>
            <el-input-number
              v-model="createForm.deposit"
              :min="0"
              :precision="2"
              :step="100"
              :controls="false"
              placeholder="押金，可留空"
              style="width: 150px"
            />
            <span class="form-tip">留空按公寓押金月数自动计算</span>
          </div>
        </el-form-item>
        <el-form-item label="租约来源">
          <el-radio-group v-model="createForm.sourceType">
            <el-radio-button v-for="item in LEASE_SOURCE_OPTIONS" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="合同文件">
          <FileUploader
            v-model="createForm.contractFileId"
            button-text="上传合同"
            uploaded-text="合同已上传"
          />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="createForm.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="createVisible = false">取消</el-button>
          <el-button type="primary" :loading="createLoading" @click="submitCreate">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editVisible"
      title="编辑租约"
      width="600px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-alert
        v-if="editLocked"
        type="warning"
        :closable="false"
        show-icon
        title="该租约已处于终态，只能修改合同文件与备注"
        style="margin-bottom: 14px"
      />
      <el-form ref="editRef" :model="editForm" :rules="editRules" label-width="112px">
        <el-form-item label="承租人">
          <span class="text-strong">{{ editingTenantText }}</span>
          <div class="form-tip">签约主体不可修改</div>
        </el-form-item>
        <el-form-item label="租约起止">
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap">
            <el-date-picker
              v-model="editForm.leaseStartDate"
              type="date"
              value-format="YYYY-MM-DD"
              :disabled="editLocked"
              placeholder="开始日期"
              style="width: 160px"
            />
            <span class="text-muted">至</span>
            <el-date-picker
              v-model="editForm.leaseEndDate"
              type="date"
              value-format="YYYY-MM-DD"
              :disabled="editLocked"
              placeholder="结束日期"
              style="width: 160px"
            />
          </div>
        </el-form-item>
        <el-form-item label="租金 / 押金">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
            <el-input-number
              v-model="editForm.rent"
              :min="0"
              :precision="2"
              :step="100"
              :controls="false"
              :disabled="editLocked"
              placeholder="月租金"
              style="width: 130px"
            />
            <el-input-number
              v-model="editForm.deposit"
              :min="0"
              :precision="2"
              :step="100"
              :controls="false"
              :disabled="editLocked"
              placeholder="押金"
              style="width: 130px"
            />
          </div>
        </el-form-item>
        <el-form-item label="合同文件">
          <FileUploader v-model="editForm.contractFileId" button-text="上传合同" uploaded-text="合同已上传" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="editVisible = false">取消</el-button>
          <el-button type="primary" :loading="editLoading" @click="submitEdit">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="transitionVisible" title="租约状态流转" width="460px" destroy-on-close>
      <p class="form-tip" style="margin-bottom: 12px">
        当前状态：{{ optionLabel(LEASE_STATUS_OPTIONS, transitionRow?.status) }}， 只能流转到下面列出的状态。
      </p>
      <el-radio-group v-model="transitionTarget" style="display: flex; flex-direction: column; gap: 8px">
        <el-radio v-for="item in transitionOptions" :key="item.value" :value="item.value">
          {{ item.label }}
        </el-radio>
      </el-radio-group>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="transitionVisible = false">取消</el-button>
          <el-button type="primary" :loading="transitionLoading" @click="submitTransition"
            >确定流转</el-button
          >
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="租约详情" size="460px">
      <template v-if="detail">
        <div class="detail-section">
          <div class="detail-section-title">合同信息</div>
          <div class="meta-row">
            <div class="meta-row-label">签约公寓</div>
            <div class="meta-row-value">{{ detail.apartmentName || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">签约房间</div>
            <div class="meta-row-value">{{ detail.roomNumber || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">租期</div>
            <div class="meta-row-value">{{ detail.leaseStartDate }} ~ {{ detail.leaseEndDate }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">租金 / 押金</div>
            <div class="meta-row-value amount">¥ {{ detail.rent }} / ¥ {{ detail.deposit }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">状态</div>
            <div class="meta-row-value">
              <span :class="leaseStatusClass(detail.status)">{{ detail.statusName }}</span>
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">来源</div>
            <div class="meta-row-value">{{ optionLabel(LEASE_SOURCE_OPTIONS, detail.sourceType) }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">合同文件</div>
            <div class="meta-row-value">
              <span v-if="detail.contractFileId && detail.contractFileId !== '0'">已上传</span>
              <span v-else class="text-muted">尚未上传</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">承租人</div>
          <div class="meta-row">
            <div class="meta-row-label">昵称</div>
            <div class="meta-row-value">{{ detail.userNickname || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">手机号</div>
            <div class="meta-row-value">{{ detail.userMobile || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">备注</div>
            <div class="meta-row-value">{{ detail.remark || '—' }}</div>
          </div>
        </div>

        <div class="detail-section">
          <div class="meta-row">
            <div class="meta-row-label">创建时间</div>
            <div class="meta-row-value">{{ formatDateTime(detail.createTime) }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">更新时间</div>
            <div class="meta-row-value">{{ formatDateTime(detail.updateTime) }}</div>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>
