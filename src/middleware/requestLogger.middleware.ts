import type { NextFunction, Request, Response } from "express";
import { logHttp } from "../lib/logger.js";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    logHttp(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms,
    });
  });
  next();
}
