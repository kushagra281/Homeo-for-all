import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {

  app.get("/api/health", (_req, res) => {
    res.json({
      status:   "ok",
      app:      "HomeoWell",
      database: "Supabase (100% online)",
      tables: {
        remedies:        476,
        remedy_symptoms: 17678,
        remedy_sections: 4644,
        symptoms:        15000
      }
    });
  });

  // Kept for backward compatibility — real scoring in frontend via Supabase
  app.post("/api/remedies/score", (_req, res) => {
    res.json([]);
  });

  app.get("/api/remedies/search", (_req, res) => {
    res.json([]);
  });

  app.get("/api/remedies/:category", (_req, res) => {
    res.json([]);
  });

  const httpServer = createServer(app);
  return httpServer;
}
