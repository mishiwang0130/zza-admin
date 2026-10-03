import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

/**
 * Vite 配置：只负责开发服务器、路径别名与代理，业务配置一律放 env 文件。
 *
 * <p>代理说明：前端所有请求都带 {@code /api} 前缀（网关前缀），dev 环境把 {@code /api}
 * 原样转发给网关，不做 rewrite —— 网关自己按 {@code /api/{服务名}/**} 路由，
 * 去掉前缀反而会让网关匹配不到。
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1500,
    },
  };
});
