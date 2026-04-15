import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import path from "path";
import { env, isProd } from "./config/env.js";
import { swaggerSpec } from "./config/swagger.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { requestLogger } from "./middleware/requestLogger.middleware.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  // 添加静态文件服务，用于访问上传的头像
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  const corsOrigins = env.corsOrigin
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) {
          cb(null, true);
          return;
        }
        if (!isProd()) {
          cb(null, true);
          return;
        }
        if (corsOrigins.length === 0) {
          cb(null, false);
          return;
        }
        if (corsOrigins.includes(origin)) {
          cb(null, true);
          return;
        }
        cb(null, false);
      },
      credentials: true,
    })
  );

  app.use("/api", apiRouter);

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use(errorMiddleware);

  return app;
}
