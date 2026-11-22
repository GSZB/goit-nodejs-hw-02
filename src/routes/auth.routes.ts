import { Router } from "express";

import { login, logout, me, refresh, register } from "../controllers/auth.controller.ts";
import { authenticate } from "../middleware/authenticate.ts";
import { validateBody } from "../middleware/validate.ts";
import { registry } from "../openapi.ts";
import {
  authResponseSchema,
  errorSchema,
  loginSchema,
  profileSchema,
  refreshSchema,
  registerSchema,
  tokenPairSchema,
  validationErrorSchema,
} from "../validators/auth.validator.ts";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh", validateBody(refreshSchema), refresh);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);

export default router;

// ---------------------------- OpenAPI docs ----------------------------

const json = <T>(schema: T) => ({ content: { "application/json": { schema } } });

const validationError = { description: "Validation failed", ...json(validationErrorSchema) };
const unauthorized = {
  description: "Missing, invalid or expired access token",
  ...json(errorSchema),
};

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  summary: "Register a new user",
  description:
    "Creates a user with a bcrypt-hashed password and returns a token pair. The refresh token is stored in the database.",
  request: { body: { required: true, ...json(registerSchema) } },
  responses: {
    201: { description: "User created", ...json(authResponseSchema) },
    400: validationError,
    409: { description: "Username or email already taken", ...json(errorSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Log in",
  description:
    "Checks username and password and returns a new token pair. The user's old refresh token is replaced with the new one.",
  request: { body: { required: true, ...json(loginSchema) } },
  responses: {
    200: { description: "Logged in", ...json(authResponseSchema) },
    400: validationError,
    401: { description: "Invalid credentials", ...json(errorSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["Auth"],
  summary: "Refresh the token pair",
  description:
    "Verifies the refresh token, deletes it from the database and stores a new one (token rotation).",
  request: { body: { required: true, ...json(refreshSchema) } },
  responses: {
    200: { description: "New token pair", ...json(tokenPairSchema) },
    400: validationError,
    401: { description: "Invalid, expired or revoked refresh token", ...json(errorSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  summary: "Log out",
  description: "Deletes the current user's refresh token from the database.",
  security: [{ bearerAuth: [] }],
  responses: {
    204: { description: "Logged out (no content)" },
    401: unauthorized,
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["Auth"],
  summary: "Current user profile",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Current user (without password)", ...json(profileSchema) },
    401: unauthorized,
    404: { description: "User not found", ...json(errorSchema) },
  },
});
