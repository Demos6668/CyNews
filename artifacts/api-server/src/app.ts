import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { resolve, join } from "path";
import { existsSync } from "fs";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { globalErrorHandler } from "./middlewares/errorHandler";
import { writeAuth, apiKeyAuth } from "./middlewares/auth";
import { logger } from "./lib/logger";

const app: Express = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
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
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/api/healthz" } }));
}

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

// Prevent browsers from caching API responses (server-side TTL cache handles freshness)
app.use("/api", (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

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
