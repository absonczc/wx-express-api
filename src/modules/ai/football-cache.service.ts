import { predictionPromptCacheHash } from "../../lib/prediction-prompt-hash.js";
import { prisma } from "../../lib/prisma.js";
import {
  extractOrderedMatchIdsFromPredictionPrompt,
  idEquals,
} from "./prediction-response-match-ids.util.js";

/** 与定时任务写入时间差过大时不做模糊匹配，避免误命中旧比赛 */
const PREDICTION_CACHE_LOOKBACK_MS = 48 * 3600 * 1000;
const PREDICTION_CACHE_CANDIDATE_LIMIT = 100;

/** 总行数超过该值时触发裁剪，仅保留按 `createdAt` 最新的若干条（与读缓存「取最新」一致） */
const PREDICTION_CACHE_TOTAL_PRUNE_THRESHOLD = 100;
const PREDICTION_CACHE_TOTAL_PRUNE_KEEP = 20;

async function pruneFootballPredictionCacheIfOverThreshold(): Promise<void> {
  const total = await prisma.footballPredictionCache.count();
  if (total <= PREDICTION_CACHE_TOTAL_PRUNE_THRESHOLD) return;
  const deleteCount = total - PREDICTION_CACHE_TOTAL_PRUNE_KEEP;
  const victims = await prisma.footballPredictionCache.findMany({
    orderBy: { createdAt: "asc" },
    take: deleteCount,
    select: { id: true },
  });
  if (victims.length === 0) return;
  await prisma.footballPredictionCache.deleteMany({
    where: { id: { in: victims.map((v) => v.id) } },
  });
}

async function pruneBasketballPredictionCacheIfOverThreshold(): Promise<void> {
  const total = await prisma.basketballPredictionCache.count();
  if (total <= PREDICTION_CACHE_TOTAL_PRUNE_THRESHOLD) return;
  const deleteCount = total - PREDICTION_CACHE_TOTAL_PRUNE_KEEP;
  const victims = await prisma.basketballPredictionCache.findMany({
    orderBy: { createdAt: "asc" },
    take: deleteCount,
    select: { id: true },
  });
  if (victims.length === 0) return;
  await prisma.basketballPredictionCache.deleteMany({
    where: { id: { in: victims.map((v) => v.id) } },
  });
}

type PredictionCacheRow = {
  id: string;
  prompt: string;
  promptHash: string;
  result: string;
  createdAt: Date;
};

function sortedMatchIdMultisetKey(ids: string[]): string {
  return [...ids]
    .map((id) => String(id).trim())
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .join("\u0001");
}

/** 当前请求的 match_id 序列与缓存中前若干场一致（常见于尾部场次已开赛，prompt 变短） */
function requestIdsAreOrderedPrefixOfCache(requestIds: string[], cacheIds: string[]): boolean {
  if (requestIds.length === 0 || cacheIds.length < requestIds.length) return false;
  for (let i = 0; i < requestIds.length; i++) {
    if (!idEquals(requestIds[i], cacheIds[i])) return false;
  }
  return true;
}

function sameMatchIdMultiset(requestIds: string[], cacheIds: string[]): boolean {
  if (requestIds.length !== cacheIds.length || requestIds.length === 0) return false;
  return sortedMatchIdMultisetKey(requestIds) === sortedMatchIdMultisetKey(cacheIds);
}

/**
 * 先按 prompt 全文精确匹配；若无记录，则在近期写入的缓存中按 match_id 兼容匹配：
 * 1) 请求中的 id 序列为某条缓存 prompt 的有序前缀（赛程变短）；
 * 2) 与某条缓存的 match_id 多重集相同（顺序差异等）。
 */
async function findLatestCompatiblePredictionCache(
  prompt: string,
  findExact: () => Promise<PredictionCacheRow | null>,
  findRecentCandidates: (since: Date, take: number) => Promise<PredictionCacheRow[]>
): Promise<PredictionCacheRow | null> {
  const exact = await findExact();
  if (exact) return exact;

  const requestIds = extractOrderedMatchIdsFromPredictionPrompt(prompt);
  if (requestIds.length === 0) return null;

  const since = new Date(Date.now() - PREDICTION_CACHE_LOOKBACK_MS);
  const candidates = await findRecentCandidates(since, PREDICTION_CACHE_CANDIDATE_LIMIT);

  for (const row of candidates) {
    const cacheIds = extractOrderedMatchIdsFromPredictionPrompt(row.prompt);
    if (cacheIds.length === 0) continue;
    if (requestIdsAreOrderedPrefixOfCache(requestIds, cacheIds)) return row;
  }
  for (const row of candidates) {
    const cacheIds = extractOrderedMatchIdsFromPredictionPrompt(row.prompt);
    if (sameMatchIdMultiset(requestIds, cacheIds)) return row;
  }
  return null;
}

/** 按 prompt 取足球预测库中最新一条（HTTP 接口只读库，不区分 TTL） */
export async function getLatestFootballPredictionCache(prompt: string) {
  const hash = predictionPromptCacheHash(prompt);
  return findLatestCompatiblePredictionCache(
    prompt,
    () =>
      prisma.footballPredictionCache.findFirst({
        where: { promptHash: hash, prompt },
        orderBy: { createdAt: "desc" },
      }),
    (since, take) =>
      prisma.footballPredictionCache.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take,
      })
  );
}

export async function cachePrediction(prompt: string, result: string): Promise<void> {
  await prisma.footballPredictionCache.create({
    data: {
      prompt,
      promptHash: predictionPromptCacheHash(prompt),
      result,
    },
  });
  await pruneFootballPredictionCacheIfOverThreshold();
}

/** 按 prompt 取篮球预测库中最新一条（HTTP 接口只读库，不区分 TTL） */
export async function getLatestBasketballPredictionCache(prompt: string) {
  const hash = predictionPromptCacheHash(prompt);
  return findLatestCompatiblePredictionCache(
    prompt,
    () =>
      prisma.basketballPredictionCache.findFirst({
        where: { promptHash: hash, prompt },
        orderBy: { createdAt: "desc" },
      }),
    (since, take) =>
      prisma.basketballPredictionCache.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take,
      })
  );
}

export async function cacheBasketballPrediction(prompt: string, result: string): Promise<void> {
  await prisma.basketballPredictionCache.create({
    data: {
      prompt,
      promptHash: predictionPromptCacheHash(prompt),
      result,
    },
  });
  await pruneBasketballPredictionCacheIfOverThreshold();
}
