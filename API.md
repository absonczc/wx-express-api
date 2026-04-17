# miniapp-express-api 接口文档

本文档用于前后端联调与接口查阅。  
需求基线与变更约束请以 `REQUIREMENTS.md` 为准，Swagger UI（`/api-docs`）用于查看实时 schema 细节。

---

## 基础信息

- Base URL（本地示例）：`http://localhost:3000/api`
- 所有业务接口统一挂载在 `/api` 前缀下
- 请求体为 JSON 时需设置：`Content-Type: application/json`
- JWT 鉴权接口需设置：`Authorization: Bearer <token>`

---

## 通用返回约定

### 成功

```json
{
  "ok": true,
  "data": {}
}
```

说明：不同接口可能返回 `data`、`user`、`content` 等业务字段，但都会包含 `ok: true`。

### 失败

```json
{
  "ok": false,
  "error": "错误说明",
  "details": {}
}
```

说明：`details` 可能省略。

---

## 错误码语义

- `400`：请求参数或请求体非法
- `401`：未授权（缺失/无效 token）
- `404`：资源不存在
- `500`：服务内部错误
- `502`：上游服务错误或响应不可解析
- `503`：关键配置缺失（如第三方 API Key）

---

## 接口总览

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/health` | 否 | 健康检查 |
| GET | `/api/test/` | 否 | 测试 ping |
| POST | `/api/test/` | 否 | 测试 echo |
| POST | `/api/auth/wx/login` | 否 | 微信登录 |
| PATCH | `/api/auth/me` | 是 | 更新当前用户资料 |
| POST | `/api/auth/me/avatar` | 是 | 上传头像 |
| GET | `/api/users/me` | 是 | 获取当前用户信息 |
| POST | `/api/ai/chat` | 是 | 多轮 AI 对话 |
| POST | `/api/ai/prompt` | 是 | 单轮 AI 对话 |
| POST | `/api/ai/travel-guide` | 是 | 旅行攻略生成 |
| POST | `/api/ai/football-prediction` | 是 | 足球预测（含缓存） |
| POST | `/api/ai/basketball-prediction` | 是 | 篮球预测（含缓存） |
| GET | `/api/football/list` | 否 | 足球原始赛事列表 |
| GET | `/api/football/list-transformed` | 否 | 足球转换后列表 |
| GET | `/api/football/today-tomorrow` | 否 | 今日/明日比赛文本 |
| GET | `/api/football/match-detail` | 否 | 足球比赛详情 |
| GET | `/api/basketball/tab` | 否 | 篮球赛事 tab |
| GET | `/api/basketball/matches/{matchId}/detail` | 否 | 篮球比赛详情 |
| GET | `/api/weather/now` | 否 | 实时天气 |
| GET | `/api/weather/daily` | 否 | 多日天气预报 |

---

## 认证与用户

### `POST /api/auth/wx/login`

请求体：

```json
{
  "code": "wx_login_code"
}
```

成功响应示例：

```json
{
  "ok": true,
  "token": "jwt_token",
  "user": {
    "id": "uuid",
    "openid": "wx_openid",
    "nickname": "昵称",
    "avatarUrl": "https://..."
  }
}
```

### `PATCH /api/auth/me`（需鉴权）

请求体（至少一项）：

```json
{
  "nickname": "新昵称",
  "avatarUrl": "https://..."
}
```

### `POST /api/auth/me/avatar`（需鉴权）

- `multipart/form-data`
- 字段：`file`（binary）

### `GET /api/users/me`（需鉴权）

成功响应示例：

```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "openid": "wx_openid",
    "nickname": "昵称",
    "avatarUrl": "https://...",
    "createdAt": "2026-04-17T00:00:00.000Z"
  }
}
```

---

## AI 接口

依赖环境变量：`VECTOR_ENGINE_API_KEY`。缺失时返回 `503`。

### `POST /api/ai/chat`（需鉴权）

请求体：

```json
{
  "messages": [
    { "role": "system", "content": "你是助手" },
    { "role": "user", "content": "你好" }
  ],
  "model": "gpt-5.4-nano"
}
```

### `POST /api/ai/prompt`（需鉴权）

请求体：

```json
{
  "prompt": "用一句话介绍 Node.js",
  "system": "请用中文简洁回答",
  "model": "gpt-5.4-nano"
}
```

### `POST /api/ai/travel-guide`（需鉴权）

请求体：

```json
{
  "prompt": "北京3天2晚，2人，中等预算，偏美食和人文",
  "model": "gpt-5.4-nano"
}
```

说明：响应中的 `content` 为结构化 JSON 对象（不是纯文本）。

### `POST /api/ai/football-prediction`（需鉴权）

请求体：

```json
{
  "prompt": "比赛1（match_id=1）：...",
  "model": "gpt-5.4"
}
```

说明：

- `prompt` 可选；不传时服务端自动抓赛程生成
- 响应包含 `cached: true/false`

### `POST /api/ai/basketball-prediction`（需鉴权）

请求体与足球预测类似，`prompt` 可选，响应同样包含 `cached`。

---

## 足球接口

### `GET /api/football/list`

查询参数：

- `start`（默认 `2026-04-1400:00:00`）
- `version`（默认 `576`）
- `init`（默认 `0`）
- `wfrom`（默认 `2`）
- `from`（默认 `msite_com`）

### `GET /api/football/list-transformed`

查询参数同 `GET /api/football/list`，返回转换后的标准结构。

### `GET /api/football/today-tomorrow`

查询参数同 `GET /api/football/list`，返回可用于 AI 预测的格式化文本。

### `GET /api/football/match-detail`

查询参数：

- `matchId`（必填）

成功响应核心结构：

```json
{
  "ok": true,
  "data": {
    "matchInfo": {},
    "events": [],
    "statistics": {},
    "lineup": {},
    "analysis": {}
  }
}
```

---

## 篮球接口

### `GET /api/basketball/tab`

查询参数：

- `start`（默认 `2026-04-1516:00:00`）
- `version`（默认 `576`）
- `init`（默认 `1`）
- `wfrom`（默认 `2`）
- `from`（默认 `msite_com`）

### `GET /api/basketball/matches/{matchId}/detail`

路径参数：

- `matchId`（必填，纯数字）

成功响应核心结构：

```json
{
  "ok": true,
  "data": {
    "situation": {},
    "preAnalyzeContrast": {}
  }
}
```

---

## 天气接口

依赖环境变量：`QWEATHER_API_KEY`、`QWEATHER_API_HOST`。缺失时返回 `503`。

### `GET /api/weather/now`

查询参数：

- `location`（必填，地区名称）
- `lang`（可选）
- `unit`（可选：`m` 或 `i`）

### `GET /api/weather/daily`

查询参数：

- `location`（必填，地区名称）
- `days`（可选：`3d` / `7d` / `10d` / `15d` / `30d`，默认 `3d`）
- `lang`（可选）
- `unit`（可选：`m` 或 `i`）

---

## 文档维护规则

- 接口行为变更时，必须同步更新：
  - `REQUIREMENTS.md`（需求基线）
  - 本文档 `API.md`（联调文档）
  - Swagger 注释与 schema（`/api-docs`）
- 如三者不一致，以代码 + Swagger + `REQUIREMENTS.md` 联合校验后修正。

