// server/routes/remedies.ts
// REMEDIES ROUTES — HTTP layer only.
// All business logic is in services/.

import { Router } from "express";
import { search } from "../services/searchService";
import { groq, hasGroqKey } from "../utils/groq";
import { rateLimit } from "../utils/rateLimit";
import { detectRedFlags } from "../../shared/redFlags";
import { splitMatches } from "../services/scoringService";
import {
  buildExplainMessages, buildQuestionMessages, parseExplanation, parseNextQuestion,
  sanitizeExplainInput, sanitizeInput,
} from "../services/aiCase";

const router = Router();

// Searching hits the database; report analysis calls a paid AI model.
const searchLimit  = rateLimit({ name: "search",  windowMs: 60_000, max: 30 });
const analyzeLimit = rateLimit({ name: "analyze", windowMs: 60_000, max: 6 });
const aiLimit      = rateLimit({ name: "ai-case", windowMs: 60_000, max: 25 });

const TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "llama-3.3-70b-versatile";

/** One JSON reply from the model. Throws on network or API errors; the routes turn that into a fallback. */
async function askModel(messages: Array<{ role: "system" | "user"; content: string }>, maxTokens: number): Promise<string> {
  const r = await groq().chat.completions.create(
    { model: TEXT_MODEL, messages, max_tokens: maxTokens, temperature: 0.3, response_format: { type: "json_object" } },
    { timeout: 20_000 },
  );
  return r.choices[0]?.message?.content || "";
}

// ── POST /api/remedies/next-question ─────────────────────────────
// AI picks the next case-taking question from the symptoms and the answers so far.
// Any problem answers { fallback: true } and the app uses its built-in questions instead.
router.post("/next-question", aiLimit, async (req, res) => {
  const input = sanitizeInput(req.body);
  if (!input) return res.status(400).json({ message: "symptoms array is required" });
  if (!hasGroqKey()) { console.warn("[Route] next-question: no Groq key set, using built-in questions"); return res.json({ fallback: true }); }
  try {
    const raw = await askModel(buildQuestionMessages(input), 600);
    const reply = parseNextQuestion(raw, input);
    if (!reply) {
      // The reason the app silently used its built-in questions: visible in the server log.
      console.warn("[Route] next-question: reply rejected, using built-in questions. Model said:", raw.slice(0, 300));
      return res.json({ fallback: true });
    }
    res.json(reply);
  } catch (error) {
    console.error("[Route] next-question: Groq call failed, using built-in questions:", (error as Error)?.message);
    res.json({ fallback: true });
  }
});

// ── POST /api/remedies/explain ───────────────────────────────────
// AI explains the ranking the search engine already made. It cannot change the ranking.
router.post("/explain", aiLimit, async (req, res) => {
  const input = sanitizeExplainInput(req.body);
  if (!input) return res.status(400).json({ message: "symptoms and ranked remedies are required" });
  if (!hasGroqKey()) return res.json({ unavailable: true });
  try {
    const raw = await askModel(buildExplainMessages(input), 1100);
    const reply = parseExplanation(raw, input);
    if (!reply) console.warn("[Route] explain: reply rejected. Model said:", raw.slice(0, 300));
    res.json(reply || { unavailable: true });
  } catch (error) {
    console.error("[Route] explain: Groq call failed:", (error as Error)?.message);
    res.json({ unavailable: true });
  }
});

// ── POST /api/remedies/score ──────────────────────────────────────
// Body: { symptoms: string[], filters: {}, healthProfile: {} }
// Returns: SearchResult
router.post("/score", searchLimit, async (req, res) => {
  try {
    const { filters = {}, healthProfile } = req.body || {};
    const raw = req.body?.symptoms;

    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({ message: "symptoms array is required" });
    }
    // Only text is accepted; anything else would crash the keyword code with a 500.
    const symptoms = raw
      .filter((s: unknown): s is string => typeof s === "string")
      .map((s) => s.slice(0, 300))
      .slice(0, 40);
    if (symptoms.length === 0) {
      return res.status(400).json({ message: "symptoms must be text" });
    }
    if (typeof filters !== "object" || Array.isArray(filters)) {
      return res.status(400).json({ message: "filters must be an object" });
    }

    console.log(
      `[Route] POST /score — ${symptoms.length} symptoms,`,
      `system=${filters.symptom_location || filters.category || "any"}`
    );

    const healthHistory = typeof req.body?.healthHistory === "string" ? req.body.healthHistory.slice(0, 600) : undefined;
    const result = await search({ symptoms, filters, healthProfile, healthHistory });
    // Warning signs go with every result; the remedy ranking itself is not changed by them.
    const redFlags = detectRedFlags([...symptoms, healthHistory], healthProfile);

    // Flatten to array for backward compatibility with existing frontend
    // Frontend expects: [{ remedy: {...}, score, confidence, ... }]
    const ranked = [
      ...[...result.remedies, ...result.alternatives].map((r) => ({ r, keynoteOnly: false })),
      ...(result.keynote_extra || []).map((r) => ({ r, keynoteOnly: true })),
    ];
    const flat = ranked.map(({ r, keynoteOnly }) => {
      const split = splitMatches(r.covered_rubrics || []);
      return {
        remedy: {
          id:            r.name.toLowerCase().replace(/\s+/g, "-"),
          name:          r.name,
          category:      r.category,
          condition:     r.matching_symptoms.slice(0, 2).join("; "),
          description:   r.why_explanation,
          dosage:        r.dosage,
          symptoms:      r.matching_symptoms,
          // The scraped database has no potency / age / gender data, so these are
          // left empty (= "not specified") instead of inventing values.
          keywords:      [],
          modalities:    { better: [], worse: [] },
          potencies:     [],
          age_groups:    [],
          genders:       [],
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
        history_matches:   r.history_matches || [],
        history_considered: result.history_considered || [],
        engine:            result.engine,
        contradictions:    result.contradictions,
        rubrics_used:      result.rubrics_used,
        red_flags:         redFlags,
        mental_matches:    split.mental,
        physical_matches:  split.physical,
        keynote_matched:   split.keynote,
        keynote_only:      keynoteOnly,
    };
    });

    res.json(flat);
  } catch (error: any) {
    console.error("[Route] score error:", error);
    // The real reason stays in the server log; it can contain database URLs and settings.
    res.status(500).json({ message: "Failed to score remedies" });
  }
});

// ── POST /api/remedies/analyze-report ────────────────────────────
// Groq Vision — extract symptoms from uploaded medical report image
router.post("/analyze-report", analyzeLimit, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (typeof imageBase64 !== "string" || !imageBase64) return res.status(400).json({ message: "imageBase64 required" });
    if (mimeType !== undefined && !/^image\/(jpeg|png|webp|gif)$/.test(String(mimeType))) {
      return res.status(400).json({ message: "Only JPEG, PNG, WebP or GIF images can be analysed" });
    }
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
    res.status(500).json({ message: "Failed to analyze report" });
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
