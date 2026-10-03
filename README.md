# zza-admin

住住安管理后台前端：**Vue 3 + Vite + TypeScript + Element Plus + Pinia + Vue Router**。

## 快速开始

```bash
npm install
npm run dev      # http://localhost:5173
```

开发环境由 Vite 把 `/api` 代理到 `http://localhost:8080`（网关），所以联调前需要先启动 Nacos → gateway → infra。
改代理目标不用动代码，改 `.env.development` 里的 `VITE_PROXY_TARGET` 即可。

```bash
npm run typecheck   # vue-tsc 类型检查
npm run build       # 类型检查 + 生产构建
```

## 接口约定

- 所有请求都走网关：`/api/infra/admin-api/**`（`/api` 网关前缀 + `infra` 服务名 + `/admin-api` 端前缀）。
- 统一响应体 `{ code, msg, data }`，成功码 `1000000000`；业务失败也是 HTTP 200，由 `code` 表达。
- 鉴权头 `Authorization: Bearer <accessToken>`；`accessToken` 过期时用 `refreshToken` 静默续期。
- **后端把 `Long` 序列化成字符串**，所以用户 ID、菜单 ID、分页 `total` 在前端都是 `string`，参与计算时要显式转换。

## 目录结构

```
src
├── api          请求封装与按资源拆分的接口（auth / user / role / menu）
├── router       静态路由 + 由后端菜单生成的动态路由
├── store        Pinia：登录态、菜单与动态路由、标签页
├── layout       双栏导航外壳（图标栏 / 二级菜单 / 顶栏 / 标签页 / 内容区）
├── views        页面：登录、概览、系统管理（用户 / 角色 / 菜单）、个人中心、403 / 404
├── components   通用组件（图标渲染、递归菜单、权限树）
├── directives   v-has-perm 按钮权限指令
├── styles       主题变量与全局样式
├── types        接口类型
└── utils        本地存储、图标注册表、格式化
```

## 新增页面

后端「菜单管理」里新增菜单时，`component` 填 `views` 下的相对路径（例如 `system/user/index`），
前端会通过 `import.meta.glob` 自动把它挂成路由，不需要改代码；组件路径写错时该菜单不会注册，落到 404 而不是白屏。
