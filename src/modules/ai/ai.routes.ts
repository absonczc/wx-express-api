import { Router } from "express";
import { authRequired } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { postAiChat, postAiPrompt, postFootballPrediction } from "./ai.controller.js";

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
 * /api/ai/football-prediction:
 *   post:
 *     summary: 足球比分预测
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
