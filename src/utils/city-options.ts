import { listAreaTree } from '@/api/area';
import type { AreaVO } from '@/types/api';

/**
 * 知识库城市标签选项：与小程序端「选择城市」的取值口径完全一致。
 *
 * <p>小程序提问时把城市选择器里选中的城市名原样传给后端（如「深圳市」「杭州市」，
 * 直辖市用省名「北京市」），后端 RAG 按「选中城市 + 通用」在向量库 metadata.city 上精确匹配。
 * 所以管理端上传文档时手填城市风险很大：填「深圳」或多一个空格这类对不上的写法，
 * 文档会被静默过滤掉、永远召不回来。这里改成从同一棵 infra 区划树推导可选项，只让运营选、不让运营写。
 */

/** 平台级通用文档的城市标签：与后端 {@code zza.ai-agent.rag.common-city} 保持一致 */
export const COMMON_CITY = '通用';

/** 直辖市 / 特殊省下的占位市名：与小程序端 baseData 的口径一致，展示时用省名替代 */
const PLACEHOLDER_CITY_NAMES = ['市辖区', '县', '省直辖县级行政区划', '自治区直辖县级行政区划'];

/** 城市标签缓存：区划树是只读基础数据，多个下拉共用一次请求 */
let cachedLabels: string[] | null = null;

/** 进行中的区划树请求：并发调用只发一次 */
let pendingRequest: Promise<string[]> | null = null;

/**
 * 从区划树里抽出能当「城市」用的节点名称
 *
 * <p>口径与小程序端 {@code baseData.cities} 一致：子级是区县（level 3）的节点才算城市，
 * 普通地级市满足，直辖市的「市辖区」「县」这类占位节点也满足但要用省名展示（北京 → 北京市）；
 * 省级节点下的非市节点不会混进来。
 *
 * @param tree 省市区三级树
 */
function extractCityLabels(tree: AreaVO[]): string[] {
  const labels = new Set<string>();
  for (const province of tree ?? []) {
    for (const city of province.children ?? []) {
      const hasDistrict = (city.children ?? []).some((node) => node.level === 3);
      if (!hasDistrict) {
        continue;
      }
      const label = PLACEHOLDER_CITY_NAMES.includes(city.name) ? province.name : city.name;
      if (label) {
        labels.add(label);
      }
    }
  }
  return Array.from(labels);
}

/**
 * 拉取城市标签下拉选项
 *
 * <p>模块级缓存：重复调用只请求一次区划树；失败不缓存，下一次调用会重新拉。
 *
 * @returns 城市名列表，顺序与区划树一致
 */
export function listCityLabels(): Promise<string[]> {
  if (cachedLabels) {
    return Promise.resolve(cachedLabels);
  }
  if (!pendingRequest) {
    pendingRequest = listAreaTree()
      .then((tree) => {
        cachedLabels = extractCityLabels(tree);
        return cachedLabels;
      })
      .finally(() => {
        pendingRequest = null;
      });
  }
  return pendingRequest;
}
