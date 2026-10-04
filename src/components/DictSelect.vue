<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { listDictDataByType } from '@/api/dictData';
import type { DictDataSimpleVO } from '@/types/api';

/**
 * 字典下拉：按字典类型编码从 infra 取字典数据。
 *
 * <p>字典是跨服务契约（业务服务存编码、infra 存中文名），这里按类型做模块级缓存，
 * 同一类型只请求一次；拿不到字典（例如账号没有 infra:dict-data:query 权限）时
 * 明确显示「字典加载失败」，不静默变成空下拉让人以为没数据。
 */
defineOptions({ name: 'DictSelect' });

const props = withDefaults(
  defineProps<{
    /** infra 字典类型编码，如 rental_apartment_label */
    dictType: string;
    modelValue?: string | string[];
    multiple?: boolean;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
  }>(),
  {
    modelValue: '',
    multiple: false,
    placeholder: '请选择',
    clearable: true,
    disabled: false,
  },
);

const emit = defineEmits<{ (event: 'update:modelValue', value: string | string[]): void }>();

/** 字典缓存与去重请求 */
const dictCache = new Map<string, DictDataSimpleVO[]>();
const dictPending = new Map<string, Promise<DictDataSimpleVO[]>>();

function loadDict(type: string): Promise<DictDataSimpleVO[]> {
  const cached = dictCache.get(type);
  if (cached) {
    return Promise.resolve(cached);
  }
  let task = dictPending.get(type);
  if (!task) {
    task = listDictDataByType(type)
      .then((data) => {
        const list = data ?? [];
        dictCache.set(type, list);
        return list;
      })
      .finally(() => {
        dictPending.delete(type);
      });
    dictPending.set(type, task);
  }
  return task;
}

const options = ref<DictDataSimpleVO[]>([]);
const loading = ref(false);
const failed = ref(false);

async function loadOptions(): Promise<void> {
  if (!props.dictType) {
    return;
  }
  loading.value = true;
  failed.value = false;
  try {
    options.value = await loadDict(props.dictType);
  } catch {
    failed.value = true;
    options.value = [];
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.dictType,
  () => {
    loadOptions();
  },
);

onMounted(loadOptions);

/** 选中变化：清空时多选回传空数组，单选回传空串 */
function handleChange(value: string | string[] | null): void {
  if (value === null || value === undefined) {
    emit('update:modelValue', props.multiple ? [] : '');
    return;
  }
  emit('update:modelValue', value);
}
</script>

<template>
  <el-select
    :model-value="props.modelValue"
    :multiple="props.multiple"
    :placeholder="failed ? '字典加载失败' : props.placeholder"
    :clearable="props.clearable"
    :disabled="props.disabled || failed"
    :loading="loading"
    collapse-tags
    collapse-tags-tooltip
    style="width: 100%"
    @change="handleChange"
  >
    <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />
  </el-select>
</template>
