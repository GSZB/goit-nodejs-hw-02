import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";

export type TokenType = "access" | "refresh";

export interface TokenPayload {
  sub: number;
  username: string;
  type: TokenType;
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

function signToken(
  user: { id: number; username: string },
  type: TokenType,
  expiresIn: typeof ACCESS_TOKEN_TTL | typeof REFRESH_TOKEN_TTL,
): string {
  // jwtid makes every token unique, so two tokens issued within the same
  // second never collide on the unique `token` column.
  return jwt.sign({ sub: user.id, username: user.username, type }, getSecret(), {
    expiresIn,
    jwtid: randomUUID(),
  });
}

export function generateTokens(user: { id: number; username: string }): TokenPair {
  return {
    accessToken: signToken(user, "access", ACCESS_TOKEN_TTL),
    refreshToken: signToken(user, "refresh", REFRESH_TOKEN_TTL),
  };
}

/**
 * Verifies the token signature and expiry with jwt.verify() and checks the
 * token type. Throws if the token is invalid, expired or of the wrong type.
 */
export function verifyToken(token: string, expectedType: TokenType): TokenPayload {
  const decoded = jwt.verify(token, getSecret());

  if (
    typeof decoded === "string" ||
    decoded.type !== expectedType ||
    decoded.sub === undefined ||
    !Number.isInteger(Number(decoded.sub))
  ) {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }

  return {
    sub: Number(decoded.sub),
    username: String(decoded.username),
    type: expectedType,
    iat: decoded.iat,
    exp: decoded.exp,
    jti: decoded.jti,
  };
}
