<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { createFeeItem, deleteFeeItem, listFeeItem, updateFeeItem } from '@/api/feeItem';
import type { FeeItemVO } from '@/types/rental';

/**
 * 费用项管理：水费、电费、网费这类挂在公寓上的配置项。
 *
 * <p>小配置表，后端不分页也不出详情接口，所以列表行数据直接回填编辑弹窗。
 */
defineOptions({ name: 'RentalFeeItemIndex' });

const loading = ref(false);
const list = ref<FeeItemVO[]>([]);

/** 查询费用项列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    list.value = (await listFeeItem()) ?? [];
  } finally {
    loading.value = false;
  }
}

/* ---------------------------- 新增 / 编辑 ---------------------------- */

const formVisible = ref(false);
const formLoading = ref(false);
const formRef = ref<FormInstance>();
const editingId = ref('');
const isEdit = computed(() => Boolean(editingId.value));

const form = reactive({
  name: '',
  amount: null as number | null,
  unit: '',
});

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入费用项名称', trigger: 'blur' },
    { max: 64, message: '名称长度不能超过 64 个字符', trigger: 'blur' },
  ],
  amount: [
    { required: true, message: '请输入费用金额', trigger: 'blur' },
    {
      validator: (_rule, value: number | null, callback) => {
        if (value !== null && value < 0) {
          callback(new Error('费用金额不能为负数'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
  unit: [{ max: 16, message: '计价单位长度不能超过 16 个字符', trigger: 'blur' }],
};

function resetForm(): void {
  form.name = '';
  form.amount = null;
  form.unit = '';
  formRef.value?.clearValidate();
}

function openCreate(): void {
  editingId.value = '';
  resetForm();
  formVisible.value = true;
}

function openEdit(row: FeeItemVO): void {
  editingId.value = row.id;
  resetForm();
  form.name = row.name;
  form.amount = row.amount;
  form.unit = row.unit ?? '';
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
      await updateFeeItem({ id: editingId.value, ...form });
      ElMessage.success('修改成功');
    } else {
      await createFeeItem({ ...form });
      ElMessage.success('新增成功');
    }
    formVisible.value = false;
    await loadList();
  } finally {
    formLoading.value = false;
  }
}

/* -------------------------------- 删除 -------------------------------- */

async function handleDelete(row: FeeItemVO): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除费用项「${row.name}」吗？已被公寓引用的费用项无法删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  await deleteFeeItem(row.id);
  ElMessage.success('删除成功');
  await loadList();
}

onMounted(loadList);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">费用项管理</div>
        <div class="page-desc">维护水费、电费这类费用项，公寓表单里按需勾选</div>
      </div>
      <div class="page-head-actions">
        <el-button :loading="loading" @click="loadList">
          <el-icon :size="14" style="margin-right: 4px"><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button v-has-perm="'rental:fee-item:create'" type="primary" @click="openCreate">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          新建费用项
        </el-button>
      </div>
    </div>

    <div class="table-card">
      <el-table v-loading="loading" :data="list" row-key="id" style="width: 100%">
        <el-table-column prop="name" label="费用项名称" min-width="180" />
        <el-table-column label="费用金额" min-width="140">
          <template #default="{ row }">
            <span class="amount">¥ {{ row.amount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="计价单位" min-width="120">
          <template #default="{ row }">
            <span v-if="row.unit">{{ row.unit }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button v-has-perm="'rental:fee-item:update'" type="button" @click="openEdit(row)">编辑</button>
              <button
                v-has-perm="'rental:fee-item:delete'"
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
          <div class="empty-block">还没有费用项，先建一个再挂到公寓上</div>
        </template>
      </el-table>
    </div>

    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '编辑费用项' : '新建费用项'"
      width="460px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="88px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="如 水费" />
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number
            v-model="form.amount"
            :min="0"
            :precision="2"
            :step="10"
            controls-position="right"
          />
          <span class="form-tip" style="margin-left: 10px">单位：元</span>
        </el-form-item>
        <el-form-item label="计价单位" prop="unit">
          <el-input v-model="form.unit" placeholder="如 吨 / 度 / 月，可留空" />
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
