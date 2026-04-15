import type { Request, Response } from "express";

export async function testPing(req: Request, res: Response): Promise<void> {
  res.json({
    ok: true,
    message: "test endpoint",
    serverTime: new Date().toISOString(),
    query: Object.keys(req.query).length ? req.query : undefined,
  });
}

export async function testEcho(req: Request, res: Response): Promise<void> {
  res.json({
    ok: true,
    message: "echo",
    serverTime: new Date().toISOString(),
    body: req.body && typeof req.body === "object" ? req.body : undefined,
    rawBodyEmpty: !req.body || (typeof req.body === "object" && Object.keys(req.body).length === 0),
  });
}
