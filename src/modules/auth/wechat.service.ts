import { HttpError } from "../../middleware/error.middleware.js";
import type { WxCode2SessionResult } from "./auth.types.js";

type WxErrorResponse = {
  errcode: number;
  errmsg: string;
};

function isWxError(data: unknown): data is WxErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "errcode" in data &&
    typeof (data as WxErrorResponse).errcode === "number" &&
    (data as WxErrorResponse).errcode !== 0
  );
}

export async function code2Session(
  appid: string,
  secret: string,
  code: string
): Promise<WxCode2SessionResult> {
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const res = await fetch(url);
  if (!res.ok) {
    throw new HttpError(502, "WeChat API request failed");
  }

  const data = (await res.json()) as unknown;

  if (isWxError(data)) {
    throw new HttpError(400, `WeChat error: ${data.errmsg}`, { errcode: data.errcode });
  }

  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as WxCode2SessionResult).openid !== "string" ||
    typeof (data as WxCode2SessionResult).session_key !== "string"
  ) {
    throw new HttpError(502, "Unexpected WeChat API response");
  }

  return data as WxCode2SessionResult;
}
