import { predictionPromptCacheHash } from "../../lib/prediction-prompt-hash.js";
import { prisma } from "../../lib/prisma.js";

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

/** 足球预测缓存：整张表按 `createdAt` 最新一条（HTTP 只读库） */
export async function getLatestFootballPredictionCache() {
  return prisma.footballPredictionCache.findFirst({
    orderBy: { createdAt: "desc" },
  });
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

/** 篮球预测缓存：整张表按 `createdAt` 最新一条（HTTP 只读库） */
export async function getLatestBasketballPredictionCache() {
  return prisma.basketballPredictionCache.findFirst({
    orderBy: { createdAt: "desc" },
  });
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
