-- 超长 `prompt` 无法建 B-tree（54000）；用固定长度 MD5 hex 建索引，全文仍保留在 `prompt`
DROP INDEX IF EXISTS "FootballPredictionCache_prompt_idx";
DROP INDEX IF EXISTS "BasketballPredictionCache_prompt_idx";

ALTER TABLE "FootballPredictionCache" ADD COLUMN "promptHash" TEXT NOT NULL DEFAULT '';

UPDATE "FootballPredictionCache" SET "promptHash" = md5("prompt");

ALTER TABLE "FootballPredictionCache" ALTER COLUMN "promptHash" DROP DEFAULT;

CREATE INDEX "FootballPredictionCache_promptHash_idx" ON "FootballPredictionCache"("promptHash");

ALTER TABLE "BasketballPredictionCache" ADD COLUMN "promptHash" TEXT NOT NULL DEFAULT '';

UPDATE "BasketballPredictionCache" SET "promptHash" = md5("prompt");

ALTER TABLE "BasketballPredictionCache" ALTER COLUMN "promptHash" DROP DEFAULT;

CREATE INDEX "BasketballPredictionCache_promptHash_idx" ON "BasketballPredictionCache"("promptHash");
