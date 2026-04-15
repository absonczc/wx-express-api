import type { Request, Response } from "express";
import { HttpError } from "../../middleware/error.middleware.js";
import { fetchFootballList, buildTodayTomorrowPrompt, transformFootballData, fetchMatchSituation, fetchMatchLineup, fetchMatchAnalysis, transformMatchDetail } from "./football.service.js";

export async function getFootballList(req: Request, res: Response): Promise<void> {
  const start = (req.query.start as string) || "2026-04-1400:00:00";
  const version = req.query.version ? Number(req.query.version) : 576;
  const init = req.query.init ? Number(req.query.init) : 0;
  const wfrom = req.query.wfrom ? Number(req.query.wfrom) : 2;
  const from = (req.query.from as string) || "msite_com";

  if (!start || typeof start !== "string") {
    throw new HttpError(400, "start parameter is required");
  }

  const data = await fetchFootballList({ start, version, init, wfrom, from });

  res.json({
    ok: true,
    data,
  });
}

export async function getFootballListTransformed(req: Request, res: Response): Promise<void> {
  const start = (req.query.start as string) || "2026-04-1400:00:00";
  const version = req.query.version ? Number(req.query.version) : 576;
  const init = req.query.init ? Number(req.query.init) : 0;
  const wfrom = req.query.wfrom ? Number(req.query.wfrom) : 2;
  const from = (req.query.from as string) || "msite_com";

  if (!start || typeof start !== "string") {
    throw new HttpError(400, "start parameter is required");
  }

  const data = await fetchFootballList({ start, version, init, wfrom, from });
  const transformedData = transformFootballData(data);

  res.json({
    ok: true,
    data: transformedData,
  });
}

export async function getTodayTomorrowMatches(req: Request, res: Response): Promise<void> {
  const start = (req.query.start as string) || "2026-04-1400:00:00";
  const version = req.query.version ? Number(req.query.version) : 576;
  const init = req.query.init ? Number(req.query.init) : 0;
  const wfrom = req.query.wfrom ? Number(req.query.wfrom) : 2;
  const from = (req.query.from as string) || "msite_com";

  const data = await fetchFootballList({ start, version, init, wfrom, from });
  const prompt = buildTodayTomorrowPrompt(data);

  res.json({
    ok: true,
    data: prompt,
  });
}

export async function getMatchDetail(req: Request, res: Response): Promise<void> {
  const matchId = req.query.matchId as string;

  if (!matchId || typeof matchId !== "string") {
    throw new HttpError(400, "matchId parameter is required");
  }

  const [situation, lineup, analysis] = await Promise.all([
    fetchMatchSituation(matchId),
    fetchMatchLineup(matchId),
    fetchMatchAnalysis(matchId),
  ]);

  const transformedData = transformMatchDetail(situation, lineup, analysis);

  res.json({
    ok: true,
    data: transformedData,
  });
}