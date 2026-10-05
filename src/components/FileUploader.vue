<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage, type UploadRequestOptions } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { FileSizeExceededError, UploadCanceledError, uploadFile } from '@/api/file';

/**
 * 单文件上传（如租约合同）：v-model 绑定 fileId。
 *
 * <p>后端只存文件 ID、详情接口不回文件地址，所以编辑态只能显示「已上传」；
 * 本次会话刚上传的文件因为拿到了预签名地址，会额外给一个「查看」链接。
 *
 * <p>合同常有几十 MB 的扫描件，所以上传中显示百分比并支持取消；
 * 走老接口还是分片链路由 uploadFile 按文件大小自动分流，本组件不感知。
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

/** 上传进度（0~100）：大文件按分片上报，小文件按单请求的 loaded/total 上报 */
const percent = ref(0);

/** 仅本次会话刚上传的地址可预览：预签名地址过期后要用 fileId 重新换 */
const previewUrl = ref('');

/** 取消句柄：取消、重新上传、切换文件都靠它中断在途请求并触发后端的 abort */
let controller: AbortController | null = null;

/** 上传轮次：取消后立刻开始新一轮时，旧一轮的回调不能覆盖新一轮的状态 */
let uploadSeq = 0;

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      previewUrl.value = '';
    }
  },
);

async function handleUpload(options: UploadRequestOptions): Promise<void> {
  // 上一轮还没结束就先取消：既释放服务端会话，也避免两轮的进度互相覆盖
  controller?.abort();
  const seq = (uploadSeq += 1);
  const current = new AbortController();
  controller = current;
  uploading.value = true;
  percent.value = 0;
  try {
    const result = await uploadFile(
      options.file as File,
      (value) => {
        if (seq === uploadSeq) {
          percent.value = value;
        }
      },
      { signal: current.signal },
    );
    if (seq !== uploadSeq) {
      return;
    }
    previewUrl.value = result.url;
    emit('update:modelValue', result.fileId);
    ElMessage.success('上传成功');
  } catch (error) {
    if (seq !== uploadSeq) {
      return;
    }
    if (error instanceof UploadCanceledError) {
      ElMessage.info('已取消');
    } else if (error instanceof FileSizeExceededError) {
      ElMessage.error(error.message);
    }
    // 其余失败（后端业务错误、网络异常）拦截器已经弹过后端 msg，这里不重复提示；
    // 已有的 fileId 保持不变，用户可以重试或重新选文件
  } finally {
    if (seq === uploadSeq) {
      uploading.value = false;
      controller = null;
    }
  }
}

/** 取消上传：中断在途请求并让上传链路 abort 服务端会话，提示统一在 catch 里给 */
function cancelUpload(): void {
  controller?.abort();
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
      <el-button size="small" text :disabled="props.disabled || uploading" @click="clearFile">
        清除
      </el-button>
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

    <template v-if="uploading">
      <span class="upload-progress">上传中 {{ percent }}%</span>
      <el-button size="small" text @click="cancelUpload">取消</el-button>
    </template>
  </div>
</template>

<style scoped>
.upload-progress {
  color: var(--zz-text-muted);
  font-size: 12.5px;
}
</style>
