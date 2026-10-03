<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown, Bell, Expand } from '@element-plus/icons-vue';
import { useAuthStore } from '@/store/auth';
import { usePermissionStore } from '@/store/permission';
import { useTabsStore } from '@/store/tabs';
import { resetDynamicRoutes } from '@/router';
import { avatarText } from '@/utils/format';

/**
 * 顶栏：左边面包屑（窄屏多一个呼出导航的按钮），右边通知与用户下拉。
 *
 * <p>个人中心、修改密码、退出登录都收在用户下拉里，不占左侧导航的位置。
 */
defineOptions({ name: 'TopBar' });

const emit = defineEmits<{ (event: 'toggle-nav'): void }>();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const permission = usePermissionStore();
const tabs = useTabsStore();

const currentModule = computed(
  () => permission.modules.find((item) => item.path === permission.activeModule) ?? permission.modules[0],
);

/** 面包屑：模块名 + 页面名，两者同名时只显示一个 */
const crumbs = computed(() => {
  const title = route.meta.title ?? '';
  const moduleName = currentModule.value?.name ?? '';
  const list: string[] = [];
  if (moduleName && moduleName !== title) {
    list.push(moduleName);
  }
  if (title) {
    list.push(title);
  }
  return list;
});

const avatar = computed(() => avatarText(auth.nickname || auth.username));

const roleText = computed(() =>
  auth.roleCodes.map((code) => (code === 'super_admin' ? '超级管理员' : code)).join(' / '),
);

/**
 * 用户下拉的命令处理
 *
 * @param command 下拉项标识
 */
async function handleCommand(command: string): Promise<void> {
  if (command === 'profile') {
    await router.push('/profile');
    return;
  }

  if (command === 'password') {
    await router.push('/profile');
    document.getElementById('password-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  try {
    await ElMessageBox.confirm('退出后需要重新登录才能继续操作。', '确定退出登录？', {
      type: 'warning',
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }

  await auth.logoutAction();
  permission.reset();
  tabs.reset();
  resetDynamicRoutes();
  ElMessage.success('已退出登录');
  await router.push('/login');
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-left">
      <button type="button" class="topbar-icon topbar-only-narrow" @click="emit('toggle-nav')">
        <el-icon :size="16"><Expand /></el-icon>
      </button>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item v-for="(crumb, index) in crumbs" :key="index">{{ crumb }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="topbar-right">
      <el-popover placement="bottom-end" :width="220" trigger="click">
        <template #reference>
          <button type="button" class="topbar-icon">
            <el-icon :size="16"><Bell /></el-icon>
          </button>
        </template>
        <div class="empty-block">暂无新通知</div>
      </el-popover>

      <el-dropdown trigger="click" @command="handleCommand">
        <div class="user-trigger">
          <span class="user-avatar">{{ avatar }}</span>
          <span class="user-trigger-name">{{ auth.nickname || auth.username || '未登录' }}</span>
          <el-icon :size="12"><ArrowDown /></el-icon>
        </div>
        <template #dropdown>
          <div class="user-dropdown">
            <div class="user-dropdown-head">
              <b>{{ auth.nickname || auth.username }}</b>
              <span>{{ auth.username }}</span>
              <div v-if="roleText" class="user-dropdown-roles">{{ roleText }}</div>
            </div>
            <el-dropdown-menu>
              <el-dropdown-item command="profile">个人中心</el-dropdown-item>
              <el-dropdown-item command="password">修改密码</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </div>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>
