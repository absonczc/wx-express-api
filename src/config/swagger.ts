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
        url: "http://localhost:3000",
        description: "本地开发（默认 PORT=3000）",
      },
      {
        url: "http://localhost:9080",
        description: "本地开发（备用端口）",
      },
    ],
    tags: [
      { name: "Football", description: "懂球帝足球赛事与比赛详情" },
      { name: "Basketball", description: "懂球帝篮球赛事 tab、比赛详情代理" },
      { name: "Auth", description: "微信登录与 JWT" },
      { name: "Users", description: "用户资料" },
      {
        name: "AI",
        description:
          "向量引擎（OpenAI 兼容 Chat）；通用对话、旅游攻略 JSON、足球/篮球预测等。须配置 VECTOR_ENGINE_API_KEY。",
      },
      { name: "Test", description: "测试接口" },
      {
        name: "Weather",
        description:
          "和风天气代理（先 GeoAPI 城市搜索解析地区名称，再请求 v7 `/v7/weather/now` 与 `/v7/weather/{days}`）；须配置 QWEATHER_API_KEY 与 QWEATHER_API_HOST。",
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
        BasketballTabListItem: {
          type: "object",
          description: "篮球 tab 单场比赛摘要（懂球帝 `list[]`）；上游可能增减字段",
          properties: {
            relate_type: { type: "string", description: "关联类型" },
            relate_id: { type: "string", description: "关联 ID" },
            match_id: {
              type: "string",
              description: "比赛 ID，对应详情 `GET /api/basketball/matches/{matchId}/detail` 的路径参数",
              example: "54439749",
            },
            team_A_id: { type: "string", description: "主队 ID" },
            team_A_name: { type: "string", description: "主队名称" },
            team_A_logo: { type: "string", description: "主队 logo URL" },
            team_B_id: { type: "string", description: "客队 ID" },
            team_B_name: { type: "string", description: "客队名称" },
            team_B_logo: { type: "string", description: "客队 logo URL" },
            date_utc: { type: "string", description: "比赛日 UTC 日期" },
            time_utc: { type: "string", description: "开赛 UTC 时间" },
            start_play: { type: "string", description: "开赛时间（展示用字符串）" },
            sort_timestamp: { type: "integer", description: "排序用 Unix 时间戳（秒）" },
            status: { type: "string", description: "状态，如 Played、Playing、Scheduled" },
            fs_A: { type: "string", description: "主队全场得分" },
            fs_B: { type: "string", description: "客队全场得分" },
            hts_A: { type: "string", description: "主队半场/节间相关比分" },
            hts_B: { type: "string", description: "客队半场比分" },
            minute: { type: "string", description: "时钟或进行时间" },
            minute_period: { type: "string", description: "节次或阶段，如 FT、Q4" },
            competition_id: { type: "string", description: "联赛 ID" },
            competition_name: { type: "string", description: "联赛名称，如 NBA" },
            competition_color: { type: "string", description: "联赛主题色" },
            round_name: { type: "string", description: "轮次名称" },
            cmp_type: { type: "string", description: "球种，如 basketball" },
            animationLivingFlag: { type: "string", description: "动画直播等标识" },
          },
          additionalProperties: true,
        },
        BasketballTabResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            data: {
              type: "object",
              description: "懂球帝 `data/tab/new/basketball` 原始体；除下列字段外可能还有上游扩展字段",
              properties: {
                list: {
                  type: "array",
                  description: "赛程列表",
                  items: { $ref: "#/components/schemas/BasketballTabListItem" },
                },
                prevDate: { type: "string", description: "加载更早数据的游标/日期" },
                nextDate: { type: "string", description: "加载更晚数据的游标/日期" },
                finishFlag: { type: "string", description: "列表是否已到头尾等标识" },
              },
              additionalProperties: true,
            },
          },
        },
        DongqiudiSituationTeam: {
          type: "object",
          description: "态势接口中的主队或客队对象（篮球含四节得分等）",
          properties: {
            id: { type: "string", description: "球队 ID" },
            name: { type: "string", description: "球队全称" },
            short_name: { type: "string", description: "简称" },
            logo: { type: "string", description: "队徽 URL" },
            score: { type: "string", description: "总得分字符串" },
            fs: { type: "string", description: "全场得分（与 score 可能一致）" },
            hts: { type: "string", description: "半场相关得分" },
            fs_1: { type: "integer", description: "第 1 节得分（篮球）" },
            fs_2: { type: "integer", description: "第 2 节得分" },
            fs_3: { type: "integer", description: "第 3 节得分" },
            fs_4: { type: "integer", description: "第 4 节得分" },
            rank: {
              type: "object",
              description: "联赛排名信息",
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
        DongqiudiSituationMatch: {
          type: "object",
          description: "`situation.match`：单场核心元数据与比分",
          properties: {
            id: { type: "string", description: "比赛 ID（可能与 tab 的 match_id 位数不同，均为懂球帝体系）" },
            competition: {
              type: "object",
              description: "联赛信息",
              properties: {
                id: { type: "string" },
                name: { type: "string", example: "NBA" },
                short_name: { type: "string" },
                logo: { type: "string" },
                color: { type: "string" },
                type: { type: "string", description: "球种，如 basketball" },
              },
              additionalProperties: true,
            },
            season: { type: "object", description: "赛季", additionalProperties: true },
            round: { type: "object", description: "轮次/阶段", additionalProperties: true },
            team_A: { $ref: "#/components/schemas/DongqiudiSituationTeam" },
            team_B: { $ref: "#/components/schemas/DongqiudiSituationTeam" },
            venue: { type: "object", additionalProperties: true },
            start_play: { type: "string", description: "开赛时间" },
            end_play: { type: "string", description: "结束时间" },
            status: { type: "string", description: "Played、Playing 等" },
            period: { type: "string", description: "阶段，如 FT、Q1" },
            minute: { type: "string", description: "时钟" },
            winner: { type: "string", description: "获胜方球队 ID" },
            cmp_type: { type: "string", description: "球种" },
            fouls_A: { type: "string", description: "主队犯规数（篮球）" },
            fouls_B: { type: "string", description: "客队犯规数" },
            timeout_A: { type: "string", description: "主队暂停" },
            timeout_B: { type: "string", description: "客队暂停" },
            live: { type: "object", description: "直播相关", additionalProperties: true },
            live_source: { type: "array", description: "直播源列表", items: { type: "object", additionalProperties: true } },
          },
          additionalProperties: true,
        },
        DongqiudiSituationInfo: {
          type: "object",
          description: "`situation.info`：事件时间轴、技术统计等",
          properties: {
            status: { type: "string", description: "与赛况相关的状态字段" },
            teamurl: { type: "string", description: "球队页链接等" },
            events: {
              type: "object",
              description: "按时间键聚合的事件对象（键为分钟或序号，值为该时刻双方事件数组）",
              additionalProperties: true,
            },
            statistics: {
              type: "object",
              description: "技术统计（含 team_A、team_B、list 分项等）",
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
        DongqiudiSituationRoot: {
          type: "object",
          description: "懂球帝 `GET /mobile/match/situation/{matchId}` 根对象（本接口置于 `data.situation`）",
          properties: {
            show_time_day: { type: "string", description: "展示用日期，如 04-16" },
            show_time_min: { type: "string", description: "展示用时间" },
            match: { $ref: "#/components/schemas/DongqiudiSituationMatch" },
            info: { $ref: "#/components/schemas/DongqiudiSituationInfo" },
            matchid: { type: "string", description: "与路径一致的比赛 ID 字符串" },
          },
          additionalProperties: true,
        },
        DongqiudiPreAnalyzeComprehensiveRow: {
          type: "object",
          description: "「综合实力」下某一对比行",
          properties: {
            title: { type: "string", description: "对比维度标题，如近 10 场战绩" },
            winner: { type: "string", description: "该行优势方 team_A / team_B" },
            team_A: {
              type: "object",
              properties: {
                match_info: { type: "string", description: "文字战绩，如 6 胜 0 平 4 负" },
                score: { type: "string", description: "条形占比等，如 67%" },
              },
              additionalProperties: true,
            },
            team_B: {
              type: "object",
              properties: {
                match_info: { type: "string" },
                score: { type: "string" },
              },
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
        DongqiudiPreAnalyzeComprehensive: {
          type: "object",
          description: "赛前分析中的「综合实力」模块（篮球常见）",
          properties: {
            title: { type: "string", example: "综合实力" },
            team_A_score: { type: "string", description: "主队综合占比" },
            team_B_score: { type: "string", description: "客队综合占比" },
            winner: { type: "string", description: "综合优势方 team_A / team_B" },
            data: {
              type: "array",
              description: "各维度对比行",
              items: { $ref: "#/components/schemas/DongqiudiPreAnalyzeComprehensiveRow" },
            },
          },
          additionalProperties: true,
        },
        DongqiudiPreAnalyzeContrastBody: {
          type: "object",
          description:
            "懂球帝 `pre_analyze_data_contrast` 响应（本接口置于 `data.preAnalyzeContrast`）；足球赛可能还有 attack_defend、control、corner 等块，篮球常以 comprehensive 为主",
          properties: {
            errno: { type: "integer", description: "0 表示成功", example: 0 },
            message: { type: "string", example: "success" },
            data: {
              type: "object",
              properties: {
                comprehensive: { $ref: "#/components/schemas/DongqiudiPreAnalyzeComprehensive" },
              },
              additionalProperties: true,
            },
          },
          additionalProperties: true,
        },
        BasketballMatchDetailData: {
          type: "object",
          description: "篮球详情聚合体：两段上游 JSON 原样",
          required: ["situation", "preAnalyzeContrast"],
          properties: {
            situation: { $ref: "#/components/schemas/DongqiudiSituationRoot" },
            preAnalyzeContrast: { $ref: "#/components/schemas/DongqiudiPreAnalyzeContrastBody" },
          },
        },
        BasketballMatchDetailResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            data: { $ref: "#/components/schemas/BasketballMatchDetailData" },
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
            data: {
              type: "string",
              description:
                "JSON 数组字符串：筛选「北京时间今天、明天、且未开赛」的场次，每项含 home、away、time（YYYY-MM-DD HH:mm:ss）、match_id。无场次时为空字符串。",
              example:
                '[{"home":"吉达国民","away":"柔佛新山","time":"2026-04-17 22:45:00","match_id":"54440340"}]',
            },
          },
        },
        AiPromptRequest: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              description: "用户输入，非空",
              example: "用一句话介绍 Node.js",
            },
            system: {
              type: "string",
              description: "系统提示词（可选）",
              example: "请用中文简洁回答。",
            },
            model: {
              type: "string",
              description: "模型名；不传则使用环境变量 VECTOR_ENGINE_MODEL",
              example: "gpt-5.4-nano",
            },
          },
        },
        AiPromptResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            model: { type: "string", description: "实际使用的模型名", example: "gpt-5.4-nano" },
            content: { type: "string", description: "模型生成的文本内容" },
          },
        },
        TravelGuideRequest: {
          type: "object",
          required: ["prompt"],
          description:
            "用户自然语言描述行程需求；服务端默认注入「专业旅行规划师」system，要求模型只输出合法 JSON。",
          properties: {
            prompt: {
              type: "string",
              description: `用户行程需求（必填、非空）。建议在一条消息中写明：
- 目的地、出发地
- 出行天数（如 3 天 2 晚）、出行时间段（如 2026 年 5 月）
- 出行人数与关系（如 2 人 / 家庭）
- 预算范围（如中等 / 人均金额）
- 旅行偏好（美食 / 拍照 / 自然 / 文化 / 轻松 / 特种兵等）`,
              example:
                "目的地：日本京都；出发地：上海；3天2晚；2026年5月；2人夫妻；人均预算约4000元；偏好美食、古建筑与轻松节奏。",
            },
            system: {
              type: "string",
              description:
                "可选。覆盖服务端默认旅行规划师 system。覆盖后仍会对模型输出做 JSON 解析；若你的 system 不要求纯 JSON，接口可能返回 502。",
            },
            model: {
              type: "string",
              description:
                "模型名（可选）。不传时使用环境变量 `TRAVEL_GUIDE_VECTOR_ENGINE_MODEL`，未配置则默认 **`gpt-5.4-nano`**（与通用 `VECTOR_ENGINE_MODEL`、足篮预测模型独立）。传入则覆盖。",
              example: "gpt-5.4-nano",
            },
          },
        },
        TravelGuideTextField: {
          oneOf: [
            {
              type: "string",
              description: "仅一条、无并列分点时的整段文本",
            },
            {
              type: "array",
              items: { type: "string" },
              description:
                "模型应按 system 要求对 1.2.3. / 1、2、等多分点直接使用数组；若误用多行 string，服务端会按行拆成数组",
            },
          ],
          description:
            "用于 `day_*` 的 schedule 等五字段，以及根级 total_budget、top_3、avoid_tips、map_line、alternative_plan、rain_plan",
        },
        TravelGuideDay: {
          type: "object",
          description:
            "单日行程块。键名为 `day_1`、`day_2`…（可有 `day_4` 等）。字段 schedule / attractions / restaurants / hotels / transportation：凡有 1.2.3. 或并列多分点，模型应直接输出 string[]；仅一句可用 string；含换行单 string 时服务端会拆成 string[]。",
          properties: {
            schedule: { $ref: "#/components/schemas/TravelGuideTextField" },
            attractions: { $ref: "#/components/schemas/TravelGuideTextField" },
            restaurants: { $ref: "#/components/schemas/TravelGuideTextField" },
            hotels: { $ref: "#/components/schemas/TravelGuideTextField" },
            transportation: { $ref: "#/components/schemas/TravelGuideTextField" },
          },
        },
        TravelGuideContent: {
          type: "object",
          description:
            "默认 system 要求：凡 1.2.3. / 1、2、/ 多分点并列处模型应直接输出 string[]。服务端 JSON.parse 后，对 `day_*` 五字段及根级 total_budget、top_3、avoid_tips、map_line、alternative_plan、rain_plan：若仍为含换行的 string，会按行拆成 string[]。",
          properties: {
            day_1: { $ref: "#/components/schemas/TravelGuideDay" },
            day_2: { $ref: "#/components/schemas/TravelGuideDay" },
            day_3: { $ref: "#/components/schemas/TravelGuideDay" },
            total_budget: { $ref: "#/components/schemas/TravelGuideTextField" },
            top_3: { $ref: "#/components/schemas/TravelGuideTextField" },
            avoid_tips: { $ref: "#/components/schemas/TravelGuideTextField" },
            map_line: { $ref: "#/components/schemas/TravelGuideTextField" },
            alternative_plan: { $ref: "#/components/schemas/TravelGuideTextField" },
            rain_plan: { $ref: "#/components/schemas/TravelGuideTextField" },
          },
          additionalProperties: true,
        },
        TravelGuideResponse: {
          type: "object",
          required: ["ok", "content"],
          description:
            "成功时 `ok` 为 true；`content` 为已解析的对象（非字符串）。默认 system 要求模型对分点内容直接输出 string[]；服务端另对 `day_*` 五字段及根级总结六字段中含换行的 string 做按行拆分（见 `TravelGuideTextField`）。",
          properties: {
            ok: { type: "boolean", example: true },
            model: {
              type: "string",
              description: "本轮 Vector Engine 实际使用的模型名（未传 body `model` 时默认 gpt-5.4-nano）",
              example: "gpt-5.4-nano",
            },
            content: { $ref: "#/components/schemas/TravelGuideContent" },
          },
          example: {
            ok: true,
            model: "gpt-5.4-nano",
            content: {
              day_1: {
                schedule: ["上午：伏见稻荷", "下午：清水寺周边", "晚上：祇园散步"],
                attractions: ["伏见稻荷大社：千本鸟居… 建议 2 小时", "清水寺：… 建议 1.5 小时"],
                restaurants: "XX 怀石料理：当季套餐… 人均约 800 元",
                hotels: "XX 酒店：近祇园四条站… 约 900–1300 元/晚",
                transportation: ["酒店 → 稻荷：JR 约 15 分钟", "稻荷 → 清水寺区域：…"],
              },
              day_2: {
                schedule: "上午：岚山 下午：金阁寺 晚上：回四条河原町",
                attractions: "岚山竹林与渡月桥…；金阁寺…",
                restaurants: "汤豆腐名店 XX：… 人均约 200 元",
                hotels: "（同 day_1）",
                transportation: "市区 ↔ 岚山：阪急/岚电约 40 分钟",
              },
              total_budget: ["机酒合计约 9000 元", "餐饮门票约 2000–4000 元"],
              top_3: ["清水寺", "岚山", "伏见稻荷大社"],
              avoid_tips: ["热门景点尽量早到", "部分餐厅需预约"],
              map_line: ["D1 偏东山", "D2 西北郊+市中心购物"],
              alternative_plan: ["若岚山小火车售罄可改游船"],
              rain_plan: ["雨天改室内：京都国立博物馆、商场"],
            },
          },
        },
        TravelGuideAsyncStartResponse: {
          type: "object",
          required: ["ok", "jobId"],
          description:
            "异步旅游攻略提交成功。请用 `jobId` 调用 `GET /api/ai/travel-guide/jobs/{jobId}`；建议客户端每约 **8 秒** 轮询一次直至 `status` 为 `completed`、`failed` 或 `cancelled`；可调用 `POST .../jobs/{jobId}/cancel` 取消进行中的任务。",
          properties: {
            ok: { type: "boolean", example: true },
            jobId: {
              type: "string",
              format: "uuid",
              description: "任务 ID，与当前登录用户绑定；约 1 小时后过期",
            },
          },
        },
        TravelGuideJobPollResponse: {
          type: "object",
          required: ["ok", "status"],
          description:
            "异步任务查询结果。`status` 为 `pending` 时仅含 `ok`/`status`；`completed` 时含 `model`/`content`（与同步 `POST /travel-guide` 成功体一致）；`failed` 时含 `error`，可选 `details`（如 JSON 解析失败时的 `preview`）、`httpStatus`（与若同步调用失败时对应的 HTTP 状态码一致，如 400/502/503）；`cancelled` 表示用户已调用取消或上游请求被中止，仅含 `ok`/`status`。",
          properties: {
            ok: { type: "boolean", example: true },
            status: {
              type: "string",
              enum: ["pending", "completed", "failed", "cancelled"],
              description: "任务状态",
            },
            model: {
              type: "string",
              description: "仅 `status: completed` 时存在；实际使用的模型名",
            },
            content: {
              $ref: "#/components/schemas/TravelGuideContent",
              description: "仅 `status: completed` 时存在；已解析的攻略 JSON 对象",
            },
            error: {
              type: "string",
              description: "仅 `status: failed` 时存在；错误说明",
            },
            details: {
              type: "object",
              additionalProperties: true,
              description: "仅 `status: failed` 时可能存在；与 `HttpErrorBody.details` 类似",
            },
            httpStatus: {
              type: "integer",
              description:
                "仅 `status: failed` 时可能存在；对应同步接口若直接返回错误时会使用的 HTTP 状态码（轮询接口 HTTP 仍为 200）",
              example: 502,
            },
          },
        },
        TravelGuideJobCancelResponse: {
          type: "object",
          required: ["ok", "cancelled"],
          description: "`POST /api/ai/travel-guide/jobs/{jobId}/cancel` 成功取消进行中的任务。",
          properties: {
            ok: { type: "boolean", example: true },
            cancelled: {
              type: "boolean",
              example: true,
              description: "恒为 true，表示本次请求将任务置为已取消",
            },
          },
        },
        HttpErrorBody: {
          type: "object",
          description: "全局错误中间件返回体（非 2xx 时常见 `ok: false`）",
          properties: {
            ok: { type: "boolean", example: false },
            error: { type: "string", example: "AI 返回内容无法解析为 JSON" },
            details: {
              description: "可选扩展信息；旅游攻略 JSON 解析失败时可能含 `preview`（模型正文前缀）",
              type: "object",
              additionalProperties: true,
              properties: {
                preview: {
                  type: "string",
                  description: "无法解析为 JSON 时，截取的部分模型原文，便于排查",
                },
              },
            },
          },
        },
        FootballPredictionRequest: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "比赛信息（可选）。不传或空字符串时服务端从懂球帝拉取赛程并自动生成 JSON 数组字符串：筛选「北京时间今天、明天、且未开赛」的场次，字段 home、away、time（北京时间）、match_id。",
              example:
                '[{"home":"吉达国民","away":"柔佛新山","time":"2026-04-17 22:45:00","match_id":"54440340"}]',
            },
            system: {
              type: "string",
              description: "HTTP 预测接口只读库，**忽略**该字段（写入由定时任务完成）",
            },
            model: {
              type: "string",
              description:
                "HTTP 预测接口只读库，**忽略**该字段（定时任务写入时使用 `PREDICTION_VECTOR_ENGINE_MODEL`，默认 gpt-5.4）",
            },
          },
        },
        FootballPredictionResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            cached: {
              type: "boolean",
              description: "恒为 true：内容来自 `FootballPredictionCache` 中该 `prompt` 的 `createdAt` 最新一条",
              example: true,
            },
            cacheCreatedAt: {
              type: "string",
              format: "date-time",
              description: "本条缓存记录的创建时间（ISO 8601），便于确认是否为库中最新写入",
            },
            content: {
              description:
                "库中存储的模型输出 JSON（已解析为对象）。成功解析且含 `matches` 时：服务端按本次请求 `prompt` 中 match_id 顺序重排（支持旧版「（match_id=…）」文本或 JSON 数组每项的 `match_id`），并将每条 `match_id` 强制为 prompt 中的原样字符串；`n`、`title` 与输出顺序一致（比赛1、比赛2…）。",
              oneOf: [{ type: "object", additionalProperties: true }, { type: "string" }],
            },
          },
        },
        BasketballPredictionRequest: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description:
                "比赛信息（可选）。不传或空字符串时服务端从懂球帝篮球 tab 拉取赛程并自动生成与足球接口一致的 JSON 数组字符串（今天、明天、未开赛）。",
              example:
                '[{"home":"湖人","away":"勇士","time":"2026-04-17 10:30:00","match_id":"54439749"}]',
            },
            system: {
              type: "string",
              description: "HTTP 预测接口只读库，**忽略**该字段",
            },
            model: {
              type: "string",
              description: "HTTP 预测接口只读库，**忽略**该字段",
            },
          },
        },
        BasketballPredictionResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true },
            cached: {
              type: "boolean",
              description: "恒为 true：内容来自 `BasketballPredictionCache` 中该 `prompt` 的 `createdAt` 最新一条",
              example: true,
            },
            cacheCreatedAt: {
              type: "string",
              format: "date-time",
              description: "本条缓存记录的创建时间（ISO 8601）",
            },
            content: {
              description:
                "库中存储的模型输出：约定为 JSON，含 `matches[]`（每场 `yuce`：shengfu、rangfenshengfu、daxiaofen、shengfencha、danshuangpan、xinxinzhishu）及 `jinrixuan`、`lengmen`、`chuanguan`。成功解析且含 `matches` 时：服务端按本次请求 `prompt` 中 match_id 顺序重排（旧版多行或 JSON 数组）；每条 `match_id` 与 prompt 原样一致；`n`、`title` 与顺序一致。",
              oneOf: [{ type: "object", additionalProperties: true }, { type: "string" }],
            },
          },
        },
        QWeatherAlertColor: {
          type: "object",
          description: "预警颜色信息（RGBA）与颜色等级代码",
          properties: {
            code: {
              type: "string",
              description: "预警颜色代码，如 blue、yellow、orange、red",
            },
            red: { type: "integer", description: "红色通道值（0-255）" },
            green: { type: "integer", description: "绿色通道值（0-255）" },
            blue: { type: "integer", description: "蓝色通道值（0-255）" },
            alpha: { type: "number", description: "透明度（0-1）" },
          },
          additionalProperties: true,
        },
        QWeatherAlertMessageType: {
          type: "object",
          description: "预警消息类型：新发、更新或取消等",
          properties: {
            code: {
              type: "string",
              description: "消息类型代码，常见为 alert、update、cancel",
            },
            supersedes: {
              type: "array",
              description: "当前消息替代/取消的预警 ID 列表（通常在 update/cancel 时出现）",
              items: { type: "string" },
            },
          },
          additionalProperties: true,
        },
        QWeatherAlertEventType: {
          type: "object",
          description: "预警事件类型",
          properties: {
            name: { type: "string", description: "事件名称，如大风、暴雨、高温" },
            code: { type: "string", description: "事件类型代码" },
          },
          additionalProperties: true,
        },
        QWeatherAlertItem: {
          type: "object",
          description: "单条官方天气预警信息",
          properties: {
            id: { type: "string", description: "预警唯一 ID" },
            senderName: { type: "string", description: "预警发布机构名称，可能为空", nullable: true },
            issuedTime: { type: "string", description: "预警发布时间（ISO 8601，含时区）" },
            messageType: { $ref: "#/components/schemas/QWeatherAlertMessageType" },
            eventType: { $ref: "#/components/schemas/QWeatherAlertEventType" },
            urgency: { type: "string", description: "紧迫程度，可能为空", nullable: true },
            severity: { type: "string", description: "严重程度，如 minor、moderate、severe、extreme" },
            certainty: { type: "string", description: "可信度/确定性，可能为空", nullable: true },
            icon: { type: "string", description: "预警图标代码" },
            color: { $ref: "#/components/schemas/QWeatherAlertColor" },
            effectiveTime: { type: "string", description: "预警生效时间，可能为空", nullable: true },
            onsetTime: { type: "string", description: "预计开始时间，可能为空", nullable: true },
            expireTime: { type: "string", description: "预计失效时间，可能为空", nullable: true },
            headline: { type: "string", description: "预警标题摘要" },
            description: { type: "string", description: "预警详细说明" },
            criteria: { type: "string", description: "触发标准或条件，可能为空", nullable: true },
            responseTypes: {
              type: "array",
              description: "应对方式类型代码列表，可能为空数组",
              items: { type: "string" },
            },
            instruction: { type: "string", description: "防御指南或行动建议，可能为空", nullable: true },
          },
          additionalProperties: true,
        },
        QWeatherAlertMetadata: {
          type: "object",
          description: "实时预警请求的元数据",
          properties: {
            tag: { type: "string", description: "数据标签，可用于比对版本变化" },
            zeroResult: {
              type: "boolean",
              description: "为 true 表示请求成功但无生效中的预警",
            },
            attributions: {
              type: "array",
              description: "数据来源/声明，展示预警时应同时展示这些归属信息",
              items: { type: "string" },
            },
          },
          additionalProperties: true,
        },
        QWeatherAlertUpstream: {
          type: "object",
          description: "和风 `/weatheralert/v1/current/{latitude}/{longitude}` 的成功响应体",
          properties: {
            metadata: { $ref: "#/components/schemas/QWeatherAlertMetadata" },
            alerts: {
              type: "array",
              description: "当前生效的预警列表；若无预警通常为空数组",
              items: { $ref: "#/components/schemas/QWeatherAlertItem" },
            },
          },
          additionalProperties: true,
        },
        QWeatherNowCurrent: {
          type: "object",
          description:
            "实况对象 `now`（与和风文档一致；部分字段可能为空字符串）。单位默认公制（`unit=m`）。",
          properties: {
            obsTime: { type: "string", description: "数据观测时间（含时区偏移）" },
            temp: { type: "string", description: "温度（摄氏度，字符串形式）" },
            feelsLike: { type: "string", description: "体感温度（摄氏度）" },
            icon: { type: "string", description: "天气状况图标代码，见和风图标说明" },
            text: { type: "string", description: "天气现象文字描述（阴晴雨雪等）" },
            wind360: { type: "string", description: "风向 360° 角度" },
            windDir: { type: "string", description: "风向文字，如东南风" },
            windScale: { type: "string", description: "风力等级（和风风力等级）" },
            windSpeed: { type: "string", description: "风速，公里/小时" },
            humidity: { type: "string", description: "相对湿度，百分比数值（字符串）" },
            precip: { type: "string", description: "过去 1 小时降水量（毫米）" },
            pressure: { type: "string", description: "大气压强（百帕）" },
            vis: { type: "string", description: "能见度（公里）" },
            cloud: { type: "string", description: "云量百分比；可能为空" },
            dew: { type: "string", description: "露点温度；可能为空" },
          },
          additionalProperties: true,
        },
        QWeatherNowUpstream: {
          type: "object",
          description: "和风 `/v7/weather/now` 成功时的业务体（`code` 为 \"200\"）",
          properties: {
            code: {
              type: "string",
              example: "200",
              description: "和风状态码；成功实况为 \"200\"，其余见和风错误码文档",
            },
            updateTime: { type: "string", description: "当前 API 数据最近更新时间" },
            fxLink: { type: "string", description: "当前数据的可视化页面链接" },
            now: { $ref: "#/components/schemas/QWeatherNowCurrent" },
            refer: {
              type: "object",
              description: "数据来源与许可说明（字段可能为空）",
              properties: {
                sources: { type: "array", items: { type: "string" }, description: "原始数据来源名称列表" },
                license: { type: "array", items: { type: "string" }, description: "许可或版权声明列表" },
              },
              additionalProperties: true,
            },
            weatherAlert: {
              $ref: "#/components/schemas/QWeatherAlertUpstream",
              description: "同一地点坐标的实时天气预警响应体（由 weather-alert 接口透传）",
            },
          },
          additionalProperties: true,
        },
        QWeatherDailyItem: {
          type: "object",
          description: "每日预报数组 `daily[]` 的单天对象（字段随天数接口一致）",
          properties: {
            fxDate: { type: "string", description: "预报日期（YYYY-MM-DD）" },
            sunrise: { type: "string", description: "日出时间；高纬度地区可能为空" },
            sunset: { type: "string", description: "日落时间；高纬度地区可能为空" },
            moonrise: { type: "string", description: "月升时间；可能为空" },
            moonset: { type: "string", description: "月落时间；可能为空" },
            moonPhase: { type: "string", description: "月相名称" },
            moonPhaseIcon: { type: "string", description: "月相图标代码" },
            tempMax: { type: "string", description: "当天最高温（默认摄氏度）" },
            tempMin: { type: "string", description: "当天最低温（默认摄氏度）" },
            iconDay: { type: "string", description: "白天天气图标代码" },
            textDay: { type: "string", description: "白天天气文字描述" },
            iconNight: { type: "string", description: "夜间天气图标代码" },
            textNight: { type: "string", description: "夜间天气文字描述" },
            wind360Day: { type: "string", description: "白天风向角度（0-360）" },
            windDirDay: { type: "string", description: "白天风向文字" },
            windScaleDay: { type: "string", description: "白天风力等级" },
            windSpeedDay: { type: "string", description: "白天风速（公里/小时）" },
            wind360Night: { type: "string", description: "夜间风向角度（0-360）" },
            windDirNight: { type: "string", description: "夜间风向文字" },
            windScaleNight: { type: "string", description: "夜间风力等级" },
            windSpeedNight: { type: "string", description: "夜间风速（公里/小时）" },
            humidity: { type: "string", description: "相对湿度（百分比）" },
            precip: { type: "string", description: "当天总降水量（毫米）" },
            pressure: { type: "string", description: "大气压（百帕）" },
            vis: { type: "string", description: "能见度（公里）" },
            cloud: { type: "string", description: "云量百分比；可能为空" },
            uvIndex: { type: "string", description: "紫外线强度指数" },
          },
          additionalProperties: true,
        },
        QWeatherDailyUpstream: {
          type: "object",
          description: "和风 `/v7/weather/{days}` 成功时的业务体（`code` 为 \"200\"）",
          properties: {
            code: {
              type: "string",
              example: "200",
              description: "和风状态码；成功为 \"200\"，其余见和风错误码文档",
            },
            updateTime: { type: "string", description: "当前 API 数据最近更新时间" },
            fxLink: { type: "string", description: "当前数据的可视化页面链接" },
            daily: {
              type: "array",
              description: "逐日预报数组；长度由 days 参数决定（3/7/10/15/30）",
              items: { $ref: "#/components/schemas/QWeatherDailyItem" },
            },
            refer: {
              type: "object",
              description: "数据来源与许可说明（字段可能为空）",
              properties: {
                sources: { type: "array", items: { type: "string" }, description: "原始数据来源名称列表" },
                license: { type: "array", items: { type: "string" }, description: "许可或版权声明列表" },
              },
              additionalProperties: true,
            },
            weatherAlert: {
              $ref: "#/components/schemas/QWeatherAlertUpstream",
              description: "同一地点坐标的实时天气预警响应体（由 weather-alert 接口透传）",
            },
          },
          additionalProperties: true,
        },
        WeatherNowResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true, description: "请求在本服务侧是否按成功路径返回" },
            data: { $ref: "#/components/schemas/QWeatherNowUpstream" },
          },
        },
        WeatherDailyResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean", example: true, description: "请求在本服务侧是否按成功路径返回" },
            data: { $ref: "#/components/schemas/QWeatherDailyUpstream" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/**/*.routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);