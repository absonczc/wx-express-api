/**
 * 懂球帝 tab 响应里的 `nextDate` 常为 `YYYY-MM-DD HH:mm:ssnext`（末尾多 `next`），
 * 转成请求参数 `start` 所需的 **`YYYY-MM-DDHH:mm:ss`**（日与小时之间无空格）。
 */
export function dongqiudiTabStartFromNextDate(nextDate: unknown): string | null {
  if (typeof nextDate !== "string") return null;
  const base = nextDate.trim().replace(/next$/i, "").trim();
  if (!base) return null;
  const m = base.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (m) return `${m[1]}${m[2]}`;
  if (/^\d{4}-\d{2}-\d{2}\d{2}:\d{2}:\d{2}$/.test(base)) return base;
  return null;
}
