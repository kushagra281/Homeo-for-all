// server/services/repertoryEngine.ts
// Remedy search over the GRADED repertory (rubric tree with printed grades 1-3).
//
// Flow: each symptom the patient gave ("unit") -> keyword groups -> rubrics whose path matches them
// (all groups first, fewer when that finds too little) -> best few per unit -> one scoring row per
// (rubric, remedy) with the printed grade -> the existing scoreRemedies() adds them up.
// Pure apart from the RepertoryStore it is given, so it runs the same on the database and in memory.

import { extractKeywords, groupMatches, normalizeRemedyName, type ExtractedKeywords, type KeywordGroup, type Modality } from "../utils/keywords";
import type { RepertoryRubric, RepertoryStore } from "../utils/repertoryStore";
import type { RubricRemedyRow } from "./scoringService";
import type { RubricMatch } from "./rubricService";

export interface EngineOptions {
  /** Rubrics kept for each symptom of the patient. */
  perUnit: number;
  /** When all groups of a symptom give fewer rubrics than this, fewer groups are tried too. */
  enough: number;
  /** 0 = every rubric counts the same; larger = broad rubrics (many remedies) count less. */
  sizePenalty: number;
  /** A rubric whose sub-rubric is also kept for the same symptom is dropped (no double credit). */
  dropAncestors: boolean;
  /** Each symptom's rubrics together count like this many rubrics at most (keeps one wordy symptom from outweighing the rest). */
  unitCap: number;
}

// Chosen with the offline Trials (server/trials/offline.ts, 68 textbook cases): keeping the broader parent
// rubrics and ten rubrics per symptom clearly beat dropping parents / keeping three (Top 1/3/5: 34/45/53
// against 26/40/46). The other options changed the result by a case or two, so they stay at plain values.
export const DEFAULT_OPTIONS: EngineOptions = {
  perUnit: 10,
  enough: 6,
  sizePenalty: 0.3,
  dropAncestors: false,
  unitCap: 6,
};

export interface RankedRepertoryRubric extends RepertoryRubric {
  unit:      number;   // which symptom of the patient it answers
  matched:   number;   // groups of that symptom found in the path
  relevance: number;   // 0-1, weight in the scoring
}

// ── Symptom units ─────────────────────────────────────────────────
/** One unit per sentence-like piece of what the patient wrote; commas stay inside ("worse at night, better pressure"). */
export function splitUnits(texts: string[]): string[] {
  return texts.flatMap((t) => t.split(/[.;\n]+/)).map((s) => s.trim()).filter((s) => s.length > 2);
}

export function unitKeywords(texts: string[], extra?: Record<string, string[]>): ExtractedKeywords[] {
  return splitUnits(texts)
    .map((u) => extractKeywords([u], 6, extra))
    .filter((k) => k.groups.length > 0);
}

// ── Modalities in repertory wording ───────────────────────────────
// The repertory writes "air > agg." / "warmth > amel." instead of "worse" / "better".
const AGG = /(^|[^a-z])agg(\.|[^a-z]|$)/;
const AMEL = /(^|[^a-z])amel(\.|[^a-z]|$)/;

export function repertoryModality(path: string, modalities: Modality[]): number {
  let score = 0;
  for (const m of modalities) {
    if (!path.includes(m.key)) continue;
    const agg = AGG.test(path), amel = AMEL.test(path);
    if (m.dir === "worse")  { if (agg) score += 1; else if (amel) score -= 1; }
    if (m.dir === "better") { if (amel) score += 1; else if (agg) score -= 1; }
  }
  return score;
}

// ── How much each word says ───────────────────────────────────────
interface Weighted { kw: ExtractedKeywords; groups: KeywordGroup[]; w: Map<string, number> }

/** Rare words ("urination") weigh more than words found in thousands of rubrics ("pain"). */
async function weigh(kw: ExtractedKeywords, store: RepertoryStore): Promise<Weighted> {
  const w = new Map<string, number>();
  let groups = kw.groups;
  try {
    if (store.groupFrequency) {
      const { counts, total } = await store.groupFrequency(kw.groups);
      const n = Math.max(total, 2);
      kw.groups.forEach((g, i) => w.set(g.key, Math.min(1, Math.max(0.15, Math.log(n / (1 + counts[i])) / Math.log(n)))));
      groups = [...kw.groups].sort((a, b) => (w.get(b.key)! - w.get(a.key)!));
    }
  } catch { /* weights are an improvement, not a requirement */ }
  for (const g of kw.groups) if (!w.has(g.key)) w.set(g.key, 1);
  return { kw, groups, w };
}

// ── Finding rubrics ───────────────────────────────────────────────
function pairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) out.push([items[i], items[j]]);
  return out;
}

async function candidates(
  wk: Weighted, store: RepertoryStore, chapterPats: string[] | undefined, o: EngineOptions,
): Promise<Map<number, RepertoryRubric>> {
  const found = new Map<number, RepertoryRubric>();
  const add = (rows: RepertoryRubric[]) => { for (const r of rows) found.set(r.id, r); };
  const groups = wk.groups.slice(0, 5);   // the most informative words first
  const order = groups.length <= 2 ? "broad" : "narrow";

  add(await store.query({ groups, chapterPats, limit: 150, order }));
  if (found.size < o.enough && groups.length > 1) {
    // Too few rubrics hold ALL the words: try every pair of the most specific ones.
    const top = groups.slice(0, 4);
    const rest = await Promise.all(pairs(top).map((p) => store.query({ groups: p, chapterPats, limit: 60, order: "broad" })));
    rest.forEach(add);
  }
  if (found.size < o.enough) {
    const first = await Promise.all(groups.slice(0, 2).map((g) => store.query({ groups: [g], chapterPats, limit: 60, order: "broad" })));
    first.forEach(add);
  }
  return found;
}

function rankUnit(
  unit: number, wk: Weighted, found: Map<number, RepertoryRubric>, o: EngineOptions,
): RankedRepertoryRubric[] {
  const kw = wk.kw;
  // the best a rubric can do is match the three most informative words of the symptom
  const best = [...wk.w.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0) || 1;
  const ranked: Array<RankedRepertoryRubric & { _s: number }> = [];
  for (const r of found.values()) {
    const path = r.full_path.toLowerCase();
    const own = r.rubric_text.toLowerCase();
    let matched = 0, inOwn = 0, weight = 0;
    for (const g of kw.groups) {
      if (groupMatches(path, g)) { matched++; weight += wk.w.get(g.key)!; if (groupMatches(own, g)) inOwn++; }
    }
    if (!matched) continue;
    const modality = repertoryModality(path, kw.modalities);
    ranked.push({
      ...r, unit, matched,
      relevance: Math.min(1, weight / best),
      _s: weight * 10 + inOwn * 2 + modality * 4 + Math.min(r.depth, 5) * 0.2 - Math.log1p(r.n_remedies) * 0.3,
    });
  }
  ranked.sort((a, b) => b._s - a._s || a.id - b.id);

  let kept = ranked.slice(0, o.perUnit * 2);
  if (o.dropAncestors) {
    // a kept sub-rubric ("Mind > anxiety > night") makes its kept ancestor ("Mind > anxiety") redundant
    kept = kept.filter((a) => !kept.some((d) => d !== a && d.full_path.startsWith(a.full_path + " > ")));
  }
  return kept.slice(0, o.perUnit).map(({ _s, ...r }) => r);
}

/** Best rubrics for every symptom, de-duplicated across symptoms (a rubric found twice keeps its better match). */
export async function findRubrics(
  units: ExtractedKeywords[],
  store: RepertoryStore,
  chapterPats?: string[],
  options: Partial<EngineOptions> = {},
): Promise<RankedRepertoryRubric[]> {
  const o = { ...DEFAULT_OPTIONS, ...options };
  const perUnit = await Promise.all(units.map(async (kw, i) => {
    const wk = await weigh(kw, store);
    return rankUnit(i, wk, await candidates(wk, store, chapterPats, o), o);
  }));
  const best = new Map<number, RankedRepertoryRubric>();
  for (const list of perUnit) {
    const count = list.length;
    for (const r of list) {
      // a symptom with many rubrics must not out-vote one with a single rubric
      const share = count > o.unitCap ? Math.sqrt(o.unitCap / count) : 1;
      const weighted = { ...r, relevance: r.relevance * share };
      const old = best.get(r.id);
      if (!old || weighted.relevance > old.relevance) best.set(r.id, weighted);
    }
  }
  return Array.from(best.values());
}

// ── Scoring rows ──────────────────────────────────────────────────
function symptomType(chapter: string): "mental" | "general" | "particular" {
  const c = chapter.toLowerCase();
  if (c === "mind") return "mental";
  if (c === "generalities") return "general";
  return "particular";
}

export function toScoringRows(
  rubrics: RankedRepertoryRubric[], names: Map<string, string>, o: Partial<EngineOptions> = {},
): RubricRemedyRow[] {
  const { sizePenalty } = { ...DEFAULT_OPTIONS, ...o };
  const rows: RubricRemedyRow[] = [];
  for (const r of rubrics) {
    const size = 1 / (1 + sizePenalty * Math.log(Math.max(r.n_remedies, 1)));
    for (const [abbrev, grade] of Object.entries(r.remedies)) {
      const name = normalizeRemedyName(names.get(abbrev) || abbrev);
      if (!name) continue;
      rows.push({
        rubric_code:  String(r.id),
        rubric_label: r.full_path,
        body_system:  r.chapter,
        symptom_type: symptomType(r.chapter),
        weight:       0,            // scoreRemedies looks the weight up from symptom_type
        is_negative:  false,
        remedy_name:  name,
        grade,
        relevance:    r.relevance * size,
      });
    }
  }
  return rows;
}

export function toRubricMatches(rubrics: RankedRepertoryRubric[]): RubricMatch[] {
  return rubrics.map((r) => ({
    rubric_code:      String(r.id),
    label:            r.full_path,
    confidence:       r.relevance,
    original_symptom: r.full_path,
    is_eliminating:   false,
  }));
}

export type { KeywordGroup };
