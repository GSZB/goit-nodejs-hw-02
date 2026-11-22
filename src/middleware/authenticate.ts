import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { verifyToken } from "../utils/tokens.ts";

export interface AuthUser {
  sub: number;
  username: string;
}

// Module augmentation: tell TypeScript that Request may carry `user`.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "Authorization header is missing" });
  }

  const [scheme, token, ...rest] = header.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token || rest.length > 0) {
    return res
      .status(401)
      .json({ error: "Authorization header must be in format: Bearer <token>" });
  }

  try {
    const payload = verifyToken(token, "access");
    req.user = { sub: payload.sub, username: payload.username };
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}
