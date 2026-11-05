// server/routes/repertory.ts
// REPERTORY ROUTES - browse the graded repertory and repertorise a case. HTTP layer only; the
// arithmetic is in services/repertorize.ts and the data access in utils/repertoryStore.ts.
//
// Read-only and public (the book is public reference material, like the other searches). If the
// tables are not loaded yet the routes answer 503 with a plain message instead of crashing.

import { Router, type Request, type Response } from "express";
import { rateLimit } from "../utils/rateLimit";
import { DbUnavailableError } from "../utils/supabase";
import { repertoryStore, safeWords, type RepertoryStore } from "../utils/repertoryStore";
import { repertorize, compareMethods, type Method, type SortBy, type Theme } from "../services/repertorize";
import { remedyProfile } from "../services/remedyProfile";
import { parseRelationships, resolveRelations } from "../services/remedyRelations";

const router = Router();
const readLimit = rateLimit({ name: "repertory", windowMs: 60_000, max: 120 });

export const MAX_CASE_RUBRICS = 30;

/** Lets the tests give the routes another store. */
let storeOverride: RepertoryStore | null = null;
export function useRepertoryStoreForTests(store: RepertoryStore | null) { storeOverride = store; }
const store = () => storeOverride || repertoryStore();

function fail(res: Response, e: unknown, what: string) {
  console.error(`[Route] repertory ${what}:`, (e as Error)?.message || e);
  if (e instanceof DbUnavailableError || /repertory|scraper/i.test(String((e as Error)?.message))) {
    return res.status(503).json({ message: "The graded repertory is not available right now (it may not be loaded into the database yet).", loaded: false });
  }
  return res.status(500).json({ message: "Something went wrong in the repertory" });
}

/** A positive whole number from a URL or body value; null when it is anything else. */
function toId(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,12}$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}


/** The options of a case, read defensively from a request body. */
function caseOptions(body: any) {
  const method: Method = body.method === "presence" || body.method === "emphasis" ? body.method : "grades";
  const sortBy: SortBy = body.sortBy === "coverage" ? "coverage" : "total";
  const coverTheme: Theme | undefined =
    body.coverTheme === "mental" || body.coverTheme === "general" || body.coverTheme === "particular" ? body.coverTheme : undefined;
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.filter((x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length < 24).slice(0, 100)
    : [];
  const weights: Record<number, number> = {};
  if (body.weights && typeof body.weights === "object" && !Array.isArray(body.weights)) {
    for (const [k, v] of Object.entries(body.weights)) {
      const id = toId(k);
      if (id && typeof v === "number") weights[id] = v;
    }
  }
  return {
    method, sortBy, coverTheme, exclude, weights,
    minGrade: typeof body.minGrade === "number" ? body.minGrade : 1,
    coverAll: body.coverAll === true,
  };
}

/** Validates the rubric list of a case; returns the ids, or sends the 400 itself and returns null. */
function caseIds(body: any, res: Response): number[] | null {
  const bad = (m: string) => { res.status(400).json({ message: m }); return null; };
  if (!Array.isArray(body.rubricIds)) return bad("rubricIds must be a list");
  const ids = Array.from(new Set(body.rubricIds.map(toId))) as Array<number | null>;
  if (ids.some((n) => n === null)) return bad("rubricIds must be positive whole numbers");
  if (ids.length === 0) return bad("choose at least one rubric");
  if (ids.length > MAX_CASE_RUBRICS) return bad(`a case can hold at most ${MAX_CASE_RUBRICS} rubrics`);
  return ids as number[];
}

/** The chosen rubrics in the order the practitioner chose them; null (after a 404) when none exist. */
async function loadCase(ids: number[], res: Response) {
  const found = await store().byIds(ids);
  const order = new Map(ids.map((id, i) => [id, i]));
  const rubrics = found.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  if (!rubrics.length) { res.status(404).json({ message: "none of those rubrics exist" }); return null; }
  return rubrics;
}

// GET /api/repertory/sources -> the books loaded, with the credit that must be shown
router.get("/sources", readLimit, async (_req: Request, res: Response) => {
  try { res.json(await store().sources()); } catch (e) { fail(res, e, "sources"); }
});

// GET /api/repertory/chapters
router.get("/chapters", readLimit, async (_req: Request, res: Response) => {
  try { res.json(await store().children(null)); } catch (e) { fail(res, e, "chapters"); }
});

// GET /api/repertory/children/:id
router.get("/children/:id", readLimit, async (req: Request, res: Response) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: "invalid rubric id" });
  try { res.json(await store().children(id)); } catch (e) { fail(res, e, "children"); }
});

// GET /api/repertory/search?q=anxiety night[&chapter=Mind,Head]  (chapter limits the search to those chapters)
router.get("/search", readLimit, async (req: Request, res: Response) => {
  const words = safeWords(typeof req.query.q === "string" ? req.query.q : "");
  if (!words.length) return res.json([]);
  const chapters = typeof req.query.chapter === "string"
    ? req.query.chapter.split(",").map((c) => c.trim()).filter((c) => c.length > 0 && c.length <= 40).slice(0, 8)
    : [];
  try { res.json(await store().searchText(words, 60, chapters)); } catch (e) { fail(res, e, "search"); }
});

// GET /api/repertory/rubric/:id -> one rubric with its remedies, strongest first
router.get("/rubric/:id", readLimit, async (req: Request, res: Response) => {
  const id = toId(req.params.id);
  if (!id) return res.status(400).json({ message: "invalid rubric id" });
  try {
    const [rubric] = await store().byIds([id]);
    if (!rubric) return res.status(404).json({ message: "rubric not found" });
    const names = await store().remedyNames();
    const remedies = Object.entries(rubric.remedies)
      .map(([abbrev, grade]) => ({ abbrev, name: names.get(abbrev) || abbrev, grade }))
      .sort((a, b) => b.grade - a.grade || a.name.localeCompare(b.name));
    res.json({ ...rubric, remedies });
  } catch (e) { fail(res, e, "rubric"); }
});

// GET /api/repertory/remedies -> every remedy of the book (abbreviation + name) for the pickers
router.get("/remedies", readLimit, async (_req: Request, res: Response) => {
  try {
    const names = await store().remedyNames();
    res.json(Array.from(names, ([abbrev, name]) => ({ abbrev, name })).sort((a, b) => a.name.localeCompare(b.name)));
  } catch (e) { fail(res, e, "remedies"); }
});

// POST /api/repertory/by-remedy
// { include: ["Sulph.","Calc."] (1-5), exclude?: ["Puls."], minGrade?: 1..3, limit?, offset? }
router.post("/by-remedy", readLimit, async (req: Request, res: Response) => {
  const body = req.body || {};
  const abbrevs = (v: unknown, max: number) => Array.isArray(v)
    ? Array.from(new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 24))).slice(0, max) : [];
  const include = abbrevs(body.include, 5);
  if (!include.length) return res.status(400).json({ message: "choose 1 to 5 remedies" });
  const num = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d;
  try {
    const known = await store().remedyNames();
    const unknown = include.filter((a) => !known.has(a));
    if (unknown.length) return res.status(400).json({ message: `unknown remedy: ${unknown.join(", ")}` });
    const rubrics = await store().byRemedies({
      include, exclude: abbrevs(body.exclude, 50), minGrade: num(body.minGrade, 1, 3, 1),
      limit: num(body.limit, 1, 200, 100), offset: num(body.offset, 0, 100000, 0),
    });
    res.json({ include: include.map((a) => ({ abbrev: a, name: known.get(a) || a })), rubrics });
  } catch (e) { fail(res, e, "by-remedy"); }
});

// POST /api/repertory/repertorize
// { rubricIds, weights?: {id: 1..3}, method?, minGrade?, coverAll?, coverTheme?, exclude?, sortBy?, limit? }
router.post("/repertorize", readLimit, async (req: Request, res: Response) => {
  const body = req.body || {};
  const ids = caseIds(body, res);
  if (!ids) return;
  try {
    const rubrics = await loadCase(ids, res);
    if (!rubrics) return;
    res.json(repertorize({
      rubrics, names: await store().remedyNames(), ...caseOptions(body),
      limit: typeof body.limit === "number" ? body.limit : 40,
    }));
  } catch (e) { fail(res, e, "repertorize"); }
});

// POST /api/repertory/compare  { rubricIds, weights?, minGrade?, coverAll?, coverTheme?, exclude? }
// The same case under all three methods: where each remedy ranks in each.
router.post("/compare", readLimit, async (req: Request, res: Response) => {
  const body = req.body || {};
  const ids = caseIds(body, res);
  if (!ids) return;
  const { method: _m, sortBy: _s, ...opts } = caseOptions(body);
  try {
    const rubrics = await loadCase(ids, res);
    if (!rubrics) return;
    res.json(compareMethods({ rubrics, names: await store().remedyNames(), ...opts }));
  } catch (e) { fail(res, e, "compare"); }
});

// GET /api/repertory/remedy/:abbrev -> the materia medica text of a remedy (404 when we have none)
router.get("/remedy/:abbrev", readLimit, async (req: Request, res: Response) => {
  const abbrev = String(req.params.abbrev || "");
  if (!abbrev || abbrev.length > 23) return res.status(400).json({ message: "invalid remedy" });
  try {
    const name = (await store().remedyNames()).get(abbrev);
    if (!name) return res.status(404).json({ message: "unknown remedy" });
    const profile = await remedyProfile(name);
    if (!profile) return res.status(404).json({ message: "no materia medica text for this remedy yet", name });
    const relText = profile.sections.find((x) => /^relationship/i.test(x.heading))?.content || "";
    const remedies = Array.from(await store().remedyNames(), ([a, n]) => ({ abbrev: a, name: n }));
    res.json({ abbrev, ...profile, relationships: resolveRelations(parseRelationships(relText), remedies, abbrev) });
  } catch (e) { fail(res, e, "remedy"); }
});

export default router;
