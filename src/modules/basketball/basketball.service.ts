import { logger } from "../../lib/logger.js";
import { dongqiudiTabStartFromNextDate } from "../../utils/dongqiudi-tab-next-start.js";

const DONGQIUDI_BASKETBALL_TAB_URL = "https://api.dongqiudi.com/data/tab/new/basketball";
const DONGQIUDI_MATCH_SITUATION_URL = "https://api.dongqiudi.com/mobile/match/situation";
const DONGQIUDI_PRE_ANALYZE_CONTRAST_URL =
  "https://sport-data.dongqiudi.com/soccer/biz/dqd/match/pre_analyze_data_contrast";

export interface DongqiudiBasketballParams {
  start: string;
  version?: number;
  init?: number;
  wfrom?: number;
  from?: string;
}

/** 懂球帝篮球 tab 接口原始 JSON（字段随上游变化，此处保持宽松） */
export interface DongqiudiBasketballTabResponse {
  list?: unknown[];
  prevDate?: string;
  nextDate?: string;
  finishFlag?: string;
  [key: string]: unknown;
}

const BASKETBALL_TAB_HEADERS: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  "accept-language": "zh-CN,zh;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
  origin: "https://m.dongqiudi.com",
  referer: "https://m.dongqiudi.com/",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
};

export async function fetchBasketballTab(
  params: DongqiudiBasketballParams
): Promise<DongqiudiBasketballTabResponse> {
  const queryParams = new URLSearchParams({
    start: params.start,
    version: String(params.version ?? 576),
    init: String(params.init ?? 1),
    wfrom: String(params.wfrom ?? 2),
    from: params.from ?? "msite_com",
  });

  const url = `${DONGQIUDI_BASKETBALL_TAB_URL}?${queryParams.toString()}`;
  logger.info(`Fetching basketball tab from dongqiudi: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: BASKETBALL_TAB_HEADERS,
  });

  if (!response.ok && response.status !== 304) {
    logger.error(`Dongqiudi basketball API error: ${response.status} ${response.statusText}`);
    throw new Error(`Dongqiudi basketball API error: ${response.status} ${response.statusText}`);
  }

  if (response.status === 304) {
    return { list: [], prevDate: undefined, nextDate: undefined, finishFlag: undefined };
  }

  const data: DongqiudiBasketballTabResponse = await response.json();
  logger.info("Successfully fetched basketball tab");
  return data;
}

/** 预测预热：合并多页篮球 tab */
const BASKETBALL_PREDICTION_TAB_MAX_PAGES = 6;

export async function fetchBasketballTabForPrediction(): Promise<DongqiudiBasketballTabResponse> {
  const merged: unknown[] = [];
  const seen = new Set<string>();
  let start = formatBasketballTabStart();

  for (let page = 0; page < BASKETBALL_PREDICTION_TAB_MAX_PAGES; page++) {
    const res = await fetchBasketballTab({ start });
    const batch = Array.isArray(res.list) ? res.list : [];
    for (const row of batch) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const rec = row as Record<string, unknown>;
      const rt = rec.relate_type;
      if (rt !== undefined && rt !== null && rt !== "" && rt !== "match") continue;
      const id = String(rec.match_id ?? rec.relate_id ?? "").trim();
      const key = id || `idx:${merged.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(row);
    }
    const nextStart = dongqiudiTabStartFromNextDate(res.nextDate);
    if (!nextStart || nextStart === start) break;
    start = nextStart;
  }

  logger.info(`Basketball prediction tab merged: ${merged.length} matches (up to ${BASKETBALL_PREDICTION_TAB_MAX_PAGES} pages)`);
  return { list: merged };
}

/** 与 H5 一致，用于比赛态势、赛前数据对比等移动端接口 */
const BASKETBALL_MATCH_MOBILE_HEADERS: Record<string, string> = {
  ...BASKETBALL_TAB_HEADERS,
  "content-type": "application/json",
  priority: "u=1, i",
  "sec-ch-ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"iOS"',
};

export interface BasketballMatchDetailPayload {
  situation: unknown;
  preAnalyzeContrast: unknown;
}

async function fetchJsonOrThrow(url: string, label: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: BASKETBALL_MATCH_MOBILE_HEADERS,
  });

  if (!response.ok) {
    logger.error(`Dongqiudi ${label} error: ${response.status} ${response.statusText} (${url})`);
    throw new Error(`Dongqiudi ${label} error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<unknown>;
}

/**
 * 懂球帝 tab `start` 参数格式：`YYYY-MM-DDHH:mm:ss`（日与小时之间无分隔）。
 * 使用 **Asia/Shanghai** 墙钟，与 `buildBasketballPredictionJsonPrompt` 中「今明两天」筛选一致。
 */
export function formatBasketballTabStart(d = new Date()): string {
  const s = d.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
  return `${s.slice(0, 10)}${s.slice(11, 19)}`;
}

/**
 * 聚合篮球（懂球帝）单场比赛详情：赛场态势 + 赛前分析数据对比。
 * 上游与足球详情部分接口同源，按比赛 ID 拉取原始 JSON。
 */
export async function fetchBasketballMatchDetail(matchId: string): Promise<BasketballMatchDetailPayload> {
  const situationUrl = `${DONGQIUDI_MATCH_SITUATION_URL}/${matchId}`;
  const contrastUrl = `${DONGQIUDI_PRE_ANALYZE_CONTRAST_URL}/${matchId}?app=dqd`;

  logger.info(`Fetching basketball match detail: ${matchId}`);

  const [situation, preAnalyzeContrast] = await Promise.all([
    fetchJsonOrThrow(situationUrl, "match situation"),
    fetchJsonOrThrow(contrastUrl, "pre analyze data contrast"),
  ]);

  logger.info(`Successfully fetched basketball match detail: ${matchId}`);
  return { situation, preAnalyzeContrast };
}
