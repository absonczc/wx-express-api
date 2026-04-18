/**
 * 懂球帝 tab 的 `start_play`：无时区后缀的 `YYYY-MM-DD HH:mm:ss` 按 **UTC 墙钟** 解析（与上游一致），
 * 再经 `Asia/Shanghai` 得到北京时间用于展示与「今明两天」日历筛选。
 * 预测筛选用 `kickoffUnixSecForPredictionMatch`（仅 `start_play` / `startPlay`）。
 * `parseUnknownEpochToUnixSec` 供列表等在仅有数值时间戳时使用。
 */

/** 数值 ≥ 该阈值视为毫秒 Unix，否则视为秒 */
const EPOCH_MS_MIN = 1_000_000_000_000;

function pad2(n: string): string {
  return n.length >= 2 ? n : `0${n}`;
}

/** 将年月日时分秒按 **UTC** 组成瞬间（与 `Date.UTC` 语义一致） */
function wallPartsToUnixSecUtc(
  y: string,
  mo: string,
  d: string,
  h: string,
  mi: string,
  sec: string
): number | null {
  const ms = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(sec)
  );
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * 懂球帝 tab `start_play` → Unix 秒。字符串分量为 **UTC**（无时区后缀），非东八区墙钟。
 * 支持 ` ` 或 `T` 分隔；秒可省略（按 00）；`/` 可写作 `-`。
 */
export function dongqiudiTabStartPlayToUnixSec(startPlay: string): number | null {
  const s = startPlay.trim().replace(/\//g, "-").replace(/\s+/g, " ");

  const withSec = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (withSec) {
    const [, y, mo, d, h, mi, sec] = withSec;
    return wallPartsToUnixSecUtc(y, mo, d, h, mi, sec);
  }
  const noSec = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})$/);
  if (noSec) {
    const [, y, mo, d, h, mi] = noSec;
    return wallPartsToUnixSecUtc(y, mo, d, h, mi, "0");
  }
  return null;
}

export function epochNumberToUnixSec(n: number): number | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= EPOCH_MS_MIN) return Math.floor(n / 1000);
  return Math.floor(n);
}

export function parseUnknownEpochToUnixSec(v: unknown): number | null {
  if (typeof v === "number") return epochNumberToUnixSec(v);
  if (typeof v === "string" && /^\d+$/.test(v.trim())) {
    return epochNumberToUnixSec(Number(v.trim()));
  }
  return null;
}

/**
 * 预测筛选用：**只**认 `start_play` / `startPlay`（UTC 无时区字符串 → Unix 秒），
 * 再与北京时间今明、`Date.now()` 比较未开赛；解析失败或缺字段则返回 null。
 */
export function kickoffUnixSecForPredictionMatch(raw: Record<string, unknown>): number | null {
  const sp = raw.start_play ?? raw.startPlay;
  if (typeof sp !== "string" || !sp.trim()) return null;
  return dongqiudiTabStartPlayToUnixSec(sp);
}
