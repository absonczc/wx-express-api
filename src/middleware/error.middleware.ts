import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      ok: false,
      error: err.message,
      details: err.details,
    });
    return;
  }

  logger.error("Unhandled error", err);
  res.status(500).json({
    ok: false,
    error: "Internal Server Error",
  });
}
