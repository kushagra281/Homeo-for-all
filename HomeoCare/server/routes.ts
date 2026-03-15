import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRemedySchema, insertCategorySchema, insertKeywordSchema, insertFavoriteSchema, insertMedicalTermSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Remedy routes
  app.get("/api/remedies", async (req, res) => {
    try {
      const { category, search, keywords } = req.query;

      let remedies;
      if (category && typeof category === 'string') {
        remedies = await storage.getRemediesByCategory(category);
      } else if (search && typeof search === 'string') {
        remedies = await storage.searchRemedies(search);
      } else if (keywords && typeof keywords === 'string') {
        const keywordList = keywords.split(',');
        remedies = await storage.getRemediesByKeywords(keywordList);
      } else {
        remedies = await storage.getRemedies();
      }

      res.json(remedies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch remedies" });
    }
  });

  app.get("/api/remedies/featured", async (req, res) => {
    try {
      const remedies = await storage.getFeaturedRemedies();
      res.json(remedies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch featured remedies" });
    }
  });

  app.get("/api/remedies/:id", async (req, res) => {
    try {
      const remedy = await storage.getRemedy(req.params.id);
      if (!remedy) {
        return res.status(404).json({ message: "Remedy not found" });
      }
      res.json(remedy);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch remedy" });
    }
  });

  app.post("/api/remedies", async (req, res) => {
    try {
      const data = insertRemedySchema.parse(req.body);
      const remedy = await storage.createRemedy(data);
      res.status(201).json(remedy);
    } catch (error) {
      res.status(400).json({ message: "Invalid remedy data" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:name", async (req, res) => {
    try {
      const category = await storage.getCategoryByName(req.params.name);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category" });
    }
  });

  // Keyword routes
  app.get("/api/keywords", async (req, res) => {
    try {
      const { category } = req.query;
      let keywords;
      if (category && typeof category === 'string') {
        keywords = await storage.getKeywordsByCategory(category);
      } else {
        keywords = await storage.getKeywords();
      }
      res.json(keywords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch keywords" });
    }
  });

  // Favorites routes
  app.get("/api/favorites/:userId", async (req, res) => {
    try {
      const favorites = await storage.getUserFavorites(req.params.userId);
      res.json(favorites);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.post("/api/favorites", async (req, res) => {
    try {
      const data = insertFavoriteSchema.parse(req.body);
      const favorite = await storage.addFavorite(data);
      res.status(201).json(favorite);
    } catch (error) {
      res.status(400).json({ message: "Invalid favorite data" });
    }
  });

  app.delete("/api/favorites/:userId/:remedyId", async (req, res) => {
    try {
      const success = await storage.removeFavorite(req.params.userId, req.params.remedyId);
      if (!success) {
        return res.status(404).json({ message: "Favorite not found" });
      }
      res.json({ message: "Favorite removed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  // Medical Dictionary routes
  app.get("/api/medical-terms", async (req, res) => {
    try {
      const { category, search } = req.query;

      let terms;
      if (category && typeof category === 'string') {
        terms = await storage.getMedicalTermsByCategory(category);
      } else if (search && typeof search === 'string') {
        terms = await storage.searchMedicalTerms(search);
      } else {
        terms = await storage.getMedicalTerms();
      }

      res.json(terms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch medical terms" });
    }
  });

  app.get("/api/medical-terms/:id", async (req, res) => {
    try {
      const term = await storage.getMedicalTerm(req.params.id);
      if (!term) {
        return res.status(404).json({ message: "Medical term not found" });
      }
      res.json(term);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch medical term" });
    }
  });

  app.post("/api/medical-terms", async (req, res) => {
    try {
      const data = insertMedicalTermSchema.parse(req.body);
      const term = await storage.createMedicalTerm(data);
      res.status(201).json(term);
    } catch (error) {
      res.status(400).json({ message: "Invalid medical term data" });
    }
  });

  // Advanced search with scoring
  app.post("/api/remedies/search-advanced", async (req, res) => {
    try {
      const { symptoms, filters } = req.body;
      if (!symptoms || !Array.isArray(symptoms)) {
        return res.status(400).json({ message: "Symptoms array is required" });
      }

      const scoredRemedies = await storage.searchRemediesWithScore(symptoms, filters);
      res.json(scoredRemedies);
    } catch (error) {
      res.status(500).json({ message: "Failed to search remedies" });
    }
  });

  // Keyword synonym management
  app.put("/api/keywords/:id/synonyms", async (req, res) => {
    try {
      const { synonyms } = req.body;
      if (!Array.isArray(synonyms)) {
        return res.status(400).json({ message: "Synonyms must be an array" });
      }

      const keyword = await storage.updateKeywordSynonyms(req.params.id, synonyms);
      if (!keyword) {
        return res.status(404).json({ message: "Keyword not found" });
      }

      res.json(keyword);
    } catch (error) {
      res.status(500).json({ message: "Failed to update synonyms" });
    }
  });

  // Synonym file management routes
  app.post("/api/admin/synonyms/upload", async (req, res) => {
    try {
      const { synonyms } = req.body;
      if (!synonyms || typeof synonyms !== 'object') {
        return res.status(400).json({ message: "Invalid synonym data format" });
      }

      const result = await storage.updateSynonymsFromFile(synonyms);
      res.json({
        message: "Synonyms updated successfully",
        ...result
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update synonyms from file" });
    }
  });

  app.get("/api/admin/synonyms/export", async (req, res) => {
    try {
      const synonyms = await storage.exportSynonyms();
      res.json(synonyms);
    } catch (error) {
      res.status(500).json({ message: "Failed to export synonyms" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}