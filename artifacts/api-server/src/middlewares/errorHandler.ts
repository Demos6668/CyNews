import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Centralized async route handler that catches errors and sends proper responses.
 * Wraps route handlers to avoid repetitive try/catch blocks.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Global error handler middleware - must be registered last.
 */
export function globalErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err.name === "ZodError") {
    res.status(400).json({
      error: "Validation error",
      details: (err as unknown as { errors?: unknown }).errors,
    });
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
}
