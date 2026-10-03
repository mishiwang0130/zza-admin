<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Lock, User } from '@element-plus/icons-vue';
import { useAuthStore } from '@/store/auth';
import { usePermissionStore } from '@/store/permission';
import { useTabsStore } from '@/store/tabs';

/**
 * 登录页：左侧品牌介绍 + 右侧表单。
 *
 * <p>登录接口是免鉴权的，失败提示由 axios 拦截器统一弹出，这里只负责表单校验与跳转。
 */
defineOptions({ name: 'LoginPage' });

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const permission = usePermissionStore();
const tabs = useTabsStore();

const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  username: '',
  password: '',
});

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

/** 仅开发环境展示的默认账号提示，生产构建里会被摇掉 */
const showDevTip = import.meta.env.DEV;

/** 提交登录 */
async function submit(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }
  loading.value = true;
  try {
    await auth.loginAction({ ...form });
    // 换账号时清掉上一个人的菜单与标签页
    permission.reset();
    tabs.reset();
    ElMessage.success('登录成功');
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } finally {
    loading.value = false;
  }
}

/** 开发环境一键填入默认账号 */
function fillDevAccount(): void {
  form.username = 'admin';
  form.password = '123456';
}
</script>

<template>
  <div class="login-page">
    <section class="login-brand">
      <div class="login-brand-inner">
        <div class="login-logo">住</div>
        <h1>住住安管理后台</h1>
        <p>房源、订单、客服与系统权限统一在一处管理。</p>

        <ul class="login-points">
          <li>菜单与按钮权限由后端下发，前端按权限渲染</li>
          <li>访问凭证自动续期，长时间操作不掉线</li>
          <li>用户 / 角色 / 菜单三层权限模型</li>
        </ul>
      </div>
      <div class="login-brand-glow one" />
      <div class="login-brand-glow two" />
    </section>

    <section class="login-form-area">
      <div class="login-form-card">
        <h2>登录</h2>
        <p class="login-form-sub">请使用管理后台账号登录</p>

        <el-form ref="formRef" :model="form" :rules="rules" size="large" @submit.prevent="submit">
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" clearable />
          </el-form-item>
          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="密码"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="submit"
            />
          </el-form-item>
          <el-button type="primary" class="login-submit" :loading="loading" @click="submit">
            {{ loading ? '登录中…' : '登 录' }}
          </el-button>
        </el-form>

        <div v-if="showDevTip" class="login-dev-tip">
          <span>开发环境默认账号：admin / 123456</span>
          <button type="button" @click="fillDevAccount">一键填入</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-page {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  min-height: 100vh;
  background: #fff;
}

.login-brand {
  position: relative;
  overflow: hidden;
  padding: 56px;
  background: linear-gradient(150deg, #0f766e 0%, #0d9488 42%, #14b8a6 100%);
  color: #fff;
}

.login-brand-inner {
  position: relative;
  z-index: 2;
  display: flex;
  height: 100%;
  flex-direction: column;
  justify-content: center;
  max-width: 420px;
}

.login-logo {
  display: grid;
  width: 46px;
  height: 46px;
  margin-bottom: 22px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
  font-size: 22px;
  font-weight: 600;
  place-items: center;
  backdrop-filter: blur(6px);
}

.login-brand h1 {
  margin-bottom: 10px;
  color: #fff;
  font-size: 30px;
  letter-spacing: -0.5px;
}

.login-brand p {
  margin: 0 0 30px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
}

.login-points {
  margin: 0;
  padding: 0;
  list-style: none;
}

.login-points li {
  position: relative;
  padding: 6px 0 6px 20px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
}

.login-points li::before {
  position: absolute;
  top: 13px;
  left: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
  content: '';
}

.login-brand-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
}

.login-brand-glow.one {
  top: -80px;
  right: -60px;
  width: 300px;
  height: 300px;
  background: rgba(45, 212, 191, 0.55);
}

.login-brand-glow.two {
  bottom: -120px;
  left: -40px;
  width: 280px;
  height: 280px;
  background: rgba(6, 95, 70, 0.6);
}

.login-form-area {
  display: grid;
  padding: 40px;
  place-items: center;
}

.login-form-card {
  width: 100%;
  max-width: 360px;
}

.login-form-card h2 {
  font-size: 22px;
  letter-spacing: -0.3px;
}

.login-form-sub {
  margin: 6px 0 26px;
  color: var(--zz-text-faint);
  font-size: 13px;
}

.login-submit {
  width: 100%;
  margin-top: 4px;
  letter-spacing: 2px;
}

.login-dev-tip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
  padding: 10px 12px;
  border: 1px dashed var(--zz-border);
  border-radius: var(--zz-radius);
  background: #fafafa;
  color: var(--zz-text-faint);
  font-size: 12px;
}

.login-dev-tip button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--zz-primary-ink);
  font-size: 12px;
  cursor: pointer;
}

@media (max-width: 900px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .login-brand {
    display: none;
  }

  .login-form-area {
    padding: 24px;
  }
}
</style>
