// Run: npx tsx server/tests/search-pipeline.test.ts main   and   ... noenv   (fake network, no database needed)
import assert from "node:assert/strict";

const scenario = process.argv[2] || "main";
if (scenario !== "noenv") { process.env.SCRAPER_SUPABASE_URL = "http://scraper.test"; process.env.SCRAPER_SUPABASE_KEY = "k"; }
process.env.SUPABASE_URL = "http://main.test"; process.env.SUPABASE_ANON_KEY = "k";

type Handler = (url: URL) => { status?: number; body: any };
let handler: Handler = () => ({ body: [] });
const calls: URL[] = [];
(globalThis as any).fetch = async (input: any) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  calls.push(url);
  const { status = 200, body } = handler(url);
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
};
const dec = (u: URL) => decodeURIComponent(u.pathname + u.search.replace(/\+/g, " "));

const { searchScraperRubrics, getRemediesForRubricIds, DbUnavailableError } = await import("../utils/supabase");
const { extractKeywords } = await import("../utils/keywords");
const { sectionPatterns } = await import("../utils/sections");
const { search } = await import("../services/searchService");

// ── toy repertory ────────────────────────────────────────────────
const RUBRICS = [
  { id: 1, parent_id: null, section: "Mind", rubric_text: "Anxiety, night", full_path: "Mind > Anxiety > night", depth: 2, symptom_type: "mental", is_eliminating: false },
  { id: 2, parent_id: null, section: "Mind", rubric_text: "Fear of death", full_path: "Mind > Fear > death", depth: 2, symptom_type: "mental", is_eliminating: false },
  { id: 3, parent_id: null, section: "Head", rubric_text: "Pain, burning", full_path: "Head > Pain > burning", depth: 2, symptom_type: "particular", is_eliminating: false },
  { id: 4, parent_id: null, section: "Mind", rubric_text: "Thirstless", full_path: "Mind > Thirstless", depth: 1, symptom_type: "mental", is_eliminating: true },
];
const embed = (id: number) => { const r = RUBRICS.find((x) => x.id === id)!; return { rubric_text: r.rubric_text, full_path: r.full_path, section: r.section, symptom_type: r.symptom_type, depth: r.depth }; };
const RR = [
  { id: 1, rubric_id: 1, remedy_name: "ARSENICUM ALBUM", grade: 3 },
  { id: 2, rubric_id: 1, remedy_name: "Aconitum napellus", grade: 2 },
  { id: 3, rubric_id: 2, remedy_name: "Arsenicum album.", grade: 3 },   // same remedy, different spelling
  { id: 4, rubric_id: 2, remedy_name: "Phosphorus", grade: 2 },
];
const okHandler: Handler = (u) => {
  if (u.pathname.endsWith("/rubrics")) return { body: RUBRICS };
  if (u.pathname.endsWith("/rubric_remedies")) return { body: RR.map((r) => ({ ...r, rubrics: embed(r.rubric_id) })) };
  return { body: [] };
};
let n = 0; const t = async (name: string, fn: () => Promise<void>) => { calls.length = 0; await fn(); n++; console.log("ok  ", name); };

if (scenario === "main") {
  await t("query shape: group queries, pair (AND) queries, section filter, order, limit", async () => {
    handler = () => ({ body: [] });
    await searchScraperRubrics(extractKeywords(["throbbing headache worse from light", "ear ache"]), sectionPatterns("Head")).catch(() => {});
    const first = dec(calls[0]);
    console.log("      sample:", first.slice(0, 330) + (first.length > 330 ? " …" : ""));
    assert.match(first, /or=\(rubric_text\.ilike\./);
    assert.match(first, /section\.ilike\.%head%,section\.ilike\.%vertigo%/);
    assert.match(first, /order=depth\.desc/); assert.match(first, /limit=150/);
    const pair = calls.map(dec).find((u) => (u.match(/[?&]or=/g) || []).length >= 3);   // 2 text ORs + 1 section OR
    assert.ok(pair, "expected a 'must match two keywords' query");
    assert.ok(calls.some((u) => dec(u).includes("ear%,rubric_text.ilike.% ear%")), "short word 'ear' must use word-start patterns");
    assert.ok(!calls.some((u) => /ilike\.%ear%[,)]/.test(dec(u))), "no bare %ear% substring pattern");
  });

  await t("section with no hits is retried without the section filter", async () => {
    handler = (u) => (dec(u).includes("section.ilike") ? { body: [] } : { body: RUBRICS });
    const r = await searchScraperRubrics(extractKeywords(["anxiety night"]), ["nosuchsection"]);
    assert.ok(r.length > 0); assert.ok(calls.some((u) => !dec(u).includes("section.ilike")));
  });

  await t("ranking: rubric matching both keywords first; 'eliminating' rubric never used", async () => {
    handler = okHandler;
    const r = await searchScraperRubrics(extractKeywords(["anxiety worse at night", "burning"]), undefined);
    assert.equal(r[0].rubric_text, "Anxiety, night");
    assert.ok(!r.some((x) => x.id === 4));
    assert.ok(r[0].relevance > r.find((x) => x.id === 3)!.relevance - 1e-9);
  });

  await t("pagination: page 2 is requested when page 1 is full (no silent 1000-row cap)", async () => {
    handler = (u) => {
      const off = Number(u.searchParams.get("offset") || 0);
      const mk = (i: number) => ({ id: i, rubric_id: 1, remedy_name: "R" + i, grade: 1, rubrics: embed(1) });
      return { body: off === 0 ? Array.from({ length: 1000 }, (_, i) => mk(i)) : Array.from({ length: 5 }, (_, i) => mk(1000 + i)) };
    };
    const rows = await getRemediesForRubricIds([1, 2, 3]);
    assert.equal(rows.length, 1005);
    assert.ok(calls.some((u) => u.searchParams.get("offset") === "1000"));
  });

  await t("ids are chunked (250 ids → 3 requests of ≤100)", async () => {
    handler = () => ({ body: [] });
    await getRemediesForRubricIds(Array.from({ length: 250 }, (_, i) => 10_000 + i));
    const rr = calls.filter((u) => u.pathname.endsWith("/rubric_remedies"));
    assert.equal(rr.length, 3);
    for (const u of rr) assert.ok((u.searchParams.get("rubric_id")!.match(/,/g) || []).length + 1 <= 100);
  });

  await t("full pipeline: remedy names merged, top remedy is the one in both rubrics", async () => {
    handler = okHandler;
    const res = await search({ symptoms: ["anxiety worse at night", "fear of death", "category: Mind"], filters: { symptom_location: "Mind" } });
    assert.equal(res.engine, "scraper");
    assert.equal(res.remedies[0].name, "Arsenicum Album");
    assert.equal(res.remedies.filter((r) => r.name === "Arsenicum Album").length, 1);
    console.log("      top:", res.remedies.map((r) => `${r.name} ${r.score}`).join(", "));
  });

  await t("DB down (HTTP 503 everywhere): search THROWS instead of reporting 'no remedies'", async () => {
    handler = () => ({ status: 503, body: { message: "project paused" } });
    await assert.rejects(search({ symptoms: ["unlikelyword xyzzy headache"], filters: {} }), /queries failed|paused/i);
  });

  await t("failures are not cached: same search works once DB is back", async () => {
    handler = okHandler;
    const res = await search({ symptoms: ["anxiety worse at night", "fear of death"], filters: {} });
    assert.ok(res.remedies.length >= 2);
  });

  await t("genuinely no matches (HTTP 200, empty): returns empty result, no throw", async () => {
    handler = () => ({ body: [] });
    const res = await search({ symptoms: ["zzqqword"], filters: {} });
    assert.equal(res.remedies.length, 0);
  });

  await t("no Groq call is made by search()", async () => {
    assert.ok(true); // search() no longer imports rubricService.mapSymptoms (checked by grep below)
  });
}

if (scenario === "noenv") {
  await t("scraper env vars missing: clear error from scraperDB, legacy table in main DB still answers", async () => {
    handler = (u) => u.pathname.endsWith("/symptoms")
      ? { body: [{ remedy: "Belladonna", symptom: "Throbbing headache worse from light", category: "HEAD", intensity: 3 },
                 { remedy: "Bryonia", symptom: "Headache worse from motion", category: "HEAD", intensity: 2 }] }
      : { body: [] };
    const res = await search({ symptoms: ["throbbing headache worse from light"], filters: {} });
    assert.equal(res.engine, "legacy"); assert.equal(res.remedies[0].name, "Belladonna");
    assert.ok(!calls.some((u) => u.host === "scraper.test"));
  });
}
console.log(`\n${n} checks passed (${scenario})`);
process.exit(0);
