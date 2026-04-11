// server/services/searchService.ts
// SEARCH SERVICE — Full pipeline using scraper DB (17,755 rubrics)
// Flow: symptoms → rubric text search → score by grade×weight → format results

import { mapSymptoms } from "./rubricService";
import { scoreRemedies, buildSafetyFlags, gradeToDosage } from "./scoringService";
import type { RemedyScore, SafetyFlag, Contradiction } from "./scoringService";
import {
  searchScraperRubrics,
  getRemediesForRubricIds,
  searchScraperRemedySymptoms,
  fetchLegacySymptoms,
  type ScraperRubric,
  type ScraperRemedyRow,
} from "../utils/supabase";

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
    matching_symptoms: entry.covered_rubrics.map((r: any) => r.label || r.rubric_text || "").slice(0, 5),
    covered_rubrics:   entry.covered_rubrics,
    safety_flags:      buildSafetyFlags(entry.remedy_name, profile),
  };
}

// ── Convert scraper rubric rows to scoring engine format ──────────
function toScoringRows(rows: ScraperRemedyRow[]) {
  return rows.map((r) => ({
    rubric_code:  String(r.rubric_id),
    rubric_label: r.rubric_text,
    body_system:  r.section,
    symptom_type: r.symptom_type || "particular",
    weight:       r.symptom_type === "mental" ? 3 : r.symptom_type === "general" ? 2 : 1,
    is_negative:  false,
    remedy_name:  r.remedy_name,
    grade:        r.grade,
  }));
}

function toRubricMatches(rubrics: ScraperRubric[], originalSymptoms: string[]) {
  const text = originalSymptoms.join(" ").toLowerCase();
  return rubrics.map((r) => ({
    rubric_code:      String(r.id),
    label:            r.rubric_text,
    confidence:       0.8,
    original_symptom: originalSymptoms.find((s) =>
      r.rubric_text.toLowerCase().split(" ").some((w) => w.length > 3 && s.includes(w))
    ) || r.rubric_text,
    is_eliminating: r.is_eliminating || false,
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

  if (!clean.length) return { remedies: [], alternatives: [], contradictions: [], rubrics_used: [], rubric_count: 0, engine: "scraper" };

  const section = filters.symptom_location || filters.category || undefined;
  console.log(`[Search] ${clean.length} symptoms, section=${section || "any"}`);

  // ── STEP 1: AI + keyword mapping for extra search terms ───────
  const [aiRubricMatches, scraperRubrics] = await Promise.all([
    mapSymptoms(clean, section),
    searchScraperRubrics(clean, section),
  ]);

  console.log(`[Search] AI/keyword: ${aiRubricMatches.length} matches, Scraper rubrics: ${scraperRubrics.length}`);

  // ── STEP 2: Score using scraper rubrics (17k rubrics) ─────────
  if (scraperRubrics.length > 0) {
    const rubricIds = scraperRubrics.map((r) => r.id);
    const remedyRows = await getRemediesForRubricIds(rubricIds);
    console.log(`[Search] ${remedyRows.length} remedy rows from scraper DB`);

    if (remedyRows.length > 0) {
      const rubricMatches = toRubricMatches(scraperRubrics, clean);
      const scoringRows = toScoringRows(remedyRows);
      const { remedies, contradictions } = scoreRemedies(rubricMatches, scoringRows);

      if (remedies.length >= 2) {
        const top3  = remedies.slice(0, 3).map((r) => formatResult(r, healthProfile));
        const alts  = remedies.slice(3, 5).map((r) => formatResult(r, healthProfile));
        const rubricLabels = scraperRubrics.slice(0, 10).map((r) => r.rubric_text);

        console.log(`[Search] Scraper engine: ${remedies.length} results, top=${remedies[0]?.remedy_name}`);
        return { remedies: top3, alternatives: alts, contradictions, rubrics_used: rubricLabels, rubric_count: scraperRubrics.length, engine: "scraper" };
      }
    }
  }

  // ── STEP 3: Fallback — remedy_symptoms table (17,678 rows) ────
  console.log(`[Search] Falling back to remedy_symptoms table`);
  const remSymRows = await searchScraperRemedySymptoms(clean, section);

  if (remSymRows.length > 0) {
    const scoreMap = new Map<string, { total: number; count: number; matched: string[]; sections: Set<string> }>();
    for (const row of remSymRows) {
      const name = row.remedy_name;
      if (!name) continue;
      const hits = clean.filter((t) => row.symptom?.toLowerCase().includes(t) || row.heading?.toLowerCase().includes(t)).length;
      if (!hits) continue;
      if (!scoreMap.has(name)) scoreMap.set(name, { total: 0, count: 0, matched: [], sections: new Set() });
      const e = scoreMap.get(name)!;
      e.total += hits * 2;
      e.count += 1;
      e.matched.push(row.symptom);
      e.sections.add(row.heading || "");
    }

    if (scoreMap.size > 0) {
      const sorted = Array.from(scoreMap.entries()).sort((a, b) => b[1].total - a[1].total);
      const maxScore = sorted[0][1].total;
      const all: RemedyResult[] = sorted.slice(0, 8).map(([name, e]) => {
        const pct = Math.round((e.total / maxScore) * 100);
        const uniq = [...new Set(e.matched)].slice(0, 5);
        return {
          name: toTitleCase(name), score: pct,
          confidence: Math.min(100, e.count * 8),
          dosage: gradeToDosage(2),
          category: [...e.sections].filter(Boolean).join(", ") || section || "General",
          explanation: uniq,
          why_explanation: `${toTitleCase(name)} matched ${e.count} symptom(s) in materia medica. Score: ${pct}/100.`,
          matching_symptoms: uniq, covered_rubrics: [],
          safety_flags: buildSafetyFlags(name, healthProfile),
        };
      });
      console.log(`[Search] remedy_symptoms: ${all.length} results`);
      return { remedies: all.slice(0, 3), alternatives: all.slice(3, 5), contradictions: [], rubrics_used: [], rubric_count: 0, engine: "remedy_symptoms" };
    }
  }

  // ── STEP 4: Last resort — legacy symptoms table ───────────────
  console.log(`[Search] Last resort: legacy symptoms table`);
  const legRows = await fetchLegacySymptoms(clean, section);
  const scoreMap = new Map<string, { total: number; count: number; matched: string[] }>();
  for (const row of legRows) {
    const hits = clean.filter((t) => row.symptom?.toLowerCase().includes(t)).length;
    if (!hits) continue;
    if (!scoreMap.has(row.remedy)) scoreMap.set(row.remedy, { total: 0, count: 0, matched: [] });
    const e = scoreMap.get(row.remedy)!;
    e.total += hits * (row.intensity || 1);
    e.count += 1;
    e.matched.push(row.symptom);
  }

  const sorted = Array.from(scoreMap.entries()).sort((a, b) => b[1].total - a[1].total);
  const maxScore = sorted[0]?.[1]?.total || 1;
  const all: RemedyResult[] = sorted.slice(0, 8).map(([name, e]) => {
    const pct = Math.round((e.total / maxScore) * 100);
    const uniq = [...new Set(e.matched)].slice(0, 5);
    return {
      name: toTitleCase(name), score: pct,
      confidence: Math.min(100, e.count * 10),
      dosage: gradeToDosage(1.5),
      category: section || "General",
      explanation: uniq,
      why_explanation: `${toTitleCase(name)} matched ${e.count} symptom(s). Score: ${pct}/100.`,
      matching_symptoms: uniq, covered_rubrics: [],
      safety_flags: buildSafetyFlags(name, healthProfile),
    };
  });

  return { remedies: all.slice(0, 3), alternatives: all.slice(3, 5), contradictions: [], rubrics_used: [], rubric_count: 0, engine: "legacy" };
}
