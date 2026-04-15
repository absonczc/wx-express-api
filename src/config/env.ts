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
  /** Vector Engine（OpenAI 兼容），见 https://api.vectorengine.ai/pricing */
  vectorEngineApiKey: process.env.VECTOR_ENGINE_API_KEY?.trim() ?? "",
  vectorEngineBaseUrl: trimTrailingSlashes(
    process.env.VECTOR_ENGINE_BASE_URL?.trim() ?? "https://api.vectorengine.ai/v1"
  ),
  vectorEngineModel: process.env.VECTOR_ENGINE_MODEL?.trim() ?? "gpt-5.4-nano",
};

export function isProd(): boolean {
  return env.nodeEnv === "production";
}
