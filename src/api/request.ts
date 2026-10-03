import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ElMessage } from 'element-plus';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/utils/storage';
import type { Result, TokenResp } from '@/types/api';

/** 后端统一成功码：CommonErrorConstant.SUCCESS */
export const SUCCESS_CODE = 1000000000;

/** 网关前缀（默认 /api），dev 由 Vite 代理转发到网关 */
const GATEWAY_PREFIX = import.meta.env.VITE_API_BASE || '/api';

/** infra 服务的管理后台接口前缀：网关前缀 + 服务名 + 端前缀 */
const API_BASE = `${GATEWAY_PREFIX}/infra/admin-api`;

/** 续期接口地址：单独拼出来，续期请求走裸 axios，不经过本文件里的拦截器 */
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

const client = axios.create({
  baseURL: API_BASE,
  timeout: REQUEST_TIMEOUT,
});

client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

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

client.interceptors.response.use(
  (response: AxiosResponse<Result<unknown>>) => {
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
  },
  async (error: AxiosError<Result<unknown>>) => {
    const { response, config } = error;
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
  },
);

/**
 * 统一请求入口：拦截器已经把 {@code Result<T>} 解包成 {@code T}，
 * 所以这里的泛型直接写业务数据类型。
 */
export const api = {
  /**
   * GET 请求
   *
   * @param url 业务路径（相对 API_BASE）
   * @param params 查询参数
   * @param config 额外 axios 配置
   */
  get<T>(url: string, params?: Record<string, unknown>, config?: AxiosRequestConfig): Promise<T> {
    return client.get(url, { params, ...config }) as unknown as Promise<T>;
  },

  /**
   * POST 请求
   *
   * @param url 业务路径（相对 API_BASE）
   * @param data 请求体
   * @param config 额外 axios 配置
   */
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return client.post(url, data, config) as unknown as Promise<T>;
  },
};
