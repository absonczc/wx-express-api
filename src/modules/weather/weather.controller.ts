import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { HttpError } from "../../middleware/error.middleware.js";
import {
  fetchQWeatherDaily,
  fetchQWeatherAlert,
  fetchQWeatherNow,
  resolveQWeatherLocationByName,
  type QWeatherForecastDays,
} from "./weather.service.js";

const LOCATION_MAX = 64;
const FORECAST_DAYS_SET: ReadonlySet<string> = new Set(["3d", "7d", "10d", "15d", "30d"]);

function parseUnit(raw: unknown): "m" | "i" | undefined {
  if (raw === "m" || raw === "i") {
    return raw;
  }
  return undefined;
}

function parseForecastDays(raw: unknown): QWeatherForecastDays {
  if (typeof raw !== "string" || !FORECAST_DAYS_SET.has(raw)) {
    return "3d";
  }
  return raw as QWeatherForecastDays;
}

function extractLocationName(raw: unknown): string {
  const locationName = typeof raw === "string" ? raw.trim() : "";
  if (!locationName || locationName.length > LOCATION_MAX) {
    throw new HttpError(
      400,
      `缺少或非法的查询参数 location（须为地区名称非空字符串，最长 ${LOCATION_MAX}；示例：北京、上海）`
    );
  }
  return locationName;
}

function mapQweatherError(e: unknown): never {
  const withBody = e as {
    qweatherBody?: {
      code?: string;
      error?: { type?: string; title?: string; detail?: string };
    };
  };
  const invalidHostType = "https://dev.qweather.com/docs/resource/error-code/#invalid-host";
  if (withBody.qweatherBody?.error?.type === invalidHostType) {
    throw new HttpError(
      502,
      "和风天气拒绝了当前 API Host：请在 .env 配置 QWEATHER_API_HOST 为你控制台 Settings 中的专属域名",
      withBody.qweatherBody
    );
  }
  if (withBody.qweatherBody?.code !== undefined) {
    const c = String(withBody.qweatherBody.code);
    if (c === "400" || c === "404") {
      throw new HttpError(400, "和风天气拒绝该查询（请检查 location 等参数）", withBody.qweatherBody);
    }
    throw new HttpError(502, `和风天气返回错误码 ${c}`, withBody.qweatherBody);
  }
  const msg = e instanceof Error ? e.message : "Unknown error";
  throw new HttpError(502, `请求和风天气失败：${msg}`);
}

export async function getWeatherNow(req: Request, res: Response): Promise<void> {
  if (!env.qweatherApiKey) {
    throw new HttpError(503, "和风天气未配置：请在环境变量中设置 QWEATHER_API_KEY");
  }
  if (!env.qweatherApiHost) {
    throw new HttpError(503, "和风天气未配置：请在环境变量中设置 QWEATHER_API_HOST（控制台专属域名）");
  }

  const lang = typeof req.query.lang === "string" && req.query.lang.trim() ? req.query.lang.trim() : undefined;
  const unit = parseUnit(req.query.unit);
  const locationName = extractLocationName(req.query.location);

  try {
    const resolved = await resolveQWeatherLocationByName({ locationName, lang });
    if (!resolved) {
      throw new HttpError(400, `未找到地区「${locationName}」，请尝试更完整的地区名称`);
    }
    const [data, weatherAlert] = await Promise.all([
      fetchQWeatherNow({ location: resolved.location, lang, unit }),
      fetchQWeatherAlert({
        latitude: String(resolved.matchedLocation.lat ?? ""),
        longitude: String(resolved.matchedLocation.lon ?? ""),
        lang,
      }),
    ]);
    res.json({ ok: true, data: { ...data, weatherAlert } });
  } catch (e: unknown) {
    if (e instanceof HttpError) {
      throw e;
    }
    mapQweatherError(e);
  }
}

export async function getWeatherDaily(req: Request, res: Response): Promise<void> {
  if (!env.qweatherApiKey) {
    throw new HttpError(503, "和风天气未配置：请在环境变量中设置 QWEATHER_API_KEY");
  }
  if (!env.qweatherApiHost) {
    throw new HttpError(503, "和风天气未配置：请在环境变量中设置 QWEATHER_API_HOST（控制台专属域名）");
  }

  const days = parseForecastDays(req.query.days);
  const lang = typeof req.query.lang === "string" && req.query.lang.trim() ? req.query.lang.trim() : undefined;
  const unit = parseUnit(req.query.unit);
  const locationName = extractLocationName(req.query.location);

  try {
    const resolved = await resolveQWeatherLocationByName({ locationName, lang });
    if (!resolved) {
      throw new HttpError(400, `未找到地区「${locationName}」，请尝试更完整的地区名称`);
    }
    const [data, weatherAlert] = await Promise.all([
      fetchQWeatherDaily({ days, location: resolved.location, lang, unit }),
      fetchQWeatherAlert({
        latitude: String(resolved.matchedLocation.lat ?? ""),
        longitude: String(resolved.matchedLocation.lon ?? ""),
        lang,
      }),
    ]);
    res.json({ ok: true, data: { ...data, weatherAlert } });
  } catch (e: unknown) {
    if (e instanceof HttpError) {
      throw e;
    }
    mapQweatherError(e);
  }
}
