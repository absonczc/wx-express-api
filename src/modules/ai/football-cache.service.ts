import { prisma } from "../../lib/prisma.js";

export async function getCachedPrediction(prompt: string): Promise<string | null> {
  const latestCache = await prisma.footballPredictionCache.findFirst({
    where: {
      prompt,
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