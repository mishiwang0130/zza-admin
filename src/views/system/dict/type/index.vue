<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { createDictType, deleteDictType, getDictType, pageDictType, updateDictType } from '@/api/dictType';
import type { DictTypeVO } from '@/types/api';
import { formatDateTime, toNumber } from '@/utils/format';

/**
 * 字典类型管理：字典数据的入口页。
 *
 * <p>字典类型没有单独的启停接口，状态通过编辑弹窗里的「状态」字段修改；
 * 表格里点「字典数据」跳到字典数据详情页，并把类型编码带过去。
 */
defineOptions({ name: 'SystemDictTypeIndex' });

/** 字典数据详情页路径：不在菜单表里，由前端静态路由提供 */
const DICT_DATA_PATH = '/system/dict-type/data';

const router = useRouter();

const loading = ref(false);
const list = ref<DictTypeVO[]>([]);
const total = ref(0);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  name: '',
  type: '',
  status: null as number | null,
});

/** 拉取字典类型列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageDictType({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      name: query.name.trim() || undefined,
      type: query.type.trim() || undefined,
      status: query.status,
    });
    list.value = page.records ?? [];
    total.value = toNumber(page.total);
  } finally {
    loading.value = false;
  }
}

function resetQuery(): void {
  query.name = '';
  query.type = '';
  query.status = null;
  query.pageNum = 1;
  loadList();
}

function handleSearch(): void {
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

/** 跳到该类型的字典数据详情页 */
function goDictData(row: DictTypeVO): void {
  router.push({ path: DICT_DATA_PATH, query: { dictType: row.type } });
}

/* ---------------------------- 新增 / 编辑 ---------------------------- */

const formVisible = ref(false);
const formLoading = ref(false);
const formRef = ref<FormInstance>();
const editingId = ref('');
const isEdit = computed(() => Boolean(editingId.value));

const form = reactive({
  name: '',
  type: '',
  status: 0,
  remark: '',
});

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入字典名称', trigger: 'blur' },
    { max: 100, message: '字典名称不能超过 100 个字符', trigger: 'blur' },
  ],
  type: [
    { required: true, message: '请输入字典类型编码', trigger: 'blur' },
    { max: 100, message: '编码长度不能超过 100 个字符', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
      message: '只能由字母、数字、下划线、中划线组成，且以字母开头',
      trigger: 'blur',
    },
  ],
  remark: [{ max: 500, message: '备注不能超过 500 个字符', trigger: 'blur' }],
};

function resetForm(): void {
  form.name = '';
  form.type = '';
  form.status = 0;
  form.remark = '';
  formRef.value?.clearValidate();
}

function openCreate(): void {
  editingId.value = '';
  resetForm();
  formVisible.value = true;
}

async function openEdit(row: DictTypeVO): Promise<void> {
  editingId.value = row.id;
  resetForm();
  const detail = await getDictType(row.id);
  form.name = detail.name;
  form.type = detail.type;
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
      await updateDictType({ id: editingId.value, ...form });
      ElMessage.success('修改成功');
    } else {
      await createDictType({ ...form });
      ElMessage.success('新增成功');
    }
    formVisible.value = false;
    await loadList();
  } finally {
    formLoading.value = false;
  }
}

/* -------------------------------- 删除 -------------------------------- */

async function handleDelete(row: DictTypeVO): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除字典类型「${row.name}」吗？类型下还有字典数据时无法删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  await deleteDictType(row.id);
  ElMessage.success('删除成功');
  await loadList();
}

onMounted(loadList);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">字典类型</div>
        <div class="page-desc">维护业务枚举，前端按类型编码取字典数据</div>
      </div>
      <div class="page-head-actions">
        <el-button v-has-perm="'infra:dict-type:create'" type="primary" @click="openCreate">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          新建字典类型
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-field">
        <span class="filter-label">字典名称</span>
        <el-input v-model="query.name" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
      </div>
      <div class="filter-field">
        <span class="filter-label">类型编码</span>
        <el-input v-model="query.type" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
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
        <el-table-column prop="name" label="字典名称" min-width="150" />
        <el-table-column label="类型编码" min-width="180">
          <template #default="{ row }">
            <span class="perm-chip">{{ row.type }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="status-tag" :class="{ 'is-on': row.status === 0 }">
              {{ row.status === 0 ? '启用' : '停用' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="180">
          <template #default="{ row }">
            <span v-if="row.remark">{{ row.remark }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button v-has-perm="'infra:dict-data:query'" type="button" @click="goDictData(row)">
                字典数据
              </button>
              <button v-has-perm="'infra:dict-type:update'" type="button" @click="openEdit(row)">编辑</button>
              <button
                v-has-perm="'infra:dict-type:delete'"
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
          <div class="empty-block">没有符合条件的字典类型</div>
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
      :title="isEdit ? '编辑字典类型' : '新建字典类型'"
      width="520px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="94px">
        <el-form-item label="字典名称" prop="name">
          <el-input v-model="form.name" placeholder="展示用名称，如 通用状态" />
        </el-form-item>
        <el-form-item label="类型编码" prop="type">
          <el-input v-model="form.type" placeholder="如 common_status" />
          <div class="form-tip">前端按这个编码取字典数据，建议小写下划线</div>
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
