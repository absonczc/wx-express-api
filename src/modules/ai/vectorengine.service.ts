import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { HttpError } from "../../middleware/error.middleware.js";

/** OpenAI 兼容多模态：user 消息可带图（data URL 或 https URL） */
export type VectorEngineChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type VectorEngineChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | VectorEngineChatContentPart[];
};

type OpenAICompatChatResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string | null | unknown };
  }>;
  error?: { message?: string; type?: string };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 对 `fetch` 抛出、且非本地 Abort/超时 的瞬时网络错误做有限次重试 */
function isRetriableVectorEngineFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "AbortError") return false;

  const msg = err.message;
  if (/fetch failed/i.test(msg)) return true;

  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code && /^(ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH)$/.test(code)) {
      return true;
    }
  }
  if (typeof cause === "object" && cause !== null && "code" in cause) {
    const code = String((cause as { code: unknown }).code);
    if (code.startsWith("UND_ERR")) return true;
  }
  return false;
}

function composeFetchSignal(userSignal: AbortSignal | undefined, timeoutMs: number | undefined): AbortSignal | undefined {
  if (timeoutMs === undefined || timeoutMs <= 0) {
    return userSignal;
  }
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!userSignal) {
    return timeoutSignal;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([userSignal, timeoutSignal]);
  }
  return timeoutSignal;
}

function extractTextFromMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (content === null || content === undefined) return "";
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const p = part as { type?: string; text?: string };
      if (p.type === "text" && typeof p.text === "string") {
        parts.push(p.text);
      }
    }
    return parts.join("");
  }
  return "";
}

export async function vectorEngineChat(params: {
  messages: VectorEngineChatMessage[];
  model?: string;
  signal?: AbortSignal;
  /** 单次请求超时（毫秒）；不传则不设 fetch 层超时 */
  timeoutMs?: number;
  /** `fetch` 失败时的最大尝试次数，默认 1（不重试） */
  networkRetries?: number;
}): Promise<{ content: string; model: string }> {
  if (!env.vectorEngineApiKey) {
    throw new HttpError(503, "Vector Engine is not configured (VECTOR_ENGINE_API_KEY)");
  }

  const model = params.model ?? env.vectorEngineModel;
  const url = `${env.vectorEngineBaseUrl}/chat/completions`;
  const maxAttempts = Math.max(1, Math.min(10, params.networkRetries ?? 1));
  const signal = composeFetchSignal(params.signal, params.timeoutMs);

  let res!: Response;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.vectorEngineApiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: params.messages,
        }),
        signal,
      });
      break;
    } catch (err) {
      const retriable = attempt < maxAttempts && isRetriableVectorEngineFetchError(err);
      if (retriable) {
        const wait = 1500 * attempt;
        logger.warn(
          `Vector Engine fetch failed (attempt ${attempt}/${maxAttempts}), retrying in ${wait}ms`,
          err
        );
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }

  let raw: OpenAICompatChatResponse;
  try {
    raw = (await res.json()) as OpenAICompatChatResponse;
  } catch {
    throw new HttpError(502, "Vector Engine returned a non-JSON response", { status: res.status });
  }

  if (!res.ok) {
    const msg =
      raw.error?.message ??
      (typeof raw === "object" && raw !== null ? JSON.stringify(raw) : `HTTP ${res.status}`);
    const hint =
      typeof msg === "string" && msg.length > 0
        ? msg.length > 400
          ? `${msg.slice(0, 400)}…`
          : msg
        : undefined;
    throw new HttpError(
      502,
      hint ? `Vector Engine request failed: ${hint}` : "Vector Engine request failed",
      {
        upstreamStatus: res.status,
        upstream: msg,
      }
    );
  }

  const rawContent = raw.choices?.[0]?.message?.content;
  const content = extractTextFromMessageContent(rawContent);
  if (!content.length) {
    throw new HttpError(502, "Vector Engine returned an empty reply", { raw });
  }

  return { content, model };
}

/** Vector Engine 绘画：`POST /v1/images/generations`（豆包 Seedream 等） */
export async function vectorEngineImageGenerations(params: {
  model: string;
  prompt: string;
  /** 参考图 data URL 或 https URL；单图时默认写入 `image`（与官方示例一致），多图写 `images` */
  referenceDataUrls: string[];
  watermark?: boolean;
  /** 如 `2048x2048`，写入上游 `images/generations` body.size */
  size?: string;
  /** 生成张数，写入 body.n */
  n?: number;
  /** 为 true 时只发送 `images` 数组（不发送 `image`），便于对接仅支持数组字段的网关 */
  referenceAsImagesArrayOnly?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  networkRetries?: number;
}): Promise<{ raw: unknown }> {
  if (!env.vectorEngineApiKey) {
    throw new HttpError(503, "Vector Engine is not configured (VECTOR_ENGINE_API_KEY)");
  }

  const urls = params.referenceDataUrls.filter((u) => typeof u === "string" && u.length > 0);
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    watermark: params.watermark ?? false,
  };

  if (typeof params.size === "string" && params.size.trim()) {
    body.size = params.size.trim();
  }
  if (typeof params.n === "number" && Number.isFinite(params.n)) {
    body.n = params.n;
  }

  if (params.referenceAsImagesArrayOnly) {
    body.images = urls;
  } else if (urls.length === 1) {
    body.image = urls[0];
  } else if (urls.length > 1) {
    body.images = urls;
  }

  const url = `${env.vectorEngineBaseUrl}/images/generations`;
  const maxAttempts = Math.max(1, Math.min(10, params.networkRetries ?? 1));
  const signal = composeFetchSignal(params.signal, params.timeoutMs);

  let res!: Response;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.vectorEngineApiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });
      break;
    } catch (err) {
      const retriable = attempt < maxAttempts && isRetriableVectorEngineFetchError(err);
      if (retriable) {
        const wait = 1500 * attempt;
        logger.warn(
          `Vector Engine images fetch failed (attempt ${attempt}/${maxAttempts}), retrying in ${wait}ms`,
          err
        );
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new HttpError(502, "Vector Engine images returned a non-JSON response", { status: res.status });
  }

  if (!res.ok) {
    const errObj = raw as { error?: { message?: string }; message?: string };
    const msg =
      errObj?.error?.message ??
      (typeof errObj?.message === "string" ? errObj.message : undefined) ??
      (typeof raw === "object" && raw !== null ? JSON.stringify(raw) : `HTTP ${res.status}`);
    const hint = typeof msg === "string" && msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
    throw new HttpError(502, hint ? `Vector Engine images request failed: ${hint}` : "Vector Engine images request failed", {
      upstreamStatus: res.status,
      upstream: msg,
    });
  }

  return { raw };
}
