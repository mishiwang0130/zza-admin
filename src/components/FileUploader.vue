<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage, type UploadRequestOptions } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { uploadFile } from '@/api/file';

/**
 * 单文件上传（如租约合同）：v-model 绑定 fileId。
 *
 * <p>后端只存文件 ID、详情接口不回文件地址，所以编辑态只能显示「已上传」；
 * 本次会话刚上传的文件因为拿到了预签名地址，会额外给一个「查看」链接。
 */
defineOptions({ name: 'FileUploader' });

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    buttonText?: string;
    uploadedText?: string;
    disabled?: boolean;
  }>(),
  {
    modelValue: '',
    buttonText: '上传文件',
    uploadedText: '文件已上传',
    disabled: false,
  },
);

const emit = defineEmits<{ (event: 'update:modelValue', value: string): void }>();

const uploading = ref(false);

/** 仅本次会话刚上传的地址可预览：预签名地址过期后要用 fileId 重新换 */
const previewUrl = ref('');

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      previewUrl.value = '';
    }
  },
);

async function handleUpload(options: UploadRequestOptions): Promise<void> {
  uploading.value = true;
  try {
    const result = await uploadFile(options.file as File);
    previewUrl.value = result.url;
    emit('update:modelValue', result.fileId);
    ElMessage.success('上传成功');
  } catch {
    // 拦截器已提示
  } finally {
    uploading.value = false;
  }
}

function clearFile(): void {
  previewUrl.value = '';
  emit('update:modelValue', '');
}
</script>

<template>
  <div class="file-uploader">
    <template v-if="props.modelValue">
      <span class="status-tag is-on">{{ props.uploadedText }}</span>
      <a v-if="previewUrl" :href="previewUrl" target="_blank" rel="noopener">查看</a>
      <el-upload :http-request="handleUpload" :show-file-list="false" :disabled="props.disabled || uploading">
        <el-button size="small" :disabled="props.disabled" :loading="uploading">重新上传</el-button>
      </el-upload>
      <el-button size="small" text :disabled="props.disabled" @click="clearFile">清除</el-button>
    </template>
    <el-upload
      v-else
      :http-request="handleUpload"
      :show-file-list="false"
      :disabled="props.disabled || uploading"
    >
      <el-button :disabled="props.disabled" :loading="uploading">
        <el-icon :size="14" style="margin-right: 4px"><Upload /></el-icon>
        {{ props.buttonText }}
      </el-button>
    </el-upload>
  </div>
</template>
