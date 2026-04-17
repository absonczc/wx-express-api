import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import { fetchBasketballMatchDetail, fetchBasketballTab } from "./basketball.service.js";

export async function getBasketballTab(req: Request, res: Response): Promise<void> {
  const start = (req.query.start as string) || "2026-04-1516:00:00";
  const version = req.query.version ? Number(req.query.version) : 576;
  const init = req.query.init !== undefined ? Number(req.query.init) : 1;
  const wfrom = req.query.wfrom ? Number(req.query.wfrom) : 2;
  const from = (req.query.from as string) || "msite_com";

  if (!start || typeof start !== "string") {
    throw new HttpError(400, "start parameter is required");
  }

  const data = await fetchBasketballTab({ start, version, init, wfrom, from });

  res.json({
    ok: true,
    data,
  });
}

const MATCH_ID_RE = /^\d+$/;

export async function getBasketballMatchDetail(req: Request, res: Response): Promise<void> {
  const matchId = req.params.matchId;

  if (!matchId || typeof matchId !== "string" || !MATCH_ID_RE.test(matchId)) {
    throw new HttpError(400, "matchId must be a numeric id in the path");
  }

  const data = await fetchBasketballMatchDetail(matchId);

  res.json({
    ok: true,
    data,
  });
}
