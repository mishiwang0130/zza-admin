<script setup lang="ts">
import { useRouter } from 'vue-router';

/**
 * 403：已登录但没有访问该页面的权限。
 */
defineOptions({ name: 'ErrorForbidden' });

const router = useRouter();
</script>

<template>
  <div class="error-page">
    <div class="error-code">403</div>
    <h2>没有访问权限</h2>
    <p>当前账号未被授予该页面的权限，需要的话请联系管理员在「角色管理」里调整。</p>
    <div class="error-actions">
      <el-button @click="router.back()">返回上一页</el-button>
      <el-button type="primary" @click="router.push('/dashboard')">回到概览</el-button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}

.error-code {
  color: var(--zz-primary);
  font-size: 64px;
  font-weight: 600;
  letter-spacing: -2px;
  opacity: 0.85;
}

.error-page h2 {
  margin: 8px 0 6px;
  font-size: 18px;
}

.error-page p {
  max-width: 420px;
  margin: 0 0 22px;
  color: var(--zz-text-faint);
  font-size: 13px;
}

.error-actions {
  display: flex;
  gap: 10px;
}
</style>
