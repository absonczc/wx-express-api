import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MiniApp Express API",
      version: "1.0.0",
      description: "Express + Prisma + JWT backend with WeChat mini-program login",
    },
    servers: [
      {
        url: "http://localhost:9080",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string", example: "cuid123456789" },
            openid: { type: "string", example: "oXXXXX" },
            unionid: { type: "string", nullable: true, example: "uXXXXX" },
            nickname: { type: "string", nullable: true, example: "John Doe" },
            avatarUrl: { type: "string", nullable: true, example: "https://example.com/avatar.png" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["code"],
          properties: {
            code: { type: "string", description: "WeChat login code", example: "091xxx" },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            token: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
            user: { $ref: "#/components/schemas/User" },
          },
        },
        UpdateUserRequest: {
          type: "object",
          properties: {
            nickname: { type: "string", example: "New Name" },
            avatarUrl: { type: "string", example: "https://example.com/new-avatar.png" },
          },
        },
        Error: {
          type: "object",
          properties: {
            code: { type: "string", example: "AUTH_ERROR" },
            message: { type: "string", example: "Invalid credentials" },
          },
        },
        FootballListResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                list: {
                  type: "array",
                  description: "比赛列表",
                  items: {
                    type: "object",
                    properties: {
                      match_id: { type: "string", description: "比赛ID" },
                      team_A_id: { type: "string", description: "球队A ID" },
                      team_A_name: { type: "string", description: "球队A名称" },
                      team_A_logo: { type: "string", description: "球队A logo" },
                      team_B_id: { type: "string", description: "球队B ID" },
                      team_B_name: { type: "string", description: "球队B名称" },
                      team_B_logo: { type: "string", description: "球队B logo" },
                      competition_id: { type: "string", description: "联赛ID" },
                      competition_name: { type: "string", description: "联赛名称" },
                      competition_color: { type: "string", description: "联赛颜色" },
                      start_play: { type: "string", description: "比赛开始时间" },
                      sort_timestamp: { type: "integer", description: "比赛时间戳" },
                      status: { type: "string", description: "比赛状态，如 Played、Scheduled" },
                      fs_A: { type: "string", description: "球队A全场比分" },
                      fs_B: { type: "string", description: "球队B全场比分" },
                      hts_A: { type: "string", description: "球队A半场比分" },
                      hts_B: { type: "string", description: "球队B半场比分" },
                      minute_period: { type: "string", description: "比赛时段，如 FT(全场)" },
                      minute: { type: "string", description: "比赛时间（分钟）" },
                      team_A_events: {
                        type: "array",
                        description: "球队A事件（进球、红黄牌等）",
                        items: { type: "object", properties: { title: { type: "string" }, code: { type: "string" } } },
                      },
                      team_B_events: {
                        type: "array",
                        description: "球队B事件（进球、红黄牌等）",
                        items: { type: "object", properties: { title: { type: "string" }, code: { type: "string" } } },
                      },
                    },
                  },
                },
                prevDate: { type: "string", description: "上一页日期" },
                nextDate: { type: "string", description: "下一页日期" },
                finishFlag: { type: "string", description: "完成标识" },
              },
            },
          },
        },
        FootballListTransformedResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                matches: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      matchId: { type: "string", description: "比赛ID" },
                      teamA: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string", description: "球队A名称" },
                          logo: { type: "string", description: "球队A logo" },
                        },
                      },
                      teamB: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string", description: "球队B名称" },
                          logo: { type: "string", description: "球队B logo" },
                        },
                      },
                      league: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string", description: "联赛名称" },
                          color: { type: "string", description: "联赛颜色" },
                        },
                      },
                      matchTime: { type: "string", description: "比赛时间（北京时间）" },
                      status: { type: "string", description: "比赛状态，如 Played、Scheduled" },
                      score: {
                        type: "object",
                        properties: {
                          fullTime: { type: "string", description: "全场比分，如 2-1" },
                          halfTime: { type: "string", description: "半场比分，如 1-0" },
                        },
                      },
                      events: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            player: { type: "string", description: "球员名称" },
                            time: { type: "string", description: "事件时间，如 45'" },
                            type: { type: "string", description: "事件类型，G=进球，Y=黄牌，R=红牌" },
                          },
                        },
                      },
                    },
                  },
                },
                total: { type: "integer", description: "比赛总数" },
              },
            },
          },
        },
        TodayTomorrowMatchesResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            data: { type: "string", description: "格式化后的今天和明天比赛列表" },
          },
        },
        FootballPredictionRequest: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              description: "比赛信息，如：比赛1（match_id=1）：球队A vs 球队B｜联赛｜时间",
              example: "比赛1（match_id=1）：\n球队A vs 球队B｜英超｜2026-04-15 03:00\n\n比赛2（match_id=2）：\n球队C vs 球队D｜西甲｜2026-04-15 04:00",
            },
            system: {
              type: "string",
              description: "系统提示词，默认为足球分析师角色（可选）",
            },
          },
        },
        FootballPredictionResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            content: { type: "string", description: "AI 返回的预测结果 JSON" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/**/*.routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);