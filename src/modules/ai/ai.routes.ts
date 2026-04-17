import { Router } from "express";
import { authRequired } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  postAiChat,
  postAiPrompt,
  postFootballPrediction,
  postBasketballPrediction,
  postTravelGuide,
} from "./ai.controller.js";

export const aiRouter = Router();

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Multi-turn AI chat (OpenAI style)
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: AI response
 */
aiRouter.post("/chat", authRequired, asyncHandler(postAiChat));

/**
 * @swagger
 * /api/ai/prompt:
 *   post:
 *     summary: 单轮 AI 对话（仅传 prompt）
 *     description: |
 *       调用 Vector Engine，适合小程序只发一句用户问题；可选 `system`、`model`。
 *       须配置环境变量 `VECTOR_ENGINE_API_KEY`，否则服务返回 503。
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AiPromptRequest'
 *     responses:
 *       200:
 *         description: 成功，正文在 `content` 字符串中
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AiPromptResponse'
 *       400:
 *         description: Body 非法或 `prompt` 为空
 *       502:
 *         description: 上游错误或响应无法按约定解析
 *       503:
 *         description: 未配置 VECTOR_ENGINE_API_KEY
 */
aiRouter.post("/prompt", authRequired, asyncHandler(postAiPrompt));

/**
 * @swagger
 * /api/ai/travel-guide:
 *   post:
 *     summary: 旅游行程攻略（固定旅行规划师 + 结构化 JSON 响应）
 *     description: |
 *       **调用方式**：与 `POST /api/ai/prompt` 相同，经 Vector Engine（OpenAI 兼容 Chat）生成内容；须配置环境变量 `VECTOR_ENGINE_API_KEY`。未传 body `model` 时本接口默认 **`gpt-5.4-nano`**（可用 `TRAVEL_GUIDE_VECTOR_ENGINE_MODEL` 覆盖，与 `VECTOR_ENGINE_MODEL`、足篮预测默认值独立）。
 *
 *       **默认 system（服务端内置，可被 `system` 字段覆盖）**：模型扮演专业旅行规划师；用户需在 `prompt` 中提供行程参数。规划要求包括：
 *       - 每日须覆盖：行程安排（上/下午/晚）、景点（名称+简介+建议时长）、餐厅（店名+菜+人均）、住宿（酒店+位置+价位）、交通（A→B）。
 *       - 整体：高评分/本地人常去餐厅、节奏不赶、点与点之间标注大致距离或时间、地图动线顺路、1–2 个备选（人多/下雨等）。
 *       - 总结区：`total_budget`、`top_3`、`avoid_tips`，以及 `map_line`、`alternative_plan`、`rain_plan` 等（与默认 system 中的 JSON 模板一致）。
 *       - **输出**：模型应**只输出一个合法 JSON 对象**（不要用 Markdown 代码围栏、不要在 JSON 外写说明）。天数字段为 `day_1`、`day_2`…，随天数增减。
 *
 *       **服务端行为**：将模型返回的字符串尝试解析为 JSON（兼容剥离 Markdown 的 json 代码块、截取首个 `{` 到最后一个 `}`），成功则 **200** 的 **content** 为对象；解析失败返回 **502**，**details.preview** 为正文前缀便于排查。若传入自定义 **system**，仍会做 JSON 解析，请自行保证模型输出合法 JSON。
 *       **字段规范化**：默认 system 要求模型对「1.2.3.」「1、2、」等分点**直接输出 JSON 数组**。服务端仍会对 `day_*` 内上述五字段及根级 `total_budget`、`top_3`、`avoid_tips`、`map_line`、`alternative_plan`、`rain_plan` 中误用的**含换行 string**按行拆成 **string[]**（trim、去空行）；已是数组则不改。
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TravelGuideRequest'
 *     responses:
 *       200:
 *         description: |
 *           成功：`content` 为已解析的攻略对象（见 `TravelGuideContent` / `TravelGuideDay`）。
 *           完整响应结构见 `TravelGuideResponse`（含 `example`）。
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TravelGuideResponse'
 *             examples:
 *               kyoto:
 *                 summary: 京都三日示例（节选）
 *                 value:
 *                   ok: true
 *                   model: gpt-5.4-nano
 *                   content:
 *                     day_1:
 *                       schedule: 上午… 下午… 晚上…
 *                       attractions: 景点文字说明
 *                       restaurants: 餐厅文字说明
 *                       hotels: 住宿文字说明
 *                       transportation: 交通文字说明
 *                     total_budget: 两人约 … 元
 *                     top_3: 必去三处摘要
 *                     avoid_tips: 避坑摘要
 *                     map_line: 动线摘要
 *                     alternative_plan: 备选摘要
 *                     rain_plan: 雨天备选摘要
 *       400:
 *         description: JSON Body 非法、`prompt` 非非空字符串、或 `system` 传入但为空字符串
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HttpErrorBody'
 *       502:
 *         description: 上游向量引擎错误，或模型输出无法解析为 JSON（见 `HttpErrorBody.details.preview`）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HttpErrorBody'
 *       503:
 *         description: 未配置 VECTOR_ENGINE_API_KEY
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HttpErrorBody'
 */
aiRouter.post("/travel-guide", authRequired, asyncHandler(postTravelGuide));

/**
 * @swagger
 * /api/ai/football-prediction:
 *   post:
 *     summary: 足球比分预测
 *     description: |
 *       先按用户消息（或自动拉取的赛程文本）查 `FootballPredictionCache`，在 `PREDICTION_CACHE_TTL_MS`（默认 1 小时）内命中则 `cached: true` 直接返回；否则调用向量引擎并写入缓存。
 *       向量引擎网关默认 `https://api.vectorengine.ai/v1`；未传 body `model` 时预测使用 **`gpt-5.4`**（可用 `PREDICTION_VECTOR_ENGINE_MODEL` 覆盖，定价见 https://api.vectorengine.ai/pricing?keyword=gpt ）。
 *       响应中 `content.matches` 会按本次 `prompt` 里「（match_id=…）」顺序整理，且每条 `match_id` 与请求 prompt 中的值一致。
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FootballPredictionRequest'
 *     responses:
 *       200:
 *         description: 足球比分预测结果
 */
aiRouter.post("/football-prediction", authRequired, asyncHandler(postFootballPrediction));

/**
 * @swagger
 * /api/ai/basketball-prediction:
 *   post:
 *     summary: 篮球比分与盘路预测
 *     description: |
 *       与 `POST /api/ai/football-prediction` 类似：可选 `prompt` 传入多场比赛文本；不传则从懂球帝篮球 tab 拉取今日赛程并自动生成用户消息。
 *       默认系统提示要求模型输出结构化 JSON（胜负、让分、大小分、胜分差、单双、信心指数及 `jinrixuan` / `lengmen` / `chuanguan` 总结区）。
 *       须配置 `VECTOR_ENGINE_API_KEY`。先按 `prompt` 查 `BasketballPredictionCache`，在 `PREDICTION_CACHE_TTL_MS`（默认 1 小时）内命中则直接返回；否则调用模型并写入篮球缓存表（与足球缓存表分离）。
 *       未传 body `model` 时预测使用 **`gpt-5.4`**（`PREDICTION_VECTOR_ENGINE_MODEL` 可覆盖；网关与定价同足球预测）。
 *       响应中 `content.matches` 按本次 `prompt` 中 match_id 顺序整理，每条 `match_id` 与请求 prompt 一致。
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BasketballPredictionRequest'
 *     responses:
 *       200:
 *         description: 篮球预测结果（`content` 为解析后的 JSON 对象或原始字符串）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasketballPredictionResponse'
 *       400:
 *         description: Body 非法、今日无赛程缓存用 prompt 为空等
 *       502:
 *         description: 上游向量引擎错误
 *       503:
 *         description: 未配置 VECTOR_ENGINE_API_KEY
 */
aiRouter.post("/basketball-prediction", authRequired, asyncHandler(postBasketballPrediction));
