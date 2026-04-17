import { createServer } from "node:http";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";
import { disconnectPrisma } from "./lib/prisma.js";
import { startPredictionSchedule, stopPredictionSchedule } from "./modules/ai/prediction-scheduler.js";

const app = createApp();
const server = createServer(app);

server.listen(env.port, () => {
  logger.info(`Server listening on http://localhost:${env.port}`);
  startPredictionSchedule();
});

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down...`);
  stopPredictionSchedule();
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await disconnectPrisma();
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    void shutdown(sig);
  });
}
