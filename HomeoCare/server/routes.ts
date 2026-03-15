import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, type RemedyFilters } from "./storage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Search remedies by keyword with optional category filter
  app.get("/api/remedies/search/:keyword", async (req, res) => {
    try {
      const keyword = req.params.keyword;
      const category = req.query.category as string;
      const remedies = await storage.searchRemediesByKeyword(keyword, category);
      res.json(remedies);
    } catch (error) {
      console.error("Error searching remedies:", error);
      res.status(500).json({ message: "Failed to search remedies" });
    }
  });

  // Score remedies by symptoms with filters
  app.post("/api/remedies/score", async (req, res) => {
    try {
      const { symptoms, filters } = req.body;
      
      if (!symptoms || !Array.isArray(symptoms)) {
        return res.status(400).json({ message: "Symptoms array is required" });
      }

      const scoredRemedies = await storage.scoreRemediesBySymptoms(symptoms, filters);
      res.json(scoredRemedies);
    } catch (error) {
      console.error("Error scoring remedies:", error);
      res.status(500).json({ message: "Failed to score remedies" });
    }
  });

  // Get diagnostic questions for body system
  app.get("/api/questions/:bodySystem", async (req, res) => {
    try {
      const bodySystem = req.params.bodySystem;
      const questions = await storage.getQuestionTree(bodySystem);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Get remedies by category
  app.get("/api/remedies/:category", async (req, res) => {
    try {
      const category = req.params.category.toUpperCase();
      const remedies = await storage.getRemediesByCategory(category);
      res.json(remedies);
    } catch (error) {
      console.error("Error fetching remedies:", error);
      res.status(500).json({ message: "Failed to fetch remedies" });
    }
  });

  // Get all remedies
  app.get("/api/remedies", async (req, res) => {
    try {
      const remedies = await storage.getAllRemedies();
      res.json(remedies);
    } catch (error) {
      console.error("Error fetching all remedies:", error);
      res.status(500).json({ message: "Failed to fetch remedies" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
