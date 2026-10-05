import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ElMessage } from 'element-plus';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/utils/storage';
import type { Result, TokenResp } from '@/types/api';

/** 后端统一成功码：CommonErrorConstant.SUCCESS */
export const SUCCESS_CODE = 200;

/** 网关前缀（默认 /api），dev 由 Vite 代理转发到网关 */
const GATEWAY_PREFIX = import.meta.env.VITE_API_BASE || '/api';

/**
 * infra 服务的管理后台接口前缀：网关前缀 + 服务名 + 端前缀。
 *
 * <p>续期接口在 infra 上，所以用裸 axios 单独拼一次地址 —— 续期请求不能带过期的
 * Authorization 头、也不能走响应拦截器，否则会递归。
 */
const API_BASE = `${GATEWAY_PREFIX}/infra/admin-api`;

const AUTH_REFRESH_URL = `${API_BASE}/auth/refresh`;

const REQUEST_TIMEOUT = 15000;

/** 业务异常：HTTP 200 但 code 不是成功码时抛出，供调用方按错误码分支处理 */
export class BizError extends Error {
  /** 后端错误码 */
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = 'BizError';
    this.code = code;
  }
}

/** 请求拦截：带上访问令牌 */
function attachToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
}

/** 拼上 traceId：出问题时用户截图就能直接对上后端日志 */
function withTraceId(message: string, traceId?: unknown): string {
  const trace = typeof traceId === 'string' && traceId ? traceId : '';
  return trace ? `${message}（Trace-Id: ${trace}）` : message;
}

/** 取响应头里的 traceId */
function traceIdOf(response?: AxiosResponse): unknown {
  return response?.headers?.['x-trace-id'];
}

/** 登录 / 续期接口本身不需要（也不能）走续期逻辑，避免递归 */
function isAuthEndpoint(url?: string): boolean {
  return Boolean(url && (url.includes('/auth/login') || url.includes('/auth/refresh')));
}

/** 凭证彻底失效：整页跳登录页，顺带清掉内存里的状态 */
function redirectToLogin(): void {
  clearTokens();
  const { pathname, search, hash } = window.location;
  if (pathname === '/login') {
    return;
  }
  const redirect = encodeURIComponent(`${pathname}${search}${hash}`);
  window.location.replace(`/login?redirect=${redirect}`);
}

/** 续期中的共享 Promise：多个请求同时 401 时只发一次续期请求 */
let refreshing: Promise<string> | null = null;

/**
 * 用 refreshToken 换一对新凭证
 *
 * @returns 新的 accessToken
 */
async function requestNewToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error('缺少续期凭证');
  }
  // 用裸 axios：续期接口是免登录的，不能带过期的 Authorization 头，也不能走响应拦截器
  const { data } = await axios.post<Result<TokenResp>>(
    AUTH_REFRESH_URL,
    { refreshToken },
    { timeout: REQUEST_TIMEOUT },
  );
  if (data.code !== SUCCESS_CODE || !data.data) {
    throw new BizError(data.code, data.msg || '续期失败');
  }
  // 续期是轮换的：旧的 refreshToken 已失效，必须把两个新值一起写回
  setTokens(data.data.accessToken, data.data.refreshToken);
  return data.data.accessToken;
}

function refreshTokenOnce(): Promise<string> {
  if (!refreshing) {
    refreshing = requestNewToken().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/** 响应拦截：解包 Result、业务失败提示、401 静默续期后重放 */
function handleResponse(response: AxiosResponse<Result<unknown>>) {
  const body = response.data;
  if (body && typeof body === 'object' && 'code' in body) {
    if (body.code === SUCCESS_CODE) {
      return body.data as never;
    }
    const message = withTraceId(body.msg || '请求失败', traceIdOf(response));
    ElMessage.error(message);
    return Promise.reject(new BizError(body.code, message));
  }
  return response.data as never;
}

async function handleResponseError(error: AxiosError<Result<unknown>>, client: AxiosInstance) {
  const { response, config } = error;

  // 主动取消（用户点「取消上传」）：这是预期内的中断，不是网络故障，不要弹错误提示
  if (axios.isCancel(error)) {
    return Promise.reject(error);
  }

  const retriable = config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  const url = retriable?.url;

  // 401：先尝试静默续期并重放原请求，只重放一次
  if (response?.status === 401 && retriable && !retriable._retried && !isAuthEndpoint(url)) {
    retriable._retried = true;
    try {
      const token = await refreshTokenOnce();
      retriable.headers.set('Authorization', `Bearer ${token}`);
      return await client.request(retriable);
    } catch {
      ElMessage.error('登录已过期，请重新登录');
      redirectToLogin();
      return Promise.reject(new BizError(1000000002, '登录已过期，请重新登录'));
    }
  }

  const status = response?.status;
  if (status === 401) {
    redirectToLogin();
    return Promise.reject(new BizError(1000000002, '登录已过期，请重新登录'));
  }

  let message: string;
  if (!response) {
    message = error.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : '无法连接后端，请确认网关已启动';
  } else if (status === 400) {
    message = withTraceId(response.data?.msg || '请求参数不合法', traceIdOf(response));
  } else if (status === 404) {
    message = withTraceId('请求的资源不存在', traceIdOf(response));
  } else if (status === 500) {
    message = withTraceId(response.data?.msg || '系统繁忙，请稍后重试', traceIdOf(response));
  } else {
    message = withTraceId(response.data?.msg || `请求失败（HTTP ${status}）`, traceIdOf(response));
  }
  ElMessage.error(message);
  return Promise.reject(error);
}

/** 某个服务的管理后台请求客户端 */
export interface ServiceApi {
  get<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<T>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
}

/**
 * 按服务前缀创建请求客户端
 *
 * <p>每个服务一个客户端实例，但令牌注入、Result 解包、401 续期、错误提示都是同一份实现，
 * 差别只在 baseURL。新增微服务时加一行即可。
 *
 * @param servicePath 网关前缀 + 服务名 + 端前缀，如 /api/rental/admin-api
 */
function createServiceApi(servicePath: string): ServiceApi {
  const client = axios.create({
    baseURL: servicePath,
    timeout: REQUEST_TIMEOUT,
  });

  client.interceptors.request.use(attachToken);
  client.interceptors.response.use(handleResponse, (error: AxiosError<Result<unknown>>) =>
    handleResponseError(error, client),
  );

  return {
    get<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<T> {
      return client.get(url, { params, ...config }) as unknown as Promise<T>;
    },
    post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
      return client.post(url, data, config) as unknown as Promise<T>;
    },
  };
}

/** infra 服务（用户、角色、菜单、字典、区划、文件） */
export const api = createServiceApi(API_BASE);

/** rental 服务（公寓、房间、费用项、租约、看房预约） */
export const rentalApi = createServiceApi(`${GATEWAY_PREFIX}/rental/admin-api`);

/** ai-agent 服务（知识库文档、语义检索调试、会话记录） */
export const aiAgentApi = createServiceApi(`${GATEWAY_PREFIX}/ai-agent/admin-api`);
