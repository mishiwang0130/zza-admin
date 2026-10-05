import SparkMD5 from 'spark-md5';

/**
 * 文件 MD5 计算 worker。
 *
 * <p>放在 worker 里是为了不阻塞主线程：200MB 的文件在主线程上一次性读成 ArrayBuffer 再算，
 * 页面会卡死几十秒。这里按固定大小的切片增量读、增量喂，主线程全程只收百分比。
 *
 * <p>协议：入参 {@link Md5WorkerRequest}，出参 {@link Md5WorkerResponse}。
 */

/** 每次读入的切片大小：太大占内存、太小读盘次数多，2MiB 是常用折中 */
const DEFAULT_SLICE_SIZE = 2 * 1024 * 1024;

export interface Md5WorkerRequest {
  /** 待计算的文件（File 可结构化克隆，worker 内再自己切片） */
  file: File;
  /** 切片大小（字节），可不传 */
  sliceSize?: number;
}

export type Md5WorkerResponse =
  | { type: 'progress'; percent: number }
  | { type: 'done'; md5: string }
  | { type: 'error'; message: string };

self.onmessage = async (event: MessageEvent<Md5WorkerRequest>): Promise<void> => {
  const { file, sliceSize = DEFAULT_SLICE_SIZE } = event.data;
  const spark = new SparkMD5.ArrayBuffer();
  try {
    let offset = 0;
    while (offset < file.size) {
      const end = Math.min(offset + sliceSize, file.size);
      spark.append(await file.slice(offset, end).arrayBuffer());
      offset = end;
      const percent = file.size ? Math.round((offset / file.size) * 100) : 100;
      postMessage({ type: 'progress', percent } satisfies Md5WorkerResponse);
    }
    postMessage({ type: 'done', md5: spark.end() } satisfies Md5WorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : '计算文件校验值失败';
    postMessage({ type: 'error', message } satisfies Md5WorkerResponse);
  }
};
