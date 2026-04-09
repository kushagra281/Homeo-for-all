// server/engine/scoring-engine.ts
// REPERTORY SCORING ENGINE
// Implements proper homeopathic totality scoring:
//   - Mind symptoms: weight 3
//   - General symptoms: weight 2
//   - Particular symptoms: weight 1
//   - Grade 1-4 multiplier per Kent notation
//   - Negative symptoms reduce score (eliminations)
//   - No double-counting same rubric

import type {
  Rubric,
  RubricRemedy,
  RubricMatch,
  RemedyScoreEntry,
  CoveredRubric,
} from "../../shared/types";

// ── Weight constants ─────────────────────────────────────────────
const SYMPTOM_WEIGHTS = {
  mental:     3,  // Mind rubrics — highest importance
  general:    2,  // Generalities — second
  particular: 1,  // Local/particular — lowest
} as const;

// Grade multiplier (Kent scale)
const GRADE_MULTIPLIER = {
  1: 1,   // plain text
  2: 2,   // italic
  3: 3,   // bold
  4: 4,   // bold + italic (most prominent)
} as const;

// ── MAIN SCORING FUNCTION ────────────────────────────────────────

export interface ScoringInput {
  rubricMatches:   RubricMatch[];    // from AI module
  rubrics:         Rubric[];         // from DAL
  rubricRemedies:  RubricRemedy[];   // from DAL
}

export interface ScoringOutput {
  scores:          RemedyScoreEntry[];
  totalRubrics:    number;
  eliminatedCount: number;
}

export function scoreRemedies(input: ScoringInput): ScoringOutput {
  const { rubricMatches, rubrics, rubricRemedies } = input;

  if (!rubricMatches.length || !rubricRemedies.length) {
    return { scores: [], totalRubrics: 0, eliminatedCount: 0 };
  }

  // Build lookup maps
  const rubricMap = new Map<string, Rubric>(rubrics.map((r) => [r.code, r]));

  // Separate positive and eliminating rubrics
  const positiveMatches = rubricMatches.filter((m) => !m.is_eliminating);
  const eliminatingMatches = rubricMatches.filter((m) => m.is_eliminating);

  // Build set of eliminating rubric codes
  const eliminatingCodes = new Set(eliminatingMatches.map((m) => m.rubric_code));

  // Collect all remedies that appear under positive rubrics
  const activeRubricCodes = new Set(positiveMatches.map((m) => m.rubric_code));

  // Group rubric-remedy pairs by remedy
  const remedyEntryMap = new Map<string, RemedyScoreEntry>();

  for (const rr of rubricRemedies) {
    if (!activeRubricCodes.has(rr.rubric_code)) continue;

    const rubric = rubricMap.get(rr.rubric_code);
    if (!rubric) continue;

    const weight = SYMPTOM_WEIGHTS[rubric.symptom_type] ?? 1;
    const gradeMultiplier = GRADE_MULTIPLIER[rr.grade as 1|2|3|4] ?? 1;
    const contribution = weight * gradeMultiplier;

    if (!remedyEntryMap.has(rr.remedy_name)) {
      remedyEntryMap.set(rr.remedy_name, {
        remedy_name:     rr.remedy_name,
        total_score:     0,
        weighted_score:  0,
        grade_sum:       0,
        rubric_count:    0,
        covered_rubrics: [],
        eliminated:      false,
      });
    }

    const entry = remedyEntryMap.get(rr.remedy_name)!;

    // No double-counting: skip if this rubric is already recorded for this remedy
    const alreadyCounted = entry.covered_rubrics.some(
      (cr) => cr.rubric_code === rr.rubric_code
    );
    if (alreadyCounted) continue;

    entry.covered_rubrics.push({
      rubric_code:  rr.rubric_code,
      label:        rubric.label,
      grade:        rr.grade,
      weight,
      contribution,
    });

    entry.total_score    += contribution;
    entry.weighted_score += contribution;
    entry.grade_sum      += rr.grade;
    entry.rubric_count   += 1;
  }

  // Apply eliminations: if a remedy covers any eliminating rubric, eliminate it
  let eliminatedCount = 0;
  for (const rr of rubricRemedies) {
    if (!eliminatingCodes.has(rr.rubric_code)) continue;
    const entry = remedyEntryMap.get(rr.remedy_name);
    if (!entry) continue;
    if (!entry.eliminated) {
      entry.eliminated = true;
      entry.elimination_reason = `Eliminated: patient denied "${
        rubricMap.get(rr.rubric_code)?.label || rr.rubric_code
      }"`;
      eliminatedCount++;
    }
  }

  // Filter out eliminated, sort by weighted_score descending
  const scores = Array.from(remedyEntryMap.values())
    .filter((e) => !e.eliminated)
    .sort((a, b) => b.weighted_score - a.weighted_score);

  return {
    scores,
    totalRubrics: positiveMatches.length,
    eliminatedCount,
  };
}

// ── NORMALISE scores to 0-100 ────────────────────────────────────

export function normaliseScores(scores: RemedyScoreEntry[]): RemedyScoreEntry[] {
  if (!scores.length) return [];
  const max = scores[0].weighted_score; // already sorted desc
  if (max === 0) return scores;
  return scores.map((s) => ({
    ...s,
    weighted_score: Math.round((s.weighted_score / max) * 100),
  }));
}

// ── CONFIDENCE SCORE ─────────────────────────────────────────────
// Based on: how many of the patient's rubrics does this remedy cover?

export function calculateConfidence(
  entry: RemedyScoreEntry,
  totalRubricsInCase: number
): number {
  if (totalRubricsInCase === 0) return 0;

  // Coverage: how many case rubrics does this remedy cover
  const rubricCoverage = entry.rubric_count / totalRubricsInCase;

  // Grade quality: average Kent grade (1-4), normalised to 0-1
  const avgGrade   = entry.grade_sum / Math.max(entry.rubric_count, 1);
  const gradeScore = (avgGrade - 1) / 3;

  // Mental bonus: mental rubrics (weight=3) carry extra confidence
  const mentalRubrics = entry.covered_rubrics.filter(r => r.weight === 3).length;
  const mentalBonus   = Math.min(0.2, mentalRubrics * 0.07);

  // Grade 3+ bonus: high-grade matches are more reliable
  const highGradeCount = entry.covered_rubrics.filter(r => r.grade >= 3).length;
  const highGradeBonus = Math.min(0.15, highGradeCount * 0.05);

  const confidence =
    (rubricCoverage * 0.55 +
     gradeScore     * 0.25 +
     mentalBonus         +
     highGradeBonus) * 100;

  return Math.min(100, Math.round(confidence));
}

// ── WHY EXPLANATION ──────────────────────────────────────────────

export function buildExplanation(
  entry: RemedyScoreEntry,
  normalizedScore: number
): string {
  const topRubrics = entry.covered_rubrics
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 3)
    .map((r) => `"${r.label}" (grade ${r.grade})`)
    .join(", ");

  const mentalCount = entry.covered_rubrics.filter(
    (r) => r.weight === 3
  ).length;
  const generalCount = entry.covered_rubrics.filter(
    (r) => r.weight === 2
  ).length;

  const parts: string[] = [];
  parts.push(`Matches ${entry.rubric_count} rubric${entry.rubric_count !== 1 ? "s" : ""}`);
  if (mentalCount > 0) parts.push(`${mentalCount} mental`);
  if (generalCount > 0) parts.push(`${generalCount} general`);
  if (topRubrics) parts.push(`Covers: ${topRubrics}`);
  parts.push(`Score: ${normalizedScore}/100`);

  return parts.join(". ") + ".";
}

// ── SAFETY FLAGS ─────────────────────────────────────────────────

export interface SafetyFlag {
  level: "info" | "warning" | "danger";
  message: string;
}

export function buildSafetyFlags(
  remedyName: string,
  healthProfile?: {
    age?: number;
    heart_disease?: string;
    kidney?: string;
    current_medications?: string;
  }
): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  const name = remedyName.toLowerCase();

  // Always present
  flags.push({
    level: "info",
    message: "For educational purposes only. Always consult a qualified homeopath.",
  });

  if (!healthProfile) return flags;

  // Age warnings
  if (healthProfile.age && healthProfile.age < 12) {
    flags.push({
      level: "warning",
      message: "Child patient: use 6C potency. Do not repeat more than 3 doses without professional guidance.",
    });
  }
  if (healthProfile.age && healthProfile.age > 70) {
    flags.push({
      level: "info",
      message: "Senior patient: start with 6C or 30C. Avoid frequent repetition.",
    });
  }

  // Condition warnings
  if (
    healthProfile.heart_disease &&
    healthProfile.heart_disease !== "None" &&
    (name.includes("digitalis") || name.includes("strophanthus"))
  ) {
    flags.push({
      level: "danger",
      message: "Cardiac patient: Digitalis/Strophanthus require strict professional supervision.",
    });
  }

  if (
    healthProfile.kidney &&
    healthProfile.kidney !== "None" &&
    (name.includes("mercury") || name.includes("mercurius"))
  ) {
    flags.push({
      level: "warning",
      message: "Kidney impairment noted: Mercurius remedies should be used with caution.",
    });
  }

  // High confidence needed for serious symptoms
  if (
    healthProfile.heart_disease &&
    healthProfile.heart_disease !== "None"
  ) {
    flags.push({
      level: "warning",
      message: "Cardiac history present. Consult a qualified homeopath before any treatment.",
    });
  }

  return flags;
}
