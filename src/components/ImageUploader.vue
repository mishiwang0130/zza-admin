<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, type UploadRequestOptions } from 'element-plus';
import { Delete, Plus, Rank } from '@element-plus/icons-vue';
import { uploadFile } from '@/api/file';

/**
 * 房源图片上传：上传后只保留 fileId 与排序号，地址仅用于即时预览。
 *
 * <p>地址不落库是有意的：预签名地址会过期，提交时后端只认 fileId。
 */
defineOptions({ name: 'ImageUploader' });

/** 图片项：fileId 是提交值，url 用于回显与预览 */
interface UploadImage {
  fileId: string;
  url?: string;
  sort?: number;
}

const props = withDefaults(
  defineProps<{
    modelValue?: UploadImage[];
    /** 最多几张 */
    max?: number;
    disabled?: boolean;
    tip?: string;
  }>(),
  {
    modelValue: () => [],
    max: 10,
    disabled: false,
    tip: '单张不超过 10MB，支持常见图片格式',
  },
);

const emit = defineEmits<{ (event: 'update:modelValue', value: UploadImage[]): void }>();

const uploading = ref(false);

/** 重排 sort：始终按当前顺序生成 1..n，避免删掉中间一张后排序号出现空洞 */
function emitList(list: UploadImage[]): void {
  emit(
    'update:modelValue',
    list.map((item, index) => ({ ...item, sort: index + 1 })),
  );
}

/** 自定义上传：走统一 axios 客户端，才能复用令牌、续期与错误提示 */
async function handleUpload(options: UploadRequestOptions): Promise<void> {
  if (props.modelValue.length >= props.max) {
    ElMessage.warning(`最多上传 ${props.max} 张`);
    return;
  }
  uploading.value = true;
  try {
    const result = await uploadFile(options.file as File);
    emitList([...props.modelValue, { fileId: result.fileId, url: result.url }]);
    ElMessage.success('图片已上传');
  } catch {
    // 拦截器已经弹过错误提示，这里只需要让上传动作结束
  } finally {
    uploading.value = false;
  }
}

/** 删除某张 */
function removeAt(index: number): void {
  const next = [...props.modelValue];
  next.splice(index, 1);
  emitList(next);
}

/** 左右移动 */
function move(index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= props.modelValue.length) {
    return;
  }
  const next = [...props.modelValue];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  emitList(next);
}
</script>

<template>
  <div class="image-uploader">
    <div v-for="(item, index) in props.modelValue" :key="item.fileId" class="image-item">
      <el-image v-if="item.url" :src="item.url" fit="cover" :preview-src-list="[item.url]" />
      <div v-else class="image-missing">无预览</div>
      <div v-if="index === 0" class="image-cover">封面</div>
      <div class="image-actions">
        <button type="button" :disabled="index === 0 || props.disabled" title="前移" @click="move(index, -1)">
          <el-icon :size="13"><Rank /></el-icon>
        </button>
        <button
          type="button"
          :disabled="index === props.modelValue.length - 1 || props.disabled"
          title="后移"
          @click="move(index, 1)"
        >
          <el-icon :size="13" style="transform: rotate(180deg)"><Rank /></el-icon>
        </button>
        <button type="button" :disabled="props.disabled" title="删除" @click="removeAt(index)">
          <el-icon :size="13"><Delete /></el-icon>
        </button>
      </div>
    </div>

    <el-upload
      v-if="props.modelValue.length < props.max"
      :http-request="handleUpload"
      :show-file-list="false"
      accept="image/*"
      :disabled="props.disabled || uploading"
      class="image-add"
    >
      <div class="image-add-inner">
        <el-icon :size="18"><Plus /></el-icon>
        <span>{{ uploading ? '上传中…' : '上传图片' }}</span>
      </div>
    </el-upload>

    <div v-if="props.tip" class="image-tip">{{ props.tip }}</div>
  </div>
</template>
