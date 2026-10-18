// server/routes.ts
// ROUTE AGGREGATOR — registers all route modules
// No business logic here.

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { MedicalTerm } from "@shared/schema";
import remediesRouter from "./routes/remedies";
import profileRouter  from "./routes/profile";

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

  // ── Medical dictionary (used by the /dictionary page) ─────────
  let medicalTerms: MedicalTerm[] | null = null;
  app.get("/api/medical-terms", (_req, res) => {
    try {
      if (!medicalTerms) {
        const file = ["attached_assets", "server/data", "data"]
          .map((d) => join(process.cwd(), d, "homeopathic_medical_dictionary_1753724702324.json"))
          .find(existsSync);
        if (!file) return res.status(404).json({ message: "Dictionary data file not found" });
        const raw = JSON.parse(readFileSync(file, "utf-8")) as any[];
        medicalTerms = raw.map((t, i) => ({
          id: String(t.id ?? i + 1),
          term: String(t.term || ""),
          definition: String(t.definition || ""),
          category: String(t.category || "General"),
          synonyms: Array.isArray(t.synonyms) ? t.synonyms : [],
          relatedRemedies: Array.isArray(t.related_remedies) ? t.related_remedies : [],
          translations: t.translations && typeof t.translations === "object" ? t.translations : {},
        })).filter((t) => t.term);
      }
      res.json(medicalTerms);
    } catch (error) {
      console.error("[Route] medical-terms:", error);
      res.status(500).json({ message: "Failed to load dictionary" });
    }
  });

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
