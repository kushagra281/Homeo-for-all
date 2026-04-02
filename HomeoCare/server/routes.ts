import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ── Groq client (fix: reads GROQ_OPENAI_API which is what Render has) ──
const groq = new OpenAI({
  apiKey: process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

// ── Supabase client (server-side, uses service role for reliability) ──
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
);

// ================================================================
// HELPERS — replicate supabase.js scoring logic, server-side
// ================================================================

function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

interface ScoreEntry {
  name: string;
  displayName: string;
  totalScore: number;
  matchCount: number;
  matchedSymptoms: string[];
  headings: Set<string>;
}

interface ScoredRemedy {
  remedy: {
    id: string;
    name: string;
    category: string;
    condition: string;
    description: string;
    dosage: string;
    symptoms: string[];
    keywords: string[];
    modalities: { better: string[]; worse: string[] };
    potencies: string[];
    age_groups: string[];
    genders: string[];
    synonym_names: string[];
  };
  score: number;
  matching_symptoms: string[];
  confidence: number;
  ai_insight?: string;
}

function buildResults(scoreMap: Record<string, ScoreEntry>, category: string): ScoredRemedy[] {
  if (!Object.keys(scoreMap).length) return [];

  const maxScore = Math.max(...Object.values(scoreMap).map((r) => r.totalScore));

  return Object.values(scoreMap)
    .map((r) => {
      const pct = Math.round((r.totalScore / maxScore) * 100);
      const grade = pct >= 75 ? 3 : pct >= 45 ? 2 : 1;
      const headings = [...r.headings].filter(Boolean).slice(0, 2).join(", ");

      return {
        remedy: {
          id: r.name.toLowerCase().replace(/\s+/g, "-"),
          name: r.displayName,
          category: headings || category || "General",
          condition: [...new Set(r.matchedSymptoms)].slice(0, 2).join("; "),
          description: `${r.displayName} matched ${r.matchCount} symptom(s) for your complaint.`,
          dosage:
            grade === 3
              ? "200C — 3 pellets twice daily for 3 days, then once weekly"
              : grade === 2
              ? "30C — 3 pellets three times daily for 5 days"
              : "6C — 3 pellets four times daily for 7 days",
          symptoms: [...new Set(r.matchedSymptoms)].slice(0, 5),
          keywords: [],
          modalities: { better: [], worse: [] },
          potencies: ["6C", "30C", "200C"],
          age_groups: ["child", "adult", "senior"],
          genders: ["male", "female", "any"],
          synonym_names: [],
        },
        score: pct,
        matching_symptoms: [...new Set(r.matchedSymptoms)].slice(0, 5),
        confidence: Math.min(100, r.matchCount * 8),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

async function searchRemedySymptoms(
  searchTerms: string[],
  category: string
): Promise<ScoredRemedy[]> {
  try {
    const allData: any[] = [];

    for (const term of searchTerms.slice(0, 4)) {
      let query = supabase
        .from("remedy_symptoms")
        .select("remedy_name, heading, symptom")
        .ilike("symptom", `%${term}%`)
        .limit(300);

      if (category) query = query.ilike("heading", `%${category}%`);

      const { data, error } = await query;
      if (error) console.error("remedy_symptoms query error:", error.message);
      if (data) allData.push(...data);
    }

    if (!allData.length) return [];

    const scoreMap: Record<string, ScoreEntry> = {};
    allData.forEach((row) => {
      const name = row.remedy_name;
      const termMatches = searchTerms.filter(
        (t) =>
          row.symptom?.toLowerCase().includes(t) ||
          row.heading?.toLowerCase().includes(t)
      ).length;
      if (!termMatches) return;

      if (!scoreMap[name]) {
        scoreMap[name] = {
          name,
          displayName: toTitleCase(name),
          totalScore: 0,
          matchCount: 0,
          matchedSymptoms: [],
          headings: new Set(),
        };
      }
      scoreMap[name].totalScore += 3 * termMatches;
      scoreMap[name].matchCount += 1;
      scoreMap[name].matchedSymptoms.push(row.symptom);
      scoreMap[name].headings.add(row.heading);
    });

    return buildResults(scoreMap, category);
  } catch (e) {
    console.error("Strategy 1 error:", e);
    return [];
  }
}

async function searchSymptomsTable(
  searchTerms: string[],
  category: string
): Promise<ScoredRemedy[]> {
  try {
    const allData: any[] = [];

    for (const term of searchTerms.slice(0, 4)) {
      let query = supabase
        .from("symptoms")
        .select("remedy_name, heading, symptom")
        .ilike("symptom", `%${term}%`)
        .limit(200);

      if (category) query = query.ilike("heading", `%${category}%`);

      const { data, error } = await query;
      if (error) console.error("symptoms table query error:", error.message);
      if (data) allData.push(...data);
    }

    if (!allData.length) return [];

    const scoreMap: Record<string, ScoreEntry> = {};
    allData.forEach((row) => {
      const name = row.remedy_name;
      const termMatches = searchTerms.filter((t) =>
        row.symptom?.toLowerCase().includes(t)
      ).length;
      if (!termMatches) return;

      if (!scoreMap[name]) {
        scoreMap[name] = {
          name,
          displayName: toTitleCase(name),
          totalScore: 0,
          matchCount: 0,
          matchedSymptoms: [],
          headings: new Set(),
        };
      }
      scoreMap[name].totalScore += termMatches * 2;
      scoreMap[name].matchCount += 1;
      scoreMap[name].matchedSymptoms.push(row.symptom);
      scoreMap[name].headings.add(row.heading || "");
    });

    return buildResults(scoreMap, category);
  } catch (e) {
    console.error("Strategy 2 error:", e);
    return [];
  }
}

function mergeResults(arr1: ScoredRemedy[], arr2: ScoredRemedy[]): ScoredRemedy[] {
  const map: Record<string, ScoredRemedy> = {};

  arr1.forEach((r) => {
    map[r.remedy.name] = { ...r };
  });

  arr2.forEach((r) => {
    const key = r.remedy.name;
    if (map[key]) {
      map[key].score = Math.min(100, map[key].score + Math.round(r.score * 0.4));
      map[key].matching_symptoms = [
        ...new Set([...map[key].matching_symptoms, ...r.matching_symptoms]),
      ].slice(0, 6);
    } else {
      map[key] = { ...r };
    }
  });

  return Object.values(map)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

async function scoreRemediesFromSupabase(
  symptoms: string[],
  filters: Record<string, string> = {}
): Promise<ScoredRemedy[]> {
  const searchTerms = symptoms
    .map((s) => s.toLowerCase().trim())
    .filter(
      (s) =>
        s.length > 2 &&
        !s.startsWith("category:") &&
        !s.startsWith("clinical report:") &&
        !s.startsWith("health history:") &&
        !s.startsWith("age group:") &&
        !s.startsWith("age:") &&
        !s.startsWith("gender:") &&
        !s.startsWith("disease duration:")
    );

  if (searchTerms.length === 0) return [];

  const category = filters.symptom_location || filters.category || "";

  const [scraperResults, rubricResults] = await Promise.all([
    searchRemedySymptoms(searchTerms, category),
    searchSymptomsTable(searchTerms, category),
  ]);

  const merged = mergeResults(scraperResults, rubricResults);
  return merged.length > 0
    ? merged
    : scraperResults.length > 0
    ? scraperResults
    : rubricResults;
}

// ================================================================
// GROQ AI ENHANCEMENT — adds AI insight to top 3 remedies
// ================================================================
async function enhanceWithGroq(
  results: ScoredRemedy[],
  symptoms: string[],
  filters: Record<string, string>
): Promise<ScoredRemedy[]> {
  const groqKey = process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY;
  if (!groqKey || results.length === 0) return results;

  try {
    const top3Names = results.slice(0, 3).map((r) => r.remedy.name);
    const symptomSummary = symptoms.slice(0, 6).join(", ");
    const category = filters.symptom_location || filters.category || "general";

    const prompt = `You are a classical homeopathy expert. A patient reports: ${symptomSummary}.
Category: ${category}.

The top 3 matching remedies from our repertory are: ${top3Names.join(", ")}.

For each remedy, write ONE short sentence (max 15 words) explaining why it fits these specific symptoms.
Return ONLY valid JSON — no markdown, no explanation:
[
  {"name": "${top3Names[0]}", "insight": "..."},
  {"name": "${top3Names[1] || top3Names[0]}", "insight": "..."},
  {"name": "${top3Names[2] || top3Names[0]}", "insight": "..."}
]`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return results;

    const insights: Array<{ name: string; insight: string }> = JSON.parse(jsonMatch[0]);
    const insightMap: Record<string, string> = {};
    insights.forEach((i) => {
      insightMap[i.name] = i.insight;
    });

    return results.map((r) => ({
      ...r,
      ai_insight: insightMap[r.remedy.name] || undefined,
    }));
  } catch (e) {
    console.error("Groq enhancement error (non-fatal):", e);
    return results; // always return results even if Groq fails
  }
}

// ================================================================
// ROUTES
// ================================================================
export async function registerRoutes(app: Express): Promise<Server> {

  // ── Health check ──────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      groq: !!(process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY),
      supabase: !!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    });
  });

  // ── Score remedies — NOW uses Supabase + Groq ─────────────────
  app.post("/api/remedies/score", async (req, res) => {
    try {
      const { symptoms, filters = {} } = req.body;

      if (!symptoms || !Array.isArray(symptoms)) {
        return res.status(400).json({ message: "Symptoms array is required" });
      }

      console.log(`[score] symptoms: ${symptoms.slice(0, 4).join(", ")} | filters:`, filters);

      // Step 1: Score from Supabase
      const scored = await scoreRemediesFromSupabase(symptoms, filters);
      console.log(`[score] Supabase returned ${scored.length} results`);

      if (scored.length === 0) {
        return res.json([]);
      }

      // Step 2: Enhance top results with Groq AI insights
      const enhanced = await enhanceWithGroq(scored, symptoms, filters);
      console.log(`[score] Returning ${enhanced.length} enhanced results`);

      res.json(enhanced);
    } catch (error) {
      console.error("Error scoring remedies:", error);
      res.status(500).json({ message: "Failed to score remedies" });
    }
  });

  // ── Analyze medical report image using Groq Vision ────────────
  app.post("/api/analyze-report", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;

      if (!imageBase64) {
        return res.status(400).json({ message: "Image data is required" });
      }

      const groqKey = process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY;
      if (!groqKey) {
        return res.status(500).json({ message: "AI service not configured. Add GROQ_OPENAI_API to Render env vars." });
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
        parsed = jsonMatch
          ? JSON.parse(jsonMatch[0])
          : { symptoms: [], conditions: [], summary: "" };
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
      res.status(500).json({
        message: "Failed to analyze report",
        detail: error?.message || "Unknown error",
      });
    }
  });

  // ── Search remedies by keyword ────────────────────────────────
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

  // ── Diagnostic questions for body system ─────────────────────
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

  // ── Remedies by category ──────────────────────────────────────
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

  // ── All remedies ──────────────────────────────────────────────
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
