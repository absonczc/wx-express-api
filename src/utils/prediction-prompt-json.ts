import { kickoffUnixSecForPredictionMatch } from "./dongqiudi-start-play.js";

/**
 * 足/篮预测：从懂球帝 tab 原始体筛选「北京时间今天、明天、且未开赛」的场次，拼成模型 user 消息（JSON 数组字符串）。
 * 开赛时间：**仅** `start_play` / `startPlay`（懂球帝为 **UTC** 无时区字符串 → Unix 秒，再按北京时间筛今明、未开赛）；无有效字段则跳过该场。
 * 按开赛时间升序，**全部**纳入 prompt（无条数上限）。
 */

export type PredictionMatchPromptItem = {
  home: string;
  away: string;
  time: string;
  match_id: string;
};

function extractMatchList(data: unknown): unknown[] {
  if (!data || typeof data !== "object") return [];
  const dataObj = data as { list?: unknown[]; matches?: unknown[]; data?: unknown[] };
  if (Array.isArray(dataObj.list)) return dataObj.list;
  if (Array.isArray(dataObj.matches)) return dataObj.matches;
  if (Array.isArray(dataObj.data)) return dataObj.data;
  if (Array.isArray(dataObj)) return dataObj as unknown[];
  return [];
}

function todayYmdChina(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }).slice(0, 10);
}

function tomorrowYmdFromTodayYmd(todayYmd: string): string {
  const [y, m, d] = todayYmd.split("-").map(Number);
  const noon = new Date(
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T12:00:00+08:00`
  );
  const next = new Date(noon.getTime() + 86400000);
  return next.toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }).slice(0, 10);
}

function ymdChinaFromTsSec(tsSec: number): string {
  return new Date(tsSec * 1000).toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" }).slice(0, 10);
}

function isNotStarted(tsSec: number): boolean {
  return tsSec * 1000 > Date.now();
}

/** 北京时间 `YYYY-MM-DD HH:mm:ss`（与懂球帝 H5 展示一致） */
function formatShanghaiYmdHms(tsSec: number): string {
  return new Date(tsSec * 1000).toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function getHomeAway(item: Record<string, unknown>): { home: string; away: string } {
  const a = item.team_A_name;
  const b = item.team_B_name;
  const left = item.left_name;
  const right = item.right_name;
  return {
    home: (typeof a === "string" && a ? a : typeof left === "string" ? left : "") || "未知",
    away: (typeof b === "string" && b ? b : typeof right === "string" ? right : "") || "未知",
  };
}

function getMatchId(item: Record<string, unknown>, index: number): string {
  const mid = item.match_id ?? item.id;
  if (mid !== undefined && mid !== null && String(mid).trim() !== "") {
    return String(mid);
  }
  return String(index + 1);
}

function buildItemsFromList(matchList: unknown[]): PredictionMatchPromptItem[] {
  const rows: Array<{ ts: number; item: PredictionMatchPromptItem }> = [];
  const todayYmd = todayYmdChina();
  const tomorrowYmd = tomorrowYmdFromTodayYmd(todayYmd);

  for (let i = 0; i < matchList.length; i++) {
    const row = matchList[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const raw = row as Record<string, unknown>;
    const ts = kickoffUnixSecForPredictionMatch(raw);
    if (ts === null) continue;
    const ymd = ymdChinaFromTsSec(ts);
    if (ymd !== todayYmd && ymd !== tomorrowYmd) continue;
    if (!isNotStarted(ts)) continue;

    const { home, away } = getHomeAway(raw);
    rows.push({
      ts,
      item: {
        home,
        away,
        time: formatShanghaiYmdHms(ts),
        match_id: getMatchId(raw, i),
      },
    });
  }

  rows.sort((a, b) => a.ts - b.ts);
  return rows.map((r) => r.item);
}

/** 足球：懂球帝 `data/tab/new/soccer` 原始体 */
export function buildFootballPredictionJsonPrompt(footballData: unknown): string {
  const items = buildItemsFromList(extractMatchList(footballData));
  if (items.length === 0) return "";
  return JSON.stringify(items);
}

/** 篮球：懂球帝 `data/tab/new/basketball` 原始体 */
export function buildBasketballPredictionJsonPrompt(basketballData: unknown): string {
  const items = buildItemsFromList(extractMatchList(basketballData));
  if (items.length === 0) return "";
  return JSON.stringify(items);
}
