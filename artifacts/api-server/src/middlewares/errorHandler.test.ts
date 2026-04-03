import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  asyncHandler,
  globalErrorHandler,
} from "./errorHandler";

function mockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const mockReq = {} as Request;
const mockNext: NextFunction = vi.fn();

describe("Error classes", () => {
  describe("AppError", () => {
    it("stores statusCode and message", () => {
      const err = new AppError(418, "I'm a teapot");
      expect(err.statusCode).toBe(418);
      expect(err.message).toBe("I'm a teapot");
      expect(err.name).toBe("AppError");
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("NotFoundError", () => {
    it("defaults to 404 with 'Not found' message", () => {
      const err = new NotFoundError();
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe("Not found");
      expect(err.name).toBe("NotFoundError");
    });

    it("accepts custom message", () => {
      const err = new NotFoundError("Advisory not found");
      expect(err.message).toBe("Advisory not found");
      expect(err.statusCode).toBe(404);
    });

    it("is an instance of AppError", () => {
      expect(new NotFoundError()).toBeInstanceOf(AppError);
    });
  });

  describe("ValidationError", () => {
    it("defaults to 400 with 'Validation error' message", () => {
      const err = new ValidationError();
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Validation error");
      expect(err.name).toBe("ValidationError");
    });

    it("accepts custom message and details", () => {
      const details = [{ field: "email", issue: "required" }];
      const err = new ValidationError("Bad input", details);
      expect(err.message).toBe("Bad input");
      expect(err.details).toEqual(details);
    });

    it("is an instance of AppError", () => {
      expect(new ValidationError()).toBeInstanceOf(AppError);
    });
  });

  describe("UnauthorizedError", () => {
    it("defaults to 401 with 'Unauthorized' message", () => {
      const err = new UnauthorizedError();
      expect(err.statusCode).toBe(401);
      expect(err.message).toBe("Unauthorized");
      expect(err.name).toBe("UnauthorizedError");
    });

    it("accepts custom message", () => {
      const err = new UnauthorizedError("Invalid API key");
      expect(err.message).toBe("Invalid API key");
    });

    it("is an instance of AppError", () => {
      expect(new UnauthorizedError()).toBeInstanceOf(AppError);
    });
  });
});

describe("asyncHandler", () => {
  it("calls the wrapped function with req, res, next", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(handler);

    const res = mockRes();
    wrapped(mockReq, res, mockNext);

    // Let the promise resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(handler).toHaveBeenCalledWith(mockReq, res, mockNext);
  });

  it("calls next with error when handler throws", async () => {
    const error = new Error("boom");
    const handler = vi.fn().mockRejectedValue(error);
    const next = vi.fn();

    const wrapped = asyncHandler(handler);
    wrapped(mockReq, mockRes(), next);

    await new Promise((r) => setTimeout(r, 0));
    expect(next).toHaveBeenCalledWith(error);
  });

  it("does not call next when handler succeeds", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const next = vi.fn();

    const wrapped = asyncHandler(handler);
    wrapped(mockReq, mockRes(), next);

    await new Promise((r) => setTimeout(r, 0));
    expect(next).not.toHaveBeenCalled();
  });
});

describe("globalErrorHandler", () => {
  it("handles ZodError with 400 and validation details", () => {
    const zodErr = new Error("Invalid input");
    zodErr.name = "ZodError";
    (zodErr as unknown as { errors: unknown[] }).errors = [
      { path: ["name"], message: "Required" },
    ];

    const res = mockRes();
    globalErrorHandler(zodErr, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Validation error",
      details: [{ path: ["name"], message: "Required" }],
    });
  });

  it("handles AppError with its statusCode", () => {
    const err = new AppError(409, "Conflict");
    const res = mockRes();

    globalErrorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Conflict" });
  });

  it("handles NotFoundError with 404", () => {
    const err = new NotFoundError("Item missing");
    const res = mockRes();

    globalErrorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Item missing" });
  });

  it("handles ValidationError with details", () => {
    const details = { field: "age", issue: "must be positive" };
    const err = new ValidationError("Invalid", details);
    const res = mockRes();

    globalErrorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid",
      details,
    });
  });

  it("handles ValidationError without details", () => {
    const err = new ValidationError("Bad data");
    const res = mockRes();

    globalErrorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Bad data" });
  });

  it("handles UnauthorizedError with 401", () => {
    const err = new UnauthorizedError();
    const res = mockRes();

    globalErrorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("handles unknown errors with 500", () => {
    const err = new Error("Something unexpected");
    const res = mockRes();

    globalErrorHandler(err, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
