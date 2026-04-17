import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { runBasketballPredictionWarmup, runFootballPredictionWarmup } from "./prediction-execute.service.js";

let intervalId: ReturnType<typeof setInterval> | undefined;

/** 与定时任务相同：先足球后篮球预热缓存；可单独用脚本触发 */
export async function runPredictionWarmupCycle(): Promise<void> {
  if (!env.vectorEngineApiKey) {
    logger.warn("Prediction warmup skipped: VECTOR_ENGINE_API_KEY is not set");
    return;
  }
  try {
    const wrote = await runFootballPredictionWarmup();
    if (wrote) {
      logger.info("Prediction warmup: football cache refreshed");
    }
  } catch (err) {
    logger.error("Prediction warmup: football failed", err);
  }
  try {
    const wrote = await runBasketballPredictionWarmup();
    if (wrote) {
      logger.info("Prediction warmup: basketball cache refreshed");
    }
  } catch (err) {
    logger.error("Prediction warmup: basketball failed", err);
  }
}

/** 启动后先跑一次，再按间隔重复（与 `PREDICTION_SCHEDULE_INTERVAL_MS` 一致，默认 6 小时） */
export function startPredictionSchedule(): void {
  if (!env.predictionScheduleEnabled) {
    logger.info("Prediction schedule disabled (PREDICTION_SCHEDULE_ENABLED=false)");
    return;
  }
  if (intervalId !== undefined) {
    return;
  }

  void runPredictionWarmupCycle();

  intervalId = setInterval(() => {
    void runPredictionWarmupCycle();
  }, env.predictionScheduleIntervalMs);

  logger.info(
    `Prediction schedule started: interval ${env.predictionScheduleIntervalMs}ms (football + basketball warmup)`
  );
}

export function stopPredictionSchedule(): void {
  if (intervalId !== undefined) {
    clearInterval(intervalId);
    intervalId = undefined;
    logger.info("Prediction schedule stopped");
  }
}
