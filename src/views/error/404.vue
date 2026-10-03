<script setup lang="ts">
import { useRouter } from 'vue-router';

/**
 * 404：地址不存在，或菜单配的组件路径对不上导致页面没被注册。
 */
defineOptions({ name: 'ErrorNotFound' });

const router = useRouter();
</script>

<template>
  <div class="error-page">
    <div class="error-code">404</div>
    <h2>页面不存在</h2>
    <p>地址可能已经变更，或者菜单里配置的组件路径与实际文件对不上。</p>
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
