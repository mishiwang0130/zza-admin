/**
 * 后端接口的 TypeScript 类型定义。
 *
 * <p>注意：后端 {@code JacksonConfig} 把所有 {@code Long} 序列化成字符串，
 * 因此 id 类字段与分页 total 在这里一律声明为 {@code string}，
 * 需要参与数值计算时必须显式 {@code Number(...)} 转换。
 */

/** 统一响应体：成功与业务失败都是 HTTP 200，由 code 区分 */
export interface Result<T> {
  code: number;
  msg: string;
  data: T;
}

/** 分页返回体 */
export interface PageResp<T> {
  /** 总记录数（字符串，后端 Long 转字符串） */
  total: string;
  pageNum: number;
  pageSize: number;
  records: T[];
}

/** 分页查询公共入参 */
export interface PageQuery {
  pageNum: number;
  pageSize: number;
}

/** 登录入参 */
export interface LoginReq {
  username: string;
  password: string;
}

/** 登录 / 续期返回的凭证 */
export interface TokenResp {
  accessToken: string;
  tokenType: string;
  /** 有效期（秒） */
  expiresIn: string;
  refreshToken: string;
}

/** 当前登录用户信息 */
export interface UserInfo {
  userId: string;
  username: string;
  nickname: string;
  /** 1 管理后台、2 用户端 */
  userType: number;
  roleCodes: string[];
  perms: string[];
}

/** 当前用户可见的导航菜单节点（只含目录与菜单，不含按钮） */
export interface MenuNode {
  id: string;
  parentId: string;
  name: string;
  /** 1 目录、2 菜单、3 按钮 */
  type: number;
  path: string;
  component: string;
  perms: string;
  icon: string;
  sort: number;
  children: MenuNode[] | null;
}

/** 菜单管理返回体（含按钮与审计字段） */
export interface MenuVO {
  id: string;
  parentId: string;
  name: string;
  type: number;
  path: string;
  component: string;
  perms: string;
  icon: string;
  sort: number;
  /** 0 显示、1 隐藏 */
  visible: number;
  /** 0 启用、1 停用 */
  status: number;
  createTime: string;
  children: MenuVO[] | null;
}

/** 菜单新增 / 修改入参 */
export interface MenuFormReq {
  id?: string;
  parentId: string;
  name: string;
  type: number;
  path: string;
  component: string;
  perms: string;
  icon: string;
  sort: number;
  visible: number;
  status: number;
}

/** 用户返回体 */
export interface UserVO {
  id: string;
  username: string;
  nickname: string;
  mobile: string;
  /** 0 启用、1 停用 */
  status: number;
  createTime: string;
  updateTime: string;
  roleIds: string[] | null;
}

/** 用户分页入参 */
export interface UserPageQuery extends PageQuery {
  username?: string;
  nickname?: string;
  mobile?: string;
  status?: number | null;
}

/** 用户新增入参 */
export interface UserCreateReq {
  username: string;
  password: string;
  nickname: string;
  mobile: string;
  status: number;
  roleIds: string[];
}

/** 用户修改入参（用户名不可改） */
export interface UserUpdateReq {
  id: string;
  nickname: string;
  mobile: string;
  status: number;
  roleIds: string[];
}

/* ------------------------------ App 用户 ------------------------------ */

/** App 用户返回体：账号由 App 端注册，后台只读 */
export interface AppUserVO {
  id: string;
  nickname: string;
  mobile: string;
  /** 0 启用、1 停用 */
  status: number;
  createTime: string;
}

/**
 * App 用户分页入参
 *
 * <p>keyword 是后端唯一的搜索入口：昵称前后模糊、手机号前缀模糊，两个条件都可为空。
 */
export interface AppUserPageQuery extends PageQuery {
  keyword?: string;
  status?: number | null;
}

/** 角色返回体 */
export interface RoleVO {
  id: string;
  name: string;
  code: string;
  sort: number;
  status: number;
  createTime: string;
  updateTime: string;
  menuIds: string[] | null;
}

/** 角色精简返回体（角色下拉用） */
export interface RoleSimpleVO {
  id: string;
  name: string;
  code: string;
}

/** 角色分页入参 */
export interface RolePageQuery extends PageQuery {
  name?: string;
  code?: string;
  status?: number | null;
}

/** 角色新增 / 修改入参 */
export interface RoleFormReq {
  id?: string;
  name: string;
  code: string;
  sort: number;
  status: number;
  menuIds: string[];
}

/** 启用 / 停用入参 */
export interface StatusReq {
  id: string;
  status: number;
}

/* ------------------------------- 字典类型 ------------------------------- */

/** 字典类型返回体 */
export interface DictTypeVO {
  id: string;
  name: string;
  /** 字典类型编码，前端按它取字典数据 */
  type: string;
  /** 0 启用、1 停用 */
  status: number;
  remark: string;
  createTime: string;
}

/** 字典类型精简返回体：作为字典数据的类型下拉，值为编码、标签为名称 */
export interface DictTypeSimpleVO {
  id: string;
  type: string;
  name: string;
}

/** 字典类型分页入参 */
export interface DictTypePageQuery extends PageQuery {
  name?: string;
  type?: string;
  status?: number | null;
}

/** 字典类型新增 / 修改入参 */
export interface DictTypeFormReq {
  id?: string;
  name: string;
  type: string;
  status: number;
  remark: string;
}

/* ------------------------------- 字典数据 ------------------------------- */

/** 字典数据返回体 */
export interface DictDataVO {
  id: string;
  /** 所属字典类型编码 */
  dictType: string;
  label: string;
  value: string;
  sort: number;
  /** 0 启用、1 停用 */
  status: number;
  remark: string;
  createTime: string;
}

/** 字典数据精简返回体：下拉与标签展示用 */
export interface DictDataSimpleVO {
  label: string;
  value: string;
}

/** 字典数据分页入参 */
export interface DictDataPageQuery extends PageQuery {
  /** 所属字典类型编码，精确匹配 */
  dictType?: string;
  /** 字典标签，模糊匹配 */
  label?: string;
  status?: number | null;
}

/** 字典数据新增 / 修改入参 */
export interface DictDataFormReq {
  id?: string;
  dictType: string;
  label: string;
  value: string;
  sort: number;
  status: number;
  remark: string;
}

/* ------------------------------ 行政区划 ------------------------------ */

/** 文件上传返回体：业务表引用文件时只存 fileId，展示地址按需重新签发 */
export interface FileUploadRespVO {
  fileId: string;
  /** 对象存储中的对象名（key） */
  objectName: string;
  /** 预签名访问地址，有效期内可直接访问 */
  url: string;
}

/** 行政区划节点：既作为逐级查询的结果，也作为整棵树的节点 */
export interface AreaVO {
  id: string;
  /** 上级区划 ID，0 表示省级 */
  parentId: string;
  name: string;
  /** 行政区划代码 */
  code: string;
  /** 1 省、2 市、3 区县 */
  level: number;
  children: AreaVO[] | null;
}
