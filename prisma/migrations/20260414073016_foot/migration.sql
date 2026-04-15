-- CreateTable
CREATE TABLE "FootballPredictionCache" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FootballPredictionCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FootballPredictionCache_createdAt_idx" ON "FootballPredictionCache"("createdAt");
