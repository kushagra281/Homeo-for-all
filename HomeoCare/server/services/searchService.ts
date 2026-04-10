// server/services/searchService.ts
// SEARCH SERVICE — Orchestrates the full pipeline:
// Input symptoms → Rubric mapping → DB fetch → Score → Format output
// No HTTP logic here. No AI remedy suggestions.

import { mapSymptoms } from "./rubricService";
import {
  scoreRemedies,
  buildSafetyFlags,
  gradeToDosage,
  type RemedyScore,
  type SafetyFlag,
  type Contradiction,
} from "./scoringService";
import {
  fetchRubricRemedyRows,
  fetchLegacySymptoms,
  fetchLegacyRemedySymptoms,
} from "../utils/supabase";

// ── Input / Output types ─────────────────────────────────────────
export interface SearchInput {
  symptoms:      string[];
  filters:       SearchFilters;
  healthProfile?: HealthProfile;
}

export interface SearchFilters {
  age_group?:       string;
  gender?:          string;
  condition_type?:  string;
  symptom_location?: string;
  category?:        string;
  potency?:         string;
}

export interface HealthProfile {
  name?:               string;
  age?:                number;
  gender?:             string;
  blood_group?:        string;
  weight_kg?:          number;
  height_cm?:          number;
  diabetes?:           string;
  blood_pressure?:     string;
  obesity?:            string;
  thyroid?:            string;
  arthritis?:          string;
  heart_disease?:      string;
  kidney?:             string;
  depression_anxiety?: string;
  chronic_conditions?: string;
  current_medications?:string;
  injury_history?:     string;
  other_conditions?:   string;
}

export interface RemedyResult {
  name:            string;
  score:           number;       // 0–100
  confidence:      number;       // 0–100
  dosage:          string;
  category:        string;
  explanation:     string[];     // ["Fear of darkness (grade 3, mental, +9)"]
  why_explanation: string;       // single prose sentence
  matching_symptoms: string[];
  covered_rubrics: Array<{
    rubric_code:  string;
    label:        string;
    grade:        number;
    weight:       number;
    contribution: number;
  }>;
  safety_flags:    SafetyFlag[];
  ai_insight?:     string;
}

export interface SearchResult {
  remedies:       RemedyResult[];   // top 3
  alternatives:   RemedyResult[];   // #4–#5
  contradictions: Contradiction[];
  rubrics_used:   string[];
  engine:         "rubric" | "legacy";
}

// ── Clean symptom input ───────────────────────────────────────────
function cleanSymptoms(symptoms: string[]): string[] {
  return symptoms
    .map((s) => s.toLowerCase().trim())
    .filter(
      (s) =>
        s.length > 2 &&
        !s.startsWith("category:") &&
        !s.startsWith("age:") &&
        !s.startsWith("gender:") &&
        !s.startsWith("disease duration:")
    );
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Format a RemedyScore into a RemedyResult ──────────────────────
function formatRemedy(
  entry: RemedyScore,
  profile?: HealthProfile
): RemedyResult {
  const avgGrade = entry.grade_sum / Math.max(entry.rubric_count, 1);
  const categories = [...new Set(
    entry.covered_rubrics.map((r) => r.rubric_code.split(".")[0])
  )].join(", ");

  const topRubrics = entry.covered_rubrics
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((r) => `"${r.label}"`)
    .join(", ");

  const whyExplanation = entry.rubric_count > 0
    ? `${toTitleCase(entry.remedy_name)} covers ${entry.rubric_count} rubric(s) — ${topRubrics} — with average Kent grade ${avgGrade.toFixed(1)}.`
    : `${toTitleCase(entry.remedy_name)} matched via symptom database.`;

  return {
    name:              toTitleCase(entry.remedy_name),
    score:             entry.score,
    confidence:        entry.confidence,
    dosage:            gradeToDosage(avgGrade),
    category:          categories || "General",
    explanation:       entry.explanation,
    why_explanation:   whyExplanation,
    matching_symptoms: entry.covered_rubrics.map((r) => r.label).slice(0, 5),
    covered_rubrics:   entry.covered_rubrics,
    safety_flags:      buildSafetyFlags(entry.remedy_name, profile),
  };
}

// ── MAIN PIPELINE ─────────────────────────────────────────────────
export async function search(input: SearchInput): Promise<SearchResult> {
  const { symptoms, filters, healthProfile } = input;
  const clean = cleanSymptoms(symptoms);

  if (!clean.length) {
    return { remedies: [], alternatives: [], contradictions: [], rubrics_used: [], engine: "rubric" };
  }

  const bodySystem = filters.symptom_location || filters.category || undefined;

  console.log(`[Search] ${clean.length} symptoms, system=${bodySystem || "any"}`);

  // ── Step 1: Map symptoms → rubric codes ──────────────────────
  const rubricMatches = await mapSymptoms(clean, bodySystem);
  const rubricCodes = rubricMatches.map((m) => m.rubric_code);

  console.log(`[Search] ${rubricMatches.length} rubric matches:`,
    rubricMatches.map((m) => m.rubric_code).join(", "));

  // ── Step 2: Fetch rubric-remedy data (JOIN query) ────────────
  if (rubricCodes.length > 0) {
    const rows = await fetchRubricRemedyRows(rubricCodes);

    if (rows.length > 0) {
      // ── Step 3: Score remedies ────────────────────────────────
      const { remedies, contradictions } = scoreRemedies(rubricMatches, rows);

      if (remedies.length >= 2) {
        console.log(`[Search] Rubric engine: ${remedies.length} results, top=${remedies[0]?.remedy_name}`);

        const top3    = remedies.slice(0, 3).map((r) => formatRemedy(r, healthProfile));
        const alts    = remedies.slice(3, 5).map((r) => formatRemedy(r, healthProfile));

        return {
          remedies:       top3,
          alternatives:   alts,
          contradictions,
          rubrics_used:   rubricCodes,
          engine:         "rubric",
        };
      }
    }
  }

  // ── Step 4: Legacy fallback ───────────────────────────────────
  console.log(`[Search] Falling back to legacy symptom tables`);
  const legacyResults = await legacySearch(clean, bodySystem, healthProfile);

  return {
    ...legacyResults,
    rubrics_used:   rubricCodes,
    contradictions: [],
    engine:         "legacy",
  };
}

// ── Legacy scoring (uses symptoms + remedy_symptoms tables) ───────
async function legacySearch(
  terms: string[],
  category: string | undefined,
  profile?: HealthProfile
): Promise<Pick<SearchResult, "remedies" | "alternatives">> {
  const [symRows, remSymRows] = await Promise.all([
    fetchLegacySymptoms(terms, category),
    fetchLegacyRemedySymptoms(terms, category),
  ]);

  const scoreMap = new Map<string, {
    total: number; count: number;
    matched: string[]; cats: Set<string>;
  }>();

  for (const row of symRows) {
    const name = row.remedy;
    if (!name) continue;
    const hits = terms.filter((t) => row.symptom?.toLowerCase().includes(t)).length;
    if (!hits) continue;
    if (!scoreMap.has(name)) scoreMap.set(name, { total: 0, count: 0, matched: [], cats: new Set() });
    const e = scoreMap.get(name)!;
    e.total += hits * (row.intensity || 1);
    e.count += 1;
    e.matched.push(row.symptom);
    e.cats.add(row.category || "");
  }

  for (const row of remSymRows) {
    const name = row.remedy_name;
    if (!name) continue;
    const hits = terms.filter(
      (t) => row.symptom?.toLowerCase().includes(t) || row.heading?.toLowerCase().includes(t)
    ).length;
    if (!hits) continue;
    if (!scoreMap.has(name)) scoreMap.set(name, { total: 0, count: 0, matched: [], cats: new Set() });
    const e = scoreMap.get(name)!;
    e.total += hits * 3; // remedy_symptoms treated as grade 3
    e.count += 1;
    e.matched.push(row.symptom);
    e.cats.add(row.heading || "");
  }

  if (!scoreMap.size) return { remedies: [], alternatives: [] };

  const sorted = Array.from(scoreMap.entries()).sort((a, b) => b[1].total - a[1].total);
  const maxScore = sorted[0][1].total;

  const all: RemedyResult[] = sorted.slice(0, 8).map(([name, e]) => {
    const pct = Math.round((e.total / maxScore) * 100);
    const avgGrade = e.total / Math.max(e.count, 1);
    const cats = [...e.cats].filter(Boolean).join(", ");
    const uniqMatched = [...new Set(e.matched)].slice(0, 5);

    return {
      name:            toTitleCase(name),
      score:           pct,
      confidence:      Math.min(100, e.count * 10),
      dosage:          gradeToDosage(avgGrade),
      category:        cats || category || "General",
      explanation:     uniqMatched.map((s) => s),
      why_explanation: `${toTitleCase(name)} matched ${e.count} symptom(s) in database. Score: ${pct}/100.`,
      matching_symptoms: uniqMatched,
      covered_rubrics: [],
      safety_flags:    buildSafetyFlags(name, profile),
    };
  });

  return { remedies: all.slice(0, 3), alternatives: all.slice(3, 5) };
}
