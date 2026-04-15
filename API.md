# miniapp-express-api 接口文档

所有业务接口均挂在 **`/api`** 前缀下。默认服务端口由环境变量 **`PORT`** 控制（未设置时为 `3000`）。

**Base URL 示例：** `http://localhost:3000/api`  
生产环境请替换为你的域名与 HTTPS。

---

## 通用约定

### Content-Type

除 `GET` 外，请求体为 JSON 时需设置：

```http
Content-Type: application/json
```

请求体大小上限：**1MB**。

### 鉴权（JWT）

需要登录的接口在请求头中携带：

```http
Authorization: Bearer <token>
```

`<token>` 来自 **`POST /api/auth/wx/login`** 的响应字段 `token`。

未携带、格式错误或过期时返回 **`401`**，响应体示例：

```json
{
  "ok": false,
  "error": "Missing or invalid Authorization header"
}
```

### 错误响应

业务错误与部分校验失败使用 **`HttpError`**，响应体格式：

```json
{
  "ok": false,
  "error": "错误说明文案",
  "details": {}
}
```

`details` 可能省略；部分上游错误会附带结构化信息。

未捕获的服务器内部错误为 **`500`**：

```json
{
  "ok": false,
  "error": "Internal Server Error"
}
```

### CORS

- **非生产环境**：允许任意来源（便于本地与小程序调试）。
- **生产环境**：需在环境变量 **`CORS_ORIGIN`** 中配置允许的前端源（逗号分隔）；未配置时跨域请求可能被拒绝。

---

## 接口一览

| 方法 | 路径 | 鉴权 |
|------|------|------|
| GET | `/api/health` | 否 |
| GET | `/api/test/` | 否 |
| POST | `/api/test/` | 否 |
| POST | `/api/auth/wx/login` | 否 |
| PATCH | `/api/auth/me` | 是 |
| GET | `/api/users/me` | 是 |
| POST | `/api/ai/prompt` | 是 |
| POST | `/api/ai/chat` | 是 |
| GET | `/api/football/match-detail` | 否 |

---

## 健康检查

### `GET /api/health`

用于探活、负载均衡等。

**响应 `200`：**

```json
{
  "ok": true
}
```

---

## 测试接口（开发调试用）

### `GET /api/test/`

**响应 `200`：**

```json
{
  "ok": true,
  "message": "test endpoint",
  "serverTime": "2026-04-14T12:00:00.000Z",
  "query": {}
}
```

若带查询参数，`query` 为解析后的对象；无查询参数时该字段可能为 `undefined`（取决于实现）。

### `POST /api/test/`

回显 JSON Body。

**请求体：** 任意 JSON 对象。

**响应 `200`：**

```json
{
  "ok": true,
  "message": "echo",
  "serverTime": "2026-04-14T12:00:00.000Z",
  "body": {},
  "rawBodyEmpty": false
}
```

---

## 认证与用户

### `POST /api/auth/wx/login`

微信小程序使用 `wx.login` 拿到的 **`code`** 换取本服务 JWT 与用户资料。

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `code` | string | 是 | `wx.login` 成功回调中的 `code`，需尽快使用 |

**请求示例：**

```json
{
  "code": "081xxxxx"
}
```

**响应 `200`：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 固定 `true` |
| `token` | string | JWT，后续鉴权使用 |
| `user` | object | 用户摘要 |
| `user.id` | string | 用户 ID |
| `user.openid` | string | 微信 `openid` |
| `user.nickname` | string \| null | 昵称 |
| `user.avatarUrl` | string \| null | 头像 URL |

**错误示例：**

- **`400`**：`code` 缺失或无效格式。
- 微信接口或配置异常时可能返回 **`4xx`/`5xx`**（具体以服务端实现为准）。

---

### `PATCH /api/auth/me`

更新当前登录用户的昵称与头像。

**请求头：** `Authorization: Bearer <token>`

**请求体：** 字段均为可选，传则更新；未传的字段不修改（实现以服务端为准）。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `nickname` | string | 否 | 昵称 |
| `avatarUrl` | string | 否 | 头像地址 |

**响应 `200`：**

```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "openid": "oXXXX",
    "nickname": "新昵称",
    "avatarUrl": "https://..."
  }
}
```

---

### `GET /api/users/me`

查询当前登录用户完整信息（含创建时间）。

**请求头：** `Authorization: Bearer <token>`

**响应 `200`：**

```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "openid": "oXXXX",
    "nickname": "昵称或 null",
    "avatarUrl": "头像或 null",
    "createdAt": "2026-04-14T12:00:00.000Z"
  }
}
```

**错误：**

- **`404`**：用户不存在（数据异常场景）。

---

## AI（Vector Engine / OpenAI 兼容）

服务端通过环境变量 **`VECTOR_ENGINE_API_KEY`** 调用上游；**切勿**在前端存放 API Key。

可选环境变量：

- **`VECTOR_ENGINE_BASE_URL`**：默认 `https://api.vectorengine.ai/v1`
- **`VECTOR_ENGINE_MODEL`**：默认 `gpt-5.4-nano`

未配置 **`VECTOR_ENGINE_API_KEY`** 时，调用 AI 接口返回 **`503`**。

---

### `POST /api/ai/prompt`

单轮对话，适合小程序只发一句用户问题。

**请求头：** `Authorization: Bearer <token>`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | 是 | 用户输入，非空 |
| `system` | string | 否 | 系统提示词 |
| `model` | string | 否 | 模型名；不传则使用环境变量默认模型 |

**请求示例：**

```json
{
  "prompt": "用一句话介绍 Node.js",
  "system": "请用中文简洁回答。"
}
```

**响应 `200`：**

```json
{
  "ok": true,
  "model": "gpt-5.4-nano",
  "content": "模型生成的文本内容"
}
```

**错误：**

- **`400`**：Body 非法、`prompt` 为空等。
- **`502`**：上游返回错误或返回内容无法解析（`details` 中可能含 `upstreamStatus`、`upstream`）。
- **`503`**：未配置 `VECTOR_ENGINE_API_KEY`。

---

### `POST /api/ai/chat`

多轮对话，消息格式与 OpenAI Chat Completions 的 `messages` 一致。

**请求头：** `Authorization: Bearer <token>`

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `messages` | array | 是 | 至少一条消息 |
| `messages[].role` | string | 是 | `system` \| `user` \| `assistant` |
| `messages[].content` | string | 是 | 非空文本 |
| `model` | string | 否 | 模型名；不传则使用环境默认 |

**请求示例：**

```json
{
  "messages": [
    { "role": "system", "content": "你是助手。" },
    { "role": "user", "content": "你好" }
  ],
  "model": "gpt-5.4-nano"
}
```

**响应 `200`：**

```json
{
  "ok": true,
  "model": "gpt-5.4-nano",
  "content": "助手回复正文"
}
```

**错误：**

- **`400`**：`messages` 缺失、为空或单条格式不合法。
- **`502`** / **`503`**：含义同 **`POST /api/ai/prompt`**。

---

## 足球赛事

聚合懂球帝三个接口（赛况、阵容、分析数据），返回统一格式的比赛详情。

---

### `GET /api/football/match-detail`

获取指定比赛的完整详情。

**查询参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `matchId` | string | 是 | 懂球帝比赛 ID |

**响应 `200`：**

```json
{
  "ok": true,
  "data": {
    "matchInfo": { ... },
    "events": [ ... ],
    "statistics": { ... },
    "lineup": { ... },
    "analysis": { ... }
  }
}
```

---

#### matchInfo - 比赛基本信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `matchId` | string | 比赛 ID |
| `league.id` | string | 联赛 ID |
| `league.name` | string | 联赛全称，如"中国足球乙级联赛" |
| `league.shortName` | string | 联赛简称，如"中乙" |
| `league.logo` | string | 联赛 logo URL |
| `league.color` | string | 联赛主题色，如"#84B72B" |
| `teamA.id` | string | 主队 ID |
| `teamA.name` | string | 主队全称 |
| `teamA.shortName` | string | 主队简称 |
| `teamA.logo` | string | 主队 logo URL |
| `teamA.rank` | number | 联赛排名 |
| `teamA.score` | string | 主队得分 |
| `teamB.*` | object | 客队字段，同 teamA |
| `startPlay` | string | 比赛开始时间，格式"2026-04-14 08:30:00" |
| `status` | string | 比赛状态，如"Played"（已结束）、"Playing"（进行中）等 |
| `period` | string | 比赛阶段，如"FT"（全场）、"HT"（半场）等 |
| `minute` | string | 当前分钟数，如"90"、"45"等 |
| `winner` | string | 获胜方球队 ID |
| `showTimeDay` | string | 显示日期，如"04-14" |
| `showTimeMin` | string | 显示时间，如"16:30" |

---

#### events - 比赛事件

数组，按时间顺序排列的所有比赛事件。

| 字段 | 类型 | 说明 |
|------|------|------|
| `minute` | string | 事件发生分钟 |
| `teamAEvents` | array | 主队事件列表 |
| `teamAEvents[].player` | string | 球员名称 |
| `teamAEvents[].playerId` | string | 球员 ID |
| `teamAEvents[].eventPic` | string | 事件类型图标 URL |
| `teamBEvents` | array | 客队事件列表，字段同 teamAEvents |

事件类型通过 `eventPic` 图标区分：
- 进球：红色球衣图标
- 黄牌：黄色卡片图标
- 红牌：红色卡片图标
- 换人：双向箭头图标

---

#### statistics - 比赛统计

| 字段 | 类型 | 说明 |
|------|------|------|
| `teamA.name` | string | 主队名称 |
| `teamA.logo` | string | 主队 logo |
| `teamB.name` | string | 客队名称 |
| `teamB.logo` | string | 客队 logo |
| `items` | array | 统计项列表 |

**items 统计项：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 统计类型名称，如"控球率"、"角球"、"射门"等 |
| `teamA.value` | number | 主队数值 |
| `teamA.per` | number | 主队百分比 |
| `teamB.value` | number | 客队数值 |
| `teamB.per` | number | 客队百分比 |

---

#### lineup - 比赛阵容

| 字段 | 类型 | 说明 |
|------|------|------|
| `teamA.players` | array | 主队首发阵容（11人） |
| `teamA.substitutes` | array | 主队替补阵容 |
| `teamB.players` | array | 客队首发阵容 |
| `teamB.substitutes` | array | 客队替补阵容 |
| `positions` | object | 位置中文映射 |

**球员字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `personId` | number | 球员 ID |
| `person` | string | 球员名称 |
| `captain` | number | 是否队长，1=是，0=否 |
| `shirtNumber` | string | 球衣号码 |
| `positionX` | string | 战术位置 X 坐标 |
| `positionY` | string | 战术位置 Y 坐标 |
| `formationPlace` | number | 阵型位置编号 |
| `position` | string | 位置中文名，如"中场"、"前锋"、"后卫"、"门将" |
| `personLogo` | string | 球员头像 URL |
| `events` | array | 该球员相关事件（如进球、助攻、黄牌等） |
| `events[].type` | string | 事件类型代码：G=进球、YC=黄牌、RC=红牌、SO=射正、SI=换人、AS=助攻、HT=半场 |
| `events[].minute` | string | 事件发生分钟 |
| `events[].eventPic` | string | 事件图标 URL |

---

#### analysis - 比赛分析

来自懂球帝的历史数据分析。

| 字段 | 类型 | 说明 |
|------|------|------|
| `attackDefend` | object | 攻防特征（近10场） |
| `attackDefend.title` | string | 标题，如"攻防特征（近10场）" |
| `attackDefend.data` | array | 攻防数据列表 |
| `attackDefend.data[].title` | string | 统计项名称 |
| `attackDefend.data[].teamA.matchInfo` | string | 主队数据，如"7.6次/球" |
| `attackDefend.data[].teamB.matchInfo` | string | 客队数据 |

**attackDefend.data 包含：**

| 统计项 | 说明 |
|--------|------|
| 射门进球效率 | 射门次数/进球数，越低越好 |
| 射门次数 | 场均射门次数 |
| 被射门失球效率 | 被射门次数/失球数，越低越好 |
| 被射门次数 | 场均被射门次数 |

| `comprehensive` | object | 综合实力对比 |
| `comprehensive.title` | string | 标题，如"综合实力" |
| `comprehensive.teamAScore` | string | 主队综合实力评分，如"63%" |
| `comprehensive.teamBScore` | string | 客队综合实力评分 |
| `comprehensive.data` | array | 各维度对比数据 |

**comprehensive.data 包含：**

| 统计项 | 说明 |
|--------|------|
| 近6场交锋 | 双方历史交锋战绩 |
| 近10场战绩 | 双方近10场比赛胜负平 |
| 近10场同主客 | 在相同主/客场条件下的战绩 |
| 场均进球 | 场均进球数 |
| 场均失球 | 场均失球数 |
| 身价 | 球队总身价 |

| `control` | object | 场面控制（近10场） |
| `control.title` | string | 标题 |
| `control.data` | array | 控球率数据 |

| `corner` | object | 角球统计（近10场） |
| `corner.title` | string | 标题 |
| `corner.data[].teamA.matchInfo` | string | 主队得角/失角，如"得角5.5个 失角3.8个" |
| `corner.data[].teamA.score` | string | 主队场均角球数 |

| `halfAll` | object | 半全场统计（近10场） |
| `halfAll.title` | string | 标题 |
| `halfAll.data` | array | 半全场数据列表 |

**halfAll.data 包含：**

| 统计项 | 说明 |
|--------|------|
| 场均进球 | 上半场/下半场平均进球数 |
| 场均失球 | 上半场/下半场平均失球数 |

| `halfAll.data[].halfWinner` | string | 上半场领先方，"team_A"或"team_B" |
| `halfAll.data[].sHalfWinner` | string | 下半场领先方 |
| `halfAll.data[].teamA.half` | string | 主队上半场数据 |
| `halfAll.data[].teamA.sHalf` | string | 主队下半场数据 |

| `statistics` | object | 事件统计（近10场） |
| `statistics.title` | string | 标题 |
| `statistics.data` | array | 犯规、黄牌、任意球等数据 |

**statistics.data 包含：**

| 统计项 | 说明 |
|--------|------|
| 犯规 | 场均犯规次数 |
| 红黄牌 | 场均黄牌数 |
| 任意球 | 场均获得任意球次数 |

---

## 小程序调用示例

登录后携带 `token` 调用 AI：

```javascript
wx.request({
  url: 'https://你的域名/api/ai/prompt',
  method: 'POST',
  header: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  },
  data: { prompt: '你好' },
});
```

---

## 修订记录

文档与代码路径一致；若接口有变更，请同步更新本文档。
