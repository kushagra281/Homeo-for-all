import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeWebSocket } from "./websocket";

const app = express();

// CORS setup
app.use((req: Request, res: Response, next: NextFunction) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5000",
    process.env.FRONTEND_URL || "",
  ].filter(Boolean);

  const origin = req.headers.origin as string;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else {
    res.setHeader(
      "Access-Control-Allow-Origin",
      process.env.NODE_ENV === "production" ? "" : "*"
    );
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }

  next();
});

// Only the report-image route needs a big body; everything else is small JSON.
app.set("trust proxy", 1);   // behind Render/Railway: use the real client IP (rate limiting)
app.use("/api/remedies/analyze-report", express.json({ limit: "10mb" }));
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: false }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);
  initializeWebSocket(server);   // community chat at /ws/chat (was never started)

  // Unknown /api paths must be a JSON 404, not the single-page-app HTML with status 200
  // (that made every missing endpoint look like it had "worked" and returned garbage).
  app.use("/api", (req: Request, res: Response) => {
    res.status(404).json({ message: `No such API route: ${req.method} ${req.originalUrl}` });
  });

  // ── FIX 2a: removed "throw err" — was crashing Node process in production
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[Error] ${status} — ${message}`);
    res.status(status).json({ success: false, error: "SERVER_ERROR", message });
    // NOTE: throw err removed — it crashed the Node process on every unhandled error
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);

  // ── FIX 2b: removed reusePort:true — unsupported on Render Linux
  server.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
