// server/services/scoringService.ts
// SCORING SERVICE
// Pure functions — no DB calls, no AI calls.
// Input: rubric matches + rubric-remedy rows from DB
// Output: scored, ranked remedy list with explanations

import type { RubricMatch } from "./rubricService";
import type { RubricRemedyRow } from "../utils/supabase";

// ── Types ─────────────────────────────────────────────────────────
export interface CoveredRubric {
  rubric_code:  string;
  label:        string;
  grade:        number;
  weight:       number;
  contribution: number; // grade × weight
}

export interface RemedyScore {
  remedy_name:     string;
  raw_score:       number;
  score:           number;       // 0–100 normalised
  confidence:      number;       // 0–100
  rubric_count:    number;
  grade_sum:       number;
  covered_rubrics: CoveredRubric[];
  explanation:     string[];     // ["Fear of darkness (grade 3)", ...]
  eliminated:      boolean;
  elimination_reason?: string;
}

export interface ScoringResult {
  remedies:        RemedyScore[];
  total_rubrics:   number;
  eliminated_count: number;
  contradictions:  Contradiction[];
}

export interface Contradiction {
  symptom_a: string;
  symptom_b: string;
  reason:    string;
}

// ── Weight constants ──────────────────────────────────────────────
const WEIGHT: Record<string, number> = {
  mental:     3,
  general:    2,
  particular: 1,
};

// ── Contradiction detection ───────────────────────────────────────
// Pairs of rubric codes that cannot both be true simultaneously
const CONTRADICTION_PAIRS: Array<[string, string, string]> = [
  ["GEN.WORSE.COLD",   "GEN.WORSE.HEAT",      "Cannot be worse from both cold AND heat"],
  ["GEN.BETTER.REST",  "GEN.BETTER.MOTION",   "Cannot be better from both rest AND motion"],
  ["MIND.GRIEF",       "MIND.ANGER",           "Grief and anger are opposing emotional states — please confirm"],
  ["RESP.COUGH.DRY",   "RESP.COUGH.WET",       "Cannot have both dry and wet cough simultaneously"],
  ["SKIN.ITCH.HEAT",   "GEN.BETTER.WARMTH",    "Itching worse heat conflicts with general better warmth"],
];

export function detectContradictions(
  matches: RubricMatch[]
): Contradiction[] {
  const codes = new Set(
    matches.filter((m) => !m.is_eliminating).map((m) => m.rubric_code)
  );
  const found: Contradiction[] = [];

  for (const [a, b, reason] of CONTRADICTION_PAIRS) {
    if (codes.has(a) && codes.has(b)) {
      found.push({
        symptom_a: a,
        symptom_b: b,
        reason,
      });
    }
  }

  return found;
}

// ── MAIN SCORING FUNCTION ─────────────────────────────────────────
export function scoreRemedies(
  rubricMatches: RubricMatch[],
  rows: RubricRemedyRow[]
): ScoringResult {
  const contradictions = detectContradictions(rubricMatches);

  const positiveMatches = rubricMatches.filter((m) => !m.is_eliminating);
  const eliminatingMatches = rubricMatches.filter((m) => m.is_eliminating);

  const positiveCodes = new Set(positiveMatches.map((m) => m.rubric_code));
  const eliminatingCodes = new Set(eliminatingMatches.map((m) => m.rubric_code));

  // Group rows by remedy
  const remedyMap = new Map<string, RemedyScore>();

  for (const row of rows) {
    // Only score rows that belong to positive rubrics
    if (!positiveCodes.has(row.rubric_code)) continue;

    const weight = WEIGHT[row.symptom_type] ?? 1;
    const contribution = row.grade * weight;

    if (!remedyMap.has(row.remedy_name)) {
      remedyMap.set(row.remedy_name, {
        remedy_name:     row.remedy_name,
        raw_score:       0,
        score:           0,
        confidence:      0,
        rubric_count:    0,
        grade_sum:       0,
        covered_rubrics: [],
        explanation:     [],
        eliminated:      false,
      });
    }

    const entry = remedyMap.get(row.remedy_name)!;

    // No double-counting: skip if rubric already recorded for this remedy
    const alreadyCounted = entry.covered_rubrics.some(
      (cr) => cr.rubric_code === row.rubric_code
    );
    if (alreadyCounted) continue;

    entry.covered_rubrics.push({
      rubric_code:  row.rubric_code,
      label:        row.rubric_label,
      grade:        row.grade,
      weight,
      contribution,
    });

    entry.raw_score   += contribution;
    entry.grade_sum   += row.grade;
    entry.rubric_count += 1;
  }

  // Apply eliminations
  let eliminatedCount = 0;
  for (const row of rows) {
    if (!eliminatingCodes.has(row.rubric_code)) continue;
    const entry = remedyMap.get(row.remedy_name);
    if (!entry || entry.eliminated) continue;
    entry.eliminated = true;
    entry.elimination_reason = `Eliminated: patient denied "${row.rubric_label}"`;
    eliminatedCount++;
  }

  // Build final list — filter eliminated, sort by raw_score
  const active = Array.from(remedyMap.values())
    .filter((e) => !e.eliminated)
    .sort((a, b) => b.raw_score - a.raw_score);

  if (!active.length) {
    return { remedies: [], total_rubrics: positiveMatches.length, eliminated_count: eliminatedCount, contradictions };
  }

  const maxScore = active[0].raw_score;

  // Normalise scores + build explanations + calculate confidence
  const scored = active.map((entry) => {
    const normalised = maxScore > 0
      ? Math.round((entry.raw_score / maxScore) * 100)
      : 0;

    const confidence = calculateConfidence(entry, positiveMatches.length);
    const explanation = buildExplanation(entry);

    return {
      ...entry,
      score:       normalised,
      confidence,
      explanation,
    };
  });

  return {
    remedies:         scored,
    total_rubrics:    positiveMatches.length,
    eliminated_count: eliminatedCount,
    contradictions,
  };
}

// ── Confidence calculation ────────────────────────────────────────
function calculateConfidence(
  entry: RemedyScore,
  totalRubrics: number
): number {
  if (totalRubrics === 0) return 0;

  const rubricCoverage = entry.rubric_count / totalRubrics;
  const avgGrade       = entry.grade_sum / Math.max(entry.rubric_count, 1);
  const gradeScore     = (avgGrade - 1) / 3; // normalised 0–1

  // Mental rubric bonus
  const mentalCount = entry.covered_rubrics.filter((r) => r.weight === 3).length;
  const mentalBonus = Math.min(0.2, mentalCount * 0.07);

  // High grade bonus
  const highGradeCount = entry.covered_rubrics.filter((r) => r.grade >= 3).length;
  const highGradeBonus = Math.min(0.15, highGradeCount * 0.05);

  const confidence =
    rubricCoverage * 0.55 +
    gradeScore     * 0.25 +
    mentalBonus         +
    highGradeBonus;

  return Math.min(100, Math.round(confidence * 100));
}

// ── Explanation builder ───────────────────────────────────────────
// Returns array of strings like: ["Fear of darkness (grade 3, mental)"]
function buildExplanation(entry: RemedyScore): string[] {
  const typeLabel: Record<number, string> = { 3: "mental", 2: "general", 1: "particular" };

  return entry.covered_rubrics
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5)
    .map((r) => {
      const type = typeLabel[r.weight] || "particular";
      const gradeStr = ["", "plain", "italic", "bold", "bold+italic"][r.grade] || `grade ${r.grade}`;
      return `${r.label} (${gradeStr}, ${type}, score +${r.contribution})`;
    });
}

// ── Safety flags ─────────────────────────────────────────────────
export interface SafetyFlag {
  level:   "info" | "warning" | "danger";
  message: string;
}

export function buildSafetyFlags(
  remedyName: string,
  profile?: { age?: number; heart_disease?: string; kidney?: string }
): SafetyFlag[] {
  const flags: SafetyFlag[] = [{
    level:   "info",
    message: "For educational purposes only. Consult a qualified homeopath before treatment.",
  }];

  if (!profile) return flags;

  if (profile.age && profile.age < 12) {
    flags.push({ level: "warning", message: "Child patient: use 6C potency only. Do not repeat without guidance." });
  }
  if (profile.age && profile.age > 70) {
    flags.push({ level: "info", message: "Senior patient: start with 6C or 30C. Avoid frequent repetition." });
  }
  if (profile.heart_disease && profile.heart_disease !== "None") {
    flags.push({ level: "warning", message: "Cardiac history present. Consult a qualified homeopath before any treatment." });
  }
  if (profile.kidney && profile.kidney !== "None") {
    const lower = remedyName.toLowerCase();
    if (lower.includes("mercurius") || lower.includes("mercury")) {
      flags.push({ level: "danger", message: "Kidney impairment: Mercurius remedies require professional supervision." });
    }
  }

  return flags;
}

// ── Grade → dosage ────────────────────────────────────────────────
export function gradeToDosage(avgGrade: number): string {
  if (avgGrade >= 3) return "200C — 3 pellets twice daily for 3 days, then once weekly";
  if (avgGrade >= 2) return "30C — 3 pellets three times daily for 5 days";
  return "6C — 3 pellets four times daily for 7 days";
}
