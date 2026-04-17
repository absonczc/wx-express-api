-- CreateIndex (prompt 条件查询，与 schema 中 FootballPredictionCache @@index([prompt]) 一致)
CREATE INDEX "FootballPredictionCache_prompt_idx" ON "FootballPredictionCache"("prompt");

-- CreateTable
CREATE TABLE "BasketballPredictionCache" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BasketballPredictionCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BasketballPredictionCache_prompt_idx" ON "BasketballPredictionCache"("prompt");

-- CreateIndex
CREATE INDEX "BasketballPredictionCache_createdAt_idx" ON "BasketballPredictionCache"("createdAt");
