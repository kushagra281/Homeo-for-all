// server/services/repertorize.ts
// REPERTORISATION of a case the practitioner built by choosing rubrics: a remedy x rubric grid with
// totals. Pure functions - no database, no AI - so the numbers can be checked by hand.
//
//   method "grades"   a remedy scores its printed grade in a rubric (1, 2 or 3)
//   method "presence" a remedy scores 1 in every rubric it appears in, whatever the grade
//   method "emphasis" grade squared (1, 4, 9): strongly marked remedies count much more
//
// Each rubric can be given a weight (1 normal, 2 important, 3 key symptom) that multiplies its scores.

import type { RepertoryRubric } from "../utils/repertoryStore";

export type Method = "grades" | "presence" | "emphasis";
export type SortBy = "total" | "coverage";
/** Kent's order of importance: the mind first, then the person as a whole, then the particular parts. */
export type Theme = "mental" | "general" | "particular";

export function themeOf(chapter: string): Theme {
  const c = chapter.trim().toLowerCase();
  if (c === "mind") return "mental";
  if (c === "generalities") return "general";
  return "particular";
}

export interface RepertorizeInput {
  rubrics:   RepertoryRubric[];
  /** rubric id -> weight 1..3 (missing = 1) */
  weights?:  Record<number, number>;
  method?:   Method;
  /** links below this grade are ignored (1 = use all) */
  minGrade?: number;
  /** only remedies that appear in EVERY chosen rubric */
  coverAll?: boolean;
  /** abbreviations to leave out */
  exclude?:  string[];
  sortBy?:   SortBy;
  /** only remedies that appear in EVERY chosen rubric of this theme (generals gather, peculiars narrow) */
  coverTheme?: Theme;
  limit?:    number;
  names:     Map<string, string>;
}

export interface GridRow {
  abbrev:  string;
  name:    string;
  total:   number;
  covered: number;
  /** the total split by theme */
  themes:  Record<Theme, number>;
  /** grade in each chosen rubric, in the order of `rubrics` (0 = not in that rubric) */
  grades:  number[];
}

export interface RepertorizeResult {
  rubrics:        Array<{ id: number; full_path: string; n_remedies: number; weight: number; theme: Theme }>;
  rows:           GridRow[];
  /** remedies that passed the filters, before the limit */
  total_remedies: number;
  method:         Method;
  min_grade:      number;
}

const clampInt = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.min(hi, Math.max(lo, v));
};

export function gradeValue(grade: number, method: Method): number {
  if (method === "presence") return 1;
  if (method === "emphasis") return grade * grade;
  return grade;
}

export function repertorize(input: RepertorizeInput): RepertorizeResult {
  const method: Method = input.method === "presence" || input.method === "emphasis" ? input.method : "grades";
  const minGrade = clampInt(input.minGrade, 1, 3, 1);
  const exclude = new Set(input.exclude || []);
  const rubrics = input.rubrics;
  const weights = rubrics.map((r) => clampInt(input.weights?.[r.id], 1, 3, 1));

  const rowsByRemedy = new Map<string, GridRow>();
  rubrics.forEach((r, i) => {
    for (const [abbrev, grade] of Object.entries(r.remedies)) {
      if (grade < minGrade || exclude.has(abbrev)) continue;
      let row = rowsByRemedy.get(abbrev);
      if (!row) {
        row = { abbrev, name: input.names.get(abbrev) || abbrev, total: 0, covered: 0, themes: { mental: 0, general: 0, particular: 0 }, grades: new Array(rubrics.length).fill(0) };
        rowsByRemedy.set(abbrev, row);
      }
      row.grades[i] = grade;
      row.covered += 1;
      const points = gradeValue(grade, method) * weights[i];
      row.total += points;
      row.themes[themeOf(r.chapter)] += points;
    }
  });

  let rows = Array.from(rowsByRemedy.values());
  if (input.coverAll) rows = rows.filter((r) => r.covered === rubrics.length);
  if (input.coverTheme) {
    const idx = rubrics.map((r, i) => (themeOf(r.chapter) === input.coverTheme ? i : -1)).filter((i) => i >= 0);
    rows = rows.filter((r) => idx.every((i) => r.grades[i] > 0));
  }

  const byTotal    = (a: GridRow, b: GridRow) => b.total - a.total || b.covered - a.covered || a.name.localeCompare(b.name);
  const byCoverage = (a: GridRow, b: GridRow) => b.covered - a.covered || b.total - a.total || a.name.localeCompare(b.name);
  rows.sort(input.sortBy === "coverage" ? byCoverage : byTotal);

  const limit = clampInt(input.limit, 1, 200, 40);
  return {
    rubrics: rubrics.map((r, i) => ({ id: r.id, full_path: r.full_path, n_remedies: r.n_remedies, weight: weights[i], theme: themeOf(r.chapter) })),
    rows: rows.slice(0, limit),
    total_remedies: rows.length,
    method,
    min_grade: minGrade,
  };
}

// ── The same case under every method, side by side ────────────────
export interface MethodComparison {
  methods: Method[];
  /** union of each method's top remedies; rank is 1-based within that method (0 = not in its top) */
  rows: Array<{ abbrev: string; name: string; covered: number; scores: Record<Method, number>; ranks: Record<Method, number>; best_rank: number }>;
}

export function compareMethods(input: Omit<RepertorizeInput, "method" | "limit">, top = 8): MethodComparison {
  const methods: Method[] = ["grades", "presence", "emphasis"];
  const per = methods.map((m) => ({ m, all: repertorize({ ...input, method: m, limit: 200 }).rows }));
  const table = new Map<string, MethodComparison["rows"][number]>();
  for (const { m, all } of per) {
    all.forEach((row, i) => {
      let t = table.get(row.abbrev);
      if (!t) {
        t = { abbrev: row.abbrev, name: row.name, covered: row.covered, scores: { grades: 0, presence: 0, emphasis: 0 }, ranks: { grades: 0, presence: 0, emphasis: 0 }, best_rank: 0 };
        table.set(row.abbrev, t);
      }
      t.scores[m] = row.total;
      t.ranks[m] = i + 1;
    });
  }
  const keep = Array.from(table.values()).filter((t) => methods.some((m) => t.ranks[m] >= 1 && t.ranks[m] <= top));
  for (const t of keep) t.best_rank = Math.min(...methods.map((m) => t.ranks[m] || Infinity));
  keep.sort((a, b) => a.best_rank - b.best_rank || b.scores.grades - a.scores.grades || a.name.localeCompare(b.name));
  return { methods, rows: keep };
}
