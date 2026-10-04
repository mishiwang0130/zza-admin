<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { createRoom, getRoom, pageRoom, updateRoom, updateRoomPublishStatus } from '@/api/room';
import { listApartmentSimple } from '@/api/apartment';
import DictSelect from '@/components/DictSelect.vue';
import ImageUploader from '@/components/ImageUploader.vue';
import { useAuthStore } from '@/store/auth';
import type { ApartmentSimple, RoomDetail, RoomPageItem } from '@/types/rental';
import { PUBLISH_STATUS_OPTIONS, CHECK_IN_STATUS_OPTIONS, optionLabel } from '@/utils/rental-options';
import { formatDateTime, toNumber } from '@/utils/format';

/**
 * 房间管理：房源的第二层，属于某个公寓。
 *
 * <p>房间同样没有删除接口，下架前后端会校验房间是否存在生效中的租约；
 * 「在租」是后端按租约表派生的状态，不是房间自己的字段。
 */
defineOptions({ name: 'RentalRoomIndex' });

/** infra 字典类型编码 */
const DICT_ROOM_ORIENTATION = 'rental_room_orientation';
const DICT_ROOM_LABEL = 'rental_room_label';
const DICT_ROOM_FACILITY = 'rental_room_facility';

const route = useRoute();
const auth = useAuthStore();

const loading = ref(false);
const list = ref<RoomPageItem[]>([]);
const total = ref(0);
const apartments = ref<ApartmentSimple[]>([]);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  // 支持从公寓列表点进来时带公寓条件
  apartmentId: (route.query.apartmentId as string) ?? '',
  roomNumber: '',
  publishStatus: null as number | null,
  minRent: null as number | null,
  maxRent: null as number | null,
  vacantOnly: false,
});

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageRoom({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      apartmentId: query.apartmentId || undefined,
      roomNumber: query.roomNumber.trim() || undefined,
      publishStatus: query.publishStatus,
      minRent: query.minRent,
      maxRent: query.maxRent,
      vacantOnly: query.vacantOnly || undefined,
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
  query.roomNumber = '';
  query.publishStatus = null;
  query.minRent = null;
  query.maxRent = null;
  query.vacantOnly = false;
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

async function handlePublishChange(row: RoomPageItem): Promise<void> {
  const previous = row.publishStatus === 1 ? 0 : 1;
  try {
    await updateRoomPublishStatus(row.id, row.publishStatus);
    ElMessage.success(row.publishStatus === 1 ? '已上架' : '已下架');
  } catch {
    // 房间还有生效中的租约时后端会拒绝，这里把开关改回去
    row.publishStatus = previous;
  }
}

// 从公寓列表带条件进来时，地址栏的 query 变了要重新查
watch(
  () => route.query.apartmentId,
  (value) => {
    const next = (value as string) ?? '';
    if (next !== query.apartmentId) {
      query.apartmentId = next;
      query.pageNum = 1;
      loadList();
    }
  },
);

/* ---------------------------- 新增 / 编辑 ---------------------------- */

const formVisible = ref(false);
const formLoading = ref(false);
const formRef = ref<FormInstance>();
const editingId = ref('');
const isEdit = computed(() => Boolean(editingId.value));

const form = reactive({
  apartmentId: '',
  roomNumber: '',
  rent: null as number | null,
  area: null as number | null,
  roomCount: 1,
  orientation: '',
  floorNo: '',
  labelCodes: [] as string[],
  facilityCodes: [] as string[],
  images: [] as { fileId: string; url?: string; sort?: number }[],
});

const formRules: FormRules = {
  apartmentId: [{ required: true, message: '请选择所属公寓', trigger: 'change' }],
  roomNumber: [
    { required: true, message: '请输入房间号', trigger: 'blur' },
    { max: 50, message: '房间号不能超过 50 个字符', trigger: 'blur' },
  ],
  rent: [{ required: true, message: '请输入月租金', trigger: 'blur' }],
  floorNo: [{ max: 32, message: '楼层不能超过 32 个字符', trigger: 'blur' }],
};

function resetForm(): void {
  form.apartmentId = query.apartmentId || '';
  form.roomNumber = '';
  form.rent = null;
  form.area = null;
  form.roomCount = 1;
  form.orientation = '';
  form.floorNo = '';
  form.labelCodes = [];
  form.facilityCodes = [];
  form.images = [];
  formRef.value?.clearValidate();
}

function openCreate(): void {
  editingId.value = '';
  resetForm();
  formVisible.value = true;
}

async function openEdit(row: RoomPageItem): Promise<void> {
  editingId.value = row.id;
  resetForm();
  const detail = await getRoom(row.id);
  form.apartmentId = detail.apartmentId;
  form.roomNumber = detail.roomNumber;
  form.rent = detail.rent;
  form.area = detail.area;
  form.roomCount = detail.roomCount ?? 1;
  form.orientation = detail.orientation ?? '';
  form.floorNo = detail.floorNo ?? '';
  form.labelCodes = (detail.labelCodes ?? []).map((item) => item.value);
  form.facilityCodes = (detail.facilityCodes ?? []).map((item) => item.value);
  form.images = (detail.images ?? []).map((item) => ({
    fileId: item.fileId,
    url: item.url,
    sort: item.sort,
  }));
  formVisible.value = true;
}

async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  const payload = {
    ...form,
    ...(isEdit.value ? { id: editingId.value } : {}),
    images: form.images.map((item, index) => ({ fileId: item.fileId, sort: index + 1 })),
  };
  formLoading.value = true;
  try {
    if (isEdit.value) {
      await updateRoom(payload);
      ElMessage.success('修改成功');
    } else {
      await createRoom(payload);
      ElMessage.success('新增成功');
    }
    formVisible.value = false;
    await loadList();
  } finally {
    formLoading.value = false;
  }
}

/* -------------------------------- 详情 -------------------------------- */

const detailVisible = ref(false);
const detail = ref<RoomDetail | null>(null);

async function openDetail(row: RoomPageItem): Promise<void> {
  detail.value = await getRoom(row.id);
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
        <div class="page-title">房间管理</div>
        <div class="page-desc">房间挂在公寓下，有生效中租约时不能下架</div>
      </div>
      <div class="page-head-actions">
        <el-button :loading="loading" @click="loadList">
          <el-icon :size="14" style="margin-right: 4px"><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button v-has-perm="'rental:room:create'" type="primary" @click="openCreate">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          新建房间
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-field">
        <span class="filter-label">所属公寓</span>
        <el-select v-model="query.apartmentId" placeholder="全部公寓" clearable filterable>
          <el-option v-for="item in apartments" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
      </div>
      <div class="filter-field">
        <span class="filter-label">房间号</span>
        <el-input v-model="query.roomNumber" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
      </div>
      <div class="filter-field">
        <span class="filter-label">发布状态</span>
        <el-select v-model="query.publishStatus" placeholder="全部" clearable>
          <el-option
            v-for="item in PUBLISH_STATUS_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <div class="filter-field">
        <span class="filter-label">月租金区间</span>
        <div style="display: flex; align-items: center; gap: 6px">
          <el-input-number
            v-model="query.minRent"
            :min="0"
            :controls="false"
            placeholder="最低"
            style="width: 96px"
          />
          <span class="text-muted">-</span>
          <el-input-number
            v-model="query.maxRent"
            :min="0"
            :controls="false"
            placeholder="最高"
            style="width: 96px"
          />
        </div>
      </div>
      <div class="filter-field">
        <span class="filter-label">入住状态</span>
        <el-switch v-model="query.vacantOnly" active-text="只看空置" />
      </div>
      <div class="filter-actions">
        <el-button @click="resetQuery">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="list" row-key="id" style="width: 100%">
        <el-table-column label="房间" min-width="160">
          <template #default="{ row }">
            <div class="cell-user-name">{{ row.roomNumber }}</div>
            <div class="cell-user-account">{{ row.apartmentName || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="月租金" width="120">
          <template #default="{ row }">
            <span class="amount">¥ {{ row.rent }}</span>
          </template>
        </el-table-column>
        <el-table-column label="面积" width="100">
          <template #default="{ row }">{{ row.area ? `${row.area} ㎡` : '—' }}</template>
        </el-table-column>
        <el-table-column label="户型" width="90">
          <template #default="{ row }">{{ row.roomCount }} 室</template>
        </el-table-column>
        <el-table-column label="朝向" width="90">
          <template #default="{ row }">{{ row.orientationName || '—' }}</template>
        </el-table-column>
        <el-table-column label="楼层" width="90">
          <template #default="{ row }">{{ row.floorNo || '—' }}</template>
        </el-table-column>
        <el-table-column label="入住状态" width="100">
          <template #default="{ row }">
            <span class="status-tag" :class="{ 'is-warn': row.checkInStatus === 1 }">
              {{ optionLabel(CHECK_IN_STATUS_OPTIONS, row.checkInStatus) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="发布状态" width="110">
          <template #default="{ row }">
            <el-switch
              v-model="row.publishStatus"
              :active-value="1"
              :inactive-value="0"
              :disabled="!auth.can('rental:room:update-publish-status')"
              @change="handlePublishChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button type="button" @click="openDetail(row)">详情</button>
              <button v-has-perm="'rental:room:update'" type="button" @click="openEdit(row)">编辑</button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">没有符合条件的房间</div>
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
      v-model="formVisible"
      :title="isEdit ? '编辑房间' : '新建房间'"
      width="680px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="96px">
        <el-form-item label="所属公寓" prop="apartmentId">
          <el-select v-model="form.apartmentId" placeholder="请选择公寓" filterable style="width: 100%">
            <el-option
              v-for="item in apartments"
              :key="item.id"
              :label="item.addressDetail ? `${item.name}（${item.addressDetail}）` : item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="房间号" prop="roomNumber">
          <el-input v-model="form.roomNumber" placeholder="同一公寓内唯一，如 1801" />
        </el-form-item>
        <el-form-item label="租金 / 面积">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
            <el-input-number
              v-model="form.rent"
              :min="0"
              :precision="2"
              :step="100"
              :controls="false"
              placeholder="月租金"
              style="width: 130px"
            />
            <span class="form-tip">元/月</span>
            <el-input-number
              v-model="form.area"
              :min="0"
              :precision="2"
              :step="5"
              :controls="false"
              placeholder="面积"
              style="width: 130px"
            />
            <span class="form-tip">㎡</span>
          </div>
        </el-form-item>
        <el-form-item label="户型 / 朝向">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap; width: 100%">
            <el-input-number v-model="form.roomCount" :min="1" :max="9" controls-position="right" />
            <span class="form-tip">室</span>
            <div style="width: 180px">
              <DictSelect v-model="form.orientation" :dict-type="DICT_ROOM_ORIENTATION" placeholder="朝向" />
            </div>
          </div>
        </el-form-item>
        <el-form-item label="楼层">
          <el-input v-model="form.floorNo" placeholder="如 3 或 3/18" style="width: 200px" />
        </el-form-item>
        <el-form-item label="房间标签">
          <DictSelect v-model="form.labelCodes" :dict-type="DICT_ROOM_LABEL" multiple placeholder="可多选" />
        </el-form-item>
        <el-form-item label="房间配套">
          <DictSelect
            v-model="form.facilityCodes"
            :dict-type="DICT_ROOM_FACILITY"
            multiple
            placeholder="可多选"
          />
        </el-form-item>
        <el-form-item label="房间图片">
          <ImageUploader v-model="form.images" :max="10" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="formVisible = false">取消</el-button>
          <el-button type="primary" :loading="formLoading" @click="submitForm">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="房间详情" size="480px">
      <template v-if="detail">
        <div class="detail-section">
          <div class="detail-section-title">基本信息</div>
          <div class="meta-row">
            <div class="meta-row-label">房间号</div>
            <div class="meta-row-value">{{ detail.roomNumber }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">所属公寓</div>
            <div class="meta-row-value">{{ detail.apartmentName || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">月租金</div>
            <div class="meta-row-value amount">¥ {{ detail.rent }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">面积 / 户型</div>
            <div class="meta-row-value">
              {{ detail.area ? `${detail.area} ㎡` : '—' }} · {{ detail.roomCount }} 室
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">楼层</div>
            <div class="meta-row-value">{{ detail.floorNo || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">发布状态</div>
            <div class="meta-row-value">
              <span class="status-tag" :class="{ 'is-on': detail.publishStatus === 1 }">
                {{ optionLabel(PUBLISH_STATUS_OPTIONS, detail.publishStatus) }}
              </span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">标签与配套</div>
          <div class="tag-list" style="margin-bottom: 10px">
            <span v-for="item in detail.labelCodes" :key="item.value" class="status-tag is-on">
              {{ item.label }}
            </span>
            <span v-if="!detail.labelCodes?.length" class="text-muted">未设置标签</span>
          </div>
          <div class="tag-list">
            <span v-for="item in detail.facilityCodes" :key="item.value" class="status-tag">
              {{ item.label }}
            </span>
            <span v-if="!detail.facilityCodes?.length" class="text-muted">未设置配套</span>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">房间图片</div>
          <div v-if="detail.images?.length" class="detail-images">
            <el-image
              v-for="item in detail.images"
              :key="item.id"
              :src="item.url"
              fit="cover"
              :preview-src-list="detail.images.map((image) => image.url)"
            />
          </div>
          <div v-else class="text-muted">还没有上传图片</div>
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
