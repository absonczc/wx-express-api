import type { Request, Response } from "express";
import { loginWithWxCode, updateProfile } from "./auth.service.js";
import { env } from "../../config/env.js";

export async function wxLogin(req: Request, res: Response): Promise<void> {
  const code = (req.body as { code?: string }).code;
  const result = await loginWithWxCode(code ?? "");
  res.json({ ok: true, ...result });
}

export async function patchMe(req: Request, res: Response): Promise<void> {
  const body = req.body as { nickname?: string; avatarUrl?: string };
  const user = await updateProfile(req.authUser!.userId, {
    nickname: typeof body.nickname === "string" ? body.nickname : undefined,
    avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : undefined,
  });
  res.json({ ok: true, user });
}

export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new Error("No file uploaded");
  }

  // 构建头像的完整 URL
  const avatarUrl = `${env.baseUrl}/uploads/${req.file.filename}`;

  // 更新用户的头像URL
  const user = await updateProfile(req.authUser!.userId, {
    avatarUrl: avatarUrl
  });

  res.json({
    ok: true,
    user,
    avatarUrl
  });
}