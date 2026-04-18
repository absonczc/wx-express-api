import { Router } from "express";
import { authRequired } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  postAiChat,
  postAiPrompt,
  postFootballPrediction,
  postBasketballPrediction,
  postTravelGuide,
  postTravelGuideAsync,
  getTravelGuideJob,
  postTravelGuideJobCancel,
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
 * /api/ai/travel-guide/async:
 *   post:
 *     summary: 旅游行程攻略（异步：立即返回 jobId，轮询查询结果）
 *     description: |
 *       请求体与 `POST /api/ai/travel-guide` **完全相同**（`prompt` / 可选 `system` / `model`）。
 *       本接口**不等待**向量引擎，立即返回 `jobId`。
 *       客户端请使用 **`GET /api/ai/travel-guide/jobs/{jobId}`** 查询进度；**建议轮询间隔约 8 秒**，直至 `status` 为 `completed`、`failed` 或 `cancelled`。
 *       进行中可调用 **`POST /api/ai/travel-guide/jobs/{jobId}/cancel`** 取消（仅 `pending` 时成功）。
 *       任务仅在服务端内存中保存约 1 小时，超时后查询返回 404。
 *       仅创建任务时的同一登录用户可查询该 `jobId`。
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
 *         description: 已受理，请用返回的 jobId 轮询
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TravelGuideAsyncStartResponse'
 *       400:
 *         description: Body 非法（与同步接口一致：`prompt` / `system` 等；提交时即校验，不调用模型）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HttpErrorBody'
 *       401:
 *         description: 未授权
 */
aiRouter.post("/travel-guide/async", authRequired, asyncHandler(postTravelGuideAsync));

/**
 * @swagger
 * /api/ai/travel-guide/jobs/{jobId}:
 *   get:
 *     summary: 查询异步旅游攻略任务状态
 *     description: |
 *       返回 `POST /api/ai/travel-guide/async` 创建的任务状态。
 *       - `pending`：模型仍在生成中，建议 **约 8 秒** 后再次请求。
 *       - `completed`：`model` 与 `content` 与同步 `POST /api/ai/travel-guide` 成功响应一致。
 *       - `failed`：`error` / `details` / `httpStatus` 与同步失败时含义一致（HTTP 仍返回 200，便于小程序轮询不触发全局错误拦截；请根据 `status` 与 `httpStatus` 处理）。
 *       - `cancelled`：用户已调用取消接口，或上游请求被中止；无 `content`。
 *       任务不存在或无权访问时 **404**（不区分）。
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: `POST /travel-guide/async` 返回的 jobId
 *     responses:
 *       200:
 *         description: 查询成功（含 pending / completed / failed / cancelled）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TravelGuideJobPollResponse'
 *       401:
 *         description: 未授权
 *       404:
 *         description: 任务不存在、已过期或无权访问
 */
aiRouter.get("/travel-guide/jobs/:jobId", authRequired, asyncHandler(getTravelGuideJob));

/**
 * @swagger
 * /api/ai/travel-guide/jobs/{jobId}/cancel:
 *   post:
 *     summary: 取消异步旅游攻略任务
 *     description: |
 *       仅当任务 **`pending`** 时可取消：服务端 `AbortSignal` 中止对 Vector Engine 的 `fetch`，任务变为 `cancelled`。
 *       之后 `GET .../jobs/{jobId}` 返回 `status: cancelled`。
 *       若任务已 `completed` / `failed` / `cancelled`，返回 **409**，`details.status` 为当前状态。
 *       任务不存在或无权访问时 **404**。
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: `POST /travel-guide/async` 返回的 jobId
 *     responses:
 *       200:
 *         description: 已取消
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TravelGuideJobCancelResponse'
 *       401:
 *         description: 未授权
 *       404:
 *         description: 任务不存在、已过期或无权访问
 *       409:
 *         description: 任务已结束，无法再取消（`details.status` 为 completed / failed / cancelled）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HttpErrorBody'
 */
aiRouter.post("/travel-guide/jobs/:jobId/cancel", authRequired, asyncHandler(postTravelGuideJobCancel));

/**
 * @swagger
 * /api/ai/football-prediction:
 *   post:
 *     summary: 足球比分预测
 *     description: |
 *       **接口只读数据库**：固定返回 `FootballPredictionCache` 表中 **`createdAt` 最新一行**的 `result`（与请求体中的 `prompt` 无关；**不在此路径调用模型**）。表中无任何行时 **404**。
 *       写入缓存由进程启动时及每 `PREDICTION_SCHEDULE_INTERVAL_MS`（默认 6 小时）的定时任务完成：从懂球帝 tab **多页合并**（`nextDate` 链，与 H5 下拉一致），**仅以 `start_play` 按 UTC 无时区字符串解析**，再按 **北京时间** 筛「今明两天、未开赛」、拼入 prompt 的 `time`（北京时间 `YYYY-MM-DD HH:mm:ss`）后调模型写入（须配置 `VECTOR_ENGINE_API_KEY`；模型名见 `PREDICTION_VECTOR_ENGINE_MODEL`，默认 gpt-5.4-mini）。
 *       响应含 `createdAt` / `cacheCreatedAt`（均为该缓存行创建时间的 ISO 8601）。`content.matches` 按**写入缓存时**库内 `prompt` 中的 match_id 顺序整理（支持旧版「（match_id=…）」或 JSON 数组），每条 `match_id` 与该条缓存 `prompt` 一致。
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
 *         description: 返回库中 `createdAt` 最新一条预测结果
 *       404:
 *         description: 表中尚无足球预测缓存（等待定时任务写入）
 */
aiRouter.post("/football-prediction", authRequired, asyncHandler(postFootballPrediction));

/**
 * @swagger
 * /api/ai/basketball-prediction:
 *   post:
 *     summary: 篮球比分与盘路预测
 *     description: |
 *       默认系统提示要求模型输出结构化 JSON（胜负、让分、大小分、胜分差、单双、信心指数及 `jinrixuan` / `lengmen` / `chuanguan` 总结区）。
 *       **接口只读数据库**：固定返回 `BasketballPredictionCache` 表中 **`createdAt` 最新一行**（与请求 `prompt` 无关）；无行时 **404**。模型写入仅由定时任务执行（与足球一致：`start_play` 按 UTC 解析 → 北京时间今明未开赛筛选与 `time` 字段）。
 *       响应含 `createdAt` / `cacheCreatedAt`。`content.matches` 按该条缓存 `prompt` 中的 match_id 顺序整理。
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
 *         description: Body 非法（非 JSON 对象）等
 *       404:
 *         description: 表中尚无篮球预测缓存
 *       502:
 *         description: 库中结果无法解析为 JSON
 */
aiRouter.post("/basketball-prediction", authRequired, asyncHandler(postBasketballPrediction));
