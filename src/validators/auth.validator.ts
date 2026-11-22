import { z } from "zod";

// openapi.ts calls extendZodWithOpenApi(z), which enables `.openapi()` below
import "../openapi.ts";

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters")
      .openapi({ example: "ivan_petrenko" }),
    email: z.email("Invalid email address").openapi({ example: "ivan@example.com" }),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .openapi({ example: "secret123" }),
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .openapi({ example: "Іван" }),
  })
  .openapi("RegisterRequest");

export const loginSchema = z
  .object({
    username: z.string().min(1, "Username is required").openapi({ example: "ivan_petrenko" }),
    password: z.string().min(1, "Password is required").openapi({ example: "secret123" }),
  })
  .openapi("LoginRequest");

export const refreshSchema = z
  .object({
    refreshToken: z
      .string()
      .min(1, "Refresh token is required")
      .openapi({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
  })
  .openapi("RefreshRequest");

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

// ---------- Response schemas (used for OpenAPI documentation) ----------

export const publicUserSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    username: z.string().openapi({ example: "ivan_petrenko" }),
    email: z.string().openapi({ example: "ivan@example.com" }),
    name: z.string().openapi({ example: "Іван" }),
  })
  .openapi("PublicUser");

export const profileSchema = publicUserSchema
  .extend({
    createdAt: z
      .string()
      .openapi({ format: "date-time", example: "2025-01-10T12:00:00.000Z" }),
  })
  .openapi("UserProfile");

export const tokenPairSchema = z
  .object({
    accessToken: z.string().openapi({ example: "eyJhbGci..." }),
    refreshToken: z.string().openapi({ example: "eyJhbGci..." }),
  })
  .openapi("TokenPair");

export const authResponseSchema = z
  .object({
    user: publicUserSchema,
    accessToken: z.string().openapi({ example: "eyJhbGci..." }),
    refreshToken: z.string().openapi({ example: "eyJhbGci..." }),
  })
  .openapi("AuthResponse");

export const errorSchema = z
  .object({
    error: z.string().openapi({ example: "Error message" }),
  })
  .openapi("Error");

export const validationErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Validation failed" }),
    details: z
      .record(z.string(), z.array(z.string()))
      .openapi({
        example: { body: ["username: Username must be at least 3 characters"] },
      }),
  })
  .openapi("ValidationError");
