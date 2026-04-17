import path from "node:path";
import dotenv from "dotenv";

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
  databaseUrl: required("DATABASE_URL"),
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
  predictionVectorEngineModel: process.env.PREDICTION_VECTOR_ENGINE_MODEL?.trim() ?? "gpt-5.4",
  /** 旅游攻略：未传 body `model` 时使用；默认 gpt-5.4-nano */
  travelGuideVectorEngineModel: process.env.TRAVEL_GUIDE_VECTOR_ENGINE_MODEL?.trim() ?? "gpt-5.4-nano",
  /** 和风天气 v7；Key 见控制台凭据，勿提交到仓库 */
  qweatherApiKey: process.env.QWEATHER_API_KEY?.trim() ?? "",
  qweatherApiHost: normalizeQweatherApiHost(process.env.QWEATHER_API_HOST ?? ""),
};

export function isProd(): boolean {
  return env.nodeEnv === "production";
}
