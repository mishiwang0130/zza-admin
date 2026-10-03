<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, ElTree, type FormInstance, type FormRules } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { createRole, deleteRole, getRole, pageRole, updateRole, updateRoleStatus } from '@/api/role';
import { listMenuTree } from '@/api/menu';
import { useAuthStore } from '@/store/auth';
import type { MenuVO, RoleVO } from '@/types/api';
import { formatDateTime, toNumber } from '@/utils/format';

/**
 * 角色管理：查询、新增、编辑（含菜单与按钮权限树）、启用停用、删除。
 *
 * <p>权限树提交时把「全选 + 半选」的节点一起交给后端：
 * 父目录只被半选时也要传上去，否则后端按 menuIds 全量覆盖会把父目录丢掉。
 */
defineOptions({ name: 'SystemRoleIndex' });

/** 超管角色编码：不允许删除、停用，编码也不允许改 */
const SUPER_ADMIN_CODE = 'super_admin';

const auth = useAuthStore();

const loading = ref(false);
const list = ref<RoleVO[]>([]);
const total = ref(0);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  name: '',
  code: '',
  status: null as number | null,
});

/** 拉取角色列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageRole({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      name: query.name.trim() || undefined,
      code: query.code.trim() || undefined,
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
  query.code = '';
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

/** 是否超管角色 */
function isSuperAdminRow(row: RoleVO): boolean {
  return row.code === SUPER_ADMIN_CODE;
}

/* ------------------------------ 权限树 ------------------------------ */

const menuTree = ref<MenuVO[]>([]);

/** 收集所有叶子节点 id：回显时只勾叶子，勾父节点会级联把子节点全选上 */
const leafIds = computed(() => {
  const result = new Set<string>();
  const walk = (nodes: MenuVO[]): void => {
    nodes.forEach((node) => {
      if (node.children?.length) {
        walk(node.children);
      } else {
        result.add(node.id);
      }
    });
  };
  walk(menuTree.value);
  return result;
});

/** 菜单树只拉一次，弹窗复用 */
async function ensureMenuTree(): Promise<void> {
  if (menuTree.value.length) {
    return;
  }
  menuTree.value = (await listMenuTree()) ?? [];
}

/* ---------------------------- 新增 / 编辑 ---------------------------- */

const formVisible = ref(false);
const formLoading = ref(false);
const formRef = ref<FormInstance>();
const treeRef = ref<InstanceType<typeof ElTree>>();
const editingId = ref('');
const isEdit = computed(() => Boolean(editingId.value));

/** 每次打开弹窗换一个 key，强制权限树重新挂载以应用新的勾选状态 */
const treeKey = ref(0);
const checkedMenuIds = ref<string[]>([]);

const form = reactive({
  name: '',
  code: '',
  sort: 0,
  status: 0,
});

const formRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: '请输入角色名称', trigger: 'blur' },
    { max: 64, message: '角色名称不能超过 64 个字符', trigger: 'blur' },
  ],
  code: [
    { required: true, message: '请输入角色编码', trigger: 'blur' },
    { max: 64, message: '角色编码不能超过 64 个字符', trigger: 'blur' },
    {
      pattern: /^[a-z][a-z0-9_]*$/,
      message: '建议小写字母开头，只含小写字母、数字与下划线',
      trigger: 'blur',
    },
  ],
}));

function resetForm(): void {
  form.name = '';
  form.code = '';
  form.sort = 0;
  form.status = 0;
  checkedMenuIds.value = [];
  formRef.value?.clearValidate();
}

/** 打开新增弹窗 */
async function openCreate(): Promise<void> {
  editingId.value = '';
  resetForm();
  await ensureMenuTree();
  treeKey.value += 1;
  formVisible.value = true;
}

/** 打开编辑弹窗：拉详情并把已分配菜单回显到权限树 */
async function openEdit(row: RoleVO): Promise<void> {
  editingId.value = row.id;
  resetForm();
  await ensureMenuTree();
  const detail = await getRole(row.id);
  form.name = detail.name;
  form.code = detail.code;
  form.sort = detail.sort ?? 0;
  form.status = detail.status;
  // 只回显叶子：父节点由 el-tree 自己按级联规则推导选中状态
  checkedMenuIds.value = (detail.menuIds ?? []).filter((id) => leafIds.value.has(id));
  treeKey.value += 1;
  formVisible.value = true;
}

/** 提交新增 / 编辑 */
async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  // 半选的父目录也要提交，否则保存后菜单树会缺一层
  const checked = (treeRef.value?.getCheckedKeys() ?? []) as string[];
  const halfChecked = (treeRef.value?.getHalfCheckedKeys() ?? []) as string[];
  const menuIds = [...checked, ...halfChecked];

  formLoading.value = true;
  try {
    if (isEdit.value) {
      await updateRole({ id: editingId.value, ...form, menuIds });
      ElMessage.success('修改成功');
    } else {
      await createRole({ ...form, menuIds });
      ElMessage.success('新增成功');
    }
    formVisible.value = false;
    await loadList();
  } finally {
    formLoading.value = false;
  }
}

/* ------------------------------ 状态切换 ------------------------------ */

/** 启用 / 停用 */
async function handleStatusChange(row: RoleVO): Promise<void> {
  const previous = row.status === 0 ? 1 : 0;
  try {
    await updateRoleStatus({ id: row.id, status: row.status });
    ElMessage.success(row.status === 0 ? '已启用' : '已停用');
  } catch {
    row.status = previous;
  }
}

/* -------------------------------- 删除 -------------------------------- */

/** 删除角色 */
async function handleDelete(row: RoleVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除角色「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await deleteRole(row.id);
  ElMessage.success('删除成功');
  await loadList();
}

onMounted(() => {
  loadList();
  // 顺带预热菜单树，第一次开弹窗就不用手等
  ensureMenuTree().catch(() => undefined);
});
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">角色管理</div>
        <div class="page-desc">维护角色与其菜单、按钮权限</div>
      </div>
      <div class="page-head-actions">
        <el-button v-has-perm="'infra:role:create'" type="primary" @click="openCreate">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          新建角色
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-field">
        <span class="filter-label">角色名称</span>
        <el-input v-model="query.name" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
      </div>
      <div class="filter-field">
        <span class="filter-label">角色编码</span>
        <el-input v-model="query.code" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
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
        <el-table-column prop="name" label="角色名称" min-width="160" />
        <el-table-column label="角色编码" min-width="170">
          <template #default="{ row }">
            <span class="perm-chip">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="90" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="0"
              :inactive-value="1"
              :disabled="!auth.can('infra:role:update-status') || isSuperAdminRow(row)"
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button v-has-perm="'infra:role:update'" type="button" @click="openEdit(row)">编辑</button>
              <button
                v-has-perm="'infra:role:delete'"
                type="button"
                class="is-danger"
                :disabled="isSuperAdminRow(row)"
                @click="handleDelete(row)"
              >
                删除
              </button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">没有符合条件的角色</div>
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
      :title="isEdit ? '编辑角色' : '新建角色'"
      width="560px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="88px">
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" placeholder="展示用名称" />
        </el-form-item>
        <el-form-item label="角色编码" prop="code">
          <el-input
            v-model="form.code"
            :disabled="isEdit && form.code === SUPER_ADMIN_CODE"
            placeholder="唯一编码，如 operations"
          />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="0">启用</el-radio>
            <el-radio :value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="菜单权限">
          <div class="perm-tree-box">
            <el-tree
              :key="treeKey"
              ref="treeRef"
              :data="menuTree"
              node-key="id"
              show-checkbox
              default-expand-all
              :props="{ label: 'name', children: 'children' }"
              :default-checked-keys="checkedMenuIds"
            />
            <div v-if="!menuTree.length" class="empty-block">暂无可分配菜单</div>
          </div>
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
