import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { HttpError } from "../../middleware/error.middleware.js";
import {
  buildBasketballPredictionJsonPrompt,
  buildFootballPredictionJsonPrompt,
} from "../../utils/prediction-prompt-json.js";
import {
  fetchBasketballTab,
  formatBasketballTabStart,
} from "../basketball/basketball.service.js";
import { fetchFootballList, formatFootballTabStart } from "../football/football.service.js";
import {
  cacheBasketballPrediction,
  cachePrediction,
  getLatestBasketballPredictionCache,
  getLatestFootballPredictionCache,
} from "./football-cache.service.js";
import { BASKETBALL_PREDICTION_SYSTEM, FOOTBALL_PREDICTION_SYSTEM } from "./prediction-default-system.js";
import { applyRequestMatchIdsToPredictionContent } from "./prediction-response-match-ids.util.js";
import { vectorEngineChat } from "./vectorengine.service.js";

export type PredictionExecuteResult = {
  ok: true;
  /** 始终为 true：内容来自数据库中该 prompt 的最新一条 */
  cached: true;
  /** 本条缓存记录的写入时间（ISO 8601） */
  cacheCreatedAt: string;
  content: unknown;
};

export async function executeFootballPrediction(params: { body: unknown }): Promise<PredictionExecuteResult> {
  const { body } = params;
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Invalid JSON body");
  }

  let prompt = (body as { prompt?: unknown }).prompt;
  let promptStr = typeof prompt === "string" ? prompt.trim() : "";

  if (!promptStr) {
    const footballData = await fetchFootballList({ start: formatFootballTabStart() });
    promptStr = buildFootballPredictionJsonPrompt(footballData);
  }

  if (!promptStr) {
    throw new HttpError(400, "No football matches found for today and tomorrow (not started)");
  }

  logger.info(`Football prediction API: prompt length=${promptStr.length} chars`);
  logger.debug(`Football prediction API prompt:\n${promptStr}`);

  const row = await getLatestFootballPredictionCache(promptStr);
  if (!row) {
    throw new HttpError(
      404,
      "暂无足球预测缓存，请等待定时任务写入数据库后重试"
    );
  }

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(row.result);
  } catch {
    throw new HttpError(502, "数据库中的预测结果不是合法 JSON", {
      cacheId: row.id,
    });
  }

  return {
    ok: true,
    cached: true,
    cacheCreatedAt: row.createdAt.toISOString(),
    content: applyRequestMatchIdsToPredictionContent(parsedContent, promptStr),
  };
}

export async function executeBasketballPrediction(params: { body: unknown }): Promise<PredictionExecuteResult> {
  const { body } = params;
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Invalid JSON body");
  }

  let prompt = (body as { prompt?: unknown }).prompt;
  let promptStr = typeof prompt === "string" ? prompt.trim() : "";

  if (!promptStr) {
    const basketballData = await fetchBasketballTab({ start: formatBasketballTabStart() });
    promptStr = buildBasketballPredictionJsonPrompt(basketballData);
  }

  if (!promptStr) {
    throw new HttpError(400, "No basketball matches found for today and tomorrow (not started)");
  }

  const row = await getLatestBasketballPredictionCache(promptStr);
  if (!row) {
    throw new HttpError(
      404,
      "暂无篮球预测缓存，请等待定时任务写入数据库后重试"
    );
  }

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(row.result);
  } catch {
    throw new HttpError(502, "数据库中的预测结果不是合法 JSON", {
      cacheId: row.id,
    });
  }

  return {
    ok: true,
    cached: true,
    cacheCreatedAt: row.createdAt.toISOString(),
    content: applyRequestMatchIdsToPredictionContent(parsedContent, promptStr),
  };
}

/**
 * 定时任务：无 HTTP body，用默认赛程拉取与 system。
 * @returns 是否已向 `FootballPredictionCache` 写入新行（赛程筛出 0 场时直接跳过，不调模型）
 */
export async function runFootballPredictionWarmup(): Promise<boolean> {
  const footballData = await fetchFootballList({ start: formatFootballTabStart() });
  const promptStr = buildFootballPredictionJsonPrompt(footballData);
  if (!promptStr) {
    logger.info(
      "Prediction warmup football: skip write — no matches after filter (Beijing today/tomorrow, not started)"
    );
    return false;
  }
  const model = env.predictionVectorEngineModel;
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: FOOTBALL_PREDICTION_SYSTEM },
    { role: "user", content: promptStr },
  ];
  logger.debug(
    `[Prediction warmup football] model=${model}\n--- system ---\n${FOOTBALL_PREDICTION_SYSTEM}\n--- user ---\n${promptStr}`
  );
  const { content } = await vectorEngineChat({
    messages,
    model,
    timeoutMs: env.predictionVectorEngineTimeoutMs,
    networkRetries: env.predictionVectorEngineFetchRetries,
  });
  await cachePrediction(promptStr, content);
  return true;
}

/**
 * @returns 是否已向 `BasketballPredictionCache` 写入新行
 */
export async function runBasketballPredictionWarmup(): Promise<boolean> {
  const basketballData = await fetchBasketballTab({ start: formatBasketballTabStart() });
  const promptStr = buildBasketballPredictionJsonPrompt(basketballData);
  if (!promptStr) {
    logger.info(
      "Prediction warmup basketball: skip write — no matches after filter (Beijing today/tomorrow, not started)"
    );
    return false;
  }
  const model = env.predictionVectorEngineModel;
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: BASKETBALL_PREDICTION_SYSTEM },
    { role: "user", content: promptStr },
  ];
  logger.debug(
    `[Prediction warmup basketball] model=${model}\n--- system ---\n${BASKETBALL_PREDICTION_SYSTEM}\n--- user ---\n${promptStr}`
  );
  const { content } = await vectorEngineChat({
    messages,
    model,
    timeoutMs: env.predictionVectorEngineTimeoutMs,
    networkRetries: env.predictionVectorEngineFetchRetries,
  });
  await cacheBasketballPrediction(promptStr, content);
  return true;
}
