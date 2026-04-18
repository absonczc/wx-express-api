import path from "node:path";
import dotenv from "dotenv";
import { withPostgresSessionTimezone } from "../lib/postgres-url-timezone.js";

const rootDir = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(rootDir, ".env") });

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

/** 控制台「API Host」可为纯域名或带 https://；空字符串表示未配置 */
function normalizeQweatherApiHost(input: string): string {
  const t = input.trim();
  if (!t) {
    return "";
  }
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  return trimTrailingSlashes(withScheme);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  baseUrl: trimTrailingSlashes(process.env.BASE_URL?.trim() ?? `http://localhost:${Number(process.env.PORT ?? 3000)}`),
  /** 未在 `DATABASE_URL` 的 `options` 中指定 `TimeZone` 时，自动附加 `Asia/Shanghai` 会话时区 */
  databaseUrl: withPostgresSessionTimezone(required("DATABASE_URL")),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  wechatAppId: required("WECHAT_APPID"),
  wechatSecret: required("WECHAT_SECRET"),
  corsOrigin: process.env.CORS_ORIGIN?.trim() ?? "",
  /** Vector Engine（OpenAI 兼容），见 https://api.vectorengine.ai/pricing?keyword=gpt */
  vectorEngineApiKey: process.env.VECTOR_ENGINE_API_KEY?.trim() ?? "",
  vectorEngineBaseUrl: trimTrailingSlashes(
    process.env.VECTOR_ENGINE_BASE_URL?.trim() ?? "https://api.vectorengine.ai/v1"
  ),
  vectorEngineModel: process.env.VECTOR_ENGINE_MODEL?.trim() ?? "gpt-5.4-nano",
  /** 足球/篮球预测：未传 body `model` 时使用；默认 gpt-5.4（与通用 VECTOR_ENGINE_MODEL 可分离） */
  predictionVectorEngineModel: process.env.PREDICTION_VECTOR_ENGINE_MODEL?.trim() ?? "gpt-5.4-nano",
  /**
   * 预测预热调用 Vector Engine 的单次请求超时（毫秒）。赛程 JSON 很大、生成耗时长，默认 15 分钟；
   * 过短易出现 undici `TypeError: fetch failed`（底层超时/连接重置）。
   */
  predictionVectorEngineTimeoutMs: (() => {
    const raw = process.env.PREDICTION_VECTOR_ENGINE_TIMEOUT_MS?.trim();
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 30_000) {
        return Math.floor(n);
      }
    }
    return 15 * 60 * 1000;
  })(),
  /** 预测预热在 `fetch` 层失败时的重试次数（含首次），默认 3；仅对瞬时网络错误重试 */
  predictionVectorEngineFetchRetries: (() => {
    const raw = process.env.PREDICTION_VECTOR_ENGINE_FETCH_RETRIES?.trim();
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 1 && n <= 10) {
        return Math.floor(n);
      }
    }
    return 3;
  })(),
  /** 旅游攻略：未传 body `model` 时使用；默认 `qwen3.5-plus`（与控制台模型广场 ID 一致；定价页关键词 Qwen3.5-Plus：https://api.vectorengine.ai/pricing?keyword=Qwen3.5-Plus ） */
  travelGuideVectorEngineModel: process.env.TRAVEL_GUIDE_VECTOR_ENGINE_MODEL?.trim() ?? "qwen3.5-plus",
  /** 足/篮预测定时预热：默认开启；设为 `false` 时不启动定时任务 */
  predictionScheduleEnabled: process.env.PREDICTION_SCHEDULE_ENABLED?.trim() !== "false",
  /** 足/篮预测定时预热间隔（毫秒），默认 6 小时；最小 60 秒 */
  predictionScheduleIntervalMs: (() => {
    const raw = process.env.PREDICTION_SCHEDULE_INTERVAL_MS?.trim();
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 60_000) {
        return n;
      }
    }
    return 6 * 60 * 60 * 1000;
  })(),
  /** 和风天气 v7；Key 见控制台凭据，勿提交到仓库 */
  qweatherApiKey: process.env.QWEATHER_API_KEY?.trim() ?? "",
  qweatherApiHost: normalizeQweatherApiHost(process.env.QWEATHER_API_HOST ?? ""),
};

export function isProd(): boolean {
  return env.nodeEnv === "production";
}
