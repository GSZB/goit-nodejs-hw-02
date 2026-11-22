import type { NextFunction, Request, Response } from "express";
import type { ZodType, z } from "zod";

type RequestPart = "body" | "params" | "query";

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

function validate(part: RequestPart, schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    // safeParse never throws — it returns { success, data } or { success, error }
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: { [part]: formatIssues(result.error) },
      });
    }

    // Replace raw input with parsed data (coerced numbers, defaults, stripped
    // unknown keys). In Express 5 `req.query` is a getter, so we redefine it.
    Object.defineProperty(req, part, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });

    return next();
  };
}

export const validateBody = (schema: ZodType) => validate("body", schema);
export const validateParams = (schema: ZodType) => validate("params", schema);
export const validateQuery = (schema: ZodType) => validate("query", schema);
