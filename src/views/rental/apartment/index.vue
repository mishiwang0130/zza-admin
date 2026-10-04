<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import {
  createApartment,
  getApartment,
  pageApartment,
  updateApartment,
  updateApartmentPublishStatus,
} from '@/api/apartment';
import { listFeeItem } from '@/api/feeItem';
import AreaCascader from '@/components/AreaCascader.vue';
import DictSelect from '@/components/DictSelect.vue';
import ImageUploader from '@/components/ImageUploader.vue';
import { useAuthStore } from '@/store/auth';
import type { ApartmentDetail, ApartmentPageItem, FeeItemVO } from '@/types/rental';
import { PAYMENT_METHOD_OPTIONS, PUBLISH_STATUS_OPTIONS, optionLabel } from '@/utils/rental-options';
import { formatDateTime, toNumber } from '@/utils/format';

/**
 * 公寓管理：房源的第一层，房间挂在公寓下。
 *
 * <p>公寓没有删除接口，下架（publishStatus = 0）就是对外不可见；
 * 标签、配套、费用项、图片都随表单一次提交，不需要额外的保存接口。
 */
defineOptions({ name: 'RentalApartmentIndex' });

/** infra 字典类型编码：与后端 RentalDictTypeConstant 对应 */
const DICT_APARTMENT_LABEL = 'rental_apartment_label';
const DICT_APARTMENT_FACILITY = 'rental_apartment_facility';

const router = useRouter();
const auth = useAuthStore();

const loading = ref(false);
const list = ref<ApartmentPageItem[]>([]);
const total = ref(0);
const feeItems = ref<FeeItemVO[]>([]);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  name: '',
  cityId: '',
  districtId: '',
  areaId: '',
  paymentMethod: null as number | null,
  publishStatus: null as number | null,
});

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageApartment({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      name: query.name.trim() || undefined,
      cityId: query.cityId || undefined,
      districtId: query.districtId || undefined,
      paymentMethod: query.paymentMethod,
      publishStatus: query.publishStatus,
    });
    list.value = page.records ?? [];
    total.value = toNumber(page.total);
  } finally {
    loading.value = false;
  }
}

/**
 * 地区筛选：省市区选择器可以停在任何一级，这里按选中层级决定传给市还是区县
 *
 * @param payload 选中项与完整路径（路径里带每一级的 level，用来判断用户停在哪一级）
 */
function handleAreaFilter(payload: { value: string; path: { level: number }[] } | null): void {
  query.areaId = payload?.value ?? '';
  const level = payload?.path?.[payload.path.length - 1]?.level;
  query.districtId = level === 3 ? (payload?.value ?? '') : '';
  query.cityId = level === 2 ? (payload?.value ?? '') : '';
  handleSearch();
}

function handleSearch(): void {
  query.pageNum = 1;
  loadList();
}

function resetQuery(): void {
  query.name = '';
  query.cityId = '';
  query.districtId = '';
  query.areaId = '';
  query.paymentMethod = null;
  query.publishStatus = null;
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

/** 上架 / 下架：开关已经改了行数据，失败要改回去 */
async function handlePublishChange(row: ApartmentPageItem): Promise<void> {
  const previous = row.publishStatus === 1 ? 0 : 1;
  try {
    await updateApartmentPublishStatus(row.id, row.publishStatus);
    ElMessage.success(row.publishStatus === 1 ? '已上架' : '已下架');
  } catch {
    row.publishStatus = previous;
  }
}

/** 跳到房间管理并按当前公寓过滤 */
function goRooms(row: ApartmentPageItem): void {
  router.push({ path: '/rental/room', query: { apartmentId: row.id } });
}

/* ---------------------------- 新增 / 编辑 ---------------------------- */

const formVisible = ref(false);
const formLoading = ref(false);
const formRef = ref<FormInstance>();
const editingId = ref('');
const isEdit = computed(() => Boolean(editingId.value));

const form = reactive({
  name: '',
  introduction: '',
  districtId: '',
  addressDetail: '',
  phone: '',
  minLeaseMonths: 1,
  depositMonths: 1,
  paymentMethod: 1,
  labelCodes: [] as string[],
  facilityCodes: [] as string[],
  feeItemIds: [] as string[],
  images: [] as { fileId: string; url?: string; sort?: number }[],
});

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入公寓名称', trigger: 'blur' },
    { max: 100, message: '公寓名称不能超过 100 个字符', trigger: 'blur' },
  ],
  districtId: [{ required: true, message: '请选择所在区县', trigger: 'change' }],
  introduction: [{ max: 1000, message: '公寓介绍不能超过 1000 个字符', trigger: 'blur' }],
  addressDetail: [{ max: 255, message: '详细地址不能超过 255 个字符', trigger: 'blur' }],
  phone: [{ max: 20, message: '联系电话不能超过 20 个字符', trigger: 'blur' }],
};

function resetForm(): void {
  form.name = '';
  form.introduction = '';
  form.districtId = '';
  form.addressDetail = '';
  form.phone = '';
  form.minLeaseMonths = 1;
  form.depositMonths = 1;
  form.paymentMethod = 1;
  form.labelCodes = [];
  form.facilityCodes = [];
  form.feeItemIds = [];
  form.images = [];
  formRef.value?.clearValidate();
}

function openCreate(): void {
  editingId.value = '';
  resetForm();
  formVisible.value = true;
}

async function openEdit(row: ApartmentPageItem): Promise<void> {
  editingId.value = row.id;
  resetForm();
  const detail = await getApartment(row.id);
  form.name = detail.name;
  form.introduction = detail.introduction ?? '';
  form.districtId = detail.districtId;
  form.addressDetail = detail.addressDetail ?? '';
  form.phone = detail.phone ?? '';
  form.minLeaseMonths = detail.minLeaseMonths ?? 1;
  form.depositMonths = detail.depositMonths ?? 1;
  form.paymentMethod = detail.paymentMethod ?? 1;
  // 详情返回的是「编码 + 中文名」，回显只需要编码；费用项与图片按 ID 回显
  form.labelCodes = (detail.labelCodes ?? []).map((item) => item.value);
  form.facilityCodes = (detail.facilityCodes ?? []).map((item) => item.value);
  form.feeItemIds = (detail.feeItems ?? []).map((item) => item.id);
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
      await updateApartment(payload);
      ElMessage.success('修改成功');
    } else {
      await createApartment(payload);
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
const detail = ref<ApartmentDetail | null>(null);

async function openDetail(row: ApartmentPageItem): Promise<void> {
  detail.value = await getApartment(row.id);
  detailVisible.value = true;
}

onMounted(async () => {
  // 费用项下拉只用于表单，取不到（没权限）也不该挡住列表
  listFeeItem()
    .then((data) => {
      feeItems.value = data ?? [];
    })
    .catch(() => undefined);
  await loadList();
});
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">公寓管理</div>
        <div class="page-desc">房源的第一层，房间挂在公寓下；没有删除，下架即对外不可见</div>
      </div>
      <div class="page-head-actions">
        <el-button :loading="loading" @click="loadList">
          <el-icon :size="14" style="margin-right: 4px"><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button v-has-perm="'rental:apartment:create'" type="primary" @click="openCreate">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          新建公寓
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-field">
        <span class="filter-label">公寓名称</span>
        <el-input v-model="query.name" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
      </div>
      <div class="filter-field">
        <span class="filter-label">所在地区</span>
        <div style="width: 240px">
          <AreaCascader
            :model-value="query.areaId"
            any-level
            placeholder="按市或区县筛选"
            @change="handleAreaFilter"
          />
        </div>
      </div>
      <div class="filter-field">
        <span class="filter-label">付款方式</span>
        <el-select v-model="query.paymentMethod" placeholder="全部" clearable>
          <el-option
            v-for="item in PAYMENT_METHOD_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
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
      <div class="filter-actions">
        <el-button @click="resetQuery">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="list" row-key="id" style="width: 100%">
        <el-table-column label="公寓名称" min-width="170">
          <template #default="{ row }">
            <div class="cell-user-name">{{ row.name }}</div>
            <div class="cell-user-account">{{ row.addressDetail || '—' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="所在区县" min-width="120">
          <template #default="{ row }">{{ row.districtName || '—' }}</template>
        </el-table-column>
        <el-table-column label="付款方式" width="100">
          <template #default="{ row }">
            <span class="status-tag">{{ optionLabel(PAYMENT_METHOD_OPTIONS, row.paymentMethod) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="起租 / 押金" width="140">
          <template #default="{ row }">
            {{ row.minLeaseMonths }} 个月起租 · 押 {{ row.depositMonths }} 个月
          </template>
        </el-table-column>
        <el-table-column label="房间" width="150">
          <template #default="{ row }">
            <button type="button" class="link-button" @click="goRooms(row)">
              共 {{ row.roomCount }} 间 · 空置 {{ row.vacantRoomCount }} 间
            </button>
          </template>
        </el-table-column>
        <el-table-column label="发布状态" width="120">
          <template #default="{ row }">
            <el-switch
              v-model="row.publishStatus"
              :active-value="1"
              :inactive-value="0"
              :disabled="!auth.can('rental:apartment:update-publish-status')"
              @change="handlePublishChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button type="button" @click="openDetail(row)">详情</button>
              <button v-has-perm="'rental:apartment:update'" type="button" @click="openEdit(row)">
                编辑
              </button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">还没有公寓，先建一个再往里加房间</div>
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
      :title="isEdit ? '编辑公寓' : '新建公寓'"
      width="680px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="96px">
        <el-form-item label="公寓名称" prop="name">
          <el-input v-model="form.name" placeholder="如 住住安·科技园店" />
        </el-form-item>
        <el-form-item label="所在区县" prop="districtId">
          <AreaCascader v-model="form.districtId" :any-level="false" placeholder="请选择省 / 市 / 区县" />
        </el-form-item>
        <el-form-item label="详细地址" prop="addressDetail">
          <el-input v-model="form.addressDetail" placeholder="不含省市区前缀，如 科苑路 15 号" />
        </el-form-item>
        <el-form-item label="前台电话" prop="phone">
          <el-input v-model="form.phone" placeholder="选填" />
        </el-form-item>
        <el-form-item label="租赁条件">
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
            <el-input-number v-model="form.minLeaseMonths" :min="1" :max="120" controls-position="right" />
            <span class="form-tip">个月起租</span>
            <el-input-number v-model="form.depositMonths" :min="0" :max="12" controls-position="right" />
            <span class="form-tip">个月押金</span>
          </div>
        </el-form-item>
        <el-form-item label="付款方式">
          <el-radio-group v-model="form.paymentMethod">
            <el-radio-button v-for="item in PAYMENT_METHOD_OPTIONS" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="公寓标签">
          <DictSelect
            v-model="form.labelCodes"
            :dict-type="DICT_APARTMENT_LABEL"
            multiple
            placeholder="可多选"
          />
        </el-form-item>
        <el-form-item label="公寓配套">
          <DictSelect
            v-model="form.facilityCodes"
            :dict-type="DICT_APARTMENT_FACILITY"
            multiple
            placeholder="可多选"
          />
        </el-form-item>
        <el-form-item label="包含费用项">
          <el-select v-model="form.feeItemIds" multiple clearable placeholder="可多选" style="width: 100%">
            <el-option
              v-for="item in feeItems"
              :key="item.id"
              :label="
                item.unit ? `${item.name}（¥${item.amount}/${item.unit}）` : `${item.name}（¥${item.amount}）`
              "
              :value="item.id"
            />
          </el-select>
          <div class="form-tip">费用项在「费用项管理」里维护；这里选中的会随公寓展示给租客</div>
        </el-form-item>
        <el-form-item label="公寓介绍" prop="introduction">
          <el-input v-model="form.introduction" type="textarea" :rows="3" maxlength="1000" show-word-limit />
        </el-form-item>
        <el-form-item label="公寓图片">
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

    <el-drawer v-model="detailVisible" title="公寓详情" size="480px">
      <template v-if="detail">
        <div class="detail-section">
          <div class="detail-section-title">基本信息</div>
          <div class="meta-row">
            <div class="meta-row-label">公寓名称</div>
            <div class="meta-row-value">{{ detail.name }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">所在区县</div>
            <div class="meta-row-value">{{ detail.districtName || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">详细地址</div>
            <div class="meta-row-value">{{ detail.addressDetail || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">前台电话</div>
            <div class="meta-row-value">{{ detail.phone || '—' }}</div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">租赁条件</div>
            <div class="meta-row-value">
              {{ detail.minLeaseMonths }} 个月起租 · 押 {{ detail.depositMonths }} 个月 ·
              {{ detail.paymentMethodName || optionLabel(PAYMENT_METHOD_OPTIONS, detail.paymentMethod) }}
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">发布状态</div>
            <div class="meta-row-value">
              <span class="status-tag" :class="{ 'is-on': detail.publishStatus === 1 }">
                {{ optionLabel(PUBLISH_STATUS_OPTIONS, detail.publishStatus) }}
              </span>
            </div>
          </div>
          <div class="meta-row">
            <div class="meta-row-label">公寓介绍</div>
            <div class="meta-row-value">{{ detail.introduction || '—' }}</div>
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
          <div class="detail-section-title">费用项</div>
          <div v-if="detail.feeItems?.length" class="tag-list">
            <span v-for="item in detail.feeItems" :key="item.id" class="status-tag">
              {{ item.name }} ¥{{ item.amount }}{{ item.unit ? ` / ${item.unit}` : '' }}
            </span>
          </div>
          <div v-else class="text-muted">未配置费用项</div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">公寓图片</div>
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
