<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import {
  createUser,
  deleteUser,
  getUser,
  pageUser,
  resetUserPassword,
  updateUser,
  updateUserStatus,
} from '@/api/user';
import { listRole } from '@/api/role';
import { useAuthStore } from '@/store/auth';
import type { RoleSimpleVO, UserVO } from '@/types/api';
import { avatarText, formatDateTime, toNumber } from '@/utils/format';

/**
 * 用户管理：查询、新增、编辑、重置密码、启用停用、删除。
 *
 * <p>按钮统一用 v-has-perm 按权限渲染；后端接口上还有一层 @RequiresPermission，
 * 绕过前端直接调接口同样会被拦住。
 */
defineOptions({ name: 'SystemUserIndex' });

/** 超管角色编码：该角色不能删除也不能停用，与后端规则一致 */
const SUPER_ADMIN_CODE = 'super_admin';

const auth = useAuthStore();

const loading = ref(false);
const list = ref<UserVO[]>([]);
const total = ref(0);
const roles = ref<RoleSimpleVO[]>([]);

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  username: '',
  nickname: '',
  mobile: '',
  status: null as number | null,
});

/** 角色 id 到 名称/编码 的映射：表格回显角色名，并识别超管行 */
const roleNameMap = computed(() => {
  const map = new Map<string, string>();
  roles.value.forEach((role) => map.set(role.id, role.name));
  return map;
});

const roleCodeMap = computed(() => {
  const map = new Map<string, string>();
  roles.value.forEach((role) => map.set(role.id, role.code));
  return map;
});

/** 拼装查询条件：空值不发，避免后端做无意义的模糊匹配 */
function buildQuery() {
  return {
    pageNum: query.pageNum,
    pageSize: query.pageSize,
    username: query.username.trim() || undefined,
    nickname: query.nickname.trim() || undefined,
    mobile: query.mobile.trim() || undefined,
    status: query.status,
  };
}

/** 查询列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await pageUser(buildQuery());
    list.value = page.records ?? [];
    total.value = toNumber(page.total);
  } finally {
    loading.value = false;
  }
}

/** 重置查询条件 */
function resetQuery(): void {
  query.username = '';
  query.nickname = '';
  query.mobile = '';
  query.status = null;
  query.pageNum = 1;
  loadList();
}

/** 查询 */
function handleSearch(): void {
  query.pageNum = 1;
  loadList();
}

/** 翻页 */
function handlePageChange(pageNum: number): void {
  query.pageNum = pageNum;
  loadList();
}

/** 改每页条数 */
function handlePageSizeChange(pageSize: number): void {
  query.pageSize = pageSize;
  query.pageNum = 1;
  loadList();
}

/** 行内角色文案 */
function roleNamesOf(row: UserVO): string {
  const ids = row.roleIds ?? [];
  if (!ids.length) {
    return '—';
  }
  return ids.map((id) => roleNameMap.value.get(id) ?? '已停用角色').join('、');
}

/** 是否超管账号 */
function isSuperAdminRow(row: UserVO): boolean {
  return (row.roleIds ?? []).some((id) => roleCodeMap.value.get(id) === SUPER_ADMIN_CODE);
}

/** 不能删自己，也不能删超管 */
function canDelete(row: UserVO): boolean {
  return row.id !== auth.userInfo?.userId && !isSuperAdminRow(row);
}

/* ---------------------------- 新增 / 编辑 ---------------------------- */

const formVisible = ref(false);
const formLoading = ref(false);
const formRef = ref<FormInstance>();
const editingId = ref('');
const isEdit = computed(() => Boolean(editingId.value));

const form = reactive({
  username: '',
  password: '',
  nickname: '',
  mobile: '',
  status: 0,
  roleIds: [] as string[],
});

const formRules = computed<FormRules>(() => ({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 64, message: '用户名长度需为 3~64 个字符', trigger: 'blur' },
  ],
  password: isEdit.value
    ? []
    : [
        { required: true, message: '请输入初始密码', trigger: 'blur' },
        { min: 6, max: 32, message: '密码长度需为 6~32 个字符', trigger: 'blur' },
      ],
  nickname: [
    { required: true, message: '请输入昵称', trigger: 'blur' },
    { max: 64, message: '昵称长度不能超过 64 个字符', trigger: 'blur' },
  ],
  mobile: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
  ],
}));

/** 表单回到初始状态 */
function resetForm(): void {
  form.username = '';
  form.password = '';
  form.nickname = '';
  form.mobile = '';
  form.status = 0;
  form.roleIds = [];
  formRef.value?.clearValidate();
}

/** 打开新增弹窗 */
function openCreate(): void {
  editingId.value = '';
  resetForm();
  formVisible.value = true;
}

/** 打开编辑弹窗：先拉详情回显已分配角色 */
async function openEdit(row: UserVO): Promise<void> {
  editingId.value = row.id;
  resetForm();
  const detail = await getUser(row.id);
  form.username = detail.username;
  form.nickname = detail.nickname;
  form.mobile = detail.mobile;
  form.status = detail.status;
  form.roleIds = detail.roleIds ?? [];
  formVisible.value = true;
}

/** 提交新增 / 编辑 */
async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  formLoading.value = true;
  try {
    if (isEdit.value) {
      await updateUser({
        id: editingId.value,
        nickname: form.nickname,
        mobile: form.mobile,
        status: form.status,
        roleIds: form.roleIds,
      });
      ElMessage.success('修改成功');
    } else {
      await createUser({
        username: form.username,
        password: form.password,
        nickname: form.nickname,
        mobile: form.mobile,
        status: form.status,
        roleIds: form.roleIds,
      });
      ElMessage.success('新增成功');
    }
    formVisible.value = false;
    await loadList();
  } finally {
    formLoading.value = false;
  }
}

/* ------------------------------ 状态切换 ------------------------------ */

/** 启用 / 停用：开关已通过 v-model 改了行数据，失败要改回去 */
async function handleStatusChange(row: UserVO): Promise<void> {
  const previous = row.status === 0 ? 1 : 0;
  try {
    await updateUserStatus({ id: row.id, status: row.status });
    ElMessage.success(row.status === 0 ? '已启用' : '已停用');
  } catch {
    row.status = previous;
  }
}

/* ------------------------------ 重置密码 ------------------------------ */

const passwordVisible = ref(false);
const passwordLoading = ref(false);
const passwordRef = ref<FormInstance>();
const passwordTarget = ref<UserVO | null>(null);

const passwordForm = reactive({
  newPassword: '',
  confirmPassword: '',
});

const passwordRules: FormRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度需为 6~32 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

/** 打开重置密码弹窗 */
function openResetPassword(row: UserVO): void {
  passwordTarget.value = row;
  passwordForm.newPassword = '';
  passwordForm.confirmPassword = '';
  passwordVisible.value = true;
  passwordRef.value?.clearValidate();
}

/** 提交重置密码 */
async function submitResetPassword(): Promise<void> {
  const valid = await passwordRef.value?.validate().catch(() => false);
  if (!valid || !passwordTarget.value) {
    return;
  }
  passwordLoading.value = true;
  try {
    await resetUserPassword({ id: passwordTarget.value.id, newPassword: passwordForm.newPassword });
    ElMessage.success('密码已重置');
    passwordVisible.value = false;
  } finally {
    passwordLoading.value = false;
  }
}

/* -------------------------------- 删除 -------------------------------- */

/** 删除用户 */
async function handleDelete(row: UserVO): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除用户「${row.nickname}」吗？删除后该账号无法登录。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await deleteUser(row.id);
  ElMessage.success('删除成功');
  await loadList();
}

onMounted(async () => {
  // 角色下拉只用于表单与回显，拿不到也不该挡住列表
  listRole()
    .then((data) => {
      roles.value = data ?? [];
    })
    .catch(() => undefined);
  await loadList();
});
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">用户管理</div>
        <div class="page-desc">维护后台账号、角色授权与登录状态</div>
      </div>
      <div class="page-head-actions">
        <el-button v-has-perm="'infra:user:create'" type="primary" @click="openCreate">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          新建用户
        </el-button>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-field">
        <span class="filter-label">用户名</span>
        <el-input v-model="query.username" placeholder="前缀匹配" clearable @keyup.enter="handleSearch" />
      </div>
      <div class="filter-field">
        <span class="filter-label">昵称</span>
        <el-input v-model="query.nickname" placeholder="模糊匹配" clearable @keyup.enter="handleSearch" />
      </div>
      <div class="filter-field">
        <span class="filter-label">手机号</span>
        <el-input v-model="query.mobile" placeholder="前缀匹配" clearable @keyup.enter="handleSearch" />
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
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <div class="cell-user">
              <span class="cell-user-avatar">{{ avatarText(row.nickname) }}</span>
              <div>
                <div class="cell-user-name">{{ row.nickname }}</div>
                <div class="cell-user-account">{{ row.username }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="mobile" label="手机号" min-width="140" />
        <el-table-column label="角色" min-width="180">
          <template #default="{ row }">{{ roleNamesOf(row) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              :active-value="0"
              :inactive-value="1"
              :disabled="!auth.can('infra:user:update-status') || isSuperAdminRow(row)"
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="196" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button v-has-perm="'infra:user:update'" type="button" @click="openEdit(row)">编辑</button>
              <button
                v-has-perm="'infra:user:reset-password'"
                type="button"
                :disabled="isSuperAdminRow(row)"
                @click="openResetPassword(row)"
              >
                重置密码
              </button>
              <button
                v-has-perm="'infra:user:delete'"
                type="button"
                class="is-danger"
                :disabled="!canDelete(row)"
                @click="handleDelete(row)"
              >
                删除
              </button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-block">没有符合条件的用户</div>
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
      :title="isEdit ? '编辑用户' : '新建用户'"
      width="520px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="88px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="isEdit" placeholder="3~64 位，创建后不可修改" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="初始密码" prop="password">
          <el-input v-model="form.password" type="password" show-password placeholder="6~32 位" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="form.nickname" placeholder="用于列表与顶栏展示" />
        </el-form-item>
        <el-form-item label="手机号" prop="mobile">
          <el-input v-model="form.mobile" placeholder="11 位手机号" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleIds" multiple clearable placeholder="可暂不分配" style="width: 100%">
            <el-option v-for="role in roles" :key="role.id" :label="role.name" :value="role.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="0">启用</el-radio>
            <el-radio :value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="formVisible = false">取消</el-button>
          <el-button type="primary" :loading="formLoading" @click="submitForm">确定</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="passwordVisible"
      title="重置密码"
      width="440px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <p class="form-tip" style="margin-bottom: 14px">
        正在重置「{{ passwordTarget?.nickname }}」的登录密码，重置后需要重新登录。
      </p>
      <el-form ref="passwordRef" :model="passwordForm" :rules="passwordRules" label-width="88px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="passwordForm.newPassword" type="password" show-password placeholder="6~32 位" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            show-password
            placeholder="再次输入新密码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="passwordVisible = false">取消</el-button>
          <el-button type="primary" :loading="passwordLoading" @click="submitResetPassword">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
