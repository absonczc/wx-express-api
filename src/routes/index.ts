import { Router } from "express";
import { aiRouter } from "../modules/ai/ai.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { footballRouter } from "../modules/football/football.routes.js";
import { testRouter } from "../modules/test/test.routes.js";
import { userRouter } from "../modules/user/user.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});

apiRouter.use("/test", testRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/football", footballRouter);
