import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { HttpError } from "../../middleware/error.middleware.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenAICompatChatResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string | null };
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

export async function vectorEngineChat(params: {
  messages: ChatMessage[];
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

  const content = raw.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.length) {
    throw new HttpError(502, "Vector Engine returned an empty reply", { raw });
  }

  return { content, model };
}
