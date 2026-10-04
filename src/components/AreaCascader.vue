<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { listAreaTree } from '@/api/area';
import type { AreaVO } from '@/types/api';

/**
 * 省市区三级联动选择器：地址、门店、客户资料这类表单直接用它。
 *
 * <p>实现取舍：一次拉全量树（后端 `/area/listTree`）而不是逐级懒加载。
 * 原因是表单回显 —— 值只有一个 id/code，懒加载模式下组件无法把已选项的层级路径还原出来，
 * 只会显示原始值；拿到整棵树才能正确显示「广东省 / 深圳市 / 南山区」。
 * 树在模块级别缓存，多个表单共用一次请求。
 */
defineOptions({ name: 'AreaCascader' });

/** 级联选项：叶子节点不带 children，否则每级都会多出一个展开箭头 */
interface AreaNode {
  id: string;
  code: string;
  name: string;
  /** 1 省、2 市、3 区县 */
  level: number;
  children?: AreaNode[];
}

/** 选中项的回传信息 */
export interface AreaSelection {
  value: string;
  path: AreaNode[];
}

const props = withDefaults(
  defineProps<{
    /** 选中值：默认是区划 ID，可用 valueField 改成行政区划代码 */
    modelValue?: string;
    /** 取值字段，落库习惯存 code 时传 'code' */
    valueField?: 'id' | 'code';
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    /** 是否允许只选到省或市：地址表单通常允许，物流类表单可以关掉 */
    anyLevel?: boolean;
  }>(),
  {
    modelValue: '',
    valueField: 'id',
    placeholder: '请选择省 / 市 / 区县',
    disabled: false,
    clearable: true,
    anyLevel: true,
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'change', payload: AreaSelection | null): void;
}>();

/** 树缓存与去重请求：多个级联框同时挂载时只请求一次 */
let treeCache: AreaNode[] | null = null;
let treePending: Promise<AreaNode[]> | null = null;

function normalize(nodes: AreaVO[] | null): AreaNode[] {
  return (nodes ?? []).map((node) => {
    const children = normalize(node.children);
    const result: AreaNode = { id: node.id, code: node.code, name: node.name, level: node.level };
    if (children.length) {
      result.children = children;
    }
    return result;
  });
}

async function loadTree(force = false): Promise<AreaNode[]> {
  if (force) {
    treeCache = null;
    treePending = null;
  }
  if (treeCache) {
    return treeCache;
  }
  if (!treePending) {
    treePending = listAreaTree()
      .then((data) => {
        treeCache = normalize(data);
        return treeCache;
      })
      .finally(() => {
        treePending = null;
      });
  }
  return treePending;
}

const options = ref<AreaNode[]>([]);
const loading = ref(false);

const cascaderProps = computed(() => ({
  value: props.valueField,
  label: 'name',
  children: 'children',
  checkStrictly: props.anyLevel,
  emitPath: false,
}));

/**
 * 在树里找出某个值对应的整条路径
 *
 * @param nodes 当前层节点
 * @param value 目标值
 * @param trail 已走过的路径
 */
function findPath(nodes: AreaNode[], value: string, trail: AreaNode[] = []): AreaNode[] {
  for (const node of nodes) {
    const next = [...trail, node];
    if (node[props.valueField] === value) {
      return next;
    }
    if (node.children?.length) {
      const found = findPath(node.children, value, next);
      if (found.length) {
        return found;
      }
    }
  }
  return [];
}

/** 选中变化：回传值本身与完整路径（路径里带省市县名称与代码，省得调用方再查一次） */
function handleChange(value: unknown): void {
  const next = typeof value === 'string' ? value : '';
  emit('update:modelValue', next);
  emit('change', next ? { value: next, path: findPath(options.value, next) } : null);
}

/** 重新拉取区划树（后台补录了区划时用） */
async function reload(): Promise<void> {
  loading.value = true;
  try {
    options.value = await loadTree(true);
  } finally {
    loading.value = false;
  }
}

defineExpose({ reload });

onMounted(async () => {
  loading.value = true;
  try {
    options.value = await loadTree();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <el-cascader
    :model-value="props.modelValue"
    :options="options"
    :props="cascaderProps"
    :placeholder="props.placeholder"
    :disabled="props.disabled"
    :clearable="props.clearable"
    :show-all-levels="false"
    filterable
    style="width: 100%"
    @change="handleChange"
  />
</template>
