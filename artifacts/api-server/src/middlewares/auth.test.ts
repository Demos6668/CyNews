import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiKeyAuth, writeAuth } from "./auth";
import type { Request, Response, NextFunction } from "express";

function createMocks(overrides?: { method?: string; headers?: Record<string, string>; query?: Record<string, string> }) {
  const req = {
    method: overrides?.method ?? "GET",
    headers: overrides?.headers ?? {},
    query: overrides?.query ?? {},
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe("apiKeyAuth", () => {
  const originalEnv = process.env.API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalEnv;
    }
  });

  it("allows all requests when API_KEY is not set", () => {
    delete process.env.API_KEY;
    const { req, res, next } = createMocks();
    apiKeyAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows requests with valid x-api-key header", () => {
    process.env.API_KEY = "test-secret";
    const { req, res, next } = createMocks({ headers: { "x-api-key": "test-secret" } });
    apiKeyAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows requests with valid api_key query param", () => {
    process.env.API_KEY = "test-secret";
    const { req, res, next } = createMocks({ query: { api_key: "test-secret" } });
    apiKeyAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("rejects requests with missing key", () => {
    process.env.API_KEY = "test-secret";
    const { req, res, next } = createMocks();
    apiKeyAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized: invalid or missing API key" });
  });

  it("rejects requests with wrong key", () => {
    process.env.API_KEY = "test-secret";
    const { req, res, next } = createMocks({ headers: { "x-api-key": "wrong-key" } });
    apiKeyAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("writeAuth", () => {
  const originalEnv = process.env.API_KEY;

  beforeEach(() => {
    process.env.API_KEY = "test-secret";
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalEnv;
    }
  });

  it("allows GET requests without auth", () => {
    const { req, res, next } = createMocks({ method: "GET" });
    writeAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows HEAD requests without auth", () => {
    const { req, res, next } = createMocks({ method: "HEAD" });
    writeAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("allows OPTIONS requests without auth", () => {
    const { req, res, next } = createMocks({ method: "OPTIONS" });
    writeAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("requires auth for POST requests", () => {
    const { req, res, next } = createMocks({ method: "POST" });
    writeAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("requires auth for DELETE requests", () => {
    const { req, res, next } = createMocks({ method: "DELETE" });
    writeAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("allows POST with valid key", () => {
    const { req, res, next } = createMocks({ method: "POST", headers: { "x-api-key": "test-secret" } });
    writeAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
