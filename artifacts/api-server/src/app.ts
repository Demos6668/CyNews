import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { resolve, join } from "path";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { globalErrorHandler } from "./middlewares/errorHandler";
import { writeAuth, apiKeyAuth } from "./middlewares/auth";
import { authHandler } from "./lib/auth";
import { logger } from "./lib/logger";
import {
  registry as metricsRegistry,
  httpRequestDuration,
  httpRequestsTotal,
  statusClass,
} from "./lib/metrics";

const app: Express = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // 'unsafe-inline' retained for styles: React component libraries (Radix,
      // shadcn) and Tailwind utilities emit inline style attributes for
      // animations and computed sizing. Script-src stays strict.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Permissions-Policy — disable browser APIs the SPA doesn't need.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    "Permissions-Policy",
    [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  );
  next();
});

// RFC 9116 — well-known security contact for vulnerability reporting.
app.get("/.well-known/security.txt", (_req: Request, res: Response) => {
  const contact = process.env.SECURITY_CONTACT ?? "mailto:security@cynews.local";
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  res.type("text/plain").send(
    [
      `Contact: ${contact}`,
      `Expires: ${expires}`,
      "Preferred-Languages: en",
      "Policy: https://cynews.local/security",
      "",
    ].join("\n"),
  );
});

// Request ID for log correlation
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("X-Request-Id", requestId);
  (req as any).id = requestId;
  next();
});

// HTTP metrics — measure duration and count by (method, route, status class).
// Uses req.route.path after routing so `:id`-style params are normalised.
app.use((req: Request, res: Response, next: NextFunction) => {
  const startNs = process.hrtime.bigint();
  res.on("finish", () => {
    const route = (req.route?.path as string | undefined) ?? req.baseUrl ?? "unmatched";
    const labels = {
      method: req.method,
      route: `${req.baseUrl ?? ""}${route}` || "unmatched",
      status_class: statusClass(res.statusCode),
    };
    const durationSec = Number(process.hrtime.bigint() - startNs) / 1e9;
    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);
  });
  next();
});

// Prometheus /metrics endpoint — optionally gated by METRICS_TOKEN.
app.get("/metrics", async (req: Request, res: Response) => {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${token}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }
  try {
    res.setHeader("Content-Type", metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  } catch (err) {
    logger.error({ err }, "Failed to render /metrics");
    res.status(500).json({ error: "Failed to render metrics" });
  }
});

// Response compression — applies to JSON, HTML, and static assets.
// Skipped for Prometheus /metrics (small, scraped often) and when clients
// send `x-no-compression`.
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.path === "/metrics") return false;
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

// CORS - restrict to known origins in production
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(s => s.trim())
  : undefined;

app.use(cors(allowedOrigins ? {
  origin: allowedOrigins,
  credentials: true,
} : undefined));

// Structured request logging
if (process.env.NODE_ENV !== "test") {
  app.use(pinoHttp({
    logger,
    genReqId: (req) => (req as any).id,
    autoLogging: { ignore: (req) => req.url === "/api/healthz" },
  }));
}

// Stripe webhook requires raw body for signature verification
// Must be BEFORE the json() middleware so it gets the raw Buffer.
app.use("/api/billing/webhook", express.raw({ type: "application/json", limit: "2mb" }));

// Body parsing with size limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Rate limiting - general API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api", apiLimiter);

// Stricter rate limit for write operations
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many write requests, please try again later" },
});
app.use("/api/news", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
    writeLimiter(req, res, next);
  } else {
    next();
  }
});
app.use("/api/export", writeLimiter);
app.use("/api/threats/export", writeLimiter);

// Tight rate limit for credential/auth endpoints (anti-brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, please try again later" },
});
app.use("/api/auth/sign-in", authLimiter);
app.use("/api/auth/sign-up", authLimiter);
app.use("/api/auth/email-otp", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/verify-email", authLimiter);

// Account deletion — 5 requests per hour
const accountDeleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many account deletion requests" },
});
app.use("/api/account", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "DELETE") {
    accountDeleteLimiter(req, res, next);
  } else {
    next();
  }
});

// Stripe webhook — burst protection (Stripe retries ~3× per event)
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many webhook requests" },
});
app.use("/api/billing/webhook", webhookLimiter);

// Prevent browsers from caching API responses (server-side TTL cache handles freshness)
app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Better Auth — handles /api/auth/* (sign-in, sign-up, verify, reset)
// Must be mounted BEFORE the write-auth middleware so auth routes are public.
app.all("/api/auth/*path", authHandler);

// Authentication: protect write operations and sensitive endpoints
app.use("/api/scheduler", apiKeyAuth);
app.use("/api", writeAuth);

app.use("/api", router);

// Serve frontend static files in production
const frontendDist = resolve(import.meta.dirname, "../../cyfy-news/dist/public");
if (process.env.NODE_ENV === "production" && existsSync(frontendDist)) {
  app.use(express.static(frontendDist, {
    maxAge: "1d",
    setHeaders: (res, path) => {
      // Never cache index.html so SPA updates propagate immediately
      if (path.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }));
  app.get("*", (_req: Request, res: Response, next: NextFunction) => {
    if (_req.path.startsWith("/api") || _req.path.startsWith("/ws")) {
      return next();
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(join(frontendDist, "index.html"));
  });
}

// 404 catch-all for unmapped API routes
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler (must be after routes)
app.use(globalErrorHandler);

export default app;
