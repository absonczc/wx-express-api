# miniapp-express-api

技术选型：**Express** + **PostgreSQL（Prisma）** + **JWT**，配套 **helmet**、**cors**、**winston**、**dotenv**，实现微信小程序 `code` 登录（`jscode2session`）与用户资料接口。

## 目录结构

```
miniapp-express-api/
├── prisma/
│   └── schema.prisma          # 数据模型（User）
├── src/
│   ├── config/env.ts          # 环境变量加载与校验
│   ├── lib/
│   │   ├── logger.ts          # winston 日志
│   │   └── prisma.ts          # Prisma 单例
│   ├── middleware/
│   │   ├── auth.middleware.ts # JWT 鉴权
│   │   ├── error.middleware.ts
│   │   └── requestLogger.middleware.ts
│   ├── modules/
│   │   ├── ai/                # Vector Engine（OpenAI 兼容）对话代理
│   │   ├── auth/              # 微信登录、资料更新
│   │   └── user/              # 当前用户查询
│   ├── routes/index.ts        # 聚合路由
│   ├── types/express.d.ts     # Request 扩展类型
│   ├── utils/asyncHandler.ts
│   ├── app.ts
│   └── server.ts
├── API.md                     # 接口文档
├── .env.example
├── package.json
└── tsconfig.json
```

## 环境要求

- Node.js **>= 18.18**（内置 `fetch`）
- 本机或远程 **PostgreSQL**

## 安装与运行

1. 进入项目目录并安装依赖：

```bash
cd miniapp-express-api
npm install
```

2. 复制环境变量并填写数据库与微信参数：

```bash
cp .env.example .env
```

3. 生成 Prisma Client 并执行迁移：

```bash
npm run prisma:generate
npm run prisma:migrate
```

4. 开发模式启动：

```bash
npm run dev
```

5. 生产构建与启动：

```bash
npm run build
npm start
```

默认监听端口见 `.env` 中的 `PORT`（默认 `3000`）。

## API 说明

更完整的字段、错误码与示例见 **[API.md](./API.md)**。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/wx/login` | 微信小程序登录，Body: `{ "code": "<wx.login 返回的 code>" }` |
| GET | `/api/users/me` | 当前用户（Header: `Authorization: Bearer <token>`） |
| PATCH | `/api/auth/me` | 更新昵称/头像（需 JWT），Body: `{ "nickname"?, "avatarUrl"? }` |
| POST | `/api/ai/prompt` | AI 单轮对话（需 JWT），Body: `{ "prompt": "用户问题", "system"?: "系统提示", "model"?: "gpt-5.4-nano" }`，成功：`{ "ok", "model", "content" }` |
| POST | `/api/ai/chat` | AI 多轮（需 JWT），Body: `{ "messages": [{ "role":"user"|"assistant"|"system", "content":"..." }], "model"?: "..." }` |

登录成功示例：`{ "ok": true, "token": "...", "user": { ... } }`。

在 `.env` 中配置 `VECTOR_ENGINE_API_KEY`（勿提交到 Git）；可选 `VECTOR_ENGINE_MODEL`（默认 `gpt-5.4-nano`）、`VECTOR_ENGINE_BASE_URL`（默认 `https://api.vectorengine.ai/v1`）。

## 小程序端对接要点

1. 调用 `wx.login` 获取 `code`（有效期短，应在服务端立即换取 `openid`）。
2. 将 `code` POST 到本服务的 `/api/auth/wx/login`。
3. 保存返回的 `token`，后续请求在 `Authorization` 头携带 `Bearer <token>`。
4. 调用 AI 示例（单轮）：

```js
wx.request({
  url: 'https://你的域名/api/ai/prompt',
  method: 'POST',
  header: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + token,
  },
  data: { prompt: '用一句话介绍 Node.js' },
  success(res) {
    if (res.data && res.data.ok) console.log(res.data.content);
  },
});
```

## 生产环境注意

- 将 `JWT_SECRET` 设为足够长的随机串。
- 配置 `CORS_ORIGIN` 为允许的前端域名（逗号分隔）；当前逻辑在非生产环境会放宽 CORS 便于本地调试。
- 勿将 `.env` 与数据库凭据提交到版本库。
