import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, type RemedyFilters } from "./storage";
import OpenAI from "openai";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

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

  // Analyze medical report image using Groq AI Vision
  app.post("/api/analyze-report", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ message: "Image data is required" });
      }

      if (!process.env.GROQ_API_KEY) {
        return res.status(500).json({ message: "AI service not configured" });
      }

      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
                },
              },
              {
                type: "text",
                text: `You are a homeopathic medical assistant. Analyze this medical report or prescription image.
Extract all relevant medical information including:
- Diagnosed conditions or diseases
- Reported symptoms
- Lab values that are abnormal (high/low)
- Medications mentioned
- Any complaints described

Return ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "symptoms": ["symptom 1", "symptom 2", "symptom 3"],
  "conditions": ["condition 1", "condition 2"],
  "summary": "One sentence summary of the report"
}`,
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || "";

      let parsed: { symptoms: string[]; conditions: string[]; summary: string };
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { symptoms: [], conditions: [], summary: "" };
      } catch {
        parsed = { symptoms: [], conditions: [], summary: content.slice(0, 200) };
      }

      res.json({
        symptoms: parsed.symptoms || [],
        conditions: parsed.conditions || [],
        summary: parsed.summary || "Report analyzed",
      });
    } catch (error: any) {
      console.error("Error analyzing report:", error);
      res.status(500).json({ message: "Failed to analyze report. Check GROQ_API_KEY." });
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
