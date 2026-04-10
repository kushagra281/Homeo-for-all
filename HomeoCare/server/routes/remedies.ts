// server/routes/remedies.ts
// REMEDIES ROUTES — HTTP layer only.
// All business logic is in services/.

import { Router } from "express";
import { search } from "../services/searchService";
import { groq, hasGroqKey } from "../utils/groq";

const router = Router();

// ── POST /api/remedies/score ──────────────────────────────────────
// Body: { symptoms: string[], filters: {}, healthProfile: {} }
// Returns: SearchResult
router.post("/score", async (req, res) => {
  try {
    const { symptoms, filters = {}, healthProfile } = req.body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return res.status(400).json({ message: "symptoms array is required" });
    }

    console.log(
      `[Route] POST /score — ${symptoms.length} symptoms,`,
      `system=${filters.symptom_location || filters.category || "any"}`
    );

    const result = await search({ symptoms, filters, healthProfile });

    // Flatten to array for backward compatibility with existing frontend
    // Frontend expects: [{ remedy: {...}, score, confidence, ... }]
    const flat = [...result.remedies, ...result.alternatives].map((r) => ({
      remedy: {
        id:            r.name.toLowerCase().replace(/\s+/g, "-"),
        name:          r.name,
        category:      r.category,
        condition:     r.matching_symptoms.slice(0, 2).join("; "),
        description:   r.why_explanation,
        dosage:        r.dosage,
        symptoms:      r.matching_symptoms,
        keywords:      [],
        modalities:    { better: [], worse: [] },
        potencies:     ["6C", "30C", "200C"],
        age_groups:    ["child", "adult", "senior"],
        genders:       ["male", "female", "any"],
        synonym_names: [],
      },
      score:             r.score,
      confidence:        r.confidence,
      matching_symptoms: r.matching_symptoms,
      covered_rubrics:   r.covered_rubrics,
      why_explanation:   r.why_explanation,
      explanation:       r.explanation,
      safety_flags:      r.safety_flags,
      ai_insight:        r.ai_insight,
      engine:            result.engine,
      contradictions:    result.contradictions,
      rubrics_used:      result.rubrics_used,
    }));

    res.json(flat);
  } catch (error: any) {
    console.error("[Route] score error:", error);
    res.status(500).json({ message: "Failed to score remedies", detail: error?.message });
  }
});

// ── POST /api/remedies/analyze-report ────────────────────────────
// Groq Vision — extract symptoms from uploaded medical report image
router.post("/analyze-report", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64) return res.status(400).json({ message: "imageBase64 required" });
    if (!hasGroqKey()) return res.status(500).json({ message: "GROQ_OPENAI_API not configured" });

    const response = await groq().chat.completions.create({
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
Extract: diagnosed conditions, symptoms, abnormal lab values, medications, complaints.
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
    let parsed: any = {};
    try {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    } catch { /* ignore parse errors */ }

    res.json({
      symptoms:   parsed.symptoms   || [],
      conditions: parsed.conditions || [],
      summary:    parsed.summary    || "Report analyzed",
    });
  } catch (error: any) {
    console.error("[Route] analyze-report error:", error);
    res.status(500).json({ message: "Failed to analyze report", detail: error?.message });
  }
});

// ── GET /api/remedies ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    res.json(await storage.getAllRemedies());
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch remedies" });
  }
});

// ── GET /api/remedies/search/:keyword ────────────────────────────
router.get("/search/:keyword", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    const remedies = await storage.searchRemediesByKeyword(
      req.params.keyword,
      req.query.category as string
    );
    res.json(remedies);
  } catch (error) {
    res.status(500).json({ message: "Failed to search" });
  }
});

// ── GET /api/remedies/:category ──────────────────────────────────
router.get("/:category", async (req, res) => {
  try {
    const { storage } = await import("../storage");
    res.json(await storage.getRemediesByCategory(req.params.category.toUpperCase()));
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch remedies" });
  }
});

export default router;
