import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { getWeatherDaily, getWeatherNow } from "./weather.controller.js";

export const weatherRouter = Router();

/**
 * @swagger
 * /api/weather/now:
 *   get:
 *     summary: 实时天气（和风天气 v7 `/v7/weather/now` 代理）
 *     description: |
 *       服务端使用控制台凭据请求和风天气 [实时天气](https://dev.qweather.com/docs/api/weather/weather-now/)，
 *       将上游 JSON 放在响应体 `data` 中返回，并额外请求
 *       [实时天气预警](https://dev.qweather.com/docs/api/warning/weather-alert/) 写入 `data.weatherAlert`。
 *       调用链路为：先用地区名称调用
 *       [城市搜索](https://dev.qweather.com/docs/api/geoapi/city-lookup/) 自动解析经纬度，再请求实时天气。
 *       须配置环境变量 `QWEATHER_API_KEY`（API KEY 或短期 JWT）与 `QWEATHER_API_HOST`（控制台分配的专属 API Host，必填）。
 *       身份认证：API KEY 使用请求头 `X-QW-Api-Key`；若配置值形如三段 JWT，则改用 `Authorization: Bearer`。
 *     tags: [Weather]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: location
 *         required: true
 *         schema:
 *           type: string
 *           example: "北京"
 *         description: |
 *           地区名称，必选。服务端会先调用和风城市搜索接口解析为经纬度后，再查询实时天气。
 *           建议传可识别的城市/区县名称（如 `北京`、`上海浦东`），重名地区时按和风返回相关性第一条结果。
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           example: "zh-hans"
 *         description: 多语言，可选；取值见和风「多语言」文档。
 *       - in: query
 *         name: unit
 *         schema:
 *           type: string
 *           enum: [m, i]
 *           default: m
 *         description: 单位制，`m` 公制（默认），`i` 英制。
 *     responses:
 *       200:
 *         description: |
 *           成功。`data` 为和风成功响应体：`code` 为 `"200"` 时表示实况正常返回；
 *           `now` 内含 `obsTime`、`temp`、`text` 等实况字段；`weatherAlert` 为同坐标的实时预警结果；
 *           `updateTime`、`fxLink`、`refer` 含义见 schema。
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WeatherNowResponse'
 *       400:
 *         description: 缺少/非法 `location`（地区名）或地区无法匹配，或上游返回 400/404 类参数错误（`details` 中可能含和风原始体）
 *       502:
 *         description: 上游和风返回非 200 业务码、HTTP 错误或服务端解析失败（`details` 可能含上游 JSON）
 *       503:
 *         description: 未配置 `QWEATHER_API_KEY` 或 `QWEATHER_API_HOST`
 */
weatherRouter.get("/now", asyncHandler(getWeatherNow));

/**
 * @swagger
 * /api/weather/daily:
 *   get:
 *     summary: 每日天气预报（和风天气 v7 `/v7/weather/{days}` 代理）
 *     description: |
 *       服务端使用控制台凭据请求和风天气 [每日天气预报](https://dev.qweather.com/docs/api/weather/weather-daily-forecast/)，
 *       将上游 JSON 放在响应体 `data` 中返回，并额外请求
 *       [实时天气预警](https://dev.qweather.com/docs/api/warning/weather-alert/) 写入 `data.weatherAlert`。
 *       默认查询 `3d`；可通过 `days` 切换 3/7/10/15/30 天。
 *       调用链路为：先用地区名称调用 [城市搜索](https://dev.qweather.com/docs/api/geoapi/city-lookup/) 自动解析经纬度，再请求预报。
 *       凭据与 Host 配置规则同实时天气接口：`QWEATHER_API_KEY` 与 `QWEATHER_API_HOST` 均必填。
 *     tags: [Weather]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: days
 *         required: false
 *         schema:
 *           type: string
 *           enum: [3d, 7d, 10d, 15d, 30d]
 *           default: 3d
 *         description: 预报天数；未传或非法值时服务端默认使用 `3d`。
 *       - in: query
 *         name: location
 *         required: true
 *         schema:
 *           type: string
 *           example: "北京"
 *         description: |
 *           地区名称，必选。服务端会先通过城市搜索接口解析经纬度，再调用每日预报接口。
 *           建议传可识别的城市/区县名称（如 `北京`、`上海浦东`）。
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *           example: "zh-hans"
 *         description: 多语言，可选。
 *       - in: query
 *         name: unit
 *         schema:
 *           type: string
 *           enum: [m, i]
 *           default: m
 *         description: 单位制，`m` 公制（默认），`i` 英制。
 *     responses:
 *       200:
 *         description: |
 *           成功。`data.code` 为 `"200"`；`data.daily[]` 为逐日预报数组，含日期、白天/夜间天气、温度、风、湿度、降水、紫外线等字段；
 *           `data.weatherAlert` 为同坐标的实时预警结果。
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WeatherDailyResponse'
 *       400:
 *         description: 缺少/非法 `location`（地区名）或地区无法匹配，或上游返回 400/404 类参数错误（`details` 可能含和风原始体）
 *       502:
 *         description: 上游和风返回非 200 业务码、HTTP 错误或服务端解析失败（`details` 可能含上游 JSON）
 *       503:
 *         description: 未配置 `QWEATHER_API_KEY` 或 `QWEATHER_API_HOST`
 */
weatherRouter.get("/daily", asyncHandler(getWeatherDaily));
