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

// Groq retires models regularly (llama-3.3-70b-versatile and llama-4-scout were shut down in 2026),
// and a retired model makes every call fail. The models are tried in order, and each can be changed
// in the environment without a new deploy of the code.
const TEXT_MODELS = [process.env.GROQ_TEXT_MODEL, "openai/gpt-oss-120b", "qwen/qwen3.8-27b"].filter(Boolean) as string[];
const VISION_MODELS = [process.env.GROQ_VISION_MODEL, "qwen/qwen3.8-27b"].filter(Boolean) as string[];

/** One JSON reply from the first model that works. Throws only when every model failed. */
async function askModel(messages: Array<{ role: "system" | "user"; content: string }>, maxTokens: number): Promise<string> {
  let lastError: unknown;
  for (const model of TEXT_MODELS) {
    try {
      const body: any = { model, messages, max_tokens: maxTokens, temperature: 0.3, response_format: { type: "json_object" } };
      // gpt-oss is a reasoning model: keep its thinking short so the answer fits in max_tokens
      if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";
      const r = await groq().chat.completions.create(body, { timeout: 25_000 });
      const text = r.choices[0]?.message?.content || "";
      if (text.trim()) return text;
      lastError = new Error(`${model} returned an empty reply`);
    } catch (e) {
      lastError = e;
      console.warn(`[Groq] ${model} failed:`, (e as Error)?.message);
    }
  }
  throw lastError;
}

// ── POST /api/remedies/next-question ─────────────────────────────
// AI picks the next case-taking question from the symptoms and the answers so far.
// Any problem answers { fallback: true } and the app uses its built-in questions instead.
router.post("/next-question", aiLimit, async (req, res) => {
  const input = sanitizeInput(req.body);
  if (!input) return res.status(400).json({ message: "symptoms array is required" });
  if (!hasGroqKey()) { console.warn("[Route] next-question: no Groq key set, using built-in questions"); return res.json({ fallback: true }); }
  try {
    const raw = await askModel(buildQuestionMessages(input), 1500);
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
    const raw = await askModel(buildExplainMessages(input), 2500);
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

    const reportMessages = [
      {
        role: "user" as const,
        content: [
          { type: "image_url" as const, image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` } },
          {
            type: "text" as const,
            text: `You are a homeopathic medical assistant. Analyze this medical report.
Extract: diagnosed conditions, symptoms, abnormal lab values, medications, complaints.
Return ONLY JSON (no markdown):
{"symptoms":["..."],"conditions":["..."],"summary":"one sentence"}`,
          },
        ],
      },
    ];
    // A model counts only if it returned JSON we can read; an empty or non-JSON reply moves on to the next.
    let parsed: any = null;
    let lastError: unknown = new Error("no vision model returned a readable reply");
    for (const model of VISION_MODELS) {
      try {
        const response: any = await groq().chat.completions.create(
          { model, messages: reportMessages, max_tokens: 800, temperature: 0.1 } as any, { timeout: 40_000 });
        const content: string = response.choices?.[0]?.message?.content || "";
        const m = content.match(/\{[\s\S]*\}/);
        const j = m ? JSON.parse(m[0]) : null;
        if (j && typeof j === "object") { parsed = j; break; }
        console.warn(`[Groq] ${model} gave an unreadable reply for a report:`, content.slice(0, 200));
      } catch (e) {
        lastError = e;
        console.warn(`[Groq] ${model} failed on a report:`, (e as Error)?.message);
      }
    }
    if (!parsed) throw lastError;

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

export default router;
