<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { updatePassword } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { usePermissionStore } from '@/store/permission';
import { useTabsStore } from '@/store/tabs';
import { resetDynamicRoutes } from '@/router';
import { avatarText } from '@/utils/format';

/**
 * 个人中心：展示当前账号信息并修改密码。
 *
 * <p>只从右上角头像下拉进入。改密成功后后端会作废该用户全部凭证，
 * 所以这里改完就直接登出跳登录页，避免用户拿着一个已经失效的令牌继续点。
 */
defineOptions({ name: 'Profile' });

const router = useRouter();
const auth = useAuthStore();
const permission = usePermissionStore();
const tabs = useTabsStore();

const avatar = computed(() => avatarText(auth.nickname || auth.username));

const roleText = computed(() =>
  auth.roleCodes.length
    ? auth.roleCodes.map((code) => (code === 'super_admin' ? '超级管理员' : code)).join(' / ')
    : '—',
);

const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 32, message: '新密码长度需为 6~32 个字符', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value: string, callback) => {
        if (value !== form.newPassword) {
          callback(new Error('两次输入的密码不一致'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

/** 提交改密 */
async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  loading.value = true;
  try {
    await updatePassword({ oldPassword: form.oldPassword, newPassword: form.newPassword });
    ElMessage.success('密码修改成功，请使用新密码重新登录');
    auth.reset();
    permission.reset();
    tabs.reset();
    resetDynamicRoutes();
    await router.replace('/login');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">个人中心</div>
        <div class="page-desc">查看当前账号信息并修改登录密码</div>
      </div>
    </div>

    <div class="card-grid">
      <div class="card">
        <div class="card-title">账号信息</div>
        <div class="cell-user" style="margin-bottom: 14px">
          <span
            class="cell-user-avatar"
            style="width: 44px; height: 44px; border-radius: 12px; font-size: 16px"
          >
            {{ avatar }}
          </span>
          <div>
            <div class="cell-user-name" style="font-size: 15px">{{ auth.nickname || '—' }}</div>
            <div class="cell-user-account">{{ auth.username }}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-row-label">角色</div>
          <div class="meta-row-value">{{ roleText }}</div>
        </div>
        <div class="meta-row">
          <div class="meta-row-label">权限项</div>
          <div class="meta-row-value">{{ auth.perms.length }} 项</div>
        </div>
        <div class="meta-row" style="flex-direction: column; gap: 8px">
          <div class="meta-row-label">权限明细</div>
          <div class="perm-list">
            <span v-for="perm in auth.perms" :key="perm" class="perm-chip">{{ perm }}</span>
            <span v-if="!auth.perms.length" class="text-muted">暂无权限标识</span>
          </div>
        </div>
      </div>

      <div id="password-card" class="card">
        <div class="card-title">修改密码</div>
        <el-form ref="formRef" :model="form" :rules="rules" label-width="88px" style="max-width: 420px">
          <el-form-item label="原密码" prop="oldPassword">
            <el-input v-model="form.oldPassword" type="password" show-password placeholder="当前登录密码" />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input v-model="form.newPassword" type="password" show-password placeholder="6~32 位" />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              type="password"
              show-password
              placeholder="再次输入新密码"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="loading" @click="submit">保存并重新登录</el-button>
          </el-form-item>
        </el-form>
        <div class="form-tip">修改成功后当前账号的所有登录凭证会立即失效，需要用新密码重新登录。</div>
      </div>
    </div>
  </div>
</template>
