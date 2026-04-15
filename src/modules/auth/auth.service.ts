import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../middleware/error.middleware.js";
import { code2Session } from "./wechat.service.js";

export async function loginWithWxCode(code: string): Promise<{
  token: string;
  user: { id: string; openid: string; nickname: string | null; avatarUrl: string | null };
}> {
  if (!code || typeof code !== "string") {
    throw new HttpError(400, "code is required");
  }

  const wx = await code2Session(env.wechatAppId, env.wechatSecret, code);

  const user = await prisma.user.upsert({
    where: { openid: wx.openid },
    create: {
      openid: wx.openid,
      unionid: wx.unionid ?? null,
    },
    update: {
      unionid: wx.unionid ?? undefined,
    },
  });

  const signOptions: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  };
  const token = jwt.sign({ sub: user.id, openid: user.openid }, env.jwtSecret, signOptions);

  return {
    token,
    user: {
      id: user.id,
      openid: user.openid,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
    },
  };
}

export async function updateProfile(
  userId: string,
  input: { nickname?: string; avatarUrl?: string }
): Promise<{ id: string; openid: string; nickname: string | null; avatarUrl: string | null }> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      nickname: input.nickname,
      avatarUrl: input.avatarUrl,
    },
  });

  return {
    id: user.id,
    openid: user.openid,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  };
}
