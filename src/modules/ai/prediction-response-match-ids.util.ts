/**
 * 足/篮预测：从用户 prompt 中按出现顺序解析 match_id，并把模型返回的 matches
 * 与请求对齐（match_id 强制为请求里的原样字符串；顺序与请求一致）。
 */

function idEquals(a: unknown, b: string): boolean {
  if (a === undefined || a === null) return false;
  const sa = String(a).trim();
  const sb = b.trim();
  if (sa === sb) return true;
  if (/^-?\d+$/.test(sa) && /^-?\d+$/.test(sb)) {
    try {
      return BigInt(sa) === BigInt(sb);
    } catch {
      return false;
    }
  }
  return false;
}

/** 从 prompt 中按行顺序提取 `（match_id=xxx）` / `(match_id=xxx)` 里的 xxx（原样，不改写） */
export function extractOrderedMatchIdsFromPredictionPrompt(prompt: string): string[] {
  const re = /[（(]\s*match_id\s*=\s*([^\s)）]+)\s*[)）]/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    const id = m[1]?.trim();
    if (id) out.push(id);
  }
  return out;
}

type PoolEntry = { row: Record<string, unknown>; idx: number };

function collectMatchRows(matches: unknown): PoolEntry[] {
  if (!Array.isArray(matches)) return [];
  const pool: PoolEntry[] = [];
  for (let idx = 0; idx < matches.length; idx++) {
    const row = matches[idx];
    if (row !== null && typeof row === "object" && !Array.isArray(row)) {
      pool.push({ row: row as Record<string, unknown>, idx });
    }
  }
  return pool;
}

/**
 * 将解析后的预测 JSON（含 `matches` 数组）与当前请求的 prompt 对齐。
 * - `matches` 顺序与 prompt 中 match_id 出现顺序一致
 * - 每条 `match_id` 使用 prompt 中的字符串（与请求参数一致）
 * - `n`、`title` 与输出顺序一致（比赛1、比赛2…）
 */
export function applyRequestMatchIdsToPredictionContent(content: unknown, prompt: string): unknown {
  const orderedIds = extractOrderedMatchIdsFromPredictionPrompt(prompt);
  if (orderedIds.length === 0) {
    return content;
  }
  if (content === null || typeof content !== "object" || Array.isArray(content)) {
    return content;
  }
  const root = content as Record<string, unknown>;
  const rawMatches = root.matches;
  if (!Array.isArray(rawMatches)) {
    return content;
  }

  const pool = collectMatchRows(rawMatches);
  const used = new Set<number>();
  const assignments: (Record<string, unknown> | null)[] = orderedIds.map(() => null);

  for (let i = 0; i < orderedIds.length; i++) {
    const requestId = orderedIds[i];
    const hit = pool.find((p) => !used.has(p.idx) && idEquals(p.row.match_id, requestId));
    if (hit) {
      used.add(hit.idx);
      assignments[i] = hit.row;
    }
  }

  const missingSlots: number[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    if (assignments[i] === null) missingSlots.push(i);
  }
  const remaining = pool.filter((p) => !used.has(p.idx)).sort((a, b) => a.idx - b.idx);

  if (remaining.length > 0 && remaining.length === missingSlots.length) {
    for (let k = 0; k < missingSlots.length; k++) {
      assignments[missingSlots[k]] = remaining[k].row;
      used.add(remaining[k].idx);
    }
  }

  const matchesOut: unknown[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const row = assignments[i];
    if (!row) continue;
    const requestId = orderedIds[i];
    matchesOut.push({
      ...row,
      match_id: requestId,
      n: matchesOut.length + 1,
      title: `比赛${matchesOut.length + 1}`,
    });
  }

  return {
    ...root,
    matches: matchesOut,
  };
}
