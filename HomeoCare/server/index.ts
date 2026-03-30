import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { initializeWebSocket } from "./websocket";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "",
  process.env.VITE_SUPABASE_ANON_KEY ?? ""
);

const groq = new OpenAI({
  apiKey: process.env.GROQ_OPENAI_API ?? "",
  baseURL: "https://api.groq.com/openai/v1",
});

const hasGroq = !!process.env.GROQ_OPENAI_API;

function toTitleCase(str: string): string {
  if (!str) return "";
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildResults(scoreMap: Record<string, any>, category: string) {
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
            grade === 3 ? "200C — 3 pellets twice daily for 3 days, then once weekly" :
            grade === 2 ? "30C — 3 pellets three times daily for 5 days" :
                          "6C — 3 pellets four times daily for 7 days",
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
    .sort((a, b) => b.score - a.score);
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  initializeWebSocket(httpServer);

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      app: "HomeoWell",
      database: "Supabase",
      ai: hasGroq ? "Groq AI active" : "AI not configured — add GROQ_OPENAI_API",
    });
  });

  app.post("/api/remedies/score", async (req: Request, res: Response) => {
    try {
      const { symptoms = [], filters = {}, questionAnswers = {}, healthHistory = "" } = req.body;

      const cleanSymptoms: string[] = symptoms
        .map((s: string) => s.toLowerCase().trim())
        .filter((s: string) =>
          s.length > 2 &&
          !s.startsWith("category:") &&
          !s.startsWith("clinical report:") &&
          !s.startsWith("health history:") &&
          !s.startsWith("age group:") &&
          !s.startsWith("age:") &&
          !s.startsWith("gender:") &&
          !s.startsWith("disease duration:")
        );

      if (cleanSymptoms.length === 0) return res.json([]);

      const category = filters.symptom_location || filters.category || "";

      const allData: any[] = [];
      for (const term of cleanSymptoms.slice(0, 5)) {
        let query = supabase
          .from("remedy_symptoms")
          .select("remedy_name, heading, symptom")
          .ilike("symptom", `%${term}%`)
          .limit(300);
        if (category) query = query.ilike("heading", `%${category}%`);
        const { data } = await query;
        if (data) allData.push(...data);
      }

      const allData2: any[] = [];
      for (const term of cleanSymptoms.slice(0, 4)) {
        let q2 = supabase
          .from("symptoms")
          .select("remedy, symptom, category, intensity")
          .ilike("symptom", `%${term}%`)
          .limit(200);
        if (category) q2 = q2.ilike("category", `%${category}%`);
        const { data } = await q2;
        if (data) allData2.push(...data);
      }

      const scoreMap: Record<string, any> = {};

      allData.forEach((row) => {
        const name = row.remedy_name;
        const termMatches = cleanSymptoms.filter((t) =>
          row.symptom?.toLowerCase().includes(t) ||
          row.heading?.toLowerCase().includes(t)
        ).length;
        if (!termMatches) return;
        if (!scoreMap[name]) {
          scoreMap[name] = { name, displayName: toTitleCase(name), totalScore: 0, matchCount: 0, matchedSymptoms: [], headings: new Set() };
        }
        scoreMap[name].totalScore += 3 * termMatches;
        scoreMap[name].matchCount += 1;
        scoreMap[name].matchedSymptoms.push(row.symptom);
        scoreMap[name].headings.add(row.heading);
      });

      allData2.forEach((row) => {
        const name = row.remedy;
        const termMatches = cleanSymptoms.filter((t) =>
          row.symptom?.toLowerCase().includes(t)
        ).length;
        if (!termMatches) return;
        if (!scoreMap[name]) {
          scoreMap[name] = { name, displayName: toTitleCase(name), totalScore: 0, matchCount: 0, matchedSymptoms: [], headings: new Set() };
        }
        scoreMap[name].totalScore += (row.intensity || 1) * termMatches * 2;
        scoreMap[name].matchCount += 1;
        scoreMap[name].matchedSymptoms.push(row.symptom);
        scoreMap[name].headings.add(row.category || "");
      });

      const topRemedies = buildResults(scoreMap, category).slice(0, 5);

      if (hasGroq && topRemedies.length > 0) {
        const symptomsText = symptoms.filter((s: string) => !s.includes(":")).join(", ");
        const qaText = Object.entries(questionAnswers).map(([q, a]) => `${q}: ${a}`).join("; ");

        const aiPrompt = `You are a classical homeopath. Evaluate these remedies for the patient.

Patient symptoms: ${symptomsText}
${healthHistory ? `Health history: ${healthHistory}` : ""}
${qaText ? `Additional findings: ${qaText}` : ""}

Top matching remedies from database (by keyword score):
${topRemedies.map((r: any, i: number) => `${i + 1}. ${r.remedy.name} (score: ${r.score}%)`).join("\n")}

For each remedy, provide:
1. A clinical indication specific to the patient's symptoms (1–2 sentences)
2. A score adjustment (-10 to +15) based on classical homeopathic fit
3. Key modalities (better/worse conditions)

Return ONLY valid JSON array — no extra text:
[{"name":"RemedyName","indication":"...","adjustment":5,"better":["rest","warmth"],"worse":["cold","morning"]}]`;

        try {
          const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: aiPrompt }],
            max_tokens: 1000,
            temperature: 0.3,
          });
          const aiText = completion.choices[0]?.message?.content ?? "[]";
          const match = aiText.match(/\[[\s\S]*\]/);
          if (match) {
            const aiData: any[] = JSON.parse(match[0]);
            aiData.forEach((item) => {
              const remedy = topRemedies.find(
                (r: any) => r.remedy.name.toLowerCase() === item.name?.toLowerCase()
              );
              if (remedy) {
                if (item.indication) remedy.remedy.ai_indication = item.indication;
                if (typeof item.adjustment === "number") {
                  remedy.score = Math.min(100, Math.max(1, remedy.score + item.adjustment));
                }
                if (item.better?.length) remedy.remedy.modalities.better = item.better;
                if (item.worse?.length) remedy.remedy.modalities.worse = item.worse;
              }
            });
          }
        } catch (aiErr) {
          console.error("Groq AI error (non-fatal):", aiErr);
        }
      }

      res.json(topRemedies.sort((a: any, b: any) => b.score - a.score));
    } catch (err: any) {
      console.error("Score error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/ai/analyze-report", async (req: Request, res: Response) => {
    try {
      const { reportText, imageBase64, symptoms = [] } = req.body;

      if (!hasGroq) {
        return res.json({ extracted_symptoms: [], summary: "AI not configured. Add GROQ_OPENAI_API to your environment." });
      }

      const userContext = symptoms.filter((s: string) => !s.includes(":")).join(", ");

      if (imageBase64) {
        const completion = await groq.chat.completions.create({
          model: "llama-3.2-90b-vision-preview",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are a homeopathic physician. Analyze this medical report/image and extract all symptoms, test findings, and clinical observations useful for homeopathic remedy selection.${userContext ? ` Patient also reports: ${userContext}` : ""}

Return ONLY valid JSON:
{"extracted_symptoms":["symptom1","symptom2"],"summary":"2-3 sentence clinical summary","key_findings":["finding1","finding2"]}`,
                },
                { type: "image_url", image_url: { url: imageBase64 } },
              ],
            },
          ],
          max_tokens: 1000,
          temperature: 0.2,
        });
        const text = completion.choices[0]?.message?.content ?? "{}";
        const m = text.match(/\{[\s\S]*\}/);
        return res.json(m ? JSON.parse(m[0]) : { extracted_symptoms: [], summary: text });
      } else {
        const prompt = `You are a homeopathic physician. Extract all symptoms and clinical findings from this report.${userContext ? ` Patient also reports: ${userContext}` : ""}

Report:
${reportText}

Return ONLY valid JSON:
{"extracted_symptoms":["symptom1","symptom2"],"summary":"2-3 sentence clinical summary","key_findings":["finding1","finding2"]}`;

        const completion = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
          temperature: 0.2,
        });
        const text = completion.choices[0]?.message?.content ?? "{}";
        const m = text.match(/\{[\s\S]*\}/);
        return res.json(m ? JSON.parse(m[0]) : { extracted_symptoms: [], summary: text });
      }
    } catch (err: any) {
      console.error("Report analysis error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/remedies/search", async (req: Request, res: Response) => {
    try {
      const q = (req.query.q as string) ?? "";
      if (!q) return res.json([]);
      const { data, error } = await supabase
        .from("remedies")
        .select("id, name, common_name, slug")
        .or(`name.ilike.%${q}%,common_name.ilike.%${q}%`)
        .limit(20);
      if (error) throw error;
      res.json(data ?? []);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/remedies/:category", async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      const { data, error } = await supabase
        .from("remedy_symptoms")
        .select("remedy_name, heading, symptom")
        .ilike("heading", `%${category}%`)
        .limit(300);
      if (error) throw error;

      const remedyMap: Record<string, any> = {};
      (data ?? []).forEach((row) => {
        if (!remedyMap[row.remedy_name]) {
          remedyMap[row.remedy_name] = {
            id: row.remedy_name.toLowerCase().replace(/\s+/g, "-"),
            name: toTitleCase(row.remedy_name),
            category,
            condition: row.heading ?? category,
            description: `${toTitleCase(row.remedy_name)} is a key remedy for ${category.toLowerCase()} complaints.`,
            dosage: "30C — 3 pellets three times daily for 5 days",
            symptoms: [],
            keywords: [],
            modalities: { better: [], worse: [] },
            potencies: ["6C", "30C", "200C"],
            age_groups: ["child", "adult", "senior"],
            genders: ["male", "female", "any"],
            synonym_names: [],
          };
        }
        remedyMap[row.remedy_name].symptoms.push(row.symptom);
      });

      const remedies = Object.values(remedyMap)
        .map((r: any) => ({ ...r, symptoms: [...new Set(r.symptoms)].slice(0, 6) }))
        .slice(0, 24);

      res.json(remedies);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── FIX 1: "throw err" removed — was crashing Node process in production ──
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error(`[error] ${status} - ${message}`, err);
    res.status(status).json({ message });
  });

  return httpServer;
}
