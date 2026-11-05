// server/routes.ts
// ROUTE AGGREGATOR — registers all route modules
// No business logic here.

import type { Express } from "express";
import { createServer, type Server } from "http";
import remediesRouter from "./routes/remedies";
import profileRouter  from "./routes/profile";
import repertoryRouter from "./routes/repertory";

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Health check ──────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      status:   "ok",
      groq:     !!(process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY),
      supabase: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      // The remedy search reads the scraper database; without these it returns an error, not results.
      scraper:  !!(process.env.SCRAPER_SUPABASE_URL && process.env.SCRAPER_SUPABASE_KEY),
    });
  });

  // ── Route modules ──────────────────────────────────────────────
  app.use("/api/remedies",  remediesRouter);
  app.use("/api/profile",   profileRouter);
  app.use("/api/repertory", repertoryRouter);

  const httpServer = createServer(app);
  return httpServer;
}
