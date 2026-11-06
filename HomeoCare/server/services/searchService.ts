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

import { scoreRemedies, buildSafetyFlags, gradeToDosage, splitMatches } from "./scoringService";
import { repertoryMode, scoreWithRepertory, fuse } from "./repertorySearch";
import type { RemedyScore, SafetyFlag, Contradiction } from "./scoringService";
import {
  searchScraperRubrics,
  getRemediesForRubricIds,
  searchScraperRemedySymptoms,
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
import { expandSymptoms, translateSymptoms } from "./aiSynonyms";

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
  history_matches?:  string[];   // parts of the patient history this remedy also covers
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
  /** Remedies below the top five that still match the patient's mental symptoms (never hidden by a low total). */
  keynote_extra?: RemedyResult[];
  contradictions: Contradiction[];
  rubrics_used:   string[];
  rubric_count:   number;
  engine:         "scraper" | "remedy_symptoms" | "repertory" | "hybrid";
  history_considered?: string[];   // history phrases that were looked up
}

// ── Helpers ───────────────────────────────────────────────────────
function cleanSymptoms(symptoms: string[]): string[] {
  return symptoms.map((s) => s.toLowerCase().trim()).filter(
    (s) => s.length > 2 &&
      !s.startsWith("category:") && !s.startsWith("age:") &&
      !s.startsWith("gender:") && !s.startsWith("disease duration:")
  );
}

/** Takes the general symptoms out of the full list: what is left is the complaint. Each general is removed once, from the end (where the app puts them). */
export function splitGenerals(clean: string[], generals: string[]): { complaint: string[]; generals: string[] } {
  const complaint = [...clean], found: string[] = [];
  for (const g of generals) {
    const at = complaint.lastIndexOf(g);
    if (at >= 0) { complaint.splice(at, 1); found.push(g); }
  }
  return { complaint, generals: found };
}

// ── Patient history ───────────────────────────────────────────────
// History does NOT add new remedies: it only re-orders remedies that already match the
// complaint. A remedy that also appears under rubrics for the patient's existing conditions
// gets a small bonus (at most +24%), and the card says which condition it matched.
const NO_HISTORY = new Set(["", "none", "no", "nil", "normal", "n/a", "na", "-", "nothing"]);
const STRUCTURED_HISTORY: [keyof HealthProfile, string][] = [
  ["diabetes", "diabetes"], ["thyroid", "thyroid"], ["arthritis", "arthritis"],
  ["heart_disease", "heart"], ["kidney", "kidney"], ["depression_anxiety", "anxiety depression"],
];

export function historyPhrases(text?: string, profile?: HealthProfile): string[] {
  const parts: string[] = [];
  const addText = (v: unknown) => { if (typeof v === "string") parts.push(...v.slice(0, 600).split(/[,;\n]/)); };
  if (typeof text === "string" && text.trim()) {
    addText(text);
  } else if (profile) {
    addText(profile.chronic_conditions); addText(profile.other_conditions); addText(profile.injury_history);
    for (const [key, label] of STRUCTURED_HISTORY) {
      const v = profile[key];
      if (typeof v === "string" && !NO_HISTORY.has(v.trim().toLowerCase())) parts.push(label);
    }
  }
  return [...new Set(
    parts.map((p) => p.trim().toLowerCase()).filter((p) => p.length >= 3 && p.length <= 60 && !NO_HISTORY.has(p))
  )].slice(0, 4);
}

async function remediesForHistory(phrases: string[]): Promise<Map<string, Set<string>>> {
  const byRemedy = new Map<string, Set<string>>();
  for (const phrase of phrases) {
    const hk = extractKeywords([phrase]);
    if (!hk.groups.length) continue;
    const rubrics = (await searchScraperRubrics(hk, undefined)).slice(0, 15);
    if (!rubrics.length) continue;
    const rows = await getRemediesForRubricIds(rubrics.map((r) => r.id));
    for (const row of rows) {
      const name = normalizeRemedyName(row.remedy_name);
      if (!name) continue;
      if (!byRemedy.has(name)) byRemedy.set(name, new Set());
      byRemedy.get(name)!.add(phrase);
    }
  }
  return byRemedy;
}

function applyHistory<T extends RemedyScore & { history_matches?: string[] }>(
  remedies: T[], byRemedy: Map<string, Set<string>>
): T[] {
  const top = remedies.slice(0, 10);
  let max = 0;
  for (const r of top) {
    const hits = [...(byRemedy.get(normalizeRemedyName(r.remedy_name)) || [])];
    if (hits.length) {
      r.history_matches = hits;
      r.score = r.score * (1 + 0.08 * Math.min(hits.length, 3));
    }
    max = Math.max(max, r.score);
  }
  if (max > 0) for (const r of top) r.score = Math.round((r.score / max) * 100);
  top.sort((a, b) => b.score - a.score);
  return [...top, ...remedies.slice(10)];
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function emptyResult(engine: SearchResult["engine"]): SearchResult {
  return { remedies: [], alternatives: [], contradictions: [], rubrics_used: [], rubric_count: 0, engine };
}

function formatResult(entry: RemedyScore & { history_matches?: string[] }, profile?: HealthProfile): RemedyResult {
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
    history_matches:   entry.history_matches,
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
      weight:       r.symptom_type === "mental" || r.symptom_type === "mind" ? 3 : r.symptom_type === "general" ? 2 : 1,
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
  healthHistory?: string;
  /** The general symptoms (chilly, thirst, sleep...) that are also in `symptoms`; the rest of `symptoms` is the complaint. */
  generals?: string[];
}): Promise<SearchResult> {
  const { symptoms, filters, healthProfile, healthHistory } = input;
  const clean = cleanSymptoms(symptoms);
  if (!clean.length) return emptyResult("scraper");
  const { complaint, generals: generalsClean } = splitGenerals(clean, cleanSymptoms(input.generals || []));

  // Optional AI help: extra search words for the patient's wording. {} when off, slow or failing.
  // Symptoms typed in another script (Devanagari...) have no Latin words to search: the AI turns them
  // into English words, searched in addition. Synonym expansion only reads Latin words, so it is
  // skipped for input with none; when both apply they run together (one wait, not two).
  const hasLatin = clean.some((s) => /[a-z]{3}/.test(s));
  const [extra, english] = await Promise.all([
    hasLatin ? expandSymptoms(clean) : Promise.resolve({}),
    translateSymptoms(clean),
  ]);
  // Joined with spaces (not commas) so a modality word stays with what it modifies:
  // "headache worse night" keeps worse -> night.
  const kw = extractKeywords(english.length ? [...clean, english.join(" ")] : clean, 12, extra);
  if (!kw.groups.length) return emptyResult("scraper");

  const section = filters.symptom_location || filters.category || undefined;
  const sectionPats = sectionPatterns(section);
  console.log(`[Search] Input symptoms:`, clean);
  console.log(
    `[Search] keywords=[${kw.groups.map((g) => g.key).join(", ")}] modalities=[${kw.modalities.map((m) => `${m.dir} ${m.key}`).join(", ")}] ` +
    `section=${section || "any"} → [${sectionPats?.join(", ") || "no filter"}]`
  );

  let dbError: any = null;

  // ── STEP 1: ranked rubrics → scoring ─────────────────────────
  // REPERTORY_ENGINE=on|hybrid also searches the graded repertory (see repertorySearch.ts); "off" (the
  // default) changes nothing. A failure of the repertory never breaks the search.
  const mode = repertoryMode();
  const repPromise = mode === "off"
    ? Promise.resolve(null)
    : scoreWithRepertory(english.length ? [...complaint, english.join(" ")] : complaint, extra, sectionPats, undefined, generalsClean)
        .catch((e: any) => { console.error("[Search] graded repertory failed:", e?.message || e); return null; });

  type Scored = {
    remedies: RemedyScore[]; contradictions: Contradiction[];
    rubricTexts: string[]; rubricCount: number; engine: SearchResult["engine"];
  };
  let scored: Scored | null = null;

  try {
    if (mode === "on") {
      const rep = await repPromise;
      if (rep && rep.remedies.length >= 2) {
        scored = {
          remedies: rep.remedies, contradictions: rep.contradictions,
          rubricTexts: rep.rubrics.slice(0, 10).map((r) => r.full_path), rubricCount: rep.rubrics.length, engine: "repertory",
        };
      }
    }
    if (!scored) {
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
            scored = {
              remedies, contradictions,
              rubricTexts: rubrics.slice(0, 10).map((r) => r.rubric_text), rubricCount: rubrics.length, engine: "scraper",
            };
          }
        }
      }
    }
  } catch (e: any) {
    dbError = e;
    console.error("[Search] scraper rubric engine failed:", e?.message || e);
  }

  if (mode === "hybrid") {
    const rep = await repPromise;
    if (rep && rep.remedies.length >= 2) {
      scored = scored
        ? {
            remedies: fuse(scored.remedies, rep.remedies), contradictions: scored.contradictions,
            rubricTexts: [...scored.rubricTexts.slice(0, 5), ...rep.rubrics.slice(0, 5).map((r) => r.full_path)],
            rubricCount: scored.rubricCount + rep.rubrics.length, engine: "hybrid",
          }
        : {
            remedies: rep.remedies, contradictions: rep.contradictions,
            rubricTexts: rep.rubrics.slice(0, 10).map((r) => r.full_path), rubricCount: rep.rubrics.length, engine: "repertory",
          };
      dbError = null;   // the repertory answered, so an error from the other engine no longer matters
    }
  }

  if (scored) {
    const { remedies, contradictions } = scored;
    // Patient history: re-order the matches (never adds remedies). Optional - a failure here
    // must not break the search.
    const phrases = historyPhrases(healthHistory, healthProfile);
    let ordered: (RemedyScore & { history_matches?: string[] })[] = remedies;
    if (phrases.length) {
      try { ordered = applyHistory(remedies, await remediesForHistory(phrases)); }
      catch (e: any) { console.error("[Search] patient history lookup failed:", e?.message || e); }
    }
    const top3 = ordered.slice(0, 3).map((r) => formatResult(r, healthProfile));
    const alts = ordered.slice(3, 5).map((r) => formatResult(r, healthProfile));
    const keynoteExtra = ordered.slice(5)
      .filter((r) => splitMatches(r.covered_rubrics).keynote)
      .slice(0, 3)
      .map((r) => formatResult(r, healthProfile));
    console.log(`[Search] ${scored.engine} engine: ${remedies.length} results, top=${remedies[0]?.remedy_name}`);
    return {
      remedies: top3, alternatives: alts, keynote_extra: keynoteExtra, contradictions,
      rubrics_used: scored.rubricTexts,
      rubric_count: scored.rubricCount, engine: scored.engine,
      history_considered: phrases,
    };
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

  // (There used to be a third step reading the main database's `symptoms` table. That table holds
  // 15,000 generated rows - the same templated sentence attached to many different remedies - so it
  // produced invented suggestions. It is no longer read.)

  // Nothing found anywhere. If a database call failed along the way, say so
  // (the route returns HTTP 500, the UI shows "Something went wrong") instead of
  // pretending the symptoms simply have no remedies.
  if (dbError) throw dbError;
  return emptyResult("remedy_symptoms");
}
