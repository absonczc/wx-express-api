import { logger } from "../../lib/logger.js";

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

/** 懂球帝 tab `start` 参数格式：`YYYY-MM-DDHH:mm:ss`（日与小时之间无分隔） */
export function formatBasketballTabStart(d = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${mo}-${day}${h}:${mi}:${s}`;
}

interface BasketballTabListItem {
  match_id?: string | number;
  team_A_name?: string;
  team_B_name?: string;
  competition_name?: string;
  start_play?: string;
  sort_timestamp?: number;
  [key: string]: unknown;
}

function parseUtcStartPlayToChinaTime(dateStr: string): string {
  if (!dateStr) return "";

  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return dateStr;

  const [, year, month, day, hour, minute, second] = m;
  const utcDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second))
  );

  return utcDate.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
}

function isTodayOrTomorrow(timestampSec: number): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const matchDate = new Date(timestampSec * 1000);

  return matchDate >= today && matchDate < tomorrow && matchDate.getHours() >= 0 && matchDate.getHours() < 24;
}

function getListItemTimestampSec(item: BasketballTabListItem): number | null {
  if (typeof item.sort_timestamp === "number" && item.sort_timestamp > 0) {
    return item.sort_timestamp;
  }
  if (item.start_play) {
    const match = item.start_play.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return Math.floor(
        Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) / 1000
      );
    }
  }
  return null;
}

function formatBasketballPromptLine(item: BasketballTabListItem, displayIndex: number): string {
  const mid = item.match_id != null ? String(item.match_id) : String(displayIndex);
  const left = item.team_A_name ?? "未知球队";
  const right = item.team_B_name ?? "未知球队";
  const league = item.competition_name ?? "未知联赛";
  let matchTime = "未知时间";
  if (item.start_play) {
    matchTime = parseUtcStartPlayToChinaTime(item.start_play);
  } else if (typeof item.sort_timestamp === "number" && item.sort_timestamp > 0) {
    matchTime = new Date(item.sort_timestamp * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  }

  return `比赛${displayIndex}（match_id=${mid}）：\n${left} vs ${right}｜${league}｜${matchTime}`;
}

/** 从懂球帝篮球 tab 原始体中筛出「今日」场次并拼成模型用户消息（与足球预测接口输入格式一致） */
export function buildTodayTomorrowBasketballPrompt(basketballData: unknown): string {
  if (!basketballData || typeof basketballData !== "object") {
    return "";
  }

  const dataObj = basketballData as { list?: unknown[]; matches?: unknown[]; data?: unknown[] };

  let matchList: unknown[] = [];
  if (Array.isArray(dataObj.list)) {
    matchList = dataObj.list;
  } else if (Array.isArray(dataObj.matches)) {
    matchList = dataObj.matches;
  } else if (Array.isArray(dataObj.data)) {
    matchList = dataObj.data;
  } else if (Array.isArray(dataObj)) {
    matchList = dataObj as unknown[];
  }

  const todayMatches = matchList.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const item = row as BasketballTabListItem;
    const ts = getListItemTimestampSec(item);
    if (ts === null) return false;
    return isTodayOrTomorrow(ts);
  });

  if (todayMatches.length === 0) {
    return "";
  }

  return todayMatches
    .map((row, index) => formatBasketballPromptLine(row as BasketballTabListItem, index + 1))
    .join("\n\n");
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
