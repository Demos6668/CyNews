import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { captureException } from "../lib/sentry";

/**
 * Custom error classes for standardized API error responses.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation error", public readonly details?: unknown) {
    super(400, message);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

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
  req: Request,
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

  // Custom application errors — client-visible, not escalated to Sentry.
  if (err instanceof AppError) {
    const body: { error: string; details?: unknown } = { error: err.message };
    if (err instanceof ValidationError && err.details) {
      body.details = err.details;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Unknown errors — log and escalate to Sentry with request context.
  const requestId = (req as unknown as { id?: string }).id;
  logger.error({ err, requestId, method: req.method, url: req.originalUrl }, "Unhandled error");
  captureException(err, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    userId: req.ctx?.userId,
    orgId: req.ctx?.orgId,
  });
  res.status(500).json({ error: "Internal server error", requestId });
}
