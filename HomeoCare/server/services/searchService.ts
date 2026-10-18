// server/services/searchService.ts
// SEARCH SERVICE — Full pipeline using scraper DB (17,755 rubrics)
// Flow: symptoms → keyword groups → ranked rubrics → score by grade×weight×relevance → format results
//
// Changes vs. the previous version:
//   • no blocking Groq call (its output was never used for scoring)
//   • keywords/modalities come from utils/keywords.ts (short words kept, worse/better used)
//   • UI categories are mapped to real section patterns (utils/sections.ts)
//   • fallbacks match per keyword, not per whole sentence, and de-duplicate sentences
//   • remedy names are normalised before grouping
//   • if nothing was found AND a database call failed, the error is thrown so the UI
//     shows "something went wrong" instead of a misleading "no remedies found"

import { scoreRemedies, buildSafetyFlags, gradeToDosage } from "./scoringService";
import type { RemedyScore, SafetyFlag, Contradiction } from "./scoringService";
import {
  searchScraperRubrics,
  getRemediesForRubricIds,
  searchScraperRemedySymptoms,
  fetchLegacySymptoms,
  type RankedRubric,
  type ScraperRemedyRow,
} from "../utils/supabase";
import {
  extractKeywords,
  countGroupMatches,
  modalityScore,
  normalizeRemedyName,
} from "../utils/keywords";
import { sectionPatterns } from "../utils/sections";

// ── Types ─────────────────────────────────────────────────────────
export interface SearchFilters {
  age_group?:        string;
  gender?:           string;
  condition_type?:   string;
  symptom_location?: string;
  category?:         string;
  potency?:          string;
}

export interface HealthProfile {
  name?: string; age?: number; gender?: string;
  blood_group?: string; weight_kg?: number; height_cm?: number;
  diabetes?: string; blood_pressure?: string; obesity?: string;
  thyroid?: string; arthritis?: string; heart_disease?: string;
  kidney?: string; depression_anxiety?: string;
  chronic_conditions?: string; current_medications?: string;
  injury_history?: string; other_conditions?: string;
}

export interface RemedyResult {
  name:              string;
  score:             number;
  confidence:        number;
  dosage:            string;
  category:          string;
  explanation:       string[];
  why_explanation:   string;
  matching_symptoms: string[];
  covered_rubrics:   any[];
  safety_flags:      SafetyFlag[];
  ai_insight?:       string;
}

export interface SearchResult {
  remedies:       RemedyResult[];
  alternatives:   RemedyResult[];
  contradictions: Contradiction[];
  rubrics_used:   string[];
  rubric_count:   number;
  engine:         "scraper" | "remedy_symptoms" | "legacy";
}

// ── Helpers ───────────────────────────────────────────────────────
function cleanSymptoms(symptoms: string[]): string[] {
  return symptoms.map((s) => s.toLowerCase().trim()).filter(
    (s) => s.length > 2 &&
      !s.startsWith("category:") && !s.startsWith("age:") &&
      !s.startsWith("gender:") && !s.startsWith("disease duration:")
  );
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function emptyResult(engine: SearchResult["engine"]): SearchResult {
  return { remedies: [], alternatives: [], contradictions: [], rubrics_used: [], rubric_count: 0, engine };
}

function formatResult(entry: RemedyScore, profile?: HealthProfile): RemedyResult {
  const avgGrade = entry.grade_sum / Math.max(entry.rubric_count, 1);
  const sections = [...new Set(entry.covered_rubrics.map((r: any) => r.section || r.rubric_code?.split(".")[0] || "General"))].join(", ");
  const topRubrics = entry.covered_rubrics
    .sort((a: any, b: any) => b.contribution - a.contribution)
    .slice(0, 3).map((r: any) => `"${r.label || r.rubric_text}"`)
    .join(", ");

  return {
    name:            toTitleCase(entry.remedy_name),
    score:           entry.score,
    confidence:      entry.confidence,
    dosage:          gradeToDosage(avgGrade),
    category:        sections || "General",
    explanation:     entry.explanation,
    why_explanation: entry.rubric_count > 0
      ? `${toTitleCase(entry.remedy_name)} covers ${entry.rubric_count} rubric(s) — ${topRubrics} — avg grade ${avgGrade.toFixed(1)}.`
      : `${toTitleCase(entry.remedy_name)} matched via symptom database.`,
    matching_symptoms: [...new Set(entry.covered_rubrics.map((r: any) => r.label || r.rubric_text || "").filter(Boolean))].slice(0, 5),
    covered_rubrics:   entry.covered_rubrics,
    safety_flags:      buildSafetyFlags(entry.remedy_name, profile),
  };
}

// ── Convert scraper rubric rows to scoring engine format ──────────
function toScoringRows(rows: ScraperRemedyRow[], relevanceById: Map<number, number>) {
  const out = [];
  for (const r of rows) {
    const name = normalizeRemedyName(r.remedy_name);
    if (!name) continue;
    out.push({
      rubric_code:  String(r.rubric_id),
      rubric_label: r.rubric_text,
      body_system:  r.section,
      symptom_type: r.symptom_type || "particular",
      weight:       r.symptom_type === "mental" ? 3 : r.symptom_type === "general" ? 2 : 1,
      is_negative:  false,
      remedy_name:  name,
      grade:        r.grade,
      relevance:    relevanceById.get(r.rubric_id) ?? 1,
    });
  }
  return out;
}

function toRubricMatches(rubrics: RankedRubric[]) {
  return rubrics.map((r) => ({
    rubric_code:      String(r.id),
    label:            r.rubric_text,
    confidence:       r.relevance,
    original_symptom: r.rubric_text,
    // The patient searched by keyword; they did not deny anything. Negations are
    // dropped during keyword extraction, so nothing is eliminated here.
    is_eliminating:   false,
  }));
}

// ── MAIN PIPELINE ─────────────────────────────────────────────────
export async function search(input: {
  symptoms: string[];
  filters: SearchFilters;
  healthProfile?: HealthProfile;
}): Promise<SearchResult> {
  const { symptoms, filters, healthProfile } = input;
  const clean = cleanSymptoms(symptoms);
  if (!clean.length) return emptyResult("scraper");

  const kw = extractKeywords(clean);
  if (!kw.groups.length) return emptyResult("scraper");

  const section = filters.symptom_location || filters.category || undefined;
  const sectionPats = sectionPatterns(section);
  console.log(`[Search] Input symptoms:`, clean);
  console.log(
    `[Search] keywords=[${kw.groups.map((g) => g.key).join(", ")}] modalities=[${kw.modalities.map((m) => `${m.dir} ${m.key}`).join(", ")}] ` +
    `section=${section || "any"} → [${sectionPats?.join(", ") || "no filter"}]`
  );

  let dbError: any = null;

  // ── STEP 1: ranked scraper rubrics → scoring ─────────────────
  try {
    const rubrics = await searchScraperRubrics(kw, sectionPats);
    if (rubrics.length > 0) {
      const remedyRows = await getRemediesForRubricIds(rubrics.map((r) => r.id));
      console.log(`[Search] ${rubrics.length} rubrics, ${remedyRows.length} remedy rows`);

      if (remedyRows.length > 0) {
        const relevanceById = new Map(rubrics.map((r) => [r.id, r.relevance] as [number, number]));
        const { remedies, contradictions } = scoreRemedies(
          toRubricMatches(rubrics),
          toScoringRows(remedyRows, relevanceById)
        );

        if (remedies.length >= 2) {
          const top3 = remedies.slice(0, 3).map((r) => formatResult(r, healthProfile));
          const alts = remedies.slice(3, 5).map((r) => formatResult(r, healthProfile));
          console.log(`[Search] Scraper engine: ${remedies.length} results, top=${remedies[0]?.remedy_name}`);
          return {
            remedies: top3, alternatives: alts, contradictions,
            rubrics_used: rubrics.slice(0, 10).map((r) => r.rubric_text),
            rubric_count: rubrics.length, engine: "scraper",
          };
        }
      }
    }
  } catch (e: any) {
    dbError = e;
    console.error("[Search] scraper rubric engine failed:", e?.message || e);
  }

  // ── STEP 2: Fallback — remedy_symptoms table (materia medica sentences) ──
  console.log(`[Search] Falling back to remedy_symptoms table`);
  try {
    const remSymRows = await searchScraperRemedySymptoms(kw, sectionPats);
    const scoreMap = new Map<string, { name: string; total: number; count: number; matched: string[]; sections: Set<string>; seen: Set<string> }>();

    for (const row of remSymRows) {
      if (!row.remedy_name || !row.symptom) continue;
      const text = row.symptom.toLowerCase();
      const hits = countGroupMatches(text, kw.groups);
      if (!hits) continue;

      const key = normalizeRemedyName(row.remedy_name);
      if (!key) continue;
      if (!scoreMap.has(key)) scoreMap.set(key, { name: row.remedy_name, total: 0, count: 0, matched: [], sections: new Set(), seen: new Set() });
      const e = scoreMap.get(key)!;

      if (e.seen.has(text)) continue;   // same sentence scraped from both source sites
      e.seen.add(text);

      // Sentences matching several keywords count much more than many matching one.
      e.total += hits * hits + Math.max(0, modalityScore(text, kw.modalities)) * 0.5;
      e.count += 1;
      e.matched.push(row.symptom);
      e.sections.add(row.heading || "");
    }

    if (scoreMap.size > 0) {
      const sorted = Array.from(scoreMap.values()).sort((a, b) => b.total - a.total);
      const maxScore = sorted[0].total;
      const all: RemedyResult[] = sorted.slice(0, 8).map((e) => {
        const pct = Math.round((e.total / maxScore) * 100);
        const uniq = [...new Set(e.matched)].slice(0, 5);
        return {
          name: toTitleCase(e.name), score: pct,
          confidence: Math.min(100, e.count * 8),
          dosage: gradeToDosage(2),
          category: [...e.sections].filter(Boolean).join(", ") || section || "General",
          explanation: uniq,
          why_explanation: `${toTitleCase(e.name)} matched ${e.count} symptom(s) in materia medica. Score: ${pct}/100.`,
          matching_symptoms: uniq, covered_rubrics: [],
          safety_flags: buildSafetyFlags(e.name, healthProfile),
        };
      });
      console.log(`[Search] remedy_symptoms: ${all.length} results`);
      return { remedies: all.slice(0, 3), alternatives: all.slice(3, 5), contradictions: [], rubrics_used: [], rubric_count: 0, engine: "remedy_symptoms" };
    }
  } catch (e: any) {
    dbError = e;
    console.error("[Search] remedy_symptoms fallback failed:", e?.message || e);
  }

  // ── STEP 3: Last resort — legacy symptoms table ───────────────
  console.log(`[Search] Last resort: legacy symptoms table`);
  try {
    const legRows = await fetchLegacySymptoms(kw, sectionPats);
    const scoreMap = new Map<string, { name: string; total: number; count: number; matched: string[]; seen: Set<string> }>();

    for (const row of legRows) {
      if (!row.remedy || !row.symptom) continue;
      const text = String(row.symptom).toLowerCase();
      const hits = countGroupMatches(text, kw.groups);
      if (!hits) continue;

      const key = normalizeRemedyName(row.remedy);
      if (!key) continue;
      if (!scoreMap.has(key)) scoreMap.set(key, { name: row.remedy, total: 0, count: 0, matched: [], seen: new Set() });
      const e = scoreMap.get(key)!;

      if (e.seen.has(text)) continue;
      e.seen.add(text);
      e.total += hits * hits * (row.intensity || 1);
      e.count += 1;
      e.matched.push(row.symptom);
    }

    if (scoreMap.size > 0) {
      const sorted = Array.from(scoreMap.values()).sort((a, b) => b.total - a.total);
      const maxScore = sorted[0].total || 1;
      const all: RemedyResult[] = sorted.slice(0, 8).map((e) => {
        const pct = Math.round((e.total / maxScore) * 100);
        const uniq = [...new Set(e.matched)].slice(0, 5);
        return {
          name: toTitleCase(e.name), score: pct,
          confidence: Math.min(100, e.count * 10),
          dosage: gradeToDosage(1.5),
          category: section || "General",
          explanation: uniq,
          why_explanation: `${toTitleCase(e.name)} matched ${e.count} symptom(s). Score: ${pct}/100.`,
          matching_symptoms: uniq, covered_rubrics: [],
          safety_flags: buildSafetyFlags(e.name, healthProfile),
        };
      });
      return { remedies: all.slice(0, 3), alternatives: all.slice(3, 5), contradictions: [], rubrics_used: [], rubric_count: 0, engine: "legacy" };
    }
  } catch (e: any) {
    dbError = e;
    console.error("[Search] legacy fallback failed:", e?.message || e);
  }

  // Nothing found anywhere. If a database call failed along the way, say so
  // (the route returns HTTP 500, the UI shows "Something went wrong") instead of
  // pretending the symptoms simply have no remedies.
  if (dbError) throw dbError;
  return emptyResult("legacy");
}
