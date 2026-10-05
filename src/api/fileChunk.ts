import { api } from '@/api/request';
import { computeFileMd5 } from '@/api/fileMd5';
import type {
  FileChunkInitReqVO,
  FileChunkInitRespVO,
  FileChunkSessionReqVO,
  FileChunkUploadRespVO,
  FileUploadRespVO,
} from '@/types/api';
import { getAccessToken } from '@/utils/storage';

/**
 * 大文件分片上传：/fileChunk/init → /fileChunk/upload × N → /fileChunk/complete
 *
 * <p>为什么要有这条链路：原来的 /file/upload 一次请求传整个文件，服务端容器 10MB 上限、
 * 弱网下必然超时且失败要整文件重来。这里改成客户端切片、服务端逐片转发再合并。
 *
 * <p>阈值与上限判断不在这里，由 {@code src/api/file.ts} 统一分流：本模块只处理 >10MB 的文件。
 */

/**
 * 分片相关请求的超时：request.ts 的全局 15 秒是给普通接口用的，
 * 上传说 5MB 一片在弱网下必然超过 15 秒，不单独放大就会「被前端自己掐断」。
 */
const CHUNK_TIMEOUT = 120000;

/** 并发上传的分片数：更高并发对小带宽没有收益，反而容易出现单片超时 */
const MAX_CONCURRENCY = 3;

/** 单片失败后的退避间隔：分别是第 1 / 2 / 3 次重试前的等待，共计重试 3 次 */
const RETRY_DELAYS = [1000, 3000, 8000];

/** 上传被用户取消：调用方据此区分「失败」与「主动取消」，弹出不同提示 */
export class UploadCanceledError extends Error {
  constructor(message = '上传已取消') {
    super(message);
    this.name = 'UploadCanceledError';
  }
}

/** 超过单文件上限：本地直接拦截，省掉一次注定失败的 MD5 计算与 init 请求 */
export class FileSizeExceededError extends Error {
  constructor(message = '单个文件不能超过 200MB') {
    super(message);
    this.name = 'FileSizeExceededError';
  }
}

/** 分片上传的可选参数 */
export interface ChunkUploadOptions {
  /** 总体进度（0~100），按分片粒度上报；续传时从已传片数起算 */
  onProgress?: (percent: number) => void;
  /** 取消信号：中断在途请求、终止 MD5 worker，并调用 abort 释放服务端会话 */
  signal?: AbortSignal;
}

/* ------------------------- 关页面时的兜底 abort ------------------------- */

/**
 * 当前活跃的会话 ID 集合。
 *
 * <p>用模块级集合而不是每次调用各自的闭包，是因为 pagehide 监听只注册一次就要覆盖所有上传；
 * 用集合而不是单个值，是为了同时存在多个上传会话（例如批量场景）时都能被清理。
 */
const activeUploadIds = new Set<string>();

/** 与 request.ts 同一套地址拼法：dev 由 Vite 代理到网关，生产由网关按 /api/{服务名} 路由 */
const GATEWAY_PREFIX = import.meta.env.VITE_API_BASE || '/api';

const ABORT_URL = `${GATEWAY_PREFIX}/infra/admin-api/fileChunk/abort`;

/**
 * 关闭 / 刷新页面时尽力 abort。
 *
 * <p>pagehide 阶段普通的 axios 请求会被浏览器直接掐断，只有 fetch 的 keepalive 能把请求送出去；
 * 请求体是几十字节的 JSON，远低于 keepalive 的体积上限。拿不到结果也不提示用户 ——
 * 服务端还有「会话 24 小时过期 + 对象存储生命周期清理」两道兜底。
 */
function abortActiveSessionsOnPageHide(): void {
  if (!activeUploadIds.size) {
    return;
  }
  const token = getAccessToken();
  for (const uploadId of activeUploadIds) {
    const body: FileChunkSessionReqVO = { uploadId };
    void fetch(ABORT_URL, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }).catch(() => {
      // 页面正在卸载，失败也做不了补救，忽略
    });
  }
}

window.addEventListener('pagehide', abortActiveSessionsOnPageHide);

/* ------------------------------ 流程编排 ------------------------------ */

/**
 * 走分片链路上传一个文件
 *
 * @param file 待上传文件（>10MB）
 * @param options 进度回调与取消信号
 * @returns 与 /file/upload 完全一致的返回体（fileId / objectName / url）
 */
export async function uploadFileInChunks(
  file: File,
  options: ChunkUploadOptions = {},
): Promise<FileUploadRespVO> {
  const { onProgress, signal } = options;
  /** 已建立的会话 ID：拿到之后才有东西可 abort，finally 里也靠它注销 */
  let uploadId = '';
  try {
    assertNotAborted(signal);
    // MD5 只用于续传定位：同一用户 + 同一端 + 同一 MD5 + 同一大小会命中同一条会话
    const fileMd5 = await computeFileMd5(file, signal);
    assertNotAborted(signal);

    const initReq: FileChunkInitReqVO = {
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || undefined,
      fileMd5,
    };
    // init 不重试：失败就是这次上传失败，重试由用户点「重新上传」决定
    const session = await api.post<FileChunkInitRespVO>('/fileChunk/init', initReq, {
      timeout: CHUNK_TIMEOUT,
      signal,
    });
    uploadId = session.uploadId;
    activeUploadIds.add(uploadId);

    await uploadAllParts(file, session, onProgress, signal);
    assertNotAborted(signal);
    // complete 是幂等的：同一个 uploadId 重复调返回同一份结果，所以网络抖动重试是安全的
    const completeReq: FileChunkSessionReqVO = { uploadId };
    return await withRetry(
      () =>
        api.post<FileUploadRespVO>('/fileChunk/complete', completeReq, {
          timeout: CHUNK_TIMEOUT,
          signal,
        }),
      signal,
    );
  } catch (error) {
    // 取消可能发生在任意一步（算 MD5、init、传片、complete）：统一收敛成同一种错误，
    // 会话已经建立时必须主动 abort，否则对象存储里会留下未完成的分片
    if (signal?.aborted) {
      if (uploadId) {
        await abortSession(uploadId);
      }
      throw new UploadCanceledError();
    }
    throw error;
  } finally {
    if (uploadId) {
      activeUploadIds.delete(uploadId);
    }
  }
}

/**
 * 并发上传所有缺失的分片
 *
 * <p>用固定数量的 worker 从待传列表里取任务，而不是一次把所有 Promise 都建出来：
 * 200MB 有 40 片，一次性发出会让浏览器排队、进度也不真实。
 */
async function uploadAllParts(
  file: File,
  session: FileChunkInitRespVO,
  onProgress: ((percent: number) => void) | undefined,
  signal: AbortSignal | undefined,
): Promise<void> {
  const uploaded = new Set(session.uploadedPartNumbers ?? []);
  // 续传时已传分片计入初始进度，用户看到的是整体进度而不是「这次补传了多少」
  let doneCount = uploaded.size;
  reportProgress(onProgress, doneCount, session.totalChunks);

  const pending: number[] = [];
  for (let partNumber = 1; partNumber <= session.totalChunks; partNumber += 1) {
    if (!uploaded.has(partNumber)) {
      pending.push(partNumber);
    }
  }
  if (!pending.length) {
    return;
  }

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < pending.length) {
      assertNotAborted(signal);
      const partNumber = pending[cursor];
      cursor += 1;
      await uploadOnePart(file, session, partNumber, signal);
      doneCount += 1;
      reportProgress(onProgress, doneCount, session.totalChunks);
    }
  };

  // allSettled 而不是 all：一片失败时其它在途分片也要收口，否则它们的拒绝会变成未处理拒绝
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(MAX_CONCURRENCY, pending.length) }, () => worker()),
  );
  const failed = results.find((item) => item.status === 'rejected');
  if (failed?.status === 'rejected') {
    throw failed.reason;
  }
}

/**
 * 上传单片（失败退避重试 3 次）
 *
 * <p>同一个 partNumber 重发会覆盖服务端已有分片，所以重试就是重发同一片，不需要先清理。
 */
async function uploadOnePart(
  file: File,
  session: FileChunkInitRespVO,
  partNumber: number,
  signal: AbortSignal | undefined,
): Promise<void> {
  const start = (partNumber - 1) * session.chunkSize;
  const end = Math.min(start + session.chunkSize, file.size);
  const chunk = file.slice(start, end);

  await withRetry(async () => {
    const formData = new FormData();
    formData.append('uploadId', session.uploadId);
    formData.append('partNumber', String(partNumber));
    // 不要手动设 Content-Type：必须让浏览器自己带 multipart 的 boundary
    formData.append('file', chunk, file.name);
    await api.post<FileChunkUploadRespVO>('/fileChunk/upload', formData, {
      timeout: CHUNK_TIMEOUT,
      signal,
    });
  }, signal);
}

/* -------------------------------- 工具 -------------------------------- */

/** 失败退避重试：共尝试 RETRY_DELAYS.length + 1 次，等待期间可被取消打断 */
async function withRetry<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  let lastError: unknown = new Error('请求失败');
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt += 1) {
    assertNotAborted(signal);
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= RETRY_DELAYS.length) {
        break;
      }
      await sleep(RETRY_DELAYS[attempt], signal);
    }
  }
  throw lastError;
}

/** 可被取消的等待 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new UploadCanceledError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort);
  });
}

/** 调 abort 释放服务端会话：失败只记日志，用户已经决定放弃，不再打扰他 */
async function abortSession(uploadId: string): Promise<void> {
  const body: FileChunkSessionReqVO = { uploadId };
  try {
    await api.post<void>('/fileChunk/abort', body, { timeout: CHUNK_TIMEOUT });
  } catch (error) {
    console.warn('[fileChunk] abort 失败，交给服务端过期与对象存储生命周期兜底', error);
  }
}

function reportProgress(
  onProgress: ((percent: number) => void) | undefined,
  done: number,
  total: number,
): void {
  if (!onProgress || total <= 0) {
    return;
  }
  onProgress(Math.min(100, Math.round((done / total) * 100)));
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new UploadCanceledError();
  }
}
