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
├── api          请求封装与按资源拆分的接口（infra：auth / user / role / menu / dictType / dictData / area / file；rental：apartment / room / feeItem / lease / viewAppointment）
├── router       静态路由 + 由后端菜单生成的动态路由
├── store        Pinia：登录态、菜单与动态路由、标签页
├── layout       双栏导航外壳（图标栏 / 二级菜单 / 顶栏 / 标签页 / 内容区）
├── views        页面：登录、概览、系统管理（用户 / 角色 / 菜单 / 字典）、租房管理（公寓 / 房间 / 费用项 / 租约 / 看房预约）、个人中心、403 / 404
├── components   通用组件（图标渲染、递归菜单、省市区级联、字典下拉、图片上传、文件上传）
├── directives   v-has-perm 按钮权限指令
├── styles       主题变量与全局样式
├── types        接口类型
└── utils        本地存储、图标注册表、格式化
```

## 新增页面

后端「菜单管理」里新增菜单时，`component` 填 `views` 下的相对路径（例如 `system/user/index`），
前端会通过 `import.meta.glob` 自动把它挂成路由，不需要改代码；组件路径写错时该菜单不会注册，落到 404 而不是白屏。

## 几个页面的约定

- **多服务**：请求层按服务各建一个客户端（`api` → infra，`rentalApi` → rental），
  令牌注入、`Result` 解包、401 续期、错误提示是同一份实现，新增服务只要加一行。
- **字典类型 / 字典数据**：字典类型是导航菜单（`system/dict/type/index`）；字典数据是它的下级详情页，
  后端菜单表里没有这一项，所以走前端静态路由 `/system/dict-type/data?dictType=xxx`，
  路径挂在 `/system/dict-type` 下面，进去之后二级菜单继续高亮「字典类型」（靠路由 `meta.activePath`）。
  字典类型与字典数据都没有单独的启停接口，状态在编辑弹窗里改。
- **行政区划**：省市区不是页面而是基础数据，封装成 `AreaCascader` 组件（`v-model` 绑定区划 ID，
  `valueField="code"` 可改成绑定行政区划代码，`@change` 会回传完整路径）。
  组件一次拉全量树并缓存在模块级别：懒加载模式下表单回显只能显示原始值，拿整棵树才能还原「广东省 / 深圳市 / 南山区」。
- **文件上传**：后端现在会把上传记录落到 `infra_file`，但接口形态没变（仍是 `POST /file/upload`，
  返回 `fileId` + `objectName` + 预签名 `url`）。公寓与房间的图片提交的是 `fileId`（地址是预签名的、
  会过期，落库就是脏数据），所以 `ImageUploader` 只把 `fileId` 与排序号交给表单。
- **租房管理**：公寓与房间没有删除接口，下架（`publishStatus = 0`）就是对外不可见；
  租约也没有删除接口，作废靠状态置为「已取消」。租约的状态流转按后端状态机走，
  页面只列当前状态允许的目标状态（`utils/rental-options.ts`），不让用户点了才被拒绝。
  承租人目前只能手填 App 用户 ID：infra 还没有提供 App 用户的查询接口。
- **看房预约**：预约表只存预约人 ID，不再快照姓名与手机号，昵称与手机号由后端按
  `userId` 查 infra 用户表回填。所以筛选条件里没有姓名/手机号（infra 只提供按 ID 批量查、
  不提供按手机号搜索），只能按用户 ID 精确查；用户已注销时昵称/手机号返回 null，
  列表与详情会退化成「用户 #ID / 手机号不可用」并给出说明。
