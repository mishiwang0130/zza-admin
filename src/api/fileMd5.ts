import type { Md5WorkerRequest, Md5WorkerResponse } from '@/api/fileMd5.worker';

/**
 * 大文件 MD5（Web Worker 增量计算 + 本地缓存）。
 *
 * <p>这个 MD5 只用来让后端定位「同一条续传会话」，不做秒传去重。算一次 200MB 要几秒，
 * 所以按「文件名 + 大小 + 修改时间」缓存结果：用户重选同一个文件时直接命中，不再重算。
 */

/** 缓存存放位置：localStorage 让用户关掉标签页、重开页面后重选同一文件仍能命中 */
const CACHE_KEY = 'zza-admin:file-md5-cache';

/** 缓存条数上限：按最近使用保留，避免长期使用后无限增长 */
const CACHE_MAX_ENTRIES = 20;

/** 缓存有效期：超过就重算，避免文件被替换后拿旧 MD5 去命中错误的会话 */
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

interface Md5CacheEntry {
  /** 缓存 key：文件名 + 大小 + 修改时间 */
  key: string;
  md5: string;
  /** 写入时间（毫秒时间戳） */
  time: number;
}

/** 拼缓存 key：同一路径下的同名文件用大小与修改时间区分不同版本 */
function cacheKeyOf(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

function readCache(): Md5CacheEntry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Md5CacheEntry[]) : [];
  } catch {
    // 缓存损坏或 localStorage 不可用都不影响功能，当作没有缓存
    return [];
  }
}

/** 读缓存：命中的条目顺带提到最前面（最近使用优先） */
function readCachedMd5(file: File): string {
  const key = cacheKeyOf(file);
  const entries = readCache();
  const hit = entries.find((item) => item?.key === key);
  if (!hit || Date.now() - hit.time > CACHE_TTL) {
    return '';
  }
  writeCache([hit, ...entries.filter((item) => item?.key !== key)]);
  return hit.md5;
}

function writeCache(entries: Md5CacheEntry[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries.slice(0, CACHE_MAX_ENTRIES)));
  } catch {
    // 写不进去（隐私模式、配额满）只是少一次优化，不影响上传
  }
}

function saveCachedMd5(file: File, md5: string): void {
  const key = cacheKeyOf(file);
  const entries = readCache().filter((item) => item?.key !== key);
  writeCache([{ key, md5, time: Date.now() }, ...entries]);
}

/**
 * 计算文件 MD5（32 位小写十六进制）
 *
 * @param file 待计算文件
 * @param signal 取消信号：用户取消上传时立刻终止 worker，不再空转
 */
export function computeFileMd5(file: File, signal?: AbortSignal): Promise<string> {
  const cached = readCachedMd5(file);
  if (cached) {
    return Promise.resolve(cached);
  }
  if (signal?.aborted) {
    return Promise.reject(new DOMException('上传已取消', 'AbortError'));
  }

  return new Promise<string>((resolve, reject) => {
    const worker = new Worker(new URL('./fileMd5.worker.ts', import.meta.url), { type: 'module' });
    let settled = false;

    /** 收尾：无论是成功、失败还是取消，都必须终止 worker，否则它会继续跑完整个文件 */
    const finish = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener('abort', handleAbort);
      worker.terminate();
      callback();
    };

    function handleAbort(): void {
      finish(() => reject(new DOMException('上传已取消', 'AbortError')));
    }

    signal?.addEventListener('abort', handleAbort);

    worker.onmessage = (event: MessageEvent<Md5WorkerResponse>) => {
      const message = event.data;
      if (message.type === 'done') {
        finish(() => {
          saveCachedMd5(file, message.md5);
          resolve(message.md5);
        });
      } else if (message.type === 'error') {
        finish(() => reject(new Error(message.message)));
      }
    };
    worker.onerror = () => finish(() => reject(new Error('计算文件校验值失败')));

    const request: Md5WorkerRequest = { file };
    worker.postMessage(request);
  });
}
