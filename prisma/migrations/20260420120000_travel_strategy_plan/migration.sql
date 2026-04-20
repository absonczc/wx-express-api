-- CreateTable
CREATE TABLE "TravelStrategyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TravelStrategyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TravelStrategyPlan_userId_idx" ON "TravelStrategyPlan"("userId");

-- CreateIndex
CREATE INDEX "TravelStrategyPlan_createdAt_idx" ON "TravelStrategyPlan"("createdAt");

-- AddForeignKey
ALTER TABLE "TravelStrategyPlan" ADD CONSTRAINT "TravelStrategyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
