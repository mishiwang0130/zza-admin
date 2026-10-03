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
