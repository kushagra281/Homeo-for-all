// server/services/repertorySearch.ts
// Glue between the graded repertory engine and the remedy search (searchService.ts).
//
// REPERTORY_ENGINE (environment):
//   off (default)  the search works exactly as before
//   on             the graded repertory is used; the old rubric search only if the repertory finds nothing
//   hybrid         both run; each remedy gets the average of its two scores (0-100 each)

import { scoreRemedies, type Contradiction, type RemedyScore } from "./scoringService";
import { findRubrics, toRubricMatches, toScoringRows, unitKeywords, type RankedRepertoryRubric } from "./repertoryEngine";
import { repertoryStore, type RepertoryStore } from "../utils/repertoryStore";

export type RepertoryMode = "off" | "on" | "hybrid";

export function repertoryMode(value = process.env.REPERTORY_ENGINE): RepertoryMode {
  const v = (value || "").trim().toLowerCase();
  if (v === "hybrid") return "hybrid";
  if (v === "on" || v === "1" || v === "true" || v === "repertory") return "on";
  return "off";
}

export interface RepertoryOutcome {
  remedies:       RemedyScore[];
  contradictions: Contradiction[];
  rubrics:        RankedRepertoryRubric[];
}

/** Scores the patient's words against the graded repertory. null = nothing usable was found. */
export async function scoreWithRepertory(
  texts: string[],
  extra: Record<string, string[]> | undefined,
  chapterPats: string[] | undefined,
  store: RepertoryStore = repertoryStore(),
): Promise<RepertoryOutcome | null> {
  const units = unitKeywords(texts, extra);
  if (!units.length) return null;
  const rubrics = await findRubrics(units, store, chapterPats);
  if (!rubrics.length) return null;
  const names = await store.remedyNames();
  const { remedies, contradictions } = scoreRemedies(toRubricMatches(rubrics), toScoringRows(rubrics, names));
  return remedies.length ? { remedies, contradictions, rubrics } : null;
}

/**
 * Combines two rankings of the same remedies. Scores are already 0-100 within each engine, so a remedy
 * both engines like beats one that only one of them found. The explanation shows rubrics from both.
 */
export function fuse(a: RemedyScore[], b: RemedyScore[], weightA = 0.5): RemedyScore[] {
  const byA = new Map(a.map((r) => [r.remedy_name, r] as const));
  const byB = new Map(b.map((r) => [r.remedy_name, r] as const));
  const fused: RemedyScore[] = [];

  for (const name of new Set([...byA.keys(), ...byB.keys()])) {
    const ra = byA.get(name), rb = byB.get(name);
    const score = weightA * (ra?.score ?? 0) + (1 - weightA) * (rb?.score ?? 0);
    const main = !rb || (ra && ra.score >= rb.score) ? ra! : rb;
    const covered = [...(ra?.covered_rubrics || []), ...(rb?.covered_rubrics || [])];
    const seen = new Set<string>();
    const unique = covered.filter((c) => (seen.has(c.rubric_code) ? false : (seen.add(c.rubric_code), true)));
    fused.push({
      ...main,
      raw_score:       score,
      score,
      confidence:      Math.min(100, Math.max(ra?.confidence ?? 0, rb?.confidence ?? 0) + (ra && rb ? 5 : 0)),
      rubric_count:    unique.length,
      grade_sum:       unique.reduce((s, c) => s + c.grade, 0),
      covered_rubrics: unique,
      explanation:     [...(ra?.explanation || []).slice(0, 3), ...(rb?.explanation || []).slice(0, 3)],
    });
  }

  fused.sort((x, y) => y.score - x.score || x.remedy_name.localeCompare(y.remedy_name));
  const max = fused[0]?.score || 0;
  if (max > 0) for (const r of fused) r.score = Math.round((r.score / max) * 100);
  return fused;
}
