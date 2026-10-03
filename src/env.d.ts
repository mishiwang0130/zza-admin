/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

interface ImportMetaEnv {
  /** 网关前缀，默认 /api */
  readonly VITE_API_BASE: string;
  /** 站点标题 */
  readonly VITE_APP_TITLE: string;
  /** dev 环境代理目标（网关地址） */
  readonly VITE_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
