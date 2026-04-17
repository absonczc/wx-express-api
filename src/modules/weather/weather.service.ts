import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

/** 和风 `/v7/weather/now` 成功体（字段含义见 https://dev.qweather.com/docs/api/weather/weather-now/ ） */
export interface QWeatherNowPayload {
  code: string;
  updateTime?: string;
  fxLink?: string;
  now?: Record<string, unknown>;
  refer?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 和风 `/v7/weather/{days}` 成功体（字段含义见 https://dev.qweather.com/docs/api/weather/weather-daily-forecast/ ） */
export interface QWeatherDailyPayload {
  code: string;
  updateTime?: string;
  fxLink?: string;
  daily?: Array<Record<string, unknown>>;
  refer?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 和风 `/weatheralert/v1/current/{latitude}/{longitude}` 成功体（字段含义见 https://dev.qweather.com/docs/api/warning/weather-alert/ ） */
export interface QWeatherAlertPayload {
  metadata?: {
    tag?: string;
    zeroResult?: boolean;
    attributions?: string[];
    [key: string]: unknown;
  };
  alerts?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface QWeatherGeoLocation {
  id?: string;
  name?: string;
  lat?: string;
  lon?: string;
  adm1?: string;
  adm2?: string;
  country?: string;
  tz?: string;
  utcOffset?: string;
  [key: string]: unknown;
}

/** 和风 `/geo/v2/city/lookup` 成功体（字段含义见 https://dev.qweather.com/docs/api/geoapi/city-lookup/ ） */
export interface QWeatherCityLookupPayload {
  code: string;
  location?: QWeatherGeoLocation[];
  refer?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ResolvedWeatherLocation {
  location: string;
  matchedLocation: QWeatherGeoLocation;
}

function qweatherAuthHeaders(credential: string): Record<string, string> {
  const isLikelyJwt = /^[\w-]+\.[\w-]+\.[\w-]+$/.test(credential);
  if (isLikelyJwt) {
    return { Authorization: `Bearer ${credential}` };
  }
  return { "X-QW-Api-Key": credential };
}

export interface FetchWeatherNowParams {
  location: string;
  lang?: string;
  unit?: "m" | "i";
}

export type QWeatherForecastDays = "3d" | "7d" | "10d" | "15d" | "30d";

export interface FetchWeatherDailyParams {
  days: QWeatherForecastDays;
  location: string;
  lang?: string;
  unit?: "m" | "i";
}

export interface FetchWeatherAlertParams {
  latitude: string;
  longitude: string;
  lang?: string;
}

export interface ResolveWeatherLocationParams {
  locationName: string;
  lang?: string;
}

function normalizeAlertCoordinate(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return raw;
  }
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export async function resolveQWeatherLocationByName(
  params: ResolveWeatherLocationParams
): Promise<ResolvedWeatherLocation | null> {
  const key = env.qweatherApiKey;
  if (!key) {
    throw new Error("QWEATHER_API_KEY is not configured");
  }
  if (!env.qweatherApiHost) {
    throw new Error("QWEATHER_API_HOST is not configured");
  }

  const search = new URLSearchParams({ location: params.locationName });
  if (params.lang) {
    search.set("lang", params.lang);
  }
  search.set("number", "1");

  const url = `${env.qweatherApiHost}/geo/v2/city/lookup?${search.toString()}`;
  logger.info(`QWeather city lookup request: ${env.qweatherApiHost}/geo/v2/city/lookup`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      ...qweatherAuthHeaders(key),
    },
  });

  let body: QWeatherCityLookupPayload;
  try {
    body = (await response.json()) as QWeatherCityLookupPayload;
  } catch {
    throw new Error(`QWeather city lookup response is not JSON (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const err = new Error(`QWeather city lookup HTTP ${response.status}: ${JSON.stringify(body)}`) as Error & {
      qweatherBody?: QWeatherCityLookupPayload;
      qweatherHttpStatus?: number;
    };
    err.qweatherBody = body;
    err.qweatherHttpStatus = response.status;
    throw err;
  }

  const code = String(body.code ?? "");
  if (code !== "200") {
    const err = new Error(`QWeather city lookup business code ${code}`) as Error & {
      qweatherBody: QWeatherCityLookupPayload;
    };
    err.qweatherBody = body;
    throw err;
  }

  const firstLocation = Array.isArray(body.location) ? body.location[0] : undefined;
  const lat = typeof firstLocation?.lat === "string" ? firstLocation.lat.trim() : "";
  const lon = typeof firstLocation?.lon === "string" ? firstLocation.lon.trim() : "";
  if (!firstLocation || !lat || !lon) {
    return null;
  }

  return {
    location: `${lon},${lat}`,
    matchedLocation: firstLocation,
  };
}

export async function fetchQWeatherNow(params: FetchWeatherNowParams): Promise<QWeatherNowPayload> {
  const key = env.qweatherApiKey;
  if (!key) {
    throw new Error("QWEATHER_API_KEY is not configured");
  }
  if (!env.qweatherApiHost) {
    throw new Error("QWEATHER_API_HOST is not configured");
  }

  const search = new URLSearchParams({ location: params.location });
  if (params.lang) {
    search.set("lang", params.lang);
  }
  if (params.unit) {
    search.set("unit", params.unit);
  }

  const url = `${env.qweatherApiHost}/v7/weather/now?${search.toString()}`;
  logger.info(`QWeather now request: ${env.qweatherApiHost}/v7/weather/now (location len=${params.location.length})`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      ...qweatherAuthHeaders(key),
    },
  });

  let body: QWeatherNowPayload;
  try {
    body = (await response.json()) as QWeatherNowPayload;
  } catch {
    throw new Error(`QWeather response is not JSON (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const err = new Error(`QWeather HTTP ${response.status}: ${JSON.stringify(body)}`) as Error & {
      qweatherBody?: QWeatherNowPayload;
      qweatherHttpStatus?: number;
    };
    err.qweatherBody = body;
    err.qweatherHttpStatus = response.status;
    throw err;
  }

  const code = String(body.code ?? "");
  if (code !== "200") {
    const err = new Error(`QWeather business code ${code}`) as Error & { qweatherBody: QWeatherNowPayload };
    err.qweatherBody = body;
    throw err;
  }

  return body;
}

export async function fetchQWeatherDaily(params: FetchWeatherDailyParams): Promise<QWeatherDailyPayload> {
  const key = env.qweatherApiKey;
  if (!key) {
    throw new Error("QWEATHER_API_KEY is not configured");
  }
  if (!env.qweatherApiHost) {
    throw new Error("QWEATHER_API_HOST is not configured");
  }

  const search = new URLSearchParams({ location: params.location });
  if (params.lang) {
    search.set("lang", params.lang);
  }
  if (params.unit) {
    search.set("unit", params.unit);
  }

  const url = `${env.qweatherApiHost}/v7/weather/${params.days}?${search.toString()}`;
  logger.info(
    `QWeather daily request: ${env.qweatherApiHost}/v7/weather/${params.days} (location len=${params.location.length})`
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      ...qweatherAuthHeaders(key),
    },
  });

  let body: QWeatherDailyPayload;
  try {
    body = (await response.json()) as QWeatherDailyPayload;
  } catch {
    throw new Error(`QWeather response is not JSON (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const err = new Error(`QWeather HTTP ${response.status}: ${JSON.stringify(body)}`) as Error & {
      qweatherBody?: QWeatherDailyPayload;
      qweatherHttpStatus?: number;
    };
    err.qweatherBody = body;
    err.qweatherHttpStatus = response.status;
    throw err;
  }

  const code = String(body.code ?? "");
  if (code !== "200") {
    const err = new Error(`QWeather business code ${code}`) as Error & { qweatherBody: QWeatherDailyPayload };
    err.qweatherBody = body;
    throw err;
  }

  return body;
}

export async function fetchQWeatherAlert(params: FetchWeatherAlertParams): Promise<QWeatherAlertPayload> {
  const key = env.qweatherApiKey;
  if (!key) {
    throw new Error("QWEATHER_API_KEY is not configured");
  }
  if (!env.qweatherApiHost) {
    throw new Error("QWEATHER_API_HOST is not configured");
  }

  const lat = normalizeAlertCoordinate(params.latitude);
  const lon = normalizeAlertCoordinate(params.longitude);
  const search = new URLSearchParams();
  if (params.lang) {
    search.set("lang", params.lang);
  }
  const qs = search.size > 0 ? `?${search.toString()}` : "";
  const url = `${env.qweatherApiHost}/weatheralert/v1/current/${lat}/${lon}${qs}`;
  logger.info(`QWeather alert request: ${env.qweatherApiHost}/weatheralert/v1/current`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      ...qweatherAuthHeaders(key),
    },
  });

  let body: QWeatherAlertPayload;
  try {
    body = (await response.json()) as QWeatherAlertPayload;
  } catch {
    throw new Error(`QWeather alert response is not JSON (HTTP ${response.status})`);
  }

  if (!response.ok) {
    const err = new Error(`QWeather alert HTTP ${response.status}: ${JSON.stringify(body)}`) as Error & {
      qweatherBody?: QWeatherAlertPayload;
      qweatherHttpStatus?: number;
    };
    err.qweatherBody = body;
    err.qweatherHttpStatus = response.status;
    throw err;
  }

  return body;
}
