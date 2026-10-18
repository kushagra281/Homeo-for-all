// server/utils/supabase.ts
// DATA ACCESS LAYER — manages TWO Supabase clients:
//   mainDB()    → zlsinlcskirptxgqkzuw  (patients, profiles, history)
//   scraperDB() → rtfjnfepikhahzospnqq  (rubrics×17755, rubric_remedies×23564, remedy_symptoms×17678)

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  type ExtractedKeywords,
  type KeywordGroup,
  variantPatterns,
  groupMatches,
  modalityScore,
} from "./keywords";

// ── Cache (rubric data is static — safe to cache 15 min) ─────────
// Only non-empty, successful results are ever stored (see callers), so a
// transient DB failure can no longer be cached as "no answer".
const _cache = new Map<string, { value: any; ts: number }>();
const TTL = 15 * 60 * 1000;
export function fromCache<T>(key: string): T | null {
  const h = _cache.get(key);
  if (!h || Date.now() - h.ts > TTL) { _cache.delete(key); return null; }
  return h.value as T;
}
export function toCache(key: string, value: any) {
  _cache.set(key, { value, ts: Date.now() });
}

/** Thrown when every query against a database failed (paused project, bad key, network). */
export class DbUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbUnavailableError";
  }
}

// ── Main DB ───────────────────────────────────────────────────────
let _main: SupabaseClient | null = null;
export function mainDB(): SupabaseClient {
  if (_main) return _main;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !key) throw new Error("Main SUPABASE_URL / SUPABASE_ANON_KEY missing");
  _main = createClient(url, key);
  return _main;
}

// ── Scraper DB ────────────────────────────────────────────────────
let _scraper: SupabaseClient | null = null;
export function scraperDB(): SupabaseClient {
  if (_scraper) return _scraper;
  const url = process.env.SCRAPER_SUPABASE_URL || "";
  const key = process.env.SCRAPER_SUPABASE_KEY || "";
  if (!url || !key) {
    // Querying the main DB for rubric tables can never work — fail loudly instead.
    throw new DbUnavailableError("SCRAPER_SUPABASE_URL / SCRAPER_SUPABASE_KEY are not set");
  }
  _scraper = createClient(url, key);
  console.log("[DB] Scraper DB connected:", url);
  return _scraper;
}

// ================================================================
// SCRAPER DB — rubrics schema:
//   rubrics(id int, parent_id int, section text, rubric_text text,
//           full_path text, depth int, symptom_type text, is_eliminating bool)
//   rubric_remedies(id int, rubric_id int, remedy_id int,
//                   remedy_name text, grade int, source text)
//   remedy_symptoms(id int, remedy_id int, remedy_name text,
//                   heading text, symptom text, symptom_order int)
// ================================================================

export interface ScraperRubric {
  id:             number;
  parent_id:      number | null;
  section:        string;
  rubric_text:    string;
  full_path:      string;
  depth:          number;
  symptom_type:   string;   // 'mental' | 'general' | 'particular'
  is_eliminating: boolean;
}

/** A rubric plus how well it matches the patient's keywords. */
export interface RankedRubric extends ScraperRubric {
  matched:   number;   // how many of the patient's keyword groups this rubric matches
  relevance: number;   // 0–1, used to weight the rubric in scoring
}

export interface ScraperRemedyRow {
  rubric_id:    number;
  rubric_text:  string;
  full_path:    string;
  section:      string;
  symptom_type: string;
  depth:        number;
  remedy_name:  string;
  grade:        number;
}

// ── Query helpers ─────────────────────────────────────────────────
/** PostgREST or-filter: any column ILIKE any variant of any given group. */
function orFilter(columns: string[], groups: KeywordGroup[]): string {
  const parts: string[] = [];
  for (const g of groups)
    for (const v of g.variants)
      for (const p of variantPatterns(v))
        for (const c of columns) parts.push(`${c}.ilike.${p}`);
  return parts.join(",");
}

function sectionFilter(column: string, patterns: string[]): string {
  // "^male" = section must START with "male" (so it does not also match "Female");
  // "^ear" must not match "Heart". Everything else is a contains-match.
  return patterns.map((p) => (p.startsWith("^") ? `${column}.ilike.${p.slice(1)}%` : `${column}.ilike.%${p}%`)).join(",");
}

async function pool<T>(tasks: Array<() => Promise<T>>, size = 6): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      out[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, worker));
  return out;
}

interface GroupSearchOptions {
  db:          SupabaseClient;
  table:       string;
  select:      string;
  textCols:    string[];
  sectionCol?: string;
  sectionPats?: string[];
  kw:          ExtractedKeywords;
  perQuery:    number;
  label:       string;
  orderBy?:    { column: string; ascending: boolean };
  notNullCol?: string;
}

/**
 * Searches a table for every keyword group (one query per group, OR over its
 * variants) PLUS a few "must match two keywords" queries for the most specific
 * pairs, so rows matching several of the patient's words are not drowned out by
 * the thousands of rows matching one common word.
 * If a section filter returns nothing, the whole search is retried without it.
 * Throws DbUnavailableError when every query failed.
 */
async function searchByGroups<T>(o: GroupSearchOptions): Promise<T[]> {
  let queries = 0;
  let failures = 0;
  let lastError = "";

  const run = async (groups: KeywordGroup[], mode: "any" | "all", useSection: boolean): Promise<T[]> => {
    let q = o.db.from(o.table).select(o.select);
    if (o.notNullCol) q = q.not(o.notNullCol, "is", null);
    if (mode === "any") q = q.or(orFilter(o.textCols, groups));
    else for (const g of groups) q = q.or(orFilter(o.textCols, [g]));   // AND of ORs
    if (useSection && o.sectionCol && o.sectionPats?.length) q = q.or(sectionFilter(o.sectionCol, o.sectionPats));
    if (o.orderBy) q = q.order(o.orderBy.column, { ascending: o.orderBy.ascending });
    queries++;
    const { data, error } = await q.limit(o.perQuery);
    if (error) {
      failures++;
      lastError = error.message;
      console.error(`[DB] ${o.label}:`, error.message);
      return [];
    }
    return (data || []) as unknown as T[];
  };

  const specific = [...o.kw.groups].sort((a, b) => b.key.length - a.key.length).slice(0, 4);
  const pairs: KeywordGroup[][] = [];
  for (let i = 0; i < specific.length; i++)
    for (let j = i + 1; j < specific.length; j++) pairs.push([specific[i], specific[j]]);

  const plan = [
    ...o.kw.groups.map((g) => ({ groups: [g], mode: "any" as const })),
    ...pairs.slice(0, 4).map((p) => ({ groups: p, mode: "all" as const })),
  ];

  const execute = async (useSection: boolean): Promise<T[]> =>
    (await pool(plan.map((p) => () => run(p.groups, p.mode, useSection)), 6)).flat();

  let rows = await execute(true);
  if (!rows.length && o.sectionPats?.length) {
    console.log(`[DB] ${o.label}: nothing in section [${o.sectionPats.join(", ")}] — retrying without section filter`);
    rows = await execute(false);
  }

  if (queries > 0 && failures === queries) {
    throw new DbUnavailableError(`${o.label}: all ${queries} queries failed (${lastError})`);
  }
  return rows;
}

// ── Rubric search ─────────────────────────────────────────────────
const RUBRIC_COLS = "id, parent_id, section, rubric_text, full_path, depth, symptom_type, is_eliminating";
const MAX_RUBRICS = 80;

/**
 * Finds rubrics for the patient's keywords and RANKS them by how many of the
 * keywords each rubric matches (rubric_text matches count extra; modality
 * agreement like "worse at night" adds a bonus). Returns the best MAX_RUBRICS.
 */
export async function searchScraperRubrics(
  kw: ExtractedKeywords,
  sectionPats?: string[]
): Promise<RankedRubric[]> {
  if (!kw.groups.length) return [];

  const cacheKey = "sr2:" + JSON.stringify([
    kw.groups.map((g) => g.variants.map((v) => v.text)),
    kw.modalities,
    sectionPats || null,
  ]);
  const cached = fromCache<RankedRubric[]>(cacheKey);
  if (cached) return cached;

  console.log(`[DB] Scraper rubric keywords:`, kw.groups.map((g) => g.key).join(", "));

  const rows = await searchByGroups<ScraperRubric>({
    db: scraperDB(),
    table: "rubrics",
    select: RUBRIC_COLS,
    textCols: ["rubric_text", "full_path"],
    sectionCol: "section",
    sectionPats,
    kw,
    perQuery: 150,
    label: "searchScraperRubrics",
    orderBy: { column: "depth", ascending: false },
  });

  // Deduplicate by id
  const byId = new Map<number, ScraperRubric>();
  for (const r of rows) if (!byId.has(r.id)) byId.set(r.id, r);

  const total = kw.groups.length;
  const ranked: Array<RankedRubric & { _score: number }> = [];
  for (const r of Array.from(byId.values())) {
    // A rubric flagged as "eliminating" is a negated symptom; the patient did not deny anything, so never use it.
    if (r.is_eliminating) continue;

    const own  = (r.rubric_text || "").toLowerCase();
    const text = `${own} ${(r.full_path || "").toLowerCase()}`;
    let matched = 0;
    let inOwnText = 0;
    for (const g of kw.groups) {
      if (groupMatches(text, g)) {
        matched++;
        if (groupMatches(own, g)) inOwnText++;
      }
    }
    if (!matched) continue;   // matched only through SQL substring noise

    const modality = modalityScore(text, kw.modalities);
    ranked.push({
      ...r,
      matched,
      relevance: Math.min(1, matched / Math.min(total, 3)),
      _score: matched * 10 + inOwnText * 3 + modality * 2 + Math.min(r.depth || 0, 5) * 0.1,
    });
  }

  ranked.sort((a, b) => b._score - a._score);
  const top: RankedRubric[] = ranked.slice(0, MAX_RUBRICS).map(({ _score, ...r }) => r);

  console.log(`[DB] ${byId.size} candidate rubrics → kept top ${top.length} (best matches ${top[0]?.matched ?? 0}/${total} keywords)`);
  if (top.length) toCache(cacheKey, top);
  return top;
}

// ── Remedies for rubrics ──────────────────────────────────────────
const PAGE = 1000;   // PostgREST default max rows per response
const CHUNK = 100;   // rubric ids per request

const RR_JOIN = `
  rubric_id,
  remedy_name,
  grade,
  rubrics!inner (
    rubric_text,
    full_path,
    section,
    symptom_type,
    depth
  )
`;

async function fetchChunkJoin(db: SupabaseClient, chunk: number[]): Promise<ScraperRemedyRow[]> {
  const out: ScraperRemedyRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("rubric_remedies")
      .select(RR_JOIN)
      .in("rubric_id", chunk)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const r of (data || []) as any[]) {
      const rub = Array.isArray(r.rubrics) ? r.rubrics[0] : r.rubrics;
      out.push({
        rubric_id:    r.rubric_id,
        rubric_text:  rub?.rubric_text || "",
        full_path:    rub?.full_path || "",
        section:      rub?.section || "",
        symptom_type: rub?.symptom_type || "particular",
        depth:        rub?.depth || 1,
        remedy_name:  r.remedy_name,
        grade:        r.grade,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function fetchChunkTwoQuery(db: SupabaseClient, chunk: number[]): Promise<ScraperRemedyRow[]> {
  const rubricsRes = await db
    .from("rubrics")
    .select("id, rubric_text, full_path, section, symptom_type, depth")
    .in("id", chunk);
  if (rubricsRes.error) throw new DbUnavailableError(`rubrics lookup failed: ${rubricsRes.error.message}`);
  const rubricMap = new Map<number, any>((rubricsRes.data || []).map((r: any) => [r.id, r]));

  const out: ScraperRemedyRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("rubric_remedies")
      .select("rubric_id, remedy_name, grade")
      .in("rubric_id", chunk)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new DbUnavailableError(`rubric_remedies lookup failed: ${error.message}`);
    for (const r of (data || []) as any[]) {
      const rub = rubricMap.get(r.rubric_id) || {};
      out.push({
        rubric_id:    r.rubric_id,
        rubric_text:  rub.rubric_text || "",
        full_path:    rub.full_path || "",
        section:      rub.section || "",
        symptom_type: rub.symptom_type || "particular",
        depth:        rub.depth || 1,
        remedy_name:  r.remedy_name,
        grade:        r.grade,
      });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * Fetch remedy-rubric rows for given rubric IDs.
 * Requests are chunked and paginated, so no rows are silently dropped by the
 * API's per-response row cap. Uses a JOIN and falls back to two queries.
 */
export async function getRemediesForRubricIds(rubricIds: number[]): Promise<ScraperRemedyRow[]> {
  if (!rubricIds.length) return [];

  const ids = Array.from(new Set(rubricIds)).sort((a, b) => a - b);
  const cacheKey = `rr2:${ids.join(",")}`;
  const cached = fromCache<ScraperRemedyRow[]>(cacheKey);
  if (cached) return cached;

  const db = scraperDB();
  const rows: ScraperRemedyRow[] = [];
  let useJoin = true;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    if (useJoin) {
      try {
        rows.push(...(await fetchChunkJoin(db, chunk)));
        continue;
      } catch (e: any) {
        console.warn("[DB] JOIN failed, using two-query fallback:", e?.message);
        useJoin = false;
      }
    }
    rows.push(...(await fetchChunkTwoQuery(db, chunk)));
  }

  console.log(`[DB] ${rows.length} rubric_remedy rows fetched for ${ids.length} rubrics`);
  if (rows.length) toCache(cacheKey, rows);
  return rows;
}

// ── remedy_symptoms (materia medica sentences) ────────────────────
export interface RemedySymptomRow {
  remedy_name: string;
  heading:     string;
  symptom:     string;
}

/** Search remedy_symptoms in scraper DB. */
export async function searchScraperRemedySymptoms(
  kw: ExtractedKeywords,
  sectionPats?: string[]
): Promise<RemedySymptomRow[]> {
  if (!kw.groups.length) return [];
  const rows = await searchByGroups<RemedySymptomRow>({
    db: scraperDB(),
    table: "remedy_symptoms",
    select: "remedy_name, heading, symptom",
    textCols: ["symptom"],
    sectionCol: "heading",
    sectionPats,
    kw,
    perQuery: 400,
    label: "searchScraperRemedySymptoms",
    notNullCol: "remedy_name",
  });
  console.log(`[DB] remedy_symptoms found ${rows.length} rows`);
  return rows.filter((r) => r.remedy_name);
}

// ================================================================
// MAIN DB QUERIES
// ================================================================

export async function fetchProfile(userId: string): Promise<any | null> {
  const { data, error } = await mainDB().from("patients").select("*").eq("id", userId).single();
  if (error?.code === "PGRST116") return null;
  if (error) console.error("[DB] fetchProfile:", error.message);
  return data || null;
}

export async function upsertProfileRow(userId: string, email: string, profile: Record<string, any>): Promise<void> {
  // Build safe profile object — only include columns that are not undefined/null empty
  const safeProfile: Record<string, any> = { id: userId, email, updated_at: new Date().toISOString() };

  const ALLOWED_COLUMNS = [
    "name","age","gender","height_cm","weight_kg","blood_group",
    "diabetes","blood_pressure","obesity","cholesterol","thyroid","asthma",
    "allergy","gastritis","constipation","pcod","arthritis","kidney",
    "heart_disease","migraine","skin_condition","depression_anxiety","hair_fall",
    "injury_history","other_conditions","chronic_conditions","current_medications",
    "dietary_preference","health_notes",
  ];

  for (const col of ALLOWED_COLUMNS) {
    if (profile[col] !== undefined && profile[col] !== null) {
      safeProfile[col] = profile[col];
    }
  }

  console.log("[DB] Upserting profile for userId:", userId, "columns:", Object.keys(safeProfile).length);

  const { error } = await mainDB().from("patients").upsert(safeProfile, { onConflict: "id" });
  if (error) {
    // If error is about missing column, retry without that column
    if (error.message.includes("column") && error.message.includes("does not exist")) {
      const col = error.message.match(/"([^"]+)"/)?.[1];
      if (col) {
        console.warn(`[DB] Column ${col} missing — retrying without it`);
        delete safeProfile[col];
        const { error: error2 } = await mainDB().from("patients").upsert(safeProfile, { onConflict: "id" });
        if (error2) throw new Error(error2.message);
        return;
      }
    }
    throw new Error(error.message);
  }
}

export async function insertSearchHistory(patientId: string, symptoms: string[], rubricsUsed: string[], results: any[], confidence: number): Promise<void> {
  const { error } = await mainDB().from("search_history").insert({ patient_id: patientId, symptoms, rubrics_used: rubricsUsed, results, confidence });
  if (error) console.error("[DB] insertSearchHistory:", error.message);
}

export async function fetchSearchHistory(patientId: string): Promise<any[]> {
  const { data, error } = await mainDB().from("search_history")
    .select("id, symptoms, rubrics_used, results, confidence, created_at")
    .eq("patient_id", patientId).order("created_at", { ascending: false }).limit(20);
  if (error) { console.error("[DB] fetchSearchHistory:", error); return []; }
  return data || [];
}

// Legacy fallback
export async function fetchLegacySymptoms(kw: ExtractedKeywords, sectionPats?: string[]): Promise<any[]> {
  if (!kw.groups.length) return [];
  return searchByGroups<any>({
    db: mainDB(),
    table: "symptoms",
    select: "remedy, symptom, category, intensity",
    textCols: ["symptom"],
    sectionCol: "category",
    sectionPats,
    kw,
    perQuery: 300,
    label: "fetchLegacySymptoms",
  });
}
