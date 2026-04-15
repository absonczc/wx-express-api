import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { testEcho, testPing } from "./test.controller.js";

export const testRouter = Router();

/**
 * @swagger
 * /api/test/:
 *   get:
 *     summary: Test endpoint - ping
 *     tags: [Test]
 *     responses:
 *       200:
 *         description: OK
 */
testRouter.get("/", asyncHandler(testPing));

/**
 * @swagger
 * /api/test/:
 *   post:
 *     summary: Test endpoint - echo
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Echo response
 */
testRouter.post("/", asyncHandler(testEcho));
