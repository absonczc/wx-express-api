export type AuthUserPayload = {
  userId: string;
  openid: string;
};

export type WxCode2SessionResult = {
  openid: string;
  session_key: string;
  unionid?: string;
};
