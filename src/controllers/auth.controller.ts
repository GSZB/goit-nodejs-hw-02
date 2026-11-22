import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import createError from "http-errors";

import prisma from "../../prisma/client.ts";
import { generateTokens, verifyToken } from "../utils/tokens.ts";
import type {
  LoginInput,
  RefreshInput,
  RegisterInput,
} from "../validators/auth.validator.ts";

const SALT_ROUNDS = 10;

// Fields that are safe to return to the client — `password` is never selected.
const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
} as const;

// Used to keep login timing the same whether or not the user exists.
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", SALT_ROUNDS);

// POST /auth/register
export async function register(req: Request, res: Response) {
  const { username, email, password, name } = req.body as RegisterInput;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { id: true },
  });
  if (existing) {
    throw createError(409, "Username or email already taken");
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  try {
    user = await prisma.user.create({
      data: { username, email, password: hashedPassword, name },
      select: publicUserSelect,
    });
  } catch (err: any) {
    // Race condition: another request created the same username/email meanwhile
    if (err?.code === "P2002") {
      throw createError(409, "Username or email already taken");
    }
    throw err;
  }

  const tokens = generateTokens(user);
  await prisma.refreshToken.create({
    data: { token: tokens.refreshToken, userId: user.id },
  });

  res.status(201).json({ user, ...tokens });
}

// POST /auth/login
export async function login(req: Request, res: Response) {
  const { username, password } = req.body as LoginInput;

  const user = await prisma.user.findUnique({ where: { username } });

  // Always run bcrypt.compare so both failure cases take the same time,
  // and always answer with the same message.
  const passwordMatches = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);
  if (!user || !passwordMatches) {
    throw createError(401, "Invalid credentials");
  }

  const tokens = generateTokens(user);

  // Replace the user's old refresh token(s) with the new one
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    prisma.refreshToken.create({ data: { token: tokens.refreshToken, userId: user.id } }),
  ]);

  res.status(200).json({
    user: { id: user.id, username: user.username, email: user.email, name: user.name },
    ...tokens,
  });
}

// POST /auth/refresh
export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as RefreshInput;

  // 1. Verify the signature and expiry with jwt.verify()
  let payload;
  try {
    payload = verifyToken(refreshToken, "refresh");
  } catch {
    throw createError(401, "Invalid or expired refresh token");
  }

  // 2. Find the token record in the database
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: { select: { id: true, username: true } } },
  });
  if (!stored || stored.userId !== payload.sub) {
    throw createError(401, "Invalid or expired refresh token");
  }

  // 3. Token rotation: delete the old token and store the new one
  const tokens = generateTokens(stored.user);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.refreshToken.deleteMany({ where: { token: refreshToken } });
    if (count === 0) {
      // The token was already used by a concurrent request
      throw createError(401, "Invalid or expired refresh token");
    }
    await tx.refreshToken.create({
      data: { token: tokens.refreshToken, userId: stored.userId },
    });
  });

  res.status(200).json(tokens);
}

// POST /auth/logout (protected)
export async function logout(req: Request, res: Response) {
  // deleteMany does not throw when there is nothing to delete
  await prisma.refreshToken.deleteMany({ where: { userId: req.user!.sub } });
  res.status(204).end();
}

// GET /auth/me (protected)
export async function me(req: Request, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { ...publicUserSelect, createdAt: true },
  });

  if (!user) {
    throw createError(404, "User not found");
  }

  res.status(200).json(user);
}
