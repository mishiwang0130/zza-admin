<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { ArrowLeft, Plus } from '@element-plus/icons-vue';
import { createDictData, deleteDictData, getDictData, pageDictData, updateDictData } from '@/api/dictData';
import { listDictType } from '@/api/dictType';
import type { DictDataVO, DictTypeSimpleVO } from '@/types/api';
import { formatDateTime, toNumber } from '@/utils/format';

/**
 * 字典数据详情页：从「字典类型」列表点进来，类型编码通过 query 带过来。
 *
 * <p>这个页面刻意不做成菜单项（后端菜单表也没给它建菜单），它是字典类型的下级页面，
 * 所以路由是前端静态注册的，路径挂在 /system/dict-type 下面，方便侧边栏继续高亮「字典类型」。
 */
defineOptions({ name: 'SystemDictData' });

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const list = ref<DictDataVO[]>([]);
const total = ref(0);
const dictTypes = ref<DictTypeSimpleVO[]>([]);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  // 类型编码从地址栏取，允许用户清空后查看全部
  dictType: (route.query.dictType as string) ?? '',
  label: '',
  status: null as number | null,
});

/** 编码 → 名称：表格里把类型编码显示成中文名 */
const typeNameMap = computed(() => {
  const map = new Map<string, string>();
  dictTypes.value.forEach((item) => map.set(item.type, item.name));
  return map;
});

/** 当前正在查看的类型名称，用于页面副标题 */
const currentTypeName = computed(() =>
  query.dictType ? (typeNameMap.value.get(query.dictType) ?? query.dictType) : '全部类型',
);

/** 拉取字典数据列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageDictData({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      dictType: query.dictType || undefined,
      label: query.label.trim() || undefined,
      status: query.status,
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
  query.dictType = '';
  query.label = '';
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

/** 回到字典类型列表 */
function goBack(): void {
  router.push('/system/dict-type');
}

// 从另一个类型点进来时组件是复用的（同一路径只换了 query），这里跟着 query 重新查询
watch(
  () => route.query.dictType,
  (value) => {
    const next = (value as string) ?? '';
    if (next !== query.dictType) {
      query.dictType = next;
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
  dictType: '',
  label: '',
  value: '',
  sort: 0,
  status: 0,
  remark: '',
});

const formRules: FormRules = {
  dictType: [{ required: true, message: '请选择所属字典类型', trigger: 'change' }],
  label: [
    { required: true, message: '请输入字典标签', trigger: 'blur' },
    { max: 100, message: '字典标签不能超过 100 个字符', trigger: 'blur' },
  ],
  value: [
    { required: true, message: '请输入字典值', trigger: 'blur' },
    { max: 100, message: '字典值不能超过 100 个字符', trigger: 'blur' },
  ],
  remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }],
};

function resetForm(): void {
  form.dictType = query.dictType || '';
  form.label = '';
  form.value = '';
  form.sort = 0;
  form.status = 0;
  form.remark = '';
  formRef.value?.clearValidate();
}

function openCreate(): void {
  editingId.value = '';
  resetForm();
  formVisible.value = true;
}

async function openEdit(row: DictDataVO): Promise<void> {
  editingId.value = row.id;
  resetForm();
  const detail = await getDictData(row.id);
  form.dictType = detail.dictType;
  form.label = detail.label;
  form.value = detail.value;
  form.sort = detail.sort ?? 0;
  form.status = detail.status;
  form.remark = detail.remark ?? '';
  formVisible.value = true;
}

async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  formLoading.value = true;
  try {
    if (isEdit.value) {
      await updateDictData({ id: editingId.value, ...form });
      ElMessage.success('修改成功');
    } else {
      await createDictData({ ...form });
      ElMessage.success('新增成功');
    }
    formVisible.value = false;
    await loadList();
  } finally {
    formLoading.value = false;
  }
}

/* -------------------------------- 删除 -------------------------------- */

async function handleDelete(row: DictDataVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除字典数据「${row.label}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await deleteDictData(row.id);
  ElMessage.success('删除成功');
  await loadList();
}

onMounted(async () => {
  // 类型下拉只用于筛选与表单，拿不到也别挡住列表
  listDictType()
    .then((data) => {
      dictTypes.value = data ?? [];
    })
    .catch(() => undefined);
  await loadList();
});
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">字典数据</div>
        <div class="page-desc">当前类型：{{ currentTypeName }}</div>
      </div>
      <div class="page-head-actions">
        <el-button @click="goBack">
          <el-icon :size="14" style="margin-right: 4px"><ArrowLeft /></el-icon>
          返回字典类型
        </el-button>
        <el-button v-has-perm="'infra:dict-data:create'" type="primary" @click="openCreate">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          新建字典数据
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-field">
        <span class="filter-label">字典类型</span>
        <el-select v-model="query.dictType" placeholder="全部类型" clearable @change="handleSearch">
          <el-option v-for="item in dictTypes" :key="item.id" :label="item.name" :value="item.type" />
        </el-select>
      </div>
      <div class="filter-field">
        <span class="filter-label">字典标签</span>
        <el-input v-model="query.label" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
      </div>
      <div class="filter-field">
        <span class="filter-label">状态</span>
        <el-select v-model="query.status" placeholder="全部" clearable>
          <el-option label="启用" :value="0" />
          <el-option label="停用" :value="1" />
        </el-select>
      </div>
      <div class="filter-actions">
        <el-button @click="resetQuery">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="list" row-key="id" style="width: 100%">
        <el-table-column prop="label" label="字典标签" min-width="140" />
        <el-table-column label="字典值" min-width="130">
          <template #default="{ row }">
            <span class="perm-chip">{{ row.value }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属类型" min-width="160">
          <template #default="{ row }">
            {{ typeNameMap.get(row.dictType) ?? row.dictType }}
            <span class="cell-user-account">{{ row.dictType }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="status-tag" :class="{ 'is-on': row.status === 0 }">
              {{ row.status === 0 ? '启用' : '停用' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="150">
          <template #default="{ row }">
            <span v-if="row.remark">{{ row.remark }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button v-has-perm="'infra:dict-data:update'" type="button" @click="openEdit(row)">编辑</button>
              <button
                v-has-perm="'infra:dict-data:delete'"
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
          <div class="empty-block">没有符合条件的字典数据</div>
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
      :title="isEdit ? '编辑字典数据' : '新建字典数据'"
      width="520px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="94px">
        <el-form-item label="所属类型" prop="dictType">
          <el-select v-model="form.dictType" placeholder="请选择字典类型" style="width: 100%" filterable>
            <el-option v-for="item in dictTypes" :key="item.id" :label="item.name" :value="item.type" />
          </el-select>
        </el-form-item>
        <el-form-item label="字典标签" prop="label">
          <el-input v-model="form.label" placeholder="展示用，如 启用" />
        </el-form-item>
        <el-form-item label="字典值" prop="value">
          <el-input v-model="form.value" placeholder="存库用，如 0；同一类型下唯一" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
          <span class="form-tip" style="margin-left: 10px">越小越靠前</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="0">启用</el-radio>
            <el-radio :value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="formVisible = false">取消</el-button>
          <el-button type="primary" :loading="formLoading" @click="submitForm">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
