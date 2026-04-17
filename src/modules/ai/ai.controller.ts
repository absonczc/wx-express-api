import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { vectorEngineChat } from "./vectorengine.service.js";
import { fetchFootballList, buildTodayTomorrowPrompt } from "../football/football.service.js";
import {
  fetchBasketballTab,
  buildTodayTomorrowBasketballPrompt,
  formatBasketballTabStart,
} from "../basketball/basketball.service.js";
import {
  getCachedPrediction,
  cachePrediction,
  getCachedBasketballPrediction,
  cacheBasketballPrediction,
} from "./football-cache.service.js";
import { applyRequestMatchIdsToPredictionContent } from "./prediction-response-match-ids.util.js";

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

const DEFAULT_FOOTBALL_SYSTEM = `请你扮演一名专业足球竞彩分析师，根据我提供的多场比赛信息，逐场输出推荐分析，风格类似实战推荐单。
分析维度包括：
- 近期状态（进攻/防守效率）
- xG（预期进球）或进攻效率（篮球）
- 球员伤停及关键球员状态
- 战术匹配情况
- 主客场表现差异
- 盘口/市场赔率变化（如适用）
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

每条比赛的 match_id 必须与用户消息里该行「（match_id=…）」中的值完全一致（原样字符串，含数字 ID）；matches 数组顺序须与用户消息中比赛出现顺序一致。n、title 与顺序一致（比赛1、比赛2…）。

输出格式：
{
	"matches": [
		{ "match_id": "与用户输入该行括号内 match_id 完全一致", "n": 1, "bisaifenxi": "比赛分析", "lishijiaofeng": "历史交锋", "jingufen": "关键因素", "yuce": { "bifen": "比分预测", "rangqiu": "让球胜负预测", "daxiao": "大小球预测", "xindu": "信心指数预测" } },
		{ "match_id": "与用户输入该行括号内 match_id 完全一致", "n": 2, "bisaifenxi": "比赛分析", "lishijiaofeng": "历史交锋", "jingufen": "关键因素", "yuce": { "bifen": "比分预测", "rangqiu": "让球胜负预测", "daxiao": "大小球预测", "xindu": "信心指数预测" } }
	],
	"jinrixuan": "今日精选的内容",
	"lengmen": "冷门预警的内容",
	"chuanguan": "串关建议的内容"
}`;

const DEFAULT_TRAVEL_SYSTEM = `你是一名专业旅行规划师，请为我制定一个详细的旅游行程方案。

目的地：（填写城市/国家）- 请求的参数
出发地：（填写城市/国家）- 请求的参数
出行天数：（例如3天2晚）- 请求的参数
出行时间：（例如2026年5月）- 请求的参数
出行人数：（例如2人/家庭/朋友）- 请求的参数
预算范围：（例如中等/人均XXX元）- 请求的参数
旅行偏好：（例如美食/拍照/自然风景/文化/轻松/特种兵）- 请求的参数

请按“每天行程”详细规划，并满足以下要求：

【每日结构必须包含】
1. 行程安排（上午 / 下午 / 晚上）
2. 景点推荐（具体名称 + 简要介绍 + 建议游玩时间）
3. 餐厅推荐（具体门店名称 + 推荐菜 + 人均价格）
4. 住宿推荐（酒店名称 + 位置优势 + 价格区间）
5. 交通建议（如何从A到B）

【额外要求】
- 优先推荐高评分、本地人常去的餐厅
- 避免过于紧凑，保证行程合理不赶
- 标注每个地点之间的大致距离或时间
- 给出地图动线（顺路安排）
- 提供1-2个备选方案（如下雨/人多时替代）

【最终总结】
- 总预算预估
- 必去TOP 3
- 避坑建议

请优先推荐真实存在、评价良好的店铺和景点，避免虚构内容。
餐厅尽量选择在小红书推荐/大众点评评分较高的具体门店。
住宿优先推荐交通便利区域（靠近地铁/市中心）。

【输出要求（必须遵守）】
- 只输出一个合法 JSON 对象，可被 JSON.parse 直接解析
- 不要使用 Markdown 代码围栏（不要用三个反引号包裹）
- 不要在 JSON 前后输出任何说明文字、前缀或后缀
- **分点、分条必须用 JSON 数组**：凡是用「1.」「2.」「3.」或「1、」「2、」「3、」或「一、」「二、」或「-」等列举的多条内容，在 JSON 里**必须**写成字符串数组 \`["第一条","第二条",…]\`，数组每一项对应一个分点；不要把多条压在同一段字符串里用换行或序号硬拼（除非整段只有一句、确实没有并列分点，才可使用单个 string）
- 涉及字段：每个 \`day_*\` 内的 \`schedule\`、\`attractions\`、\`restaurants\`、\`hotels\`、\`transportation\`，以及根级的 \`total_budget\`、\`top_3\`、\`avoid_tips\`、\`map_line\`、\`alternative_plan\`、\`rain_plan\` —— 只要存在 2 条及以上并列信息，一律用 string[]；例如上午/下午/晚上三段 → schedule 用三个元素的数组；必去 TOP3 → top_3 用三个元素的数组
- 若误用多行单 string 输出分点，接口会在含换行时尽量拆成数组，但仍请你直接输出数组以符合约定
- 文案可以带emoji

输出的格式为（注意数组写法）：
{
	"day_1": {
		"schedule": ["上午：…", "下午：…", "晚上：…"],
		"attractions": ["景点一：…", "景点二：…"],
		"restaurants": ["餐厅A：…", "餐厅B：…"],
		"hotels": ["酒店说明一条即可"],
		"transportation": ["A→B：…", "B→C：…"]
	},
	"day_2": {
		"schedule": ["上午：…", "下午：…", "晚上：…"],
		"attractions": ["…"],
		"restaurants": ["…"],
		"hotels": ["…"],
		"transportation": ["…"]
	},
	"day_3": {
		"schedule": ["…", "…", "…"],
		"attractions": ["…"],
		"restaurants": ["…"],
		"hotels": ["…"],
		"transportation": ["…"]
	},
	"total_budget": ["机酒合计：…", "餐饮门票：…"],
	"top_3": ["第一名：…", "第二名：…", "第三名：…"],
	"avoid_tips": ["避坑一：…", "避坑二：…"],
	"map_line": ["D1 动线：…", "D2 动线：…"],
	"alternative_plan": ["人多时：…"],
	"rain_plan": ["雨天方案：…"]
}
`
;

const DEFAULT_BASKETBALL_SYSTEM = `请你扮演一名专业篮球竞彩分析师（NBA/CBA 等），根据我提供的多场比赛信息，逐场输出推荐分析，风格类似实战推荐单。
分析维度包括：
- 近期状态（进攻效率/防守效率/节奏）
- 有效命中率、回合占有率、失误控制与篮板（含进攻篮板）
- 球员伤停及关键球员状态
- 对位与轮换深度、战术风格匹配（挡拆/换防/内线优势等）
- 主客场表现差异
- 盘口/市场赔率变化（如适用）
比赛分析：
球队A：简要分析（主场/进攻/状态/战术特点）
球队B：简要分析（客场/防守/抗压/短板）

历史交锋：一句话总结（谁占优/主场优势）

✅ 胜负：球队A 胜
✅ 让分胜负：明确盘口 + 倾向（如让1.5分，看好赢盘）
✅ 大小分：大/小X.X分
✅ 胜分差：球队A 胜，胜 X.X 分
✅ 单双盘：单 / 双
✅ 信心指数：⭐⭐⭐⭐☆（XX%）

关键因素：用一句话总结（如「主强客弱 + 内线差距」）

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

每条比赛的 match_id 必须与用户消息里该行「（match_id=…）」中的值完全一致（原样字符串）；matches 顺序与用户消息中比赛出现顺序一致。n、title 与顺序一致（比赛1、比赛2…）。

输出格式：
{
	"matches": [
		{ "match_id": "与用户输入该行括号内 match_id 完全一致", "n": 1, "bisaifenxi": "比赛分析", "lishijiaofeng": "历史交锋", "jingufen": "关键因素",
		"yuce": {
			"shengfu": "球队A 胜",
			"rangfenshengfu": "明确盘口 + 倾向（如让1.5分，看好赢盘）",
			"daxiaofen": "大/小X.X分",
			"shengfencha": "球队A 胜，胜 X 分",
			"danshuangpan": "单 / 双",
			"xinxinzhishu": "⭐⭐⭐⭐☆（XX%）"
		}},
		{ "match_id": "与用户输入该行括号内 match_id 完全一致", "n": 2, "bisaifenxi": "比赛分析", "lishijiaofeng": "历史交锋", "jingufen": "关键因素",
		"yuce": {
			"shengfu": "球队A 胜",
			"rangfenshengfu": "明确盘口 + 倾向（如让1.5分，看好赢盘）",
			"daxiaofen": "大/小X.X分",
			"shengfencha": "球队A 胜，胜 X分",
			"danshuangpan": "单 / 双",
			"xinxinzhishu": "⭐⭐⭐⭐☆（XX%）"
		} }
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
      content: applyRequestMatchIdsToPredictionContent(parsedContent, prompt.trim()),
    });
    return;
  }

  const system = (req.body as { system?: unknown }).system;
  if (system !== undefined && (typeof system !== "string" || !system.trim())) {
    throw new HttpError(400, "system must be a non-empty string when provided");
  }

  const model = parseOptionalModel(req.body) ?? env.predictionVectorEngineModel;

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
    content: applyRequestMatchIdsToPredictionContent(parsedContent, prompt.trim()),
  });
}

export async function postBasketballPrediction(req: Request, res: Response): Promise<void> {
  if (!req.body || typeof req.body !== "object") {
    throw new HttpError(400, "Invalid JSON body");
  }

  let prompt: string = (req.body as { prompt?: unknown }).prompt as string;
  if (typeof prompt !== "string" || !prompt.trim()) {
    const basketballData = await fetchBasketballTab({ start: formatBasketballTabStart() });
    prompt = buildTodayTomorrowBasketballPrompt(basketballData);
  }

  if (!prompt.trim()) {
    throw new HttpError(400, "No basketball matches found for today");
  }

  const cachedResult = await getCachedBasketballPrediction(prompt);
  if (cachedResult) {
    const parsedContent = JSON.parse(cachedResult);
    res.json({
      ok: true,
      cached: true,
      content: applyRequestMatchIdsToPredictionContent(parsedContent, prompt.trim()),
    });
    return;
  }

  const system = (req.body as { system?: unknown }).system;
  if (system !== undefined && (typeof system !== "string" || !system.trim())) {
    throw new HttpError(400, "system must be a non-empty string when provided");
  }

  const model = parseOptionalModel(req.body) ?? env.predictionVectorEngineModel;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  messages.push({
    role: "system",
    content: typeof system === "string" && system.trim() ? system.trim() : DEFAULT_BASKETBALL_SYSTEM,
  });
  messages.push({ role: "user", content: prompt.trim() });

  const { content, model: usedModel } = await vectorEngineChat({ messages, model });

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(content);
  } catch {
    parsedContent = content;
  }

  await cacheBasketballPrediction(prompt, content);

  res.json({
    ok: true,
    cached: false,
    model: usedModel,
    content: applyRequestMatchIdsToPredictionContent(parsedContent, prompt.trim()),
  });
}

/** 旅游攻略：固定旅行规划师 system，用户消息传目的地/天数/预算等 */
export async function postTravelGuide(req: Request, res: Response): Promise<void> {
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

  const model = parseOptionalModel(req.body) ?? env.travelGuideVectorEngineModel;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  messages.push({
    role: "system",
    content: typeof system === "string" && system.trim() ? system.trim() : DEFAULT_TRAVEL_SYSTEM,
  });
  messages.push({ role: "user", content: prompt.trim() });

  const { content, model: usedModel } = await vectorEngineChat({ messages, model });

  const parsedContent = normalizeTravelGuideListFields(parseModelJsonOutput(content));

  res.json({
    ok: true,
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
