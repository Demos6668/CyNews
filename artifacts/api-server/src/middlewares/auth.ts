import type { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * API key authentication middleware.
 * Validates the API key from the `x-api-key` header or `api_key` query parameter.
 * If API_KEY is not set in the environment, all requests are allowed (dev mode).
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY;

  // If no API_KEY configured, skip auth (dev mode)
  if (!apiKey) {
    next();
    return;
  }

  const providedKey =
    req.headers["x-api-key"] as string | undefined ??
    (req.query["api_key"] as string | undefined);

  if (!providedKey || !timingSafeCompare(providedKey, apiKey)) {
    res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    return;
  }

  next();
}

/**
 * Auth middleware that only protects write operations (POST, PUT, PATCH, DELETE).
 * Read operations (GET, HEAD, OPTIONS) pass through freely.
 */
export function writeAuth(req: Request, res: Response, next: NextFunction): void {
  const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);
  if (readMethods.has(req.method)) {
    next();
    return;
  }
  apiKeyAuth(req, res, next);
}
