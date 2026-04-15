import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HttpError } from "./error.middleware.js";
import type { AuthUserPayload } from "../modules/auth/auth.types.js";

type JwtBody = {
  sub: string;
  openid: string;
};

export function authRequired(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new HttpError(401, "Missing or invalid Authorization header"));
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next(new HttpError(401, "Missing token"));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as JwtBody;
    req.authUser = { userId: decoded.sub, openid: decoded.openid } satisfies AuthUserPayload;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
}
