// server/routes.ts
// ROUTES — Thin HTTP layer only.
// Business logic lives in: engine/ ai/ dal/

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processCase } from "./engine/repertory-engine";
import { getProfile, upsertProfile, getSearchHistory, saveSearchHistory } from "./dal/supabase-dal";
import OpenAI from "openai";

// Groq only used for report image analysis (vision) — not for remedy decisions
const groq = new OpenAI({
  apiKey: process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

export async function registerRoutes(app: Express): Promise<Server> {

  // ── Health check ──────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      groq:     !!(process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY),
      supabase: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
      engine:   "repertory-v2",
    });
  });

  // ── CORE: Score remedies ──────────────────────────────────────
  // Input:  { symptoms: string[], filters: {}, healthProfile: {} }
  // Output: ScoredRemedy[] with score, confidence, why_explanation, safety_flags
  app.post("/api/remedies/score", async (req, res) => {
    try {
      const { symptoms, filters = {}, healthProfile } = req.body;

      if (!symptoms || !Array.isArray(symptoms)) {
        return res.status(400).json({ message: "symptoms array required" });
      }

      console.log(
        `[routes] /api/remedies/score — ${symptoms.length} symptoms,`,
        `system=${filters.symptom_location || "any"}`,
        healthProfile?.age ? `age=${healthProfile.age}` : ""
      );

      const results = await processCase({ symptoms, filters, healthProfile });
      res.json(results);
    } catch (error: any) {
      console.error("[routes] score error:", error);
      res.status(500).json({ message: "Failed to score remedies", detail: error?.message });
    }
  });

  // ── Analyze medical report image (Groq Vision) ────────────────
  app.post("/api/analyze-report", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) return res.status(400).json({ message: "imageBase64 required" });

      const groqKey = process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY;
      if (!groqKey) return res.status(500).json({ message: "GROQ_OPENAI_API not configured" });

      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
              },
              {
                type: "text",
                text: `You are a homeopathic medical assistant. Analyze this medical report.
Extract: diagnosed conditions, reported symptoms, abnormal lab values, medications, complaints.
Return ONLY JSON (no markdown):
{"symptoms":["..."],"conditions":["..."],"summary":"one sentence"}`,
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content || "";
      let parsed: any;
      try {
        const m = content.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : {};
      } catch {
        parsed = {};
      }

      res.json({
        symptoms:   parsed.symptoms   || [],
        conditions: parsed.conditions || [],
        summary:    parsed.summary    || "Report analyzed",
      });
    } catch (error: any) {
      console.error("[routes] analyze-report error:", error);
      res.status(500).json({ message: "Failed to analyze report", detail: error?.message });
    }
  });

  // ── Profile: save ─────────────────────────────────────────────
  app.post("/api/profile/save", async (req, res) => {
    try {
      const { userId, email, profile } = req.body;
      if (!userId) return res.status(400).json({ message: "userId required" });
      await upsertProfile(userId, email || "", profile);
      res.json({ success: true });
    } catch (error: any) {
      console.error("[routes] profile save error:", error);
      res.status(500).json({ message: error.message || "Failed to save profile" });
    }
  });

  // ── Profile: get ──────────────────────────────────────────────
  app.get("/api/profile/:userId", async (req, res) => {
    try {
      const data = await getProfile(req.params.userId);
      res.json(data);
    } catch (error: any) {
      console.error("[routes] profile get error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // ── Search history: get ───────────────────────────────────────
  app.get("/api/history/:userId", async (req, res) => {
    try {
      const data = await getSearchHistory(req.params.userId);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  // ── Remedies: search by keyword ───────────────────────────────
  app.get("/api/remedies/search/:keyword", async (req, res) => {
    try {
      const remedies = await storage.searchRemediesByKeyword(
        req.params.keyword,
        req.query.category as string
      );
      res.json(remedies);
    } catch (error) {
      res.status(500).json({ message: "Failed to search" });
    }
  });

  // ── Remedies: diagnostic questions ───────────────────────────
  app.get("/api/questions/:bodySystem", async (req, res) => {
    try {
      const questions = await storage.getQuestionTree(req.params.bodySystem);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // ── Remedies: by category ─────────────────────────────────────
  app.get("/api/remedies/:category", async (req, res) => {
    try {
      const remedies = await storage.getRemediesByCategory(
        req.params.category.toUpperCase()
      );
      res.json(remedies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch remedies" });
    }
  });

  // ── Remedies: all ─────────────────────────────────────────────
  app.get("/api/remedies", async (req, res) => {
    try {
      res.json(await storage.getAllRemedies());
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch remedies" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
