/**
 * 立即执行一次与定时任务相同的足/篮预测预热（会调用 AI 并写库）。
 * 日志中会打印两次请求的 system + user 全文。
 */
import { disconnectPrisma } from "../src/lib/prisma.js";
import { runPredictionWarmupCycle } from "../src/modules/ai/prediction-scheduler.js";

void (async () => {
  try {
    await runPredictionWarmupCycle();
    await disconnectPrisma();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await disconnectPrisma().catch(() => {});
    process.exit(1);
  }
})();
