import type { AuthUserPayload } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUserPayload;
    }
  }
}

export {};
