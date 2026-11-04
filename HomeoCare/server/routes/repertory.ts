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
import { repertorize, type Method, type SortBy } from "../services/repertorize";

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

// GET /api/repertory/search?q=anxiety night
router.get("/search", readLimit, async (req: Request, res: Response) => {
  const words = safeWords(typeof req.query.q === "string" ? req.query.q : "");
  if (!words.length) return res.json([]);
  try { res.json(await store().searchText(words, 60)); } catch (e) { fail(res, e, "search"); }
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

// POST /api/repertory/repertorize
// { rubricIds: number[], weights?: {id: 1..3}, method?, minGrade?, coverAll?, exclude?: string[], sortBy?, limit? }
router.post("/repertorize", readLimit, async (req: Request, res: Response) => {
  const body = req.body || {};
  if (!Array.isArray(body.rubricIds)) return res.status(400).json({ message: "rubricIds must be a list" });
  const ids = Array.from(new Set(body.rubricIds.map(toId))) as Array<number | null>;
  if (ids.some((n) => n === null)) return res.status(400).json({ message: "rubricIds must be positive whole numbers" });
  if (ids.length === 0) return res.status(400).json({ message: "choose at least one rubric" });
  if (ids.length > MAX_CASE_RUBRICS) return res.status(400).json({ message: `a case can hold at most ${MAX_CASE_RUBRICS} rubrics` });

  const method: Method = body.method === "presence" || body.method === "emphasis" ? body.method : "grades";
  const sortBy: SortBy = body.sortBy === "coverage" ? "coverage" : "total";
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

  try {
    const found = await store().byIds(ids as number[]);
    // keep the order the practitioner chose
    const order = new Map((ids as number[]).map((id, i) => [id, i]));
    const rubrics = found.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    if (!rubrics.length) return res.status(404).json({ message: "none of those rubrics exist" });
    const names = await store().remedyNames();
    res.json(repertorize({
      rubrics, weights, method, names, exclude, sortBy,
      minGrade: typeof body.minGrade === "number" ? body.minGrade : 1,
      coverAll: body.coverAll === true,
      limit: typeof body.limit === "number" ? body.limit : 40,
    }));
  } catch (e) { fail(res, e, "repertorize"); }
});

export default router;
