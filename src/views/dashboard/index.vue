<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppIcon from '@/components/AppIcon.vue';
import { listRole } from '@/api/role';
import { pageUser } from '@/api/user';
import { useAuthStore } from '@/store/auth';
import { usePermissionStore } from '@/store/permission';
import type { NavItem } from '@/router/dynamic';
import type { MenuNode } from '@/types/api';
import { avatarText, toNumber } from '@/utils/format';

/**
 * 概览页：不做假数据图表，卡片里的数字全部来自真实接口或当前登录态。
 *
 * <p>用户总数与启用角色数需要 query 权限，没权限时该卡片显示占位符而不是报错，
 * 这样低权限账号进来也能看到一个完整的页面。
 */
defineOptions({ name: 'Dashboard' });

const router = useRouter();
const auth = useAuthStore();
const permission = usePermissionStore();

const loading = ref(false);
const userTotal = ref<number | null>(null);
const enabledRoles = ref<number | null>(null);

const avatar = computed(() => avatarText(auth.nickname || auth.username));

/** 当前用户可见的菜单节点总数（含目录） */
const visibleMenuCount = computed(() => {
  const count = (nodes: MenuNode[]): number =>
    nodes.reduce((sum, node) => sum + 1 + count(node.children ?? []), 0);
  return count(permission.menus);
});

/** 快捷入口：直接从当前用户可见的菜单里取叶子节点，菜单改了这里自动跟着变 */
const quickLinks = computed<NavItem[]>(() => {
  const result: NavItem[] = [];
  const walk = (items: NavItem[]): void => {
    items.forEach((item) => {
      if (item.children?.length) {
        walk(item.children);
      } else {
        result.push(item);
      }
    });
  };
  permission.modules.filter((module) => module.id !== 'dashboard').forEach((module) => walk(module.children));
  return result.slice(0, 6);
});

const roleText = computed(() =>
  auth.roleCodes.length
    ? auth.roleCodes.map((code) => (code === 'super_admin' ? '超级管理员' : code)).join(' / ')
    : '—',
);

/** 拉取统计数字：用 allSettled，避免某一个接口没权限时整页都是错误提示 */
async function loadStats(): Promise<void> {
  loading.value = true;
  try {
    const [userPage, roles] = await Promise.allSettled([pageUser({ pageNum: 1, pageSize: 1 }), listRole()]);
    if (userPage.status === 'fulfilled') {
      userTotal.value = toNumber(userPage.value.total);
    }
    if (roles.status === 'fulfilled') {
      enabledRoles.value = roles.value.length;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(loadStats);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="page-title">概览</div>
        <div class="page-desc">当前账号的权限范围与系统关键数据</div>
      </div>
      <div class="page-head-actions">
        <el-button :loading="loading" @click="loadStats">刷新</el-button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon"><AppIcon name="User" :size="20" /></div>
        <div>
          <div class="stat-label">用户总数</div>
          <div class="stat-value">{{ userTotal ?? '—' }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><AppIcon name="Avatar" :size="20" /></div>
        <div>
          <div class="stat-label">启用中的角色</div>
          <div class="stat-value">{{ enabledRoles ?? '—' }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><AppIcon name="Menu" :size="20" /></div>
        <div>
          <div class="stat-label">我的可见菜单</div>
          <div class="stat-value">{{ visibleMenuCount }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon"><AppIcon name="Key" :size="20" /></div>
        <div>
          <div class="stat-label">我的权限项</div>
          <div class="stat-value">{{ auth.perms.length }}</div>
        </div>
      </div>
    </div>

    <div class="card-grid">
      <div class="card">
        <div class="card-title">当前账号</div>
        <div class="cell-user" style="margin-bottom: 12px">
          <span class="cell-user-avatar" style="width: 40px; height: 40px; border-radius: 11px">
            {{ avatar }}
          </span>
          <div>
            <div class="cell-user-name">{{ auth.nickname || '—' }}</div>
            <div class="cell-user-account">{{ auth.username }}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-row-label">角色</div>
          <div class="meta-row-value">{{ roleText }}</div>
        </div>
        <div class="meta-row">
          <div class="meta-row-label">权限标识</div>
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

      <div class="card">
        <div class="card-title">快捷入口</div>
        <div v-if="quickLinks.length" class="quick-actions">
          <el-button v-for="link in quickLinks" :key="link.id" @click="router.push(link.path)">
            <AppIcon :name="link.icon" :size="15" style="margin-right: 6px" />
            {{ link.name }}
          </el-button>
        </div>
        <div v-else class="empty-block">当前账号还没有可用菜单</div>
      </div>
    </div>
  </div>
</template>
