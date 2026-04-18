-- Prisma DateTime 写入约定为 UTC；原列为 TIMESTAMP(3) WITHOUT TIME ZONE，易产生歧义。
-- 改为 TIMESTAMPTZ(3)；旧 naive 值按 UTC 墙钟解释后转为带时区（与 Prisma 默认写入语义一致）。
ALTER TABLE "FootballPredictionCache"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING ("createdAt" AT TIME ZONE 'UTC');

ALTER TABLE "FootballPredictionCache"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING ("updatedAt" AT TIME ZONE 'UTC');

ALTER TABLE "BasketballPredictionCache"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING ("createdAt" AT TIME ZONE 'UTC');

ALTER TABLE "BasketballPredictionCache"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING ("updatedAt" AT TIME ZONE 'UTC');
