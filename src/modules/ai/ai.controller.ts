import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import { vectorEngineChat } from "./vectorengine.service.js";
import { fetchFootballList, buildTodayTomorrowPrompt } from "../football/football.service.js";
import { getCachedPrediction, cachePrediction } from "./football-cache.service.js";

const roles = new Set(["system", "user", "assistant"]);

function parseMessages(body: unknown): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Invalid JSON body");
  }
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new HttpError(400, "messages must be a non-empty array");
  }

  const out: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") {
      throw new HttpError(400, "Each message must be an object");
    }
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (typeof role !== "string" || !roles.has(role)) {
      throw new HttpError(400, "Invalid message role");
    }
    if (typeof content !== "string" || !content.trim()) {
      throw new HttpError(400, "Invalid message content");
    }
    out.push({ role: role as "system" | "user" | "assistant", content });
  }
  return out;
}

function parseOptionalModel(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const m = (body as { model?: unknown }).model;
  if (typeof m !== "string") return undefined;
  const t = m.trim();
  return t.length ? t : undefined;
}

export async function postAiChat(req: Request, res: Response): Promise<void> {
  const messages = parseMessages(req.body);
  const model = parseOptionalModel(req.body);

  const { content, model: usedModel } = await vectorEngineChat({ messages, model });

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    parsedContent = content;
  }

  res.json({
    ok: true,
    model: usedModel,
    content: parsedContent,
  });
}

const DEFAULT_FOOTBALL_SYSTEM = `请你扮演一名专业足球竞彩分析师，根据我提供的多场比赛信息，逐场输出推荐分析，风格类似实战推荐单。可参考球队实力差距、主客场表现、进攻/防守数据、近期战绩等进行判断。
比赛分析：
球队A：简要分析（主场/进攻/状态/战术特点）
球队B：简要分析（客场/防守/抗压/短板）

历史交锋：一句话总结（谁占优/主场优势）

✅ 比分：X-X 或 X-X
✅ 让球胜负：明确盘口 + 倾向（如让1.5球，看好赢盘）
✅ 大小球：大/小X.X球
✅ 信心指数：⭐⭐⭐⭐☆（XX%）

关键因素：用一句话总结（如「主强客弱 + 防线差距」）

【整体风格要求】

使用🔥、✅等符号增强可读性
每场控制在100~150字，简洁有力
结论必须明确，不要模糊表达
语气专业+偏实战推荐
不要出现「可能」「或许」等犹豫词

【输入格式如下】
比赛1（match_id=1）：
球队A vs 球队B｜联赛｜时间

比赛2（match_id=2）：
球队C vs 球队D｜联赛｜时间

（可输入多场）在输出全部比赛后，额外增加一个总结区：

总结区必须严格使用以下三行标题（便于分卡展示），每段另起一行，段内可配合 🎯/💣/🔥：
【今日精选】挑出最稳的1~2场（给理由），需写出球队名称
【冷门预警】指出1场可能爆冷的比赛，需写出球队名称
【串关建议】给出2~3场组合推荐，需写出球队名称

要求逻辑清晰，偏实战。

【输出排版要求（必须遵守）】

输出格式：
{
	"matches": [
		{ "match_id": "比赛N中括号内的match_id值（如1、2、3）", "n": 1, "title": "比赛1", "bisaifenxi": "比赛分析", "lishijiaofeng": "历史交锋", "jingufen": "关键因素", "yuce": { "bifen": "比分预测", "rangqiu": "让球胜负预测", "daxiao": "大小球预测", "xindu": "信心指数预测" } },
		{ "match_id": "比赛N中括号内的match_id值（如1、2、3）", "n": 2, "title": "比赛2", "bisaifenxi": "比赛分析", "lishijiaofeng": "历史交锋", "jingufen": "关键因素", "yuce": { "bifen": "比分预测", "rangqiu": "让球胜负预测", "daxiao": "大小球预测", "xindu": "信心指数预测" } }
	],
	"jinrixuan": "今日精选的内容",
	"lengmen": "冷门预警的内容",
	"chuanguan": "串关建议的内容"
}`;

export async function postFootballPrediction(req: Request, res: Response): Promise<void> {
  if (!req.body || typeof req.body !== "object") {
    throw new HttpError(400, "Invalid JSON body");
  }

  let prompt: string = (req.body as { prompt?: unknown }).prompt as string;
  if (typeof prompt !== "string" || !prompt.trim()) {
    const footballData = await fetchFootballList({ start: "2026-04-1400:00:00" });
    prompt = buildTodayTomorrowPrompt(footballData);
  }

  if (!prompt.trim()) {
    throw new HttpError(400, "No football matches found for today and tomorrow");
  }

  const cachedResult = await getCachedPrediction(prompt);
  if (cachedResult) {
    const parsedContent = JSON.parse(cachedResult);
    res.json({
      ok: true,
      cached: true,
      content: parsedContent,
    });
    return;
  }

  const system = (req.body as { system?: unknown }).system;
  if (system !== undefined && (typeof system !== "string" || !system.trim())) {
    throw new HttpError(400, "system must be a non-empty string when provided");
  }

  const model = parseOptionalModel(req.body);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  messages.push({ role: "system", content: typeof system === "string" && system.trim() ? system.trim() : DEFAULT_FOOTBALL_SYSTEM });
  messages.push({ role: "user", content: prompt.trim() });

  const { content, model: usedModel } = await vectorEngineChat({ messages, model });

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    parsedContent = content;
  }

  await cachePrediction(prompt, content);

  res.json({
    ok: true,
    cached: false,
    model: usedModel,
    content: parsedContent,
  });
}

/** 单轮对话：前端只需传 prompt（可选 system / model） */
export async function postAiPrompt(req: Request, res: Response): Promise<void> {
  if (!req.body || typeof req.body !== "object") {
    throw new HttpError(400, "Invalid JSON body");
  }
  const prompt = (req.body as { prompt?: unknown }).prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new HttpError(400, "prompt must be a non-empty string");
  }

  const system = (req.body as { system?: unknown }).system;
  if (system !== undefined && (typeof system !== "string" || !system.trim())) {
    throw new HttpError(400, "system must be a non-empty string when provided");
  }

  const model = parseOptionalModel(req.body);

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  if (typeof system === "string" && system.trim()) {
    messages.push({ role: "system", content: system.trim() });
  }
  messages.push({ role: "user", content: prompt.trim() });

  const { content, model: usedModel } = await vectorEngineChat({ messages, model });

  res.json({
    ok: true,
    model: usedModel,
    content,
  });
}
