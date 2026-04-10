// server/routes.ts
// ROUTE AGGREGATOR — registers all route modules
// No business logic here.

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import remediesRouter from "./routes/remedies";
import profileRouter  from "./routes/profile";

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Health check ──────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      status:   "ok",
      engine:   "repertory-v3",
      groq:     !!(process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY),
      supabase: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    });
  });

  // ── Route modules ──────────────────────────────────────────────
  app.use("/api/remedies",  remediesRouter);
  app.use("/api/profile",   profileRouter);
  app.use("/api/analyze-report", remediesRouter); // analyze-report lives in remediesRouter

  // ── Questions ─────────────────────────────────────────────────
  app.get("/api/questions/:bodySystem", async (req, res) => {
    try {
      const questions = await storage.getQuestionTree(req.params.bodySystem);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
