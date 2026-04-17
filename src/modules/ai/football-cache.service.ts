import { prisma } from "../../lib/prisma.js";

/** 足/篮预测共用：缓存命中有效期（毫秒）。为 0 时不使用缓存（每次调模型）。默认 1 小时。 */
function getPredictionCacheTtlMs(): number {
  const raw = process.env.PREDICTION_CACHE_TTL_MS;
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) {
      return n;
    }
  }
  return 60 * 60 * 1000;
}

export async function getCachedPrediction(prompt: string): Promise<string | null> {
  const ttlMs = getPredictionCacheTtlMs();
  if (ttlMs === 0) {
    return null;
  }
  const minCreatedAt = new Date(Date.now() - ttlMs);

  const latestCache = await prisma.footballPredictionCache.findFirst({
    where: {
      prompt,
      createdAt: { gte: minCreatedAt },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestCache) {
    return null;
  }

  return latestCache.result;
}

export async function cachePrediction(prompt: string, result: string): Promise<void> {
  await prisma.footballPredictionCache.create({
    data: {
      prompt,
      result,
    },
  });
}

export async function getCachedBasketballPrediction(prompt: string): Promise<string | null> {
  const ttlMs = getPredictionCacheTtlMs();
  if (ttlMs === 0) {
    return null;
  }
  const minCreatedAt = new Date(Date.now() - ttlMs);

  const latestCache = await prisma.basketballPredictionCache.findFirst({
    where: {
      prompt,
      createdAt: { gte: minCreatedAt },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!latestCache) {
    return null;
  }

  return latestCache.result;
}

export async function cacheBasketballPrediction(prompt: string, result: string): Promise<void> {
  await prisma.basketballPredictionCache.create({
    data: {
      prompt,
      result,
    },
  });
}
