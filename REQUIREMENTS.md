# miniapp-express-api 需求文档（基线版）

> 文档目标：以当前已实现接口为准，建立后续迭代的统一需求基线。  
> 适用范围：本仓库所有对外 API（`/api/**`）的新增、修改、下线。  
> 生效原则：后续功能开发需遵循本文档；若需求变更，需先更新本文档再实施代码改动。

---

## 0. 快速使用（先看这一节）

如果你后续要加功能，优先只改下面 3 个位置：

1. `7. 需求任务列表`：新增一条任务，状态先标记为 `TODO`。
2. `8. 功能模板（复制即用）`：复制一份功能模板，写清接口契约与验收标准。
3. 对应模块章节（`3.x`）：把最终确定的接口行为同步进去（路径、参数、响应、错误码）。

完成后怎么判断：

- 满足 `9. 完成定义（DoD）` 全部勾选项才算“完成”。
- `7. 需求任务列表` 中该任务状态更新为 `DONE`。

状态约定：

- `TODO`：待开始
- `DOING`：开发中
- `BLOCKED`：被阻塞
- `DONE`：已完成并验收
- `CANCELLED`：取消

---

## 1. 项目范围与目标

本项目为小程序后端 API，提供以下能力：

- 用户登录与资料管理（微信登录、个人资料读取与更新、头像上传）
- AI 对话与业务化生成（通用对话、prompt、旅行攻略、足篮预测）
- 体育数据聚合（足球赛事、篮球赛事）
- 天气查询（实时天气、多日预报，含预警）
- 测试与健康检查接口

当前统一 API 前缀：`/api`  
示例 Base URL：`http://localhost:3000/api`

---

## 2. 全局约定（后续必须遵守）

### 2.1 协议与返回格式

- 成功响应统一包含 `ok: true`。
- 失败响应统一包含 `ok: false` 与 `error`（可能附带 `details`）。
- JSON 接口请求体默认 `application/json`（上传接口除外）。
- 非捕获异常返回 `500`，错误文案为 `Internal Server Error`。

### 2.2 鉴权

- 鉴权方式：`Authorization: Bearer <token>`（JWT）。
- 需登录接口未携带/无效 token 返回 `401`。
- token 来源：`POST /api/auth/wx/login`。

### 2.3 兼容性与变更控制

- 不得无通知删除已发布字段。
- 不得在同一路径同方法上做“语义破坏式修改”（如字段类型直接变化）。
- 新增可选字段优先，避免直接改必填字段定义。
- 若接口契约变更，需同步更新：
  - 本文档 `REQUIREMENTS.md`
  - OpenAPI/Swagger 注释与 schema
  - 对外说明（如 `API.md` 或发布记录）

### 2.4 错误码语义（通用）

- `400`：请求参数/请求体非法
- `401`：未授权
- `404`：资源不存在（如用户不存在）
- `500`：服务内部错误
- `502`：上游服务错误或返回不可解析
- `503`：关键配置缺失（环境变量未配置等）

---

## 3. 模块级需求与接口基线

## 3.1 系统接口

### `GET /api/health`

- 目标：服务健康检查
- 鉴权：否
- 响应：`{ ok: true }`

### `GET /api/test/`

- 目标：测试连通性
- 鉴权：否
- 响应字段：
  - `ok: true`
  - `message: "test endpoint"`
  - `serverTime: string`
  - `query?: object`

### `POST /api/test/`

- 目标：回显请求体，便于调试
- 鉴权：否
- 请求体：任意 JSON 对象
- 响应字段：
  - `ok: true`
  - `message: "echo"`
  - `serverTime: string`
  - `body?: object`
  - `rawBodyEmpty: boolean`

---

## 3.2 认证与用户

### `POST /api/auth/wx/login`

- 目标：微信 code 换取登录态
- 鉴权：否
- 请求体：
  - `code: string`（必填）
- 成功响应：
  - `ok: true`
  - `token: string`
  - `user: { id, openid, nickname, avatarUrl }`
- 错误：
  - `400`（code 无效）
  - 其他上游异常按服务端映射返回

### `PATCH /api/auth/me`

- 目标：更新当前用户资料
- 鉴权：是
- 请求体（至少一项）：
  - `nickname?: string`
  - `avatarUrl?: string`
- 成功响应：
  - `ok: true`
  - `user: object`

### `POST /api/auth/me/avatar`

- 目标：上传并更新用户头像
- 鉴权：是
- 请求体：`multipart/form-data`
  - `file`（二进制文件）
- 成功响应：
  - `ok: true`
  - `user: object`
  - `avatarUrl: string`
- 错误：
  - `400`（文件无效等）
  - `401`（未授权）

### `GET /api/users/me`

- 目标：查询当前用户资料
- 鉴权：是
- 成功响应：
  - `ok: true`
  - `user: { id, openid, nickname, avatarUrl, createdAt }`
- 错误：
  - `401`（未授权）
  - `404`（用户不存在）

---

## 3.3 AI 能力

> 统一依赖：`VECTOR_ENGINE_API_KEY`；未配置时返回 `503`。  
> 默认网关：`https://api.vectorengine.ai/v1`（可配置覆盖）。

### `POST /api/ai/chat`

- 目标：多轮聊天
- 鉴权：是
- 请求体：
  - `messages: Array<{ role: "system" | "user" | "assistant"; content: string }>`（必填，非空）
  - `model?: string`
- 成功响应：
  - `ok: true`
  - `model: string`
  - `content: object | string`（若模型正文为 JSON 则返回对象）
- 错误：`400`、`502`、`503`

### `POST /api/ai/prompt`

- 目标：单轮 prompt
- 鉴权：是
- 请求体：
  - `prompt: string`（必填，非空）
  - `system?: string`（传入时必须非空）
  - `model?: string`
- 成功响应：
  - `ok: true`
  - `model: string`
  - `content: string`
- 错误：`400`、`502`、`503`

### `POST /api/ai/travel-guide`

- 目标：旅行攻略生成（结构化 JSON）
- 鉴权：是
- 请求体：
  - `prompt: string`（必填，非空）
  - `system?: string`（传入时必须非空）
  - `model?: string`（默认旅行模型配置）
- 成功响应：
  - `ok: true`
  - `model: string`
  - `content: object`（解析后的 JSON，服务端会做数组字段规范化）
- 错误：`400`、`502`、`503`

### `POST /api/ai/football-prediction`

- 目标：足球预测（支持缓存）
- 鉴权：是
- 请求体：
  - `prompt?: string`（为空时服务端自动抓今日/明日赛程并生成）
  - `system?: string`（传入时必须非空）
  - `model?: string`
- 成功响应：
  - `ok: true`
  - `cached: boolean`
  - `model?: string`（命中缓存时可能不返回）
  - `content: object | string`
- 业务要求：
  - 同一 prompt 在缓存 TTL 内应优先命中缓存
  - 响应中的 `match_id` 顺序需与请求 prompt 对齐
- 错误：`400`、`502`、`503`

### `POST /api/ai/basketball-prediction`

- 目标：篮球预测（支持缓存）
- 鉴权：是
- 请求体：
  - `prompt?: string`（为空时服务端自动抓今日赛程并生成）
  - `system?: string`（传入时必须非空）
  - `model?: string`
- 成功响应：
  - `ok: true`
  - `cached: boolean`
  - `model?: string`
  - `content: object | string`
- 业务要求：
  - 同一 prompt 在缓存 TTL 内应优先命中缓存
  - 响应中的 `match_id` 顺序需与请求 prompt 对齐
- 错误：`400`、`502`、`503`

---

## 3.4 足球接口

### `GET /api/football/list`

- 目标：获取足球原始赛事列表
- 鉴权：否
- 查询参数：
  - `start`（默认 `2026-04-1400:00:00`）
  - `version`（默认 `576`）
  - `init`（默认 `0`）
  - `wfrom`（默认 `2`）
  - `from`（默认 `msite_com`）
- 成功响应：
  - `ok: true`
  - `data: object`（懂球帝原始结构）

### `GET /api/football/list-transformed`

- 目标：获取转换后的统一赛事列表
- 鉴权：否
- 查询参数：同 `GET /api/football/list`
- 成功响应：
  - `ok: true`
  - `data: object`（包含标准化比赛字段）

### `GET /api/football/today-tomorrow`

- 目标：获取今天和明天可用于预测的比赛文本
- 鉴权：否
- 查询参数：同 `GET /api/football/list`
- 成功响应：
  - `ok: true`
  - `data: string`（用于 AI 预测 prompt 的格式化文本）

### `GET /api/football/match-detail`

- 目标：获取单场比赛详情（赛况/阵容/分析聚合后结构）
- 鉴权：否
- 查询参数：
  - `matchId: string`（必填）
- 成功响应：
  - `ok: true`
  - `data: { matchInfo, events, statistics, lineup, analysis }`
- 错误：`400`

---

## 3.5 篮球接口

### `GET /api/basketball/tab`

- 目标：获取篮球 tab 赛程（上游原始结构）
- 鉴权：否
- 查询参数：
  - `start`（默认 `2026-04-1516:00:00`）
  - `version`（默认 `576`）
  - `init`（默认 `1`）
  - `wfrom`（默认 `2`）
  - `from`（默认 `msite_com`）
- 成功响应：
  - `ok: true`
  - `data: object`
- 错误：`400`、`500`

### `GET /api/basketball/matches/{matchId}/detail`

- 目标：获取篮球单场详情（赛场态势 + 赛前对比）
- 鉴权：否
- 路径参数：
  - `matchId: string`（必填，纯数字）
- 成功响应：
  - `ok: true`
  - `data: { situation, preAnalyzeContrast }`
- 错误：`400`、`500`

---

## 3.6 天气接口

> 统一依赖：`QWEATHER_API_KEY`、`QWEATHER_API_HOST`（缺失返回 `503`）。

### `GET /api/weather/now`

- 目标：实时天气 + 实时预警
- 鉴权：否
- 查询参数：
  - `location: string`（必填，地区名称，最长 64）
  - `lang?: string`
  - `unit?: "m" | "i"`
- 成功响应：
  - `ok: true`
  - `data: object`（实况天气 + `weatherAlert`）
- 错误：`400`、`502`、`503`

### `GET /api/weather/daily`

- 目标：多日预报 + 实时预警
- 鉴权：否
- 查询参数：
  - `location: string`（必填，地区名称，最长 64）
  - `days?: "3d" | "7d" | "10d" | "15d" | "30d"`（默认 `3d`）
  - `lang?: string`
  - `unit?: "m" | "i"`
- 成功响应：
  - `ok: true`
  - `data: object`（每日预报 + `weatherAlert`）
- 错误：`400`、`502`、`503`

---

## 4. 非功能需求

- 性能：常规查询接口应保持可接受响应时延；AI/上游代理接口允许更高时延但需保证可观测错误。
- 安全：严禁在前端暴露上游 API Key；鉴权接口必须校验 JWT。
- 可观测性：外部依赖失败时，错误信息需可定位（在 `details` 中提供必要上下文，不泄露敏感信息）。
- 文档一致性：Swagger、本文档、代码行为必须一致。

---

## 5. 后续迭代流程（强约束）

后续新增需求请按以下流程执行：

1. 先在本文档新增/修改对应“需求描述 + 接口契约”。
2. 再实施代码改动（controller/service/routes/schema）。
3. 同步更新 Swagger 注释与 `components.schemas`。
4. 完成后做接口自测，确保返回结构与文档一致。

> 约定：若“代码已改但本文档未更新”，视为需求未完成。

---

## 6. 变更记录

- `v1.1.0`（2026-04-17）：新增“快速使用 / 任务列表 / 功能模板 / 完成定义（DoD）”，便于追踪进度与验收。
- `v1.0.0`（2026-04-17）：基于当前仓库已实现接口建立需求基线。

---

## 7. 需求任务列表（唯一进度看板）

> 规则：后续每个新功能都必须先在这里登记，再开始开发。  
> 一行一个需求，ID 不可复用，状态只能用 `TODO/DOING/BLOCKED/DONE/CANCELLED`。

| ID | 功能名称 | 优先级 | 状态 | 负责人 | 计划发布日期 | 关联接口/模块 | 备注 |
|---|---|---|---|---|---|---|---|
| FEAT-001 | （示例）新增 xxx 功能 | P1 | TODO |  |  |  |  |

---

## 8. 功能模板（复制即用）

> 每新增一个需求，在本节追加一个小节，命名为 `### FEAT-xxx 功能名`。

### FEAT-xxx 功能名（模板）

**1) 背景/目标**

- 为什么做：
- 期望结果：

**2) 范围**

- In Scope（本次要做）：
- Out of Scope（本次不做）：

**3) 接口契约**

- 路径与方法：
- 鉴权要求：
- 请求参数（query/path/body）：
- 成功响应（字段级说明）：
- 错误码与错误语义：

**4) 数据与依赖**

- 数据表/缓存改动：
- 外部服务依赖：
- 新增环境变量（如有）：

**5) 验收标准（必须可测试）**

- [ ] 场景 1：
- [ ] 场景 2：
- [ ] 场景 3：

**6) 发布与回滚**

- 发布注意事项：
- 回滚方案：

---

## 9. 完成定义（Definition of Done, DoD）

只有以下全部满足，任务状态才可以改为 `DONE`：

- [ ] 任务已登记在 `7. 需求任务列表`，且状态流转完整（`TODO -> DOING -> DONE` 或含阻塞说明）
- [ ] 功能需求已写入 `8. 功能模板`（包含验收标准）
- [ ] 代码实现完成并通过基础自测
- [ ] 路由 Swagger 注释已更新（路径/参数/请求体/响应/错误码）
- [ ] `src/config/swagger.ts` 中相关 schema 已同步
- [ ] `API.md` 已同步联调信息
- [ ] 对应模块章节（`3.x`）已反映最终接口行为
- [ ] 新增环境变量已同步到 `.env.example`（如涉及）
- [ ] 若有数据库改动，迁移文件已提交并验证

---

## 10. 版本记录

- 见 `6. 变更记录`（本节保留作后续兼容，可与第 6 节合并维护）。

