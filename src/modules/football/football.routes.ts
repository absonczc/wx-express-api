import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getFootballList, getTodayTomorrowMatches, getFootballListTransformed, getMatchDetail } from "./football.controller.js";

export const footballRouter = Router();

/**
 * @swagger
 * /api/football/list:
 *   get:
 *     summary: 获取足球赛事列表（原始数据）
 *     tags: [Football]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *         required: true
 *         description: 起始时间，格式如 "2026-04-1400:00:00"
 *       - in: query
 *         name: version
 *         schema:
 *           type: integer
 *         description: API 版本，默认 576
 *       - in: query
 *         name: init
 *         schema:
 *           type: integer
 *         description: 初始化标识，默认 0
 *       - in: query
 *         name: wfrom
 *         schema:
 *           type: integer
 *         description: 来源标识，默认 2
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         description: 来源，默认 "msite_com"
 *     responses:
 *       200:
 *         description: 足球赛事列表（懂球帝原始数据）
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FootballListResponse'
 */
footballRouter.get("/list", asyncHandler(getFootballList));

/**
 * @swagger
 * /api/football/list-transformed:
 *   get:
 *     summary: 获取足球赛事列表（转换后格式）
 *     tags: [Football]
 *     description: |
 *       将懂球帝原始数据转换为统一格式，包含：
 *       - matchId: 比赛ID
 *       - teamA/teamB: 球队信息（id、name、logo）
 *       - league: 联赛信息（id、name、color）
 *       - matchTime: 比赛时间（北京时间）
 *       - status: 比赛状态
 *       - score: 比分信息（全场/半场）
 *       - events: 事件列表（进球、红黄牌等）
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *         required: true
 *         description: 起始时间，格式如 "2026-04-1400:00:00"
 *       - in: query
 *         name: version
 *         schema:
 *           type: integer
 *         description: API 版本，默认 576
 *       - in: query
 *         name: init
 *         schema:
 *           type: integer
 *         description: 初始化标识，默认 0
 *       - in: query
 *         name: wfrom
 *         schema:
 *           type: integer
 *         description: 来源标识，默认 2
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         description: 来源，默认 "msite_com"
 *     responses:
 *       200:
 *         description: 转换格式后的足球赛事列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FootballListTransformedResponse'
 */
footballRouter.get("/list-transformed", asyncHandler(getFootballListTransformed));

/**
 * @swagger
 * /api/football/today-tomorrow:
 *   get:
 *     summary: 获取今天和明天未开始的比赛（用于足球预测）
 *     tags: [Football]
 *     parameters:
 *       - in: query
 *         name: start
 *         schema:
 *           type: string
 *         description: 起始时间，格式如 "2026-04-1400:00:00"
 *     responses:
 *       200:
 *         description: |
 *           `data` 为 JSON 数组字符串：筛选「北京时间今天、明天、且未开赛」的场次，每项含 home、away、time（YYYY-MM-DD HH:mm:ss）、match_id；无场次时为空字符串。
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TodayTomorrowMatchesResponse'
 */
footballRouter.get("/today-tomorrow", asyncHandler(getTodayTomorrowMatches));

/**
 * @swagger
 * /api/football/match-detail:
 *   get:
 *     summary: 获取比赛详情（赛况、阵容、分析数据）
 *     tags: [Football]
 *     description: |
 *       聚合三个懂球帝接口的数据，返回转换后的统一格式：
 *       - matchInfo: 比赛基本信息（联赛、球队、比分等）
 *       - events: 比赛事件（进球、红黄牌等）
 *       - statistics: 比赛统计数据
 *       - lineup: 比赛阵容（首发、替补）
 *       - analysis: 比赛分析（攻防、综合实力、控球率、角球、半全场、事件统计）
 *     parameters:
 *       - in: query
 *         name: matchId
 *         schema:
 *           type: string
 *         required: true
 *         description: 比赛ID
 *     responses:
 *       200:
 *         description: 转换格式后的比赛详情
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MatchDetailResponse'
 */
footballRouter.get("/match-detail", asyncHandler(getMatchDetail));