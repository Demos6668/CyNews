import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { validate } from "./validate";

function createApp(schemas: Parameters<typeof validate>[0]) {
  const app = express();
  app.use(express.json());

  app.get(
    "/test/:id",
    validate(schemas),
    (_req, res) => {
      res.json({ ok: true, params: _req.params });
    },
  );

  app.post(
    "/test",
    validate(schemas),
    (_req, res) => {
      res.json({ ok: true, body: _req.body });
    },
  );

  app.post(
    "/test/:id",
    validate(schemas),
    (_req, res) => {
      res.json({ ok: true, params: _req.params, body: _req.body });
    },
  );

  // Error handler to surface unexpected errors
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err.message });
  });

  return app;
}

describe("validate middleware", () => {
  describe("valid input passes through to next()", () => {
    it("passes when params are valid", async () => {
      const app = createApp({
        params: z.object({ id: z.coerce.number().int().positive() }),
      });

      const res = await request(app).get("/test/42").expect(200);

      expect(res.body).toEqual({ ok: true, params: { id: 42 } });
    });

    it("passes when body is valid", async () => {
      const app = createApp({
        body: z.object({ name: z.string().min(1) }),
      });

      const res = await request(app)
        .post("/test")
        .send({ name: "hello" })
        .expect(200);

      expect(res.body).toEqual({ ok: true, body: { name: "hello" } });
    });

    it("passes when both params and body are valid", async () => {
      const app = createApp({
        params: z.object({ id: z.coerce.number() }),
        body: z.object({ title: z.string() }),
      });

      const res = await request(app)
        .post("/test/5")
        .send({ title: "Test" })
        .expect(200);

      expect(res.body).toEqual({ ok: true, params: { id: 5 }, body: { title: "Test" } });
    });
  });

  describe("invalid params returns 400 with structured error details", () => {
    it("returns path and message for each validation error", async () => {
      const app = createApp({
        params: z.object({ id: z.coerce.number().int().positive() }),
      });

      const res = await request(app).get("/test/abc").expect(400);

      expect(res.body.error).toBe("Validation failed");
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBeGreaterThan(0);
      expect(res.body.details[0]).toHaveProperty("path");
      expect(res.body.details[0]).toHaveProperty("message");
    });

    it("returns 400 for negative number when positive is required", async () => {
      const app = createApp({
        params: z.object({ id: z.coerce.number().int().positive() }),
      });

      const res = await request(app).get("/test/-5").expect(400);

      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details[0].path).toBe("id");
    });
  });

  describe("invalid body returns 400", () => {
    it("returns 400 when body fails validation", async () => {
      const app = createApp({
        body: z.object({ name: z.string().min(1) }),
      });

      const res = await request(app)
        .post("/test")
        .send({ name: "" })
        .expect(400);

      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details[0]).toHaveProperty("path");
      expect(res.body.details[0]).toHaveProperty("message");
    });

    it("returns 400 when body is missing required fields", async () => {
      const app = createApp({
        body: z.object({ name: z.string(), age: z.number() }),
      });

      const res = await request(app)
        .post("/test")
        .send({})
        .expect(400);

      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("missing optional schema segments are skipped", () => {
    it("skips body validation when no body schema is provided", async () => {
      const app = createApp({
        params: z.object({ id: z.coerce.number() }),
        // no body or query schema
      });

      const res = await request(app).get("/test/5").expect(200);

      expect(res.body.ok).toBe(true);
    });

    it("skips params validation when no params schema is provided", async () => {
      const app = createApp({
        body: z.object({ name: z.string() }),
        // no params schema — any :id value is accepted
      });

      const res = await request(app)
        .post("/test/anything-goes")
        .send({ name: "hello" })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.params.id).toBe("anything-goes");
    });

    it("passes through when no schemas are provided at all", async () => {
      const app = createApp({});

      const res = await request(app).get("/test/anything").expect(200);

      expect(res.body.ok).toBe(true);
    });
  });
});
