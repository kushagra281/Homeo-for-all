// server/services/symptomBlend.ts
// Adds the materia-medica sentences (remedy_symptoms table) to the rubric score.
//
// Why: the rubric table covers some remedies thinly (Drosera 28 lines, Iris 37, Aloe 72 against
// Phosphorus 203), while their Boericke sentences sit in remedy_symptoms, which used to be read only
// when the rubric search found nothing. A remedy whose own sentences match the patient's words now
// gets a small extra score. Pure functions: no database or AI calls.

import { countGroupMatches, modalityScore, normalizeRemedyName } from "../utils/keywords";
import type { ExtractedKeywords } from "../utils/keywords";
import type { RemedyScore } from "./scoringService";

export interface SymptomRow { remedy_name: string; heading?: string; symptom: string }

/** Score added for one fully matching sentence (a plain rubric line is worth 1). */
export const SENTENCE_BONUS = 1.5;
/** At most this many sentences count per remedy, so a long text cannot win by volume. */
export const MAX_SENTENCES = 5;
/** A remedy found ONLY through sentences needs a sentence matching at least this many keywords. */
export const MIN_HITS_NEW_REMEDY = 2;

interface Hit { sentence: string; value: number; hits: number }

export function blendSymptomRows(
  scored: RemedyScore[],
  rows: SymptomRow[],
  kw: ExtractedKeywords
): RemedyScore[] {
  if (!rows.length || !kw.groups.length) return scored;

  const need = Math.min(kw.groups.length, 3);
  const byRemedy = new Map<string, { hits: Hit[]; seen: Set<string> }>();
  for (const row of rows) {
    if (!row.remedy_name || !row.symptom) continue;
    const text = row.symptom.toLowerCase();
    const hits = countGroupMatches(text, kw.groups);
    if (!hits) continue;
    const key = normalizeRemedyName(row.remedy_name);
    if (!key) continue;
    let e = byRemedy.get(key);
    if (!e) { e = { hits: [], seen: new Set() }; byRemedy.set(key, e); }
    if (e.seen.has(text)) continue;            // same sentence scraped from two sites
    e.seen.add(text);
    const relevance = Math.min(1, hits / need);
    const value = Math.round(SENTENCE_BONUS * relevance * (1 + Math.max(0, modalityScore(text, kw.modalities)) * 0.2) * 10) / 10;
    e.hits.push({ sentence: row.symptom, value, hits });
  }
  if (!byRemedy.size) return scored;

  const byName = new Map(scored.map((r) => [r.remedy_name, { ...r, covered_rubrics: [...r.covered_rubrics] }] as [string, RemedyScore]));

  for (const [name, e] of Array.from(byRemedy.entries())) {
    const best = e.hits.sort((a, b) => b.value - a.value).slice(0, MAX_SENTENCES);
    let entry = byName.get(name);
    if (!entry) {
      if (!best.some((h) => h.hits >= MIN_HITS_NEW_REMEDY)) continue;
      entry = {
        remedy_name: name, raw_score: 0, score: 0, confidence: 0, rubric_count: 0, grade_sum: 0,
        covered_rubrics: [], explanation: [], eliminated: false,
      };
      byName.set(name, entry);
    }
    best.forEach((h, i) => {
      entry!.covered_rubrics.push({
        rubric_code: `sym:${name}:${i}`, label: h.sentence, grade: 1, weight: 1, contribution: h.value, section: "Materia medica",
      });
      entry!.raw_score += h.value;
      entry!.grade_sum += 1;
      entry!.rubric_count += 1;
    });
  }

  const out = Array.from(byName.values()).sort((a, b) => b.raw_score - a.raw_score);
  const max = out[0]?.raw_score || 0;
  for (const r of out) {
    r.score = max > 0 ? Math.round((r.raw_score / max) * 100) : 0;
    r.explanation = r.covered_rubrics
      .slice()
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 5)
      .map((c) => `${c.label} (${c.rubric_code.startsWith("sym:") ? "materia medica" : "rubric"}, score +${c.contribution})`);
  }
  return out;
}
