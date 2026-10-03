<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import { createMenu, deleteMenu, getMenu, listMenuTree, updateMenu } from '@/api/menu';
import AppIcon from '@/components/AppIcon.vue';
import type { MenuVO } from '@/types/api';
import { iconNames } from '@/utils/icons';

/**
 * 菜单管理：目录、菜单、按钮共用一棵树。
 *
 * <p>新增菜单时 component 填 views 下的相对路径（如 system/user/index），
 * 前端路由是登录后按菜单动态生成的，保存后刷新页面即可看到新菜单。
 */
defineOptions({ name: 'SystemMenuIndex' });

/** 菜单类型：与后端 InfraMenuTypeEnum 一致 */
const TYPE_DIR = 1;
const TYPE_MENU = 2;
const TYPE_BUTTON = 3;

/** 表格用的节点：把后端返回的空 children 去掉，否则每个叶子都会多出一个展开箭头 */
interface MenuTreeNode extends Omit<MenuVO, 'children'> {
  children?: MenuTreeNode[];
}

const TYPE_OPTIONS = [
  { value: TYPE_DIR, label: '目录' },
  { value: TYPE_MENU, label: '菜单' },
  { value: TYPE_BUTTON, label: '按钮' },
];

const loading = ref(false);
const tree = ref<MenuTreeNode[]>([]);

/** 把后端的空数组 children 归一成 undefined */
function normalize(nodes: MenuVO[] | null): MenuTreeNode[] {
  return (nodes ?? []).map((node) => {
    const children = normalize(node.children);
    const result: MenuTreeNode = {
      id: node.id,
      parentId: node.parentId,
      name: node.name,
      type: node.type,
      path: node.path,
      component: node.component,
      perms: node.perms,
      icon: node.icon,
      sort: node.sort,
      visible: node.visible,
      status: node.status,
      createTime: node.createTime,
    };
    if (children.length) {
      result.children = children;
    }
    return result;
  });
}

/** 查询菜单树 */
async function loadTree(): Promise<void> {
  loading.value = true;
  try {
    tree.value = normalize(await listMenuTree());
  } finally {
    loading.value = false;
  }
}

/** 类型文案 */
function typeLabel(type: number): string {
  return TYPE_OPTIONS.find((item) => item.value === type)?.label ?? '未知';
}

/** 类型标签样式：目录用主色，菜单用中性，按钮用浅灰 */
function typeTagClass(type: number): string {
  return type === TYPE_DIR ? 'status-tag is-on' : 'status-tag';
}

/* ---------------------------- 新增 / 编辑 ---------------------------- */

const formVisible = ref(false);
const formLoading = ref(false);
const formRef = ref<FormInstance>();
const editingId = ref('');
const isEdit = computed(() => Boolean(editingId.value));

const form = reactive({
  parentId: '0',
  name: '',
  type: TYPE_MENU,
  path: '',
  component: '',
  perms: '',
  icon: '',
  sort: 0,
  visible: 0,
  status: 0,
});

const isButton = computed(() => form.type === TYPE_BUTTON);
const needRouter = computed(() => form.type === TYPE_DIR || form.type === TYPE_MENU);

/** 上级菜单选项：顶层固定一个「顶级菜单」，并排除自己与自己的子孙，避免形成环 */
const parentOptions = computed<MenuTreeNode[]>(() => {
  const excludeId = editingId.value;
  const filter = (nodes: MenuTreeNode[]): MenuTreeNode[] =>
    nodes
      .filter((node) => node.id !== excludeId)
      .map((node) => {
        const children = filter(node.children ?? []);
        return children.length ? { ...node, children } : { ...node, children: undefined };
      });
  return [
    {
      id: '0',
      parentId: '0',
      name: '顶级菜单',
      type: TYPE_DIR,
      path: '',
      component: '',
      perms: '',
      icon: '',
      sort: 0,
      visible: 0,
      status: 0,
      createTime: '',
      children: filter(tree.value),
    },
  ];
});

const formRules = computed<FormRules>(() => ({
  parentId: [{ required: true, message: '请选择上级菜单', trigger: 'change' }],
  name: [
    { required: true, message: '请输入菜单名称', trigger: 'blur' },
    { max: 64, message: '菜单名称不能超过 64 个字符', trigger: 'blur' },
  ],
  path: needRouter.value
    ? [
        { required: true, message: '请输入路由地址', trigger: 'blur' },
        { max: 200, message: '路由地址不能超过 200 个字符', trigger: 'blur' },
      ]
    : [],
  component:
    form.type === TYPE_MENU
      ? [
          { required: true, message: '请输入组件路径', trigger: 'blur' },
          { max: 200, message: '组件路径不能超过 200 个字符', trigger: 'blur' },
        ]
      : [],
  perms:
    form.type === TYPE_BUTTON || form.type === TYPE_MENU
      ? [{ max: 100, message: '权限标识不能超过 100 个字符', trigger: 'blur' }]
      : [],
}));

/** 表单回到默认值 */
function resetForm(parentId = '0'): void {
  form.parentId = parentId;
  form.name = '';
  form.type = TYPE_MENU;
  form.path = '';
  form.component = '';
  form.perms = '';
  form.icon = '';
  form.sort = 0;
  form.visible = 0;
  form.status = 0;
  formRef.value?.clearValidate();
}

/** 打开新增弹窗：parentId 传当前行就是「新增子项」 */
function openCreate(parentId = '0'): void {
  editingId.value = '';
  resetForm(parentId);
  formVisible.value = true;
}

/** 打开编辑弹窗 */
async function openEdit(row: MenuTreeNode): Promise<void> {
  editingId.value = row.id;
  resetForm();
  const detail = await getMenu(row.id);
  form.parentId = detail.parentId;
  form.name = detail.name;
  form.type = detail.type;
  form.path = detail.path;
  form.component = detail.component;
  form.perms = detail.perms;
  form.icon = detail.icon;
  form.sort = detail.sort ?? 0;
  form.visible = detail.visible ?? 0;
  form.status = detail.status ?? 0;
  formVisible.value = true;
}

/** 切换类型时清掉与该类型无关的字段，避免把脏数据提交上去 */
function handleTypeChange(): void {
  if (form.type === TYPE_BUTTON) {
    form.path = '';
    form.component = '';
    form.icon = '';
    form.visible = 0;
  } else if (form.type === TYPE_DIR) {
    form.component = '';
  }
}

/** 提交新增 / 编辑 */
async function submitForm(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  formLoading.value = true;
  try {
    const payload = { ...form, ...(isEdit.value ? { id: editingId.value } : {}) };
    if (isEdit.value) {
      await updateMenu(payload);
      ElMessage.success('修改成功');
    } else {
      await createMenu(payload);
      ElMessage.success('新增成功');
    }
    formVisible.value = false;
    await loadTree();
  } finally {
    formLoading.value = false;
  }
}

/* -------------------------------- 删除 -------------------------------- */

/** 删除菜单：有子菜单或被角色引用时后端会拒绝，这里以接口结果为准 */
async function handleDelete(row: MenuTreeNode): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await deleteMenu(row.id);
  ElMessage.success('删除成功');
  await loadTree();
}

onMounted(loadTree);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">菜单管理</div>
        <div class="page-desc">目录、菜单、按钮共用一棵树，按钮上的权限标识与接口校验一一对应</div>
      </div>
      <div class="page-head-actions">
        <el-button :loading="loading" @click="loadTree">
          <el-icon :size="14" style="margin-right: 4px"><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button v-has-perm="'infra:menu:create'" type="primary" @click="openCreate()">
          <el-icon :size="14" style="margin-right: 4px"><Plus /></el-icon>
          新建菜单
        </el-button>
      </div>
    </div>

    <div class="table-card">
      <el-table
        v-loading="loading"
        :data="tree"
        row-key="id"
        :tree-props="{ children: 'children' }"
        default-expand-all
        style="width: 100%"
      >
        <el-table-column prop="name" label="菜单名称" min-width="190" />
        <el-table-column label="图标" width="90">
          <template #default="{ row }">
            <AppIcon v-if="row.icon" :name="row.icon" :size="16" />
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90">
          <template #default="{ row }">
            <span :class="typeTagClass(row.type)">{{ typeLabel(row.type) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="路由地址" min-width="130">
          <template #default="{ row }">{{ row.path || '—' }}</template>
        </el-table-column>
        <el-table-column label="组件路径" min-width="180">
          <template #default="{ row }">
            <span v-if="row.component" class="cell-user-account">{{ row.component }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="权限标识" min-width="180">
          <template #default="{ row }">
            <span v-if="row.perms" class="perm-chip">{{ row.perms }}</span>
            <span v-else class="text-muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="status-tag" :class="{ 'is-on': row.status === 0 }">
              {{ row.status === 0 ? '启用' : '停用' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="right">
          <template #default="{ row }">
            <div class="cell-actions">
              <button
                v-if="row.type !== 3"
                v-has-perm="'infra:menu:create'"
                type="button"
                @click="openCreate(row.id)"
              >
                新增子项
              </button>
              <button v-has-perm="'infra:menu:update'" type="button" @click="openEdit(row)">编辑</button>
              <button
                v-has-perm="'infra:menu:delete'"
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
          <div class="empty-block">暂无菜单数据</div>
        </template>
      </el-table>
    </div>

    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '编辑菜单' : '新建菜单'"
      width="600px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="94px">
        <el-form-item label="上级菜单" prop="parentId">
          <el-tree-select
            v-model="form.parentId"
            :data="parentOptions"
            node-key="id"
            check-strictly
            default-expand-all
            :render-after-expand="false"
            :props="{ label: 'name', children: 'children' }"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="菜单类型" prop="type">
          <el-radio-group v-model="form.type" @change="handleTypeChange">
            <el-radio-button v-for="option in TYPE_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="菜单名称" prop="name">
          <el-input v-model="form.name" placeholder="导航里显示的名字" />
        </el-form-item>

        <el-form-item v-if="!isButton" label="图标">
          <div style="display: flex; gap: 10px; width: 100%; align-items: center">
            <el-select
              v-model="form.icon"
              filterable
              clearable
              placeholder="选择 Element Plus 图标"
              style="flex: 1"
            >
              <el-option v-for="name in iconNames" :key="name" :label="name" :value="name">
                <span class="inline-icon"><AppIcon :name="name" :size="15" />{{ name }}</span>
              </el-option>
            </el-select>
            <AppIcon v-if="form.icon" :name="form.icon" :size="18" />
          </div>
        </el-form-item>

        <el-form-item v-if="needRouter" label="路由地址" prop="path">
          <el-input v-model="form.path" :placeholder="form.type === 1 ? '/system' : 'user'" />
          <div class="form-tip">目录填绝对路径（/system），菜单填相对路径（user）</div>
        </el-form-item>

        <el-form-item v-if="form.type === 2" label="组件路径" prop="component">
          <el-input v-model="form.component" placeholder="system/user/index" />
          <div class="form-tip">相对 src/views，例如 system/user/index 对应 views/system/user/index.vue</div>
        </el-form-item>

        <el-form-item v-if="form.type !== 1" label="权限标识" prop="perms">
          <el-input v-model="form.perms" placeholder="infra:user:create" />
          <div class="form-tip">与后端 @RequiresPermission 上的字符串保持一致</div>
        </el-form-item>

        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="9999" controls-position="right" />
          <span class="form-tip" style="margin-left: 10px">越小越靠前</span>
        </el-form-item>

        <el-form-item v-if="!isButton" label="显示状态">
          <el-radio-group v-model="form.visible">
            <el-radio :value="0">显示</el-radio>
            <el-radio :value="1">隐藏</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="菜单状态">
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
  </div>
</template>
