// Run: npx tsx server/tests/repertory-search.test.ts   (fake network, no database needed)
// Checks the requests the graded-repertory store sends, and how search() behaves with
// REPERTORY_ENGINE = off / on / hybrid when the repertory works and when it does not.
import assert from "node:assert/strict";

process.env.SCRAPER_SUPABASE_URL = "http://scraper.test"; process.env.SCRAPER_SUPABASE_KEY = "k";
process.env.SUPABASE_URL = "http://main.test"; process.env.SUPABASE_ANON_KEY = "k";
delete process.env.GROQ_API_KEY; delete process.env.GROQ_OPENAI_API;

type Reply = { status?: number; body: any; headers?: Record<string, string> };
type Handler = (url: URL, init: { method: string; headers: Record<string, string> }) => Reply;
let handler: Handler = () => ({ body: [] });
const calls: Array<{ url: URL; method: string; headers: Record<string, string> }> = [];
(globalThis as any).fetch = async (input: any, init: any = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const headers: Record<string, string> = {};
  new Headers(init.headers || (typeof input === "string" ? {} : input.headers)).forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const method = String(init.method || (typeof input === "string" ? "GET" : input.method) || "GET").toUpperCase();
  calls.push({ url, method, headers });
  const { status = 200, body, headers: extra = {} } = handler(url, { method, headers });
  return new Response(method === "HEAD" ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });
};
const dec = (u: URL) => decodeURIComponent(u.pathname + u.search.replace(/\+/g, " "));
const touched = (name: string) => calls.some((c) => c.url.pathname.endsWith("/" + name));

const { supabaseRepertoryStore } = await import("../utils/repertoryStore");
const { search } = await import("../services/searchService");
const { _clearCache } = await import("../utils/supabase");

// ── old tables (same toy data as search-pipeline.test.ts) ────────
const RUBRICS = [
  { id: 1, parent_id: null, section: "Mind", rubric_text: "Anxiety, night", full_path: "Mind > Anxiety > night", depth: 2, symptom_type: "mental", is_eliminating: false },
];
const embed = { rubric_text: "Anxiety, night", full_path: "Mind > Anxiety > night", section: "Mind", symptom_type: "mental", depth: 2 };
const RR = [
  { id: 1, rubric_id: 1, remedy_name: "Phosphorus", grade: 3, rubrics: embed },
  { id: 2, rubric_id: 1, remedy_name: "Pulsatilla pratensis", grade: 2, rubrics: embed },
];

// ── repertory tables ─────────────────────────────────────────────
const R = (id: number, parent: number | null, chapter: string, text: string, path: string, depth: number, remedies: Record<string, number>) => ({
  id, parent_id: parent, chapter, rubric_text: text, full_path: path, depth, n_remedies: Object.keys(remedies).length, child_count: 0, remedies,
});
const REP = [
  R(2, 1, "Mind", "anxiety", "Mind > anxiety", 1, { "Ars.": 3, "Acon.": 3, "Phos.": 1 }),
  R(3, 2, "Mind", "night", "Mind > anxiety > night", 2, { "Ars.": 3, "Acon.": 1 }),
];
const REMEDIES = [{ abbrev: "Ars.", name: "Arsenicum Album" }, { abbrev: "Acon.", name: "Aconitum Napellus" }, { abbrev: "Phos.", name: "Phosphorus" }];
const SOURCES = [{ slug: "repertorium-publicum-2008", title: "Repertorium Publicum", author: "Vladimir Polony", year: 2008, licence: "GNU GPL v3",
  attribution: "credit", note: "", graded: true, rubric_count: 74480, link_count: 735433 }];

const old = (u: URL): Reply | null => {
  if (u.pathname.endsWith("/rubrics")) return { body: RUBRICS };
  if (u.pathname.endsWith("/rubric_remedies")) return { body: RR };
  return null;
};
const rep = (u: URL, init: { method: string; headers: Record<string, string> }): Reply | null => {
  if (u.pathname.endsWith("/repertory_rubrics")) {
    if (init.headers.prefer?.includes("count=exact")) return { body: null, headers: { "content-range": "0-0/500" } };
    return { body: REP };
  }
  if (u.pathname.endsWith("/repertory_remedies")) return { body: REMEDIES };
  if (u.pathname.endsWith("/repertory_sources")) return { body: SOURCES };
  return null;
};
const healthy: Handler = (u, i) => old(u) || rep(u, i) || { body: [] };
const repertoryDown: Handler = (u, i) => (u.pathname.includes("repertory_") ? { status: 404, body: { message: "Could not find the table 'public.repertory_rubrics' in the schema cache" } } : old(u) || { body: [] });
const oldDown: Handler = (u, i) => (old(u) ? { status: 503, body: { message: "down" } } : rep(u, i) || { body: [] });

let n = 0;
const quiet = console.log;
const t = async (name: string, fn: () => Promise<void>) => { calls.length = 0; _clearCache(); await fn(); n++; quiet("ok  ", name); }; const mute = () => { console.log = () => {}; console.error = () => {}; console.warn = () => {}; };
const loud = () => { console.log = quiet; };
const SYMPTOMS = ["anxiety at night"];

// ── store requests ───────────────────────────────────────────────
await t("query: source, no chapter roots, AND of OR filters, narrow-first order, limit, remedies selected", async () => {
  handler = healthy;
  const { unitKeywords } = await import("../services/repertoryEngine");
  const kw = unitKeywords(["anxiety at night"])[0];
  await supabaseRepertoryStore().query({ groups: kw.groups, chapterPats: ["head", "^ear"], limit: 150, order: "narrow" });
  const u = dec(calls[0].url);
  assert.match(u, /\/repertory_rubrics\?/);
  assert.match(u, /source=eq\.repertorium-publicum-2008/);
  assert.match(u, /depth=gt\.0/);
  assert.equal((u.match(/[?&]or=/g) || []).length, kw.groups.length + 1);          // one OR per group + one for chapters
  assert.match(u, /or=\(full_path\.ilike\.%anxi/);
  assert.match(u, /chapter\.ilike\.%head%,chapter\.ilike\.ear%/);
  assert.match(u, /order=n_remedies\.asc,id\.asc/); assert.match(u, /limit=150/);
  assert.match(u, /(select=|,\s*)remedies(,|&|$)/);        // the remedies column itself, not n_remedies
  await supabaseRepertoryStore().query({ groups: kw.groups, limit: 60, order: "broad" });
  assert.match(dec(calls[1].url), /order=n_remedies\.desc,id\.asc/);
});

await t("tree: chapters = parent_id is null; children = parent_id eq; the listing never selects remedies", async () => {
  handler = healthy;
  const s = supabaseRepertoryStore();
  await s.children(null); await s.children(7);
  assert.match(dec(calls[0].url), /parent_id=is\.null/); assert.match(dec(calls[1].url), /parent_id=eq\.7/);
  for (const c of calls) assert.ok(!/(select=|,\s*)remedies(,|&|$)/.test(dec(c.url)));
});

await t("byIds chunks 100 ids per request and drops junk; searchText ANDs the words", async () => {
  handler = healthy;
  const s = supabaseRepertoryStore();
  await s.byIds(Array.from({ length: 150 }, (_, i) => i + 1).concat([NaN, 3]));
  assert.equal(calls.length, 2); assert.match(dec(calls[0].url), /id=in\.\(1,2,3,/);
  calls.length = 0;
  await s.searchText(["anxiety", "night"], 60);
  const u = dec(calls[0].url);
  assert.equal((u.match(/full_path=ilike\./g) || []).length, 2); assert.match(u, /limit=60/);
});

await t("group frequency: one counting request per group, result cached, failure explained", async () => {
  handler = healthy;
  const { unitKeywords } = await import("../services/repertoryEngine");
  const kw = unitKeywords(["anxiety at night"])[0];
  const s = supabaseRepertoryStore();
  const r = await s.groupFrequency!(kw.groups);
  assert.deepEqual(r.counts, kw.groups.map(() => 500)); assert.equal(r.total, 74480);
  assert.ok(calls.filter((c) => c.headers.prefer?.includes("count=exact")).length >= kw.groups.length);
  const before = calls.length;
  await s.groupFrequency!(kw.groups);
  assert.equal(calls.length, before, "second call answered from the cache");
  _clearCache(); handler = repertoryDown;
  await assert.rejects(() => s.groupFrequency!(kw.groups), /repertory/);
});

await t("by remedy: one POST to the database function, at most five remedies, nothing sent for none", async () => {
  handler = (u) => (u.pathname.endsWith("/rpc/repertory_rubrics_by_remedies") ? { body: [{ id: 5, grades: { "Acon.": 3 } }] } : { body: [] });
  const s = supabaseRepertoryStore();
  const hits = await s.byRemedies({ include: ["Acon.", "Ars.", "Bell.", "Bry.", "Phos.", "Puls."], exclude: ["Sil."], minGrade: 3 });
  assert.equal(hits.length, 1); assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST"); assert.match(calls[0].url.pathname, /\/rpc\/repertory_rubrics_by_remedies$/);
  calls.length = 0;
  assert.deepEqual(await s.byRemedies({ include: [] }), []); assert.equal(calls.length, 0);
  handler = (u) => (u.pathname.includes("/rpc/") ? { status: 404, body: { message: "Could not find the function public.repertory_rubrics_by_remedies" } } : { body: [] });
  await assert.rejects(() => s.byRemedies({ include: ["Acon."] }), /repertory/);
});

// ── search() ─────────────────────────────────────────────────────
mute();
delete process.env.REPERTORY_ENGINE;

await t("off (default): the repertory tables are never touched and the answer is the old engine's", async () => {
  handler = healthy;
  const r = await search({ symptoms: SYMPTOMS, filters: {} });
  loud();
  assert.equal(r.engine, "scraper"); assert.equal(r.remedies[0].name, "Phosphorus");
  assert.ok(!calls.some((c) => c.url.pathname.includes("repertory_")));
  mute();
});

await t("on: the graded repertory answers; the old rubric tables are not needed", async () => {
  process.env.REPERTORY_ENGINE = "on"; handler = healthy;
  const r = await search({ symptoms: SYMPTOMS, filters: {} });
  loud();
  assert.equal(r.engine, "repertory"); assert.equal(r.remedies[0].name, "Arsenicum Album");
  assert.ok(!touched("rubrics") && !touched("rubric_remedies"));
  assert.ok(r.rubrics_used.includes("Mind > anxiety > night"));
  assert.match(r.remedies[0].category, /Mind/); assert.ok(!/^\d+$/.test(r.remedies[0].category), "category is a chapter name, not a number");
  assert.ok(r.remedies[0].covered_rubrics.some((c: any) => c.grade === 3));
  mute();
});

await t("on, but the repertory tables are missing: falls back to the old engine, no error", async () => {
  process.env.REPERTORY_ENGINE = "on"; handler = repertoryDown;
  const r = await search({ symptoms: SYMPTOMS, filters: {} });
  loud(); assert.equal(r.engine, "scraper"); assert.equal(r.remedies[0].name, "Phosphorus"); mute();
});

await t("hybrid: both engines run and the remedy both like (Phosphorus is in both) is ranked with them", async () => {
  process.env.REPERTORY_ENGINE = "hybrid"; handler = healthy;
  const r = await search({ symptoms: SYMPTOMS, filters: {} });
  loud();
  assert.equal(r.engine, "hybrid");
  const names = [...r.remedies, ...r.alternatives].map((x) => x.name);
  assert.ok(names.includes("Arsenicum Album") && names.includes("Phosphorus") && names.includes("Pulsatilla Pratensis"));
  assert.equal(names.indexOf("Phosphorus"), 0, "found by both engines: first");
  assert.ok(touched("rubric_remedies") && touched("repertory_rubrics"));
  mute();
});

await t("hybrid with the repertory down: the old answer; with the old tables down: the repertory answer", async () => {
  process.env.REPERTORY_ENGINE = "hybrid";
  handler = repertoryDown;
  let r = await search({ symptoms: SYMPTOMS, filters: {} });
  loud(); assert.equal(r.engine, "scraper"); mute();
  _clearCache(); handler = oldDown;
  r = await search({ symptoms: SYMPTOMS, filters: {} });
  loud(); assert.equal(r.engine, "repertory"); assert.equal(r.remedies[0].name, "Arsenicum Album"); mute();
});

await t("a typo in REPERTORY_ENGINE means off", async () => {
  process.env.REPERTORY_ENGINE = "yes please"; handler = healthy;
  await search({ symptoms: SYMPTOMS, filters: {} });
  loud(); assert.ok(!calls.some((c) => c.url.pathname.includes("repertory_"))); mute();
});

loud();
quiet(`\n${n} checks passed`);
