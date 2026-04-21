import type { Request, Response } from "express";
import type { Prisma } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { executeBasketballPrediction, executeFootballPrediction } from "./prediction-execute.service.js";
import {
  cancelTravelGuideJob,
  getTravelGuideJobForUser,
  startTravelGuideJob,
} from "./travel-guide-async.service.js";
import { vectorEngineChat, vectorEngineImageGenerations } from "./vectorengine.service.js";
import { parseEcommerceSeedreamSchemes } from "./seedream-ecommerce-scheme-parser.js";
import { SEEDREAM_ECOMMERCE_ANALYST_USER_PROMPT } from "./seedream-ecommerce-analyst-prompt.js";
import { XHS_GRASS_COPY_USER_PROMPT } from "./xhs-grass-prompt.js";

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

/** 从模型正文提取并解析 JSON（支持 Markdown 的 json 代码块、从首个 `{` 到最后一个 `}` 截取） */
function parseModelJsonOutput(raw: string): unknown {
  const trimmed = raw.trim();
  let candidate = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
  }
  throw new HttpError(502, "AI 返回内容无法解析为 JSON", {
    preview: trimmed.slice(0, 300),
  });
}

const TRAVEL_DAY_TEXT_KEYS = ["schedule", "attractions", "restaurants", "hotels", "transportation"] as const;
const TRAVEL_ROOT_TEXT_KEYS = [
  "total_budget",
  "top_3",
  "avoid_tips",
  "map_line",
  "alternative_plan",
  "rain_plan",
] as const;

/** 含换行的字符串 → 按行 string[]（trim、去空行）；否则原样 */
function maybeStringLinesToArray(value: unknown): unknown {
  if (typeof value !== "string" || !/[\r\n]/.test(value)) return value;
  return value
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** `day_*` 内五字段 + 根级总结字段：含换行时拆成数组（与提示词「分点用数组」对齐） */
function normalizeTravelGuideListFields(content: unknown): unknown {
  if (content === null || typeof content !== "object" || Array.isArray(content)) {
    return content;
  }
  const root = content as Record<string, unknown>;
  const out: Record<string, unknown> = { ...root };

  for (const field of TRAVEL_ROOT_TEXT_KEYS) {
    if (!(field in out)) continue;
    out[field] = maybeStringLinesToArray(out[field]);
  }

  for (const [key, val] of Object.entries(root)) {
    if (!/^day_\d+$/.test(key) || val === null || typeof val !== "object" || Array.isArray(val)) {
      continue;
    }
    const day = val as Record<string, unknown>;
    const dayOut: Record<string, unknown> = { ...day };
    for (const field of TRAVEL_DAY_TEXT_KEYS) {
      if (!(field in dayOut)) continue;
      dayOut[field] = maybeStringLinesToArray(dayOut[field]);
    }
    out[key] = dayOut;
  }
  return out;
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

const DEFAULT_TRAVEL_SYSTEM = `你是一名专业旅行规划师，请为我制定一个详细的旅游行程方案。

目的地：（填写城市/国家）- 请求的参数
出发地：（填写城市/国家）- 请求的参数
出行天数：（例如3天2晚）- 请求的参数
出行时间：（例如2026年5月）- 请求的参数
出行人数：（例如2人/家庭/朋友）- 请求的参数
预算范围：（例如中等/人均XXX元）- 请求的参数
旅行偏好：（例如美食/拍照/自然风景/文化/轻松/特种兵）- 请求的参数

请按每天输出行程，并严格按照以下格式：

【每日行程】

Day X：

上午：
- 景点名称：
- 简要介绍：
- 建议游玩时间：
- 经纬度：（纬度, 经度）
- 景点图片：（请提供真实图片URL链接）

下午：
- 景点名称：
- 简要介绍：
- 建议游玩时间：
- 经纬度：（纬度, 经度）
- 景点图片：（请提供真实图片URL链接）

晚上：
- 景点名称：
- 简要介绍：
- 建议游玩时间：
- 经纬度：（纬度, 经度）
- 景点图片：（请提供真实图片URL链接）

🍽 餐厅推荐：
- 餐厅名称（具体门店）：
- 地址：
- 人均价格：
- 推荐菜：
- 经纬度：（纬度, 经度）
- 景点图片：（请提供真实图片URL链接）

🏨 住宿推荐：
- 酒店名称：
- 地址：
- 价格区间：
- 推荐理由：
- 经纬度：（纬度, 经度）
- 景点图片：（请提供真实图片URL链接）

🚗 交通安排：
- 从A到B的方式 + 时间

【额外要求】
1. 所有景点必须提供准确经纬度（Google Maps可用）
2. 所有图片必须为真实可访问的URL（非虚构）
3. 餐厅必须是具体门店（避免泛泛推荐）
4. 行程安排要合理，尽量顺路
5. 不要编造不存在的地点或店铺
6.优先推荐高评分、本地人常去的餐厅
7.避免过于紧凑，保证行程合理不赶
8.标注每个地点之间的大致距离或时间
9.提供1-2个备选方案（如下雨/人多时替代）

【最终总结】
- 总预算预估
- 必去TOP 3
- 避坑建议

请优先推荐真实存在、评价良好的店铺和景点，避免虚构内容。
餐厅尽量选择在小红书推荐/大众点评评分较高的具体门店。
住宿优先推荐交通便利区域（靠近地铁/市中心）。
给出出发地 到 目的地的 通行方案和方式
如果无法确保图片URL真实有效，请直接说明并不给出虚假链接。
经纬度请尽量基于真实地图数据。

【输出要求】
- 请输出“完整JSON格式”，不要输出额外解释文字。
- 只输出一个合法 JSON 对象，可被 JSON.parse 直接解析
- 不要添加解释
- 不要使用Markdown格式
- 文案可以带emoji
JSON结构如下：

{
  "destination": "",
  "days": [
    {
      "day": 1,
      "schedule": [
        {
          "time": "morning/afternoon/evening",
          "spot_name": "",
          "description": "",
          "latitude": "",
          "longitude": "",
          "address": "",
          "recommended_duration": "",
          "image_url": ""
        }
      ],
      "food": [
        {
          "restaurant_name": "",
          "branch": "",
          "address": "",
          "avg_price": "",
          "recommended_dishes": [],
          "description": "",
          "latitude": "",
          "longitude": "",
          "image_url": ""
        }
      ],
      "hotel": {
        "name": "",
        "address": "",
        "price_range": "",
        "reason": "",
        "description": "",
        "latitude": "",
        "longitude": "",
        "image_url": ""
      },
      "transport": [
        {
          "from": "",
          "to": "",
          "method": "",
          "duration": ""
        }
      ]
    }
  ],
  "summary": {
    "estimated_budget": "",
    "top3_must_visit": [],
    "tips": [],
    "alternatives": []
  }
}

【严格要求】
1. 所有景点必须提供：
   - 准确名称
   - 经纬度（latitude / longitude）
   - 真实地址
2. 图片要求：
   - image_url必须为真实可访问链接（优先Unsplash / 官方网站 / 维基）
   - 如果不确定，请返回："image_url": null（禁止编造）
3. 餐厅要求：
   - 必须是“具体门店”（例如：某某餐厅 + 分店）
4. 行程安排：
   - 合理、不赶路、尽量顺路
5. 数据真实性：
   - 禁止编造不存在的地点、餐厅或酒店
6. 如果信息不确定：
   - 对应字段返回 null，而不是猜测

`
;

export async function postFootballPrediction(req: Request, res: Response): Promise<void> {
  const result = await executeFootballPrediction({ body: req.body });
  res.json(result);
}

export async function postBasketballPrediction(req: Request, res: Response): Promise<void> {
  const result = await executeBasketballPrediction({ body: req.body });
  res.json(result);
}

/** 与 `executeTravelGuide` 相同的入参校验（不调用模型），供异步提交时立即返回 400 */
export function assertTravelGuideRequestBody(body: unknown): void {
  if (!body || typeof body !== "object") {
    throw new HttpError(400, "Invalid JSON body");
  }
  const prompt = (body as { prompt?: unknown }).prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new HttpError(400, "prompt must be a non-empty string");
  }

  const system = (body as { system?: unknown }).system;
  if (system !== undefined && (typeof system !== "string" || !system.trim())) {
    throw new HttpError(400, "system must be a non-empty string when provided");
  }
}

/** 旅游攻略：与 `postTravelGuide` 相同入参校验与模型调用，供同步接口与异步任务共用 */
export async function executeTravelGuide(
  body: unknown,
  options?: { signal?: AbortSignal }
): Promise<{ model: string; content: unknown }> {
  assertTravelGuideRequestBody(body);

  const prompt = (body as { prompt: string }).prompt.trim();
  const system = (body as { system?: unknown }).system;
  const model = parseOptionalModel(body) ?? env.travelGuideVectorEngineModel;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  messages.push({
    role: "system",
    content: typeof system === "string" && system.trim() ? system.trim() : DEFAULT_TRAVEL_SYSTEM,
  });
  messages.push({ role: "user", content: prompt });

  const { content, model: usedModel } = await vectorEngineChat({
    messages,
    model,
    signal: options?.signal,
  });

  const parsedContent = normalizeTravelGuideListFields(parseModelJsonOutput(content));

  return { model: usedModel, content: parsedContent };
}

/** 旅游攻略：固定旅行规划师 system，用户消息传目的地/天数/预算等 */
export async function postTravelGuide(req: Request, res: Response): Promise<void> {
  const { model, content } = await executeTravelGuide(req.body);
  const prompt = (req.body as { prompt: string }).prompt;
  const requestParams = parseTravelGuidePromptParams(prompt);

  res.json({
    ok: true,
    model,
    requestParams,
    content,
  });
}

function parseOptionalTextField(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${fieldName} must be a non-empty string when provided`);
  }
  return value.trim();
}

type TravelGuidePromptParams = {
  departure: string | null;
  destination: string | null;
  travelDays: string | null;
  travelTime: string | null;
  travelers: string | null;
  budget: string | null;
  preferences: string | null;
};

function parseTravelGuidePromptParams(prompt: string): TravelGuidePromptParams {
  const params: TravelGuidePromptParams = {
    departure: null,
    destination: null,
    travelDays: null,
    travelTime: null,
    travelers: null,
    budget: null,
    preferences: null,
  };

  const segments = prompt
    .split(/[；;]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  for (const segment of segments) {
    const match = segment.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (!match) continue;
    const rawKey = match[1].replace(/\s+/g, "");
    const value = match[2].trim();
    if (!value) continue;

    if (rawKey.includes("出发地")) {
      params.departure = value;
      continue;
    }
    if (rawKey.includes("目的地")) {
      params.destination = value;
      continue;
    }
    if (rawKey.includes("出行天数") || rawKey === "天数") {
      params.travelDays = value;
      continue;
    }
    if (rawKey.includes("出行时间") || rawKey === "时间") {
      params.travelTime = value;
      continue;
    }
    if (rawKey.includes("人数")) {
      params.travelers = value;
      continue;
    }
    if (rawKey.includes("预算")) {
      params.budget = value;
      continue;
    }
    if (rawKey.includes("偏好")) {
      params.preferences = value;
    }
  }

  return params;
}

function parsePositiveIntQuery(value: unknown, defaultValue: number, fieldName: string): number {
  if (value === undefined) return defaultValue;
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, `${fieldName} must be a positive integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${fieldName} must be a positive integer`);
  }
  return parsed;
}

/**
 * 保存旅游策略方案到数据库（与用户绑定）。
 * 入参结构与 `GET /api/ai/travel-guide/jobs/{jobId}` 在 `status=completed` 时返回的 `content` 一致。
 */
export async function postTravelStrategyPlanSave(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.userId;
  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const saved = await prisma.travelStrategyPlan.create({
    data: {
      userId,
      content: req.body as Prisma.InputJsonValue,
    },
  });

  res.json({
    ok: true,
    id: saved.id,
    createdAt: saved.createdAt,
  });
}

/** 获取当前用户保存的旅游策略方案列表（按创建时间倒序） */
export async function getMyTravelStrategyPlans(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.userId;
  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }

  const page = parsePositiveIntQuery(req.query.page, 1, "page");
  const pageSize = parsePositiveIntQuery(req.query.pageSize, 10, "pageSize");
  const normalizedPageSize = Math.min(pageSize, 50);
  const skip = (page - 1) * normalizedPageSize;

  const [total, items] = await Promise.all([
    prisma.travelStrategyPlan.count({ where: { userId } }),
    prisma.travelStrategyPlan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: normalizedPageSize,
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  res.json({
    ok: true,
    page,
    pageSize: normalizedPageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / normalizedPageSize)),
    items,
  });
}

/** 获取当前用户单条旅游策略方案详情 */
export async function getMyTravelStrategyPlanDetail(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.userId;
  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }
  const id = parseOptionalTextField(req.params.id, "id");
  if (!id) {
    throw new HttpError(400, "id required");
  }

  const plan = await prisma.travelStrategyPlan.findFirst({
    where: { id, userId },
    select: {
      id: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!plan) {
    throw new HttpError(404, "Plan not found");
  }

  res.json({ ok: true, plan });
}

/** 删除当前用户单条旅游策略方案 */
export async function deleteMyTravelStrategyPlan(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.userId;
  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }
  const id = parseOptionalTextField(req.params.id, "id");
  if (!id) {
    throw new HttpError(400, "id required");
  }

  const deleted = await prisma.travelStrategyPlan.deleteMany({
    where: { id, userId },
  });
  if (deleted.count === 0) {
    throw new HttpError(404, "Plan not found");
  }

  res.json({ ok: true, deleted: true, id });
}

/**
 * 异步提交旅游攻略生成，立即返回 `jobId`；客户端建议每 **8 秒** 调用 `GET /api/ai/travel-guide/jobs/:jobId` 轮询直至 `status` 为 `completed`、`failed` 或 `cancelled`。
 */
export async function postTravelGuideAsync(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.userId;
  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }
  const body = req.body;
  assertTravelGuideRequestBody(body);
  const jobId = startTravelGuideJob(userId, (signal) => executeTravelGuide(body, { signal }));
  res.json({ ok: true, jobId });
}

/** 查询异步旅游攻略任务状态；`completed` 时 `model`/`content` 与同步 `POST /travel-guide` 成功响应一致 */
export async function getTravelGuideJob(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.userId;
  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }
  const jobId = req.params.jobId;
  if (typeof jobId !== "string" || !jobId.trim()) {
    throw new HttpError(400, "jobId required");
  }

  const job = getTravelGuideJobForUser(jobId.trim(), userId);
  if (!job) {
    throw new HttpError(404, "Job not found");
  }

  if (job.status === "pending") {
    res.json({ ok: true, status: "pending" as const });
    return;
  }
  if (job.status === "completed") {
    res.json({
      ok: true,
      status: "completed" as const,
      model: job.model!,
      content: job.content!,
    });
    return;
  }
  if (job.status === "cancelled") {
    res.json({ ok: true, status: "cancelled" as const });
    return;
  }
  res.json({
    ok: true,
    status: "failed" as const,
    error: job.error ?? "Unknown error",
    details: job.details,
    httpStatus: job.httpStatus,
  });
}

/** 取消异步旅游攻略任务（仅 `pending` 有效；会中止上游 Vector Engine 请求） */
export async function postTravelGuideJobCancel(req: Request, res: Response): Promise<void> {
  const userId = req.authUser?.userId;
  if (!userId) {
    throw new HttpError(401, "Unauthorized");
  }
  const jobId = req.params.jobId;
  if (typeof jobId !== "string" || !jobId.trim()) {
    throw new HttpError(400, "jobId required");
  }

  const result = cancelTravelGuideJob(jobId.trim(), userId);
  if (result.outcome === "not_found") {
    throw new HttpError(404, "Job not found");
  }
  if (result.outcome === "not_pending") {
    throw new HttpError(409, "Job is not pending", { status: result.status });
  }
  res.json({ ok: true, cancelled: true });
}

/**
 * 小红书种草：上传一张商品/场景图，使用固定提示词 + 多模态模型生成文案。
 * 模型默认 `doubao-seed-1-6-flash-250828`（见 `env.xhsGrassVectorEngineModel`）。
 */
export async function postAiXhsGrassFromImage(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer?.length) {
    throw new HttpError(
      400,
      "请使用 multipart/form-data 上传图片字段 image（支持 JPEG/PNG/GIF/WEBP，单文件最大 5MB）"
    );
  }

  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  const model = env.xhsGrassVectorEngineModel;

  const { content, model: usedModel } = await vectorEngineChat({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: XHS_GRASS_COPY_USER_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    model,
    timeoutMs: env.xhsGrassVectorEngineTimeoutMs,
    networkRetries: 2,
  });

  res.json({
    ok: true,
    model: usedModel,
    content,
  });
}

/**
 * 电商视觉阶段一：多模态分析图并生成 3 套 Seedream 5.0 用提示词（Markdown）。
 * 阶段二出图请调用 `POST /api/ai/ecommerce/seedream/generate`。
 */
export async function postAiEcommerceSeedreamAnalyze(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer?.length) {
    throw new HttpError(
      400,
      "请使用 multipart/form-data 上传图片字段 image（支持 JPEG/PNG/GIF/WEBP，单文件最大 5MB）"
    );
  }

  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  const analystModel = env.ecommerceVisualAnalystModel;

  const { content, model: usedModel } = await vectorEngineChat({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: SEEDREAM_ECOMMERCE_ANALYST_USER_PROMPT },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    model: analystModel,
    timeoutMs: env.ecommerceVisualAnalystTimeoutMs,
    networkRetries: 2,
  });

  const schemes = parseEcommerceSeedreamSchemes(content);

  res.json({
    ok: true,
    model: usedModel,
    content,
    schemes,
  });
}

const SEEDREAM_GENERATE_DEFAULT_SIZE = "2048x2048";
const SEEDREAM_GENERATE_DEFAULT_N = 3;

function parseSeedreamGenerateSize(raw: unknown): string {
  if (raw === undefined || raw === "") {
    return SEEDREAM_GENERATE_DEFAULT_SIZE;
  }
  if (typeof raw !== "string" || !raw.trim()) {
    throw new HttpError(400, "multipart 字段 size 须为非空字符串（默认 2048x2048）");
  }
  return raw.trim();
}

function parseSeedreamGenerateN(raw: unknown): number {
  if (raw === undefined || raw === "") {
    return SEEDREAM_GENERATE_DEFAULT_N;
  }
  const num = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1 || num > 10) {
    throw new HttpError(400, "multipart 字段 n 须为 1～10 的整数（默认 3）");
  }
  return num;
}

/** 电商视觉阶段二：即梦 Seedream `images/generations`（参考图 + prompt，可选 watermark / model / size / n） */
export async function postAiEcommerceSeedreamGenerate(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer?.length) {
    throw new HttpError(
      400,
      "请使用 multipart/form-data 上传图片字段 image（支持 JPEG/PNG/GIF/WEBP，单文件最大 5MB）"
    );
  }

  const body = req.body as Record<string, unknown>;
  const promptRaw = body.prompt;
  if (typeof promptRaw !== "string" || !promptRaw.trim()) {
    throw new HttpError(
      400,
      "multipart 文本字段 prompt 必填且非空（即梦生图完整提示词，通常由阶段一某套方案的正向与负面提示词按约定拼接）"
    );
  }
  const prompt = promptRaw.trim();

  let watermark = false;
  if (body.watermark !== undefined && body.watermark !== "") {
    const w = String(body.watermark).trim().toLowerCase();
    watermark = w === "true" || w === "1" || w === "yes";
  }

  const modelOverride =
    typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined;
  const imageModel = modelOverride ?? env.seedream50VectorEngineModel;

  const size = parseSeedreamGenerateSize(body.size);
  const n = parseSeedreamGenerateN(body.n);

  const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

  const { raw } = await vectorEngineImageGenerations({
    model: imageModel,
    prompt,
    referenceDataUrls: [dataUrl],
    watermark,
    size,
    n,
    referenceAsImagesArrayOnly: env.seedream5ReferenceAsImagesArrayOnly,
    timeoutMs: env.seedream50VectorEngineTimeoutMs,
    networkRetries: 2,
  });

  res.json({
    ok: true,
    model: imageModel,
    size,
    n,
    seedream: raw,
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
