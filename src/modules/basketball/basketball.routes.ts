import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getBasketballMatchDetail, getBasketballTab } from "./basketball.controller.js";

export const basketballRouter = Router();

/**
 * @swagger
 * /api/basketball/tab:
 *   get:
 *     summary: 篮球赛事 tab（懂球帝 data/tab/new/basketball 代理）
 *     description: |
 *       服务端请求 `https://api.dongqiudi.com/data/tab/new/basketball`，将上游 JSON 包在 `data` 中返回。
 *       查询参数与懂球帝 H5 一致；未传 `start` 时使用默认示例时间。
 *     tags: [Basketball]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *           example: "2026-04-1516:00:00"
 *         description: 起始时间（懂球帝格式，无空格）
 *       - in: query
 *         name: version
 *         schema:
 *           type: integer
 *           default: 576
 *         description: API 版本
 *       - in: query
 *         name: init
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 初始化标识（首屏一般为 1）
 *       - in: query
 *         name: wfrom
 *         schema:
 *           type: integer
 *           default: 2
 *         description: 来源标识
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           default: msite_com
 *         description: 来源渠道
 *     responses:
 *       200:
 *         description: |
 *           成功。`data` 为懂球帝 tab 原始体：`list` 见 schema `BasketballTabListItem`（单条赛程摘要）；
 *           `prevDate` / `nextDate` / `finishFlag` 为分页游标；其余字段以 `additionalProperties` 为准。
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasketballTabResponse'
 *       500:
 *         description: 上游懂球帝请求失败或服务端错误
 */
basketballRouter.get("/tab", asyncHandler(getBasketballTab));

/**
 * @swagger
 * /api/basketball/matches/{matchId}/detail:
 *   get:
 *     summary: 篮球比赛详情（赛场态势 + 赛前数据对比）
 *     description: |
 *       并行请求懂球帝：
 *       - `GET https://api.dongqiudi.com/mobile/match/situation/{matchId}`
 *       - `GET https://sport-data.dongqiudi.com/soccer/biz/dqd/match/pre_analyze_data_contrast/{matchId}?app=dqd`
 *       将两段上游 JSON 分别放在 `data.situation` 与 `data.preAnalyzeContrast` 中返回（字段随上游变化）。
 *     tags: [Basketball]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^\\d+$'
 *           example: "54439749"
 *         description: 懂球帝比赛 ID
 *     responses:
 *       200:
 *         description: |
 *           成功。`data.situation` 为赛场态势根对象（`DongqiudiSituationRoot`：`match` 含主客队/比分/节次等，`info` 含事件与统计）；
 *           `data.preAnalyzeContrast` 为赛前数据对比（`DongqiudiPreAnalyzeContrastBody`：`errno`/`message`/`data`，篮球常见 `data.comprehensive`）。
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BasketballMatchDetailResponse'
 *       400:
 *         description: path 中 matchId 非法
 *       500:
 *         description: 上游请求失败或服务端错误
 */
basketballRouter.get("/matches/:matchId/detail", asyncHandler(getBasketballMatchDetail));
