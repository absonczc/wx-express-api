import { env } from "../../config/env.js";
import { HttpError } from "../../middleware/error.middleware.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type OpenAICompatChatResponse = {
  choices?: Array<{
    message?: { role?: string; content?: string | null };
  }>;
  error?: { message?: string; type?: string };
};

export async function vectorEngineChat(params: {
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
}): Promise<{ content: string; model: string }> {
  if (!env.vectorEngineApiKey) {
    throw new HttpError(503, "Vector Engine is not configured (VECTOR_ENGINE_API_KEY)");
  }

  const model = params.model ?? env.vectorEngineModel;
  const url = `${env.vectorEngineBaseUrl}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.vectorEngineApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: params.messages,
    }),
    signal: params.signal,
  });

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
    throw new HttpError(502, "Vector Engine request failed", {
      upstreamStatus: res.status,
      upstream: msg,
    });
  }

  const content = raw.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.length) {
    throw new HttpError(502, "Vector Engine returned an empty reply", { raw });
  }

  return { content, model };
}
