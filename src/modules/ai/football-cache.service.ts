import { prisma } from "../../lib/prisma.js";

/** 按 prompt 取足球预测库中最新一条（HTTP 接口只读库，不区分 TTL） */
export async function getLatestFootballPredictionCache(prompt: string) {
  return prisma.footballPredictionCache.findFirst({
    where: { prompt },
    orderBy: { createdAt: "desc" },
  });
}

export async function cachePrediction(prompt: string, result: string): Promise<void> {
  await prisma.footballPredictionCache.create({
    data: {
      prompt,
      result,
    },
  });
}

/** 按 prompt 取篮球预测库中最新一条（HTTP 接口只读库，不区分 TTL） */
export async function getLatestBasketballPredictionCache(prompt: string) {
  return prisma.basketballPredictionCache.findFirst({
    where: { prompt },
    orderBy: { createdAt: "desc" },
  });
}

export async function cacheBasketballPrediction(prompt: string, result: string): Promise<void> {
  await prisma.basketballPredictionCache.create({
    data: {
      prompt,
      result,
    },
  });
}
