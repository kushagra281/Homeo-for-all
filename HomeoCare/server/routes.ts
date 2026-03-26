import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(app: Express): Promise<Server> {

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "HomeoWell API running", database: "supabase" });
  });

  // Keep this endpoint for compatibility but it now just returns empty
  // Real scoring happens in frontend via Supabase directly
  app.post("/api/remedies/score", async (req, res) => {
    try {
      const { symptoms, filters } = req.body;
      if (!symptoms || symptoms.length === 0) {
        return res.json([]);
      }
      // Return a signal to frontend to use Supabase directly
      res.json({ useSupabase: true, symptoms, filters });
    } catch (error) {
      console.error("Score error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Remedies by category
  app.get("/api/remedies/:category", async (req, res) => {
    res.json({ message: "Use Supabase client directly", category: req.params.category });
  });

  // Search
  app.get("/api/remedies/search", async (req, res) => {
    res.json({ message: "Use Supabase client directly" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
