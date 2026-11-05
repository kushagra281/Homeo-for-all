// server/utils/repertoryStore.ts
// DATA ACCESS for the graded repertory (tables repertory_sources / repertory_remedies / repertory_rubrics
// in the scraper database; created and filled by materia-medica-scraper's import_repertory.py).
//
// The rest of the code talks to the small RepertoryStore interface, so the engine and the
// repertorisation can be tested (and evaluated on the Trials) against an in-memory copy of the data.

import type { KeywordGroup } from "./keywords";
import { variantPatterns } from "./keywords";
import { scraperDB, fromCache, toCache, DbUnavailableError } from "./supabase";

/** A rubric as listed in the tree: no remedy list (those are loaded only for rubrics that are used). */
export interface RepertoryNode {
  id:          number;
  parent_id:   number | null;
  chapter:     string;
  rubric_text: string;
  full_path:   string;
  depth:       number;   // 0 = chapter
  n_remedies:  number;
  child_count: number;
}

export interface RepertoryRubric extends RepertoryNode {
  /** abbreviation as printed -> grade 1..3 */
  remedies: Record<string, number>;
}

export interface RepertorySource {
  slug:         string;
  title:        string;
  author:       string;
  year:         number | null;
  licence:      string;
  attribution:  string;
  note:         string;
  graded:       boolean;
  rubric_count: number;
  link_count:   number;
}

export interface RubricQuery {
  /** The rubric's path must match EVERY group (a group matches through any of its variants). */
  groups:       KeywordGroup[];
  /** Chapter name patterns (same syntax as utils/sections.ts); undefined = all chapters. */
  chapterPats?: string[];
  limit:        number;
  /** Which rows to keep when more than `limit` match. */
  order:        "narrow" | "broad";
}

export interface ByRemediesQuery { include: string[]; exclude?: string[]; minGrade?: number; limit?: number; offset?: number }
export interface RemedyRubricHit extends RepertoryNode {
  /** grade of each included remedy in this rubric */
  grades: Record<string, number>;
}

export interface RepertoryStore {
  sources():      Promise<RepertorySource[]>;
  /** abbreviation -> remedy name */
  remedyNames():  Promise<Map<string, string>>;
  query(q: RubricQuery):                        Promise<RepertoryRubric[]>;
  byIds(ids: number[]):                         Promise<RepertoryRubric[]>;
  /** children of a rubric; null = the chapters. */
  children(parentId: number | null, limit?: number): Promise<RepertoryNode[]>;
  /** Rubrics whose own path contains every word (for the search box of the Repertory page). */
  searchText(words: string[], limit: number, chapters?: string[]): Promise<RepertoryNode[]>;
  /**
   * Rubrics that hold ALL the included remedies (1-5, as abbreviations) and none of the excluded
   * ones, every included remedy at minGrade or higher. Narrowest rubric first.
   */
  byRemedies(q: ByRemediesQuery):               Promise<RemedyRubricHit[]>;
  /**
   * How many rubrics each group matches (rare words say more about a case than "pain"). Optional:
   * when it is missing or fails, every group counts the same. Also returns the number of rubrics.
   */
  groupFrequency?(groups: KeywordGroup[]): Promise<{ counts: number[]; total: number }>;
}

/** The book the app uses. Rubric ids of different books never clash (see id_base in the importer). */
export const DEFAULT_SOURCE = process.env.REPERTORY_SOURCE || "repertorium-publicum-2008";

// ── Chapter patterns ──────────────────────────────────────────────
// Same convention as sections.ts: "^ear" = starts with; anything else = contains.
export function chapterMatches(chapter: string, pats?: string[]): boolean {
  if (!pats?.length) return true;
  const c = chapter.toLowerCase();
  return pats.some((p) => (p.startsWith("^") ? c.startsWith(p.slice(1)) : c.includes(p)));
}

// ── Supabase implementation ───────────────────────────────────────
const NODE_COLS = "id, parent_id, chapter, rubric_text, full_path, depth, n_remedies, child_count";
const FULL_COLS = `${NODE_COLS}, remedies`;

function orFilter(column: string, g: KeywordGroup): string {
  const parts: string[] = [];
  for (const v of g.variants) for (const p of variantPatterns(v)) parts.push(`${column}.ilike.${p}`);
  return parts.join(",");
}

function chapterFilter(pats: string[]): string {
  return pats.map((p) => (p.startsWith("^") ? `chapter.ilike.${p.slice(1)}%` : `chapter.ilike.%${p}%`)).join(",");
}

/** Words that may be typed into the search box: letters and digits only, so they are safe in a filter. */
export function safeWords(text: string, max = 6): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{2,}/g) || []).slice(0, max);
}

export function supabaseRepertoryStore(source = DEFAULT_SOURCE): RepertoryStore {
  const db = () => scraperDB();
  const fail = (what: string, message: string): never => {
    throw new DbUnavailableError(`repertory ${what}: ${message}`);
  };

  return {
    async sources() {
      const hit = fromCache<RepertorySource[]>("rep:sources");
      if (hit) return hit;
      const { data, error } = await db().from("repertory_sources")
        .select("slug, title, author, year, licence, attribution, note, graded, rubric_count, link_count");
      if (error) fail("sources", error.message);
      const rows = (data || []) as RepertorySource[];
      if (rows.length) toCache("rep:sources", rows);
      return rows;
    },

    async remedyNames() {
      const hit = fromCache<Map<string, string>>("rep:names:" + source);
      if (hit) return hit;
      const map = new Map<string, string>();
      for (let from = 0; from < 20000; from += 1000) {   // PostgREST caps one response at 1000 rows
        const { data, error } = await db().from("repertory_remedies").select("abbrev, name").eq("source", source)
          .order("abbrev", { ascending: true }).range(from, from + 999);
        if (error) fail("remedies", error.message);
        for (const r of (data || []) as any[]) map.set(r.abbrev as string, r.name as string);
        if ((data || []).length < 1000) break;
      }
      if (map.size) toCache("rep:names:" + source, map);
      return map;
    },

    async query(q) {
      let req = db().from("repertory_rubrics").select(FULL_COLS).eq("source", source).gt("depth", 0);
      for (const g of q.groups) req = req.or(orFilter("full_path", g));
      if (q.chapterPats?.length) req = req.or(chapterFilter(q.chapterPats));
      req = req.order("n_remedies", { ascending: q.order === "narrow" }).order("id", { ascending: true });
      const { data, error } = await req.limit(q.limit);
      if (error) fail("query", error.message);
      return (data || []) as unknown as RepertoryRubric[];
    },

    async byIds(ids) {
      const wanted = Array.from(new Set(ids)).filter((n) => Number.isFinite(n)).slice(0, 200);
      const out: RepertoryRubric[] = [];
      for (let i = 0; i < wanted.length; i += 100) {
        const { data, error } = await db().from("repertory_rubrics").select(FULL_COLS)
          .eq("source", source).in("id", wanted.slice(i, i + 100));
        if (error) fail("byIds", error.message);
        out.push(...((data || []) as unknown as RepertoryRubric[]));
      }
      return out;
    },

    async children(parentId, limit = 500) {
      let req = db().from("repertory_rubrics").select(NODE_COLS).eq("source", source);
      req = parentId === null ? req.is("parent_id", null) : req.eq("parent_id", parentId);
      const { data, error } = await req.order("rubric_text", { ascending: true }).order("id", { ascending: true }).limit(limit);
      if (error) fail("children", error.message);
      return (data || []) as RepertoryNode[];
    },

    async byRemedies(q) {
      const include = Array.from(new Set(q.include)).slice(0, 5);
      if (!include.length) return [];
      const { data, error } = await db().rpc("repertory_rubrics_by_remedies", {
        p_source: source, p_include: include, p_exclude: Array.from(new Set(q.exclude || [])).slice(0, 50),
        p_min_grade: Math.min(3, Math.max(1, Math.round(q.minGrade || 1))),
        p_limit: Math.min(200, Math.max(1, Math.round(q.limit || 100))), p_offset: Math.max(0, Math.round(q.offset || 0)),
      });
      if (error) fail("by-remedies", error.message);
      return (data || []) as RemedyRubricHit[];
    },

    async groupFrequency(groups) {
      const total = (await this.sources()).find((x) => x.slug === source)?.rubric_count || 0;
      const counts = await Promise.all(groups.map(async (g) => {
        const key = "rep:df:" + source + ":" + g.variants.map((v) => v.text).join("|");
        const hit = fromCache<number>(key);
        if (hit !== null) return hit;
        const { count, error } = await db().from("repertory_rubrics")
          .select("id", { count: "exact", head: true }).eq("source", source).or(orFilter("full_path", g));
        if (error || count === null) fail("frequency", error?.message || "no count");
        toCache(key, count as number);
        return count as number;
      }));
      return { counts, total };
    },

    async searchText(words, limit, chapters) {
      if (!words.length) return [];
      let req = db().from("repertory_rubrics").select(NODE_COLS).eq("source", source).gt("depth", 0);
      if (chapters?.length) req = req.in("chapter", chapters);
      for (const w of words) req = req.ilike("full_path", `%${w}%`);
      const { data, error } = await req.order("depth", { ascending: true }).order("n_remedies", { ascending: false }).limit(limit);
      if (error) fail("search", error.message);
      return (data || []) as RepertoryNode[];
    },
  };
}

let _store: RepertoryStore | null = null;
/** The store the app uses (created on first use). Tests may replace it. */
export function repertoryStore(): RepertoryStore {
  return (_store ||= supabaseRepertoryStore());
}
export function setRepertoryStore(store: RepertoryStore | null): void {
  _store = store;
}
