import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ── Groq client ───────────────────────────────────────────────────
const groq = new OpenAI({
  apiKey: process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

// ── Supabase client (server-side) ─────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ""
);

// ================================================================
// TYPES
// ================================================================
interface ScoreEntry {
  name: string;
  displayName: string;
  totalScore: number;
  matchCount: number;
  matchedSymptoms: string[];
  categories: Set<string>;
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

interface HealthProfile {
  name?: string;
  age?: number;
  gender?: string;
  blood_group?: string;
  weight_kg?: number;
  height_cm?: number;
  chronic_conditions?: string;
  allergies?: string;
  current_medications?: string;
  dietary_preference?: string;
  diabetes?: string;
  blood_pressure?: string;
  obesity?: string;
  thyroid?: string;
  arthritis?: string;
  heart_disease?: string;
  depression_anxiety?: string;
  injury_history?: string;
  other_conditions?: string;
}

// ================================================================
// HELPERS
// ================================================================
function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildResults(
  scoreMap: Record<string, ScoreEntry>,
  category: string
): ScoredRemedy[] {
  if (!Object.keys(scoreMap).length) return [];
  const maxScore = Math.max(...Object.values(scoreMap).map((r) => r.totalScore));

  return Object.values(scoreMap)
    .map((r) => {
      const pct = Math.round((r.totalScore / maxScore) * 100);
      const grade = pct >= 75 ? 3 : pct >= 45 ? 2 : 1;
      const cats = [...r.categories].filter(Boolean).slice(0, 2).join(", ");
      return {
        remedy: {
          id: r.name.toLowerCase().replace(/\s+/g, "-"),
          name: r.displayName,
          category: cats || category || "General",
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

// ================================================================
// STEP 1 — GROQ: Expand user symptoms into specific search terms
// ================================================================
async function groqExpandSymptoms(
  symptoms: string[],
  category: string
): Promise<string[]> {
  const groqKey = process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY;
  if (!groqKey) return symptoms;

  try {
    const prompt = `You are a classical homeopathy repertory expert.
Patient complaint: ${symptoms.slice(0, 6).join(", ")}
Body system: ${category || "general"}

The database stores symptoms like:
"Extremities - Pain - knees worse after eating"
"Eyes - Pain - left eye worse noise, morning"
"Mind - Anxiety - night - alone"

Convert the patient complaint into 6 short keyword phrases that would match rubric entries in this database.
Focus on: body part, sensation/type, modality (worse/better).
Keep each phrase under 4 words.

Return ONLY a JSON array of strings, no explanation:
["term1", "term2", "term3", "term4", "term5", "term6"]`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return symptoms;
    const expanded: string[] = JSON.parse(match[0]);
    // Combine original + expanded, deduplicated, max 10
    const all = [...symptoms.map(s => s.toLowerCase()), ...expanded.map(s => s.toLowerCase())];
    return [...new Set(all)].slice(0, 10);
  } catch (e) {
    console.error("Groq expand error (non-fatal):", e);
    return symptoms;
  }
}

// ================================================================
// STEP 2 — SUPABASE: Search symptoms table
// Columns: id, remedy (text), symptom (text), category (text),
//          intensity (int4), created_at
// ================================================================
async function searchSymptomsTable(
  searchTerms: string[],
  category: string
): Promise<ScoredRemedy[]> {
  try {
    const allData: any[] = [];

    for (const term of searchTerms.slice(0, 6)) {
      // category filter uses the `category` column (not `heading`)
      let query = supabase
        .from("symptoms")
        .select("remedy, symptom, category, intensity")
        .ilike("symptom", `%${term}%`)
        .limit(200);

      if (category) query = query.ilike("category", `%${category}%`);

      const { data, error } = await query;
      if (error) console.error("symptoms table error:", error.message);
      if (data) allData.push(...data);
    }

    if (!allData.length) return [];

    const scoreMap: Record<string, ScoreEntry> = {};

    allData.forEach((row) => {
      const name = row.remedy;
      if (!name) return;

      // Count how many search terms match this row
      const termMatches = searchTerms.filter((t) =>
        row.symptom?.toLowerCase().includes(t)
      ).length;
      if (!termMatches) return;

      // Use intensity (1/2/3) as weight multiplier — grade 3 counts more
      const intensity = row.intensity || 1;

      if (!scoreMap[name]) {
        scoreMap[name] = {
          name,
          displayName: toTitleCase(name),
          totalScore: 0,
          matchCount: 0,
          matchedSymptoms: [],
          categories: new Set(),
        };
      }
      // Score = term matches × intensity weight
      scoreMap[name].totalScore += termMatches * intensity;
      scoreMap[name].matchCount += 1;
      scoreMap[name].matchedSymptoms.push(row.symptom);
      scoreMap[name].categories.add(row.category || "");
    });

    return buildResults(scoreMap, category);
  } catch (e) {
    console.error("searchSymptomsTable error:", e);
    return [];
  }
}

// ================================================================
// STEP 2b — SUPABASE: Search remedy_symptoms table
// Columns: remedy_name, heading, symptom (+ possibly others)
// ================================================================
async function searchRemedySymptoms(
  searchTerms: string[],
  category: string
): Promise<ScoredRemedy[]> {
  try {
    const allData: any[] = [];

    for (const term of searchTerms.slice(0, 6)) {
      let query = supabase
        .from("remedy_symptoms")
        .select("remedy_name, heading, symptom")
        .ilike("symptom", `%${term}%`)
        .limit(300);

      if (category) query = query.ilike("heading", `%${category}%`);

      const { data, error } = await query;
      if (error) console.error("remedy_symptoms error:", error.message);
      if (data) allData.push(...data);
    }

    if (!allData.length) return [];

    const scoreMap: Record<string, ScoreEntry> = {};

    allData.forEach((row) => {
      const name = row.remedy_name;
      if (!name) return;

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
          categories: new Set(),
        };
      }
      scoreMap[name].totalScore += termMatches * 3;
      scoreMap[name].matchCount += 1;
      scoreMap[name].matchedSymptoms.push(row.symptom);
      scoreMap[name].categories.add(row.heading || "");
    });

    return buildResults(scoreMap, category);
  } catch (e) {
    console.error("searchRemedySymptoms error:", e);
    return [];
  }
}

// ================================================================
// MERGE both result sets
// ================================================================
function mergeResults(
  arr1: ScoredRemedy[],
  arr2: ScoredRemedy[]
): ScoredRemedy[] {
  const map: Record<string, ScoredRemedy> = {};

  arr1.forEach((r) => { map[r.remedy.name] = { ...r }; });
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

// ================================================================
// STEP 3 — GROQ: Rerank + add insights using health profile
// ================================================================
async function groqRerankAndInsight(
  results: ScoredRemedy[],
  originalSymptoms: string[],
  category: string,
  healthProfile?: HealthProfile
): Promise<ScoredRemedy[]> {
  const groqKey = process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY;
  if (!groqKey || results.length === 0) return results;

  try {
    const top10Names = results.slice(0, 10).map((r) => r.remedy.name);
    const symptomSummary = originalSymptoms.slice(0, 6).join(", ");

    // Build patient profile context
    const profileParts: string[] = [];
    if (healthProfile) {
      if (healthProfile.age)               profileParts.push(`Age: ${healthProfile.age}`);
      if (healthProfile.gender)            profileParts.push(`Gender: ${healthProfile.gender}`);
      if (healthProfile.diabetes && healthProfile.diabetes !== "None")
        profileParts.push(`Diabetes: ${healthProfile.diabetes}`);
      if (healthProfile.blood_pressure && healthProfile.blood_pressure !== "Normal")
        profileParts.push(`BP: ${healthProfile.blood_pressure}`);
      if (healthProfile.thyroid && healthProfile.thyroid !== "None")
        profileParts.push(`Thyroid: ${healthProfile.thyroid}`);
      if (healthProfile.arthritis && healthProfile.arthritis !== "None")
        profileParts.push(`Arthritis: ${healthProfile.arthritis}`);
      if (healthProfile.heart_disease && healthProfile.heart_disease !== "None")
        profileParts.push(`Heart: ${healthProfile.heart_disease}`);
      if (healthProfile.depression_anxiety && healthProfile.depression_anxiety !== "None")
        profileParts.push(`Mental health: ${healthProfile.depression_anxiety}`);
      if (healthProfile.chronic_conditions)
        profileParts.push(`Chronic: ${healthProfile.chronic_conditions}`);
      if (healthProfile.current_medications)
        profileParts.push(`Medications: ${healthProfile.current_medications}`);
      if (healthProfile.injury_history)
        profileParts.push(`Injuries: ${healthProfile.injury_history}`);
    }
    const patientContext = profileParts.length > 0
      ? `\nPatient profile: ${profileParts.join(" | ")}`
      : "";

    const prompt = `You are a classical homeopathy expert with 30 years experience.
Patient symptoms: ${symptomSummary}
Body system: ${category || "general"}${patientContext}

These remedies were found in the repertory database:
${top10Names.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Task:
1. Reorder these remedies by how well they truly match the symptoms${patientContext ? " AND patient profile" : ""}
2. For the top 3, write ONE sentence (max 15 words) explaining the fit

Return ONLY valid JSON, no markdown:
{
  "ranked": ["remedy1", "remedy2", "remedy3", "remedy4", "remedy5", "remedy6", "remedy7", "remedy8", "remedy9", "remedy10"],
  "insights": [
    {"name": "remedy1", "insight": "..."},
    {"name": "remedy2", "insight": "..."},
    {"name": "remedy3", "insight": "..."}
  ]
}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return results;

    const parsed: {
      ranked: string[];
      insights: Array<{ name: string; insight: string }>;
    } = JSON.parse(jsonMatch[0]);

    // Build insight map
    const insightMap: Record<string, string> = {};
    (parsed.insights || []).forEach((i) => { insightMap[i.name] = i.insight; });

    // Reorder results by Groq ranking
    const resultMap: Record<string, ScoredRemedy> = {};
    results.forEach((r) => { resultMap[r.remedy.name] = r; });

    const reranked: ScoredRemedy[] = [];
    (parsed.ranked || []).forEach((name, idx) => {
      const match = resultMap[name] || Object.values(resultMap).find(
        r => r.remedy.name.toLowerCase() === name.toLowerCase()
      );
      if (match) {
        // Assign new score based on Groq rank position
        const aiScore = Math.round(100 - (idx * 8));
        reranked.push({
          ...match,
          score: aiScore,
          ai_insight: insightMap[name] || insightMap[match.remedy.name],
        });
      }
    });

    // Add any results Groq didn't mention (keep their original score)
    results.forEach((r) => {
      const alreadyAdded = reranked.some(
        (x) => x.remedy.name === r.remedy.name
      );
      if (!alreadyAdded) reranked.push(r);
    });

    return reranked.slice(0, 10);
  } catch (e) {
    console.error("Groq rerank error (non-fatal):", e);
    return results;
  }
}

// ================================================================
// MAIN SCORING PIPELINE
// 1. Groq expands symptoms → better search terms
// 2. Supabase searches both tables with expanded terms + intensity
// 3. Groq reranks results + adds insights
// ================================================================
async function scoreRemedies(
  symptoms: string[],
  filters: Record<string, string>,
  healthProfile?: HealthProfile
): Promise<ScoredRemedy[]> {
  // Clean input symptoms
  const cleanSymptoms = symptoms
    .map((s) => s.toLowerCase().trim())
    .filter(
      (s) =>
        s.length > 2 &&
        !s.startsWith("category:") &&
        !s.startsWith("clinical report:") &&
        !s.startsWith("health history:") &&
        !s.startsWith("age:") &&
        !s.startsWith("gender:") &&
        !s.startsWith("disease duration:")
    );

  if (cleanSymptoms.length === 0) return [];

  const category = filters.symptom_location || filters.category || "";

  // Step 1: Groq expands symptoms into better search terms
  console.log(`[score] Step 1: Expanding ${cleanSymptoms.length} symptoms with Groq...`);
  const expandedTerms = await groqExpandSymptoms(cleanSymptoms, category);
  console.log(`[score] Expanded to ${expandedTerms.length} search terms:`, expandedTerms.slice(0, 4));

  // Step 2: Search both Supabase tables in parallel
  console.log(`[score] Step 2: Searching Supabase...`);
  const [symptomsResults, remedySymptomResults] = await Promise.all([
    searchSymptomsTable(expandedTerms, category),
    searchRemedySymptoms(expandedTerms, category),
  ]);
  console.log(`[score] symptoms table: ${symptomsResults.length}, remedy_symptoms: ${remedySymptomResults.length}`);

  const merged = mergeResults(symptomsResults, remedySymptomResults);
  if (merged.length === 0) {
    // Fallback: try original symptoms if expanded terms gave nothing
    const [s2, r2] = await Promise.all([
      searchSymptomsTable(cleanSymptoms, category),
      searchRemedySymptoms(cleanSymptoms, category),
    ]);
    const fallback = mergeResults(s2, r2);
    if (fallback.length === 0) return [];
    return groqRerankAndInsight(fallback, symptoms, category, healthProfile);
  }

  // Step 3: Groq reranks + adds insights
  console.log(`[score] Step 3: Groq reranking ${merged.length} results...`);
  const final = await groqRerankAndInsight(merged, symptoms, category, healthProfile);
  console.log(`[score] Final: ${final.length} results, top remedy: ${final[0]?.remedy?.name}`);
  return final;
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

  // ── Score remedies — 3-step AI pipeline ──────────────────────
  app.post("/api/remedies/score", async (req, res) => {
    try {
      const { symptoms, filters = {}, healthProfile } = req.body;

      if (!symptoms || !Array.isArray(symptoms)) {
        return res.status(400).json({ message: "Symptoms array is required" });
      }

      console.log(
        `[score] Received: symptoms=${symptoms.slice(0, 3).join(", ")} | category=${filters.symptom_location || "none"}` +
        (healthProfile?.age ? ` | age=${healthProfile.age}` : "")
      );

      const results = await scoreRemedies(symptoms, filters, healthProfile);
      res.json(results);
    } catch (error) {
      console.error("Error scoring remedies:", error);
      res.status(500).json({ message: "Failed to score remedies" });
    }
  });

  // ── Save health profile ───────────────────────────────────────
  app.post("/api/profile/save", async (req, res) => {
    try {
      const { userId, email, profile } = req.body;
      if (!userId) return res.status(400).json({ message: "userId required" });

      const { error } = await supabase.from("patients").upsert(
        {
          id:                   userId,
          email:                email || "",
          name:                 profile.name || "",
          age:                  profile.age ? parseInt(profile.age) : null,
          gender:               profile.gender || null,
          height_cm:            profile.height_cm ? parseFloat(profile.height_cm) : null,
          weight_kg:            profile.weight_kg ? parseFloat(profile.weight_kg) : null,
          blood_group:          profile.blood_group || null,
          diabetes:             profile.diabetes || null,
          blood_pressure:       profile.blood_pressure || null,
          obesity:              profile.obesity || null,
          cholesterol:          profile.cholesterol || null,
          thyroid:              profile.thyroid || null,
          asthma:               profile.asthma || null,
          allergy:              profile.allergy || null,
          gastritis:            profile.gastritis || null,
          constipation:         profile.constipation || null,
          pcod:                 profile.pcod || null,
          arthritis:            profile.arthritis || null,
          kidney:               profile.kidney || null,
          heart_disease:        profile.heart_disease || null,
          migraine:             profile.migraine || null,
          skin_condition:       profile.skin_condition || null,
          depression_anxiety:   profile.depression_anxiety || null,
          hair_fall:            profile.hair_fall || null,
          injury_history:       profile.injury_history || null,
          other_conditions:     profile.other_conditions || null,
          chronic_conditions:   profile.chronic_conditions || null,
          current_medications:  profile.current_medications || null,
          dietary_preference:   profile.dietary_preference || null,
          updated_at:           new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) {
        console.error("Profile save error:", error);
        return res.status(500).json({ message: "Failed to save profile", detail: error.message });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Profile save error:", error);
      res.status(500).json({ message: "Failed to save profile" });
    }
  });

  // ── Get health profile ────────────────────────────────────────
  app.get("/api/profile/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ message: "userId required" });

      const { data, error } = await supabase
        .from("patients")
        .select(
          "name, age, gender, height_cm, weight_kg, blood_group, " +
          "diabetes, blood_pressure, obesity, cholesterol, thyroid, asthma, allergy, " +
          "gastritis, constipation, pcod, arthritis, kidney, heart_disease, migraine, " +
          "skin_condition, depression_anxiety, hair_fall, " +
          "injury_history, other_conditions, " +
          "chronic_conditions, current_medications, dietary_preference, updated_at"
        )
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") return res.json(null);
        console.error("Profile fetch error:", error);
        return res.status(500).json({ message: "Failed to fetch profile" });
      }
      res.json(data);
    } catch (error: any) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // ── Analyze medical report image using Groq Vision ────────────
  app.post("/api/analyze-report", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) return res.status(400).json({ message: "Image data is required" });

      const groqKey = process.env.GROQ_OPENAI_API || process.env.GROQ_API_KEY;
      if (!groqKey) {
        return res.status(500).json({ message: "AI service not configured. Add GROQ_OPENAI_API to Render." });
      }

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
      res.status(500).json({ message: "Failed to analyze report", detail: error?.message });
    }
  });

  // ── Search remedies by keyword ────────────────────────────────
  app.get("/api/remedies/search/:keyword", async (req, res) => {
    try {
      const remedies = await storage.searchRemediesByKeyword(
        req.params.keyword,
        req.query.category as string
      );
      res.json(remedies);
    } catch (error) {
      res.status(500).json({ message: "Failed to search remedies" });
    }
  });

  // ── Diagnostic questions ──────────────────────────────────────
  app.get("/api/questions/:bodySystem", async (req, res) => {
    try {
      const questions = await storage.getQuestionTree(req.params.bodySystem);
      res.json(questions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // ── Remedies by category ──────────────────────────────────────
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

  // ── All remedies ──────────────────────────────────────────────
  app.get("/api/remedies", async (req, res) => {
    try {
      const remedies = await storage.getAllRemedies();
      res.json(remedies);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch remedies" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
