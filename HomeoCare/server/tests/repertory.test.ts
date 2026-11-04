// Run: npx tsx server/tests/repertory.test.ts   (no database, no network)
import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { repertorize, gradeValue } from "../services/repertorize";
import {
  findRubrics, repertoryModality, splitUnits, toScoringRows, unitKeywords, DEFAULT_OPTIONS,
} from "../services/repertoryEngine";
import { fuse, repertoryMode, scoreWithRepertory } from "../services/repertorySearch";
import { scoreRemedies, type RemedyScore } from "../services/scoringService";
import { memoryRepertoryStore } from "../utils/repertoryMemory";
import { safeWords, chapterMatches, type RepertoryRubric, type RepertoryStore } from "../utils/repertoryStore";
import repertoryRouter, { useRepertoryStoreForTests, MAX_CASE_RUBRICS } from "../routes/repertory";
import { DbUnavailableError } from "../utils/supabase";
import { compareMethods } from "../services/repertorize";
import { pickProfile } from "../services/remedyProfile";

let n = 0;
const t = async (name: string, fn: () => void | Promise<void>) => { await fn(); n++; console.log("ok  ", name); };

// ── toy repertory ────────────────────────────────────────────────
const R = (id: number, parent: number | null, chapter: string, text: string, path: string, depth: number,
  remedies: Record<string, number>, kids = 0): RepertoryRubric => ({
  id, parent_id: parent, chapter, rubric_text: text, full_path: path, depth,
  n_remedies: Object.keys(remedies).length, child_count: kids, remedies,
});
const ROWS: RepertoryRubric[] = [
  R(1, null, "Mind", "Mind", "Mind", 0, { "Acon.": 3, "Ars.": 2, "Bell.": 1 }, 2),
  R(2, 1, "Mind", "anxiety", "Mind > anxiety", 1, { "Acon.": 3, "Ars.": 3, "Puls.": 1, "Phos.": 2 }, 1),
  R(3, 2, "Mind", "night", "Mind > anxiety > night", 2, { "Ars.": 3, "Acon.": 1 }),
  R(4, 1, "Mind", "fear", "Mind > fear", 1, { "Acon.": 3, "Phos.": 2, "Ars.": 2 }, 1),
  R(5, 4, "Mind", "death", "Mind > fear > death", 2, { "Acon.": 3, "Ars.": 3 }),
  R(6, null, "Head", "Head", "Head", 0, { "Bell.": 3 }, 1),
  R(7, 6, "Head", "pain", "Head > pain", 1, { "Bell.": 3, "Bry.": 2, "Acon.": 1 }, 3),
  R(8, 7, "Head", "light agg.", "Head > pain > light agg.", 2, { "Bell.": 3, "Bry.": 1 }),
  R(9, 7, "Head", "motion amel.", "Head > pain > motion amel.", 2, { "Rhus-t.": 2 }),
  R(10, 7, "Head", "motion agg.", "Head > pain > motion agg.", 2, { "Bry.": 3, "Bell.": 2 }),
];
const NAMES = new Map(Object.entries({
  "Acon.": "Aconitum napellus", "Ars.": "Arsenicum album", "Bell.": "Belladonna", "Puls.": "Pulsatilla pratensis",
  "Phos.": "Phosphorus", "Bry.": "Bryonia alba", "Rhus-t.": "Rhus toxicodendron",
}));
const store = memoryRepertoryStore(ROWS, NAMES);
const byId = (ids: number[]) => ROWS.filter((r) => ids.includes(r.id));

// ── repertorize: numbers checked by hand ─────────────────────────
await t("grades: Ars 3+3 over two rubrics, Acon 3+1, sorted by total then coverage", () => {
  const r = repertorize({ rubrics: byId([3, 5]), names: NAMES });
  assert.deepEqual(r.rows.map((x) => [x.abbrev, x.total, x.covered, x.grades]), [
    ["Ars.", 6, 2, [3, 3]],
    ["Acon.", 4, 2, [1, 3]],
  ]);
  assert.equal(r.rows[0].name, "Arsenicum album");
  assert.deepEqual(r.rubrics.map((x) => x.weight), [1, 1]);
});

await t("methods: presence counts 1 per rubric, emphasis squares the grade", () => {
  assert.equal(gradeValue(3, "grades"), 3); assert.equal(gradeValue(3, "presence"), 1); assert.equal(gradeValue(3, "emphasis"), 9);
  const p = repertorize({ rubrics: byId([3, 5]), names: NAMES, method: "presence" });
  assert.deepEqual(p.rows.map((x) => [x.abbrev, x.total]), [["Acon.", 2], ["Ars.", 2]]);   // tie: name order
  const e = repertorize({ rubrics: byId([3, 5]), names: NAMES, method: "emphasis" });
  assert.equal(e.rows.find((x) => x.abbrev === "Ars.")!.total, 18);
  assert.equal(e.rows.find((x) => x.abbrev === "Acon.")!.total, 10);
});

await t("weights multiply a rubric's scores and are kept to 1..3", () => {
  const r = repertorize({ rubrics: byId([3, 5]), names: NAMES, weights: { 5: 3, 3: 99 } });
  assert.deepEqual(r.rubrics.map((x) => x.weight), [3, 3]);     // 99 -> 3
  assert.equal(r.rows.find((x) => x.abbrev === "Ars.")!.total, 18);
  const w = repertorize({ rubrics: byId([3, 5]), names: NAMES, weights: { 5: 2 } });
  assert.equal(w.rows.find((x) => x.abbrev === "Acon.")!.total, 1 + 3 * 2);
});

await t("minGrade drops weak links; coverAll keeps only remedies in every rubric; exclude removes remedies", () => {
  const min = repertorize({ rubrics: byId([3, 5]), names: NAMES, minGrade: 2 });
  assert.deepEqual(min.rows.map((x) => [x.abbrev, x.covered]), [["Ars.", 2], ["Acon.", 1]]);   // Acon grade 1 in rubric 3 ignored
  const all = repertorize({ rubrics: byId([2, 3]), names: NAMES, coverAll: true });
  assert.deepEqual(all.rows.map((x) => x.abbrev).sort(), ["Acon.", "Ars."]);                    // Puls/Phos are only in rubric 2
  assert.equal(all.total_remedies, 2);
  const ex = repertorize({ rubrics: byId([3, 5]), names: NAMES, exclude: ["Ars."] });
  assert.deepEqual(ex.rows.map((x) => x.abbrev), ["Acon."]);
});

await t("sort by coverage puts the remedy in most rubrics first; limit cuts but total_remedies stays", () => {
  const r = repertorize({ rubrics: byId([2, 3, 5]), names: NAMES, sortBy: "coverage", limit: 1 });
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].covered, 3);
  assert.equal(r.total_remedies, 4);                       // Acon, Ars, Puls, Phos
});

await t("grid columns follow the order of the chosen rubrics; unknown abbreviation keeps its abbreviation", () => {
  const odd = R(99, null, "Mind", "x", "Mind > x", 1, { "Zzz.": 2 });
  const r = repertorize({ rubrics: [odd, ...byId([3])], names: NAMES });
  const zzz = r.rows.find((x) => x.abbrev === "Zzz.")!;
  assert.deepEqual(zzz.grades, [2, 0]); assert.equal(zzz.name, "Zzz.");
});

// ── engine ───────────────────────────────────────────────────────
await t("splitUnits: sentences become units, commas stay inside", () => {
  assert.deepEqual(splitUnits(["headache worse at night, better pressure. thirst; fear", "ab"]),
    ["headache worse at night, better pressure", "thirst", "fear"]);
});

await t("repertory wording: agg./amel. agree or disagree with worse/better", () => {
  const worseLight = [{ dir: "worse" as const, key: "light" }];
  assert.equal(repertoryModality("head > pain > light agg.", worseLight), 1);
  assert.equal(repertoryModality("head > pain > light amel.", worseLight), -1);
  assert.equal(repertoryModality("head > pain > light", worseLight), 0);
  assert.equal(repertoryModality("head > pain > motion agg.", worseLight), 0);   // other word
  assert.equal(repertoryModality("abdomen > warmth > amel.", [{ dir: "better", key: "warmth" }]), 1);
  assert.equal(repertoryModality("aggravated cough", [{ dir: "worse", key: "cough" }]), 0);   // not the abbreviation
});

await t("findRubrics: the rubric matching both words comes first, parents are kept, no chapter roots", async () => {
  const found = await findRubrics(unitKeywords(["anxiety at night"]), store);
  assert.equal(found[0].id, 3);
  assert.ok(found.some((r) => r.id === 2), "broader parent rubric is kept");
  assert.ok(found.every((r) => r.depth > 0));
  assert.ok(found[0].relevance >= found[1].relevance);
});

await t("findRubrics: a worse-from-light symptom prefers the 'light agg.' rubric", async () => {
  const found = await findRubrics(unitKeywords(["head pain worse light"]), store);
  assert.equal(found[0].id, 8);
});

await t("findRubrics: dropAncestors removes a rubric whose sub-rubric is also kept", async () => {
  const found = await findRubrics(unitKeywords(["anxiety at night"]), store, undefined, { dropAncestors: true });
  assert.ok(found.some((r) => r.id === 3) && !found.some((r) => r.id === 2));
});

await t("findRubrics: chapter filter limits the search; no match gives an empty list", async () => {
  const head = await findRubrics(unitKeywords(["pain"]), store, ["head"]);
  assert.ok(head.length > 0 && head.every((r) => r.chapter === "Head"));
  assert.deepEqual(await findRubrics(unitKeywords(["pain"]), store, ["mind"]), []);   // no pain rubrics in Mind
  assert.deepEqual(await findRubrics(unitKeywords(["xyzzyq"]), store), []);
});

await t("findRubrics: a symptom with many rubrics cannot out-vote one with a single rubric", async () => {
  const many = Array.from({ length: 10 }, (_, i) => R(100 + i, null, "Back", `s${i}`, `Back > pain > s${i}`, 2, { "Bry.": 1 }));
  const s = memoryRepertoryStore([...ROWS, ...many], NAMES);
  const found = await findRubrics(unitKeywords(["back pain"]), s, undefined, { unitCap: 3, perUnit: 10 });
  const back = found.filter((r) => r.chapter === "Back");
  assert.equal(back.length, 10);
  assert.ok(back[0].relevance <= Math.sqrt(3 / 10) + 1e-9);
});

await t("works when the store has no frequency counts, or they fail", async () => {
  const plain: RepertoryStore = { ...store, groupFrequency: undefined };
  const failing: RepertoryStore = { ...store, groupFrequency: async () => { throw new Error("boom"); } };
  for (const s of [plain, failing]) {
    const found = await findRubrics(unitKeywords(["anxiety at night"]), s);
    assert.equal(found[0].id, 3);
  }
});

await t("toScoringRows: chapter decides the weight class, names are normalised, section is carried", async () => {
  const found = await findRubrics(unitKeywords(["anxiety at night", "head pain"]), store);
  const rows = toScoringRows(found, NAMES);
  assert.ok(rows.every((r) => ["mental", "general", "particular"].includes(r.symptom_type)));
  assert.equal(rows.find((r) => r.body_system === "Mind")!.symptom_type, "mental");
  assert.equal(rows.find((r) => r.body_system === "Head")!.symptom_type, "particular");
  assert.ok(rows.some((r) => r.remedy_name === "arsenicum album"));
  const { remedies } = scoreRemedies(
    found.map((r) => ({ rubric_code: String(r.id), label: r.full_path, confidence: 1, original_symptom: "", is_eliminating: false })),
    rows,
  );
  assert.ok(remedies[0].covered_rubrics.every((c) => !!c.section), "covered rubrics carry their chapter");
});

await t("scoreWithRepertory: the remedy strongest in the matching rubrics wins; nothing found gives null", async () => {
  const out = await scoreWithRepertory(["anxiety at night"], undefined, undefined, store);
  assert.equal(out!.remedies[0].remedy_name, "arsenicum album");
  assert.equal(out!.remedies[0].score, 100);
  assert.equal(await scoreWithRepertory(["xyzzyq"], undefined, undefined, store), null);
  assert.equal(await scoreWithRepertory([], undefined, undefined, store), null);
});

await t("defaults are the ones chosen with the offline Trials", () => {
  assert.equal(DEFAULT_OPTIONS.dropAncestors, false); assert.equal(DEFAULT_OPTIONS.perUnit, 10);
});

// ── fusion + mode ────────────────────────────────────────────────
const S = (name: string, score: number, codes: string[], grade = 2): RemedyScore => ({
  remedy_name: name, raw_score: score, score, confidence: 40, rubric_count: codes.length, grade_sum: codes.length * grade,
  covered_rubrics: codes.map((c) => ({ rubric_code: c, label: "rubric " + c, grade, weight: 1, contribution: grade })),
  explanation: codes.map((c) => "rubric " + c), eliminated: false,
});

await t("fuse: a remedy both engines like beats one that only one found; top is 100; rubrics are merged", () => {
  const a = [S("x", 100, ["1"]), S("y", 80, ["2"]), S("z", 50, ["3"])];
  const b = [S("y", 100, ["1000001"]), S("w", 90, ["1000002"])];
  const f = fuse(a, b);
  assert.equal(f[0].remedy_name, "y");                       // (80 + 100) / 2 = 90 beats x (50) and w (45)
  assert.equal(f[0].score, 100);
  assert.deepEqual(f.map((r) => r.remedy_name), ["y", "x", "w", "z"]);
  assert.deepEqual(f[0].covered_rubrics.map((c) => c.rubric_code).sort(), ["1000001", "2"]);
  assert.equal(f[0].rubric_count, 2);
  assert.ok(f[0].confidence > 40);                           // both engines agree: small confidence bonus
  assert.equal(fuse(a, [])[0].remedy_name, "x");
});

await t("repertoryMode: off unless switched on", () => {
  assert.equal(repertoryMode(undefined), "off"); assert.equal(repertoryMode(""), "off"); assert.equal(repertoryMode("nonsense"), "off");
  for (const v of ["on", "ON", "1", "true", "repertory"]) assert.equal(repertoryMode(v), "on");
  assert.equal(repertoryMode(" Hybrid "), "hybrid");
});

await t("search box words are letters and digits only (safe inside a filter)", () => {
  assert.deepEqual(safeWords("Anxiety, night!"), ["anxiety", "night"]);
  assert.deepEqual(safeWords("x),or=(id.gt.0"), ["or", "id", "gt"]);       // punctuation never reaches the filter
  assert.ok(safeWords("a),b.ilike.%x%;drop").every((w) => /^[a-z0-9]+$/.test(w)));
  assert.equal(safeWords("alpha beta gamma delta epsilon zeta eta theta", 3).length, 3);
  assert.deepEqual(safeWords(""), []);
  assert.deepEqual(safeWords("é ñ 漢字"), []);
  assert.ok(chapterMatches("Ear", ["^ear"]) && !chapterMatches("Hearing", ["^ear"]) && chapterMatches("Head", undefined));
});

// ── HTTP routes ──────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use("/api/repertory", repertoryRouter);
const server = createServer(app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}/api/repertory`;
const get = async (p: string) => { const r = await fetch(base + p); return { status: r.status, body: await r.json() }; };
const post = async (p: string, body: unknown) => {
  const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
useRepertoryStoreForTests(store);

await t("routes: chapters, children and search", async () => {
  const ch = await get("/chapters");
  assert.deepEqual(ch.body.map((x: any) => x.rubric_text), ["Head", "Mind"]);
  assert.ok(!("remedies" in ch.body[0]), "the tree listing carries no remedy lists");
  const kids = await get("/children/7");
  assert.deepEqual(kids.body.map((x: any) => x.id).sort((a: number, b: number) => a - b), [8, 9, 10]);
  assert.equal((await get("/children/abc")).status, 400);
  assert.equal((await get("/children/-3")).status, 400);
  const s = await get("/search?q=anxiety%20night");
  assert.deepEqual(s.body.map((x: any) => x.id), [3]);
  assert.deepEqual((await get("/search?q=")).body, []);
  assert.deepEqual((await get("/search?q=%25%27%22")).body, []);
});

await t("routes: one rubric lists its remedies strongest first with names", async () => {
  const r = await get("/rubric/2");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.remedies.map((x: any) => [x.abbrev, x.grade]), [["Acon.", 3], ["Ars.", 3], ["Phos.", 2], ["Puls.", 1]]);
  assert.equal(r.body.remedies[0].name, "Aconitum napellus");
  assert.equal((await get("/rubric/9999")).status, 404);
});

await t("routes: repertorize returns the grid and validates its input", async () => {
  const ok = await post("/repertorize", { rubricIds: [3, 5], method: "grades" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.rows[0].abbrev, "Ars."); assert.equal(ok.body.rows[0].total, 6);
  assert.deepEqual(ok.body.rubrics.map((x: any) => x.id), [3, 5]);
  const flipped = await post("/repertorize", { rubricIds: [5, 3] });
  assert.deepEqual(flipped.body.rubrics.map((x: any) => x.id), [5, 3]);       // the practitioner's order
  assert.equal((await post("/repertorize", {})).status, 400);
  assert.equal((await post("/repertorize", { rubricIds: [] })).status, 400);
  assert.equal((await post("/repertorize", { rubricIds: ["3", "x"] })).status, 400);
  assert.equal((await post("/repertorize", { rubricIds: [1.5] })).status, 400);
  assert.equal((await post("/repertorize", { rubricIds: Array.from({ length: MAX_CASE_RUBRICS + 1 }, (_, i) => i + 1) })).status, 400);
  assert.equal((await post("/repertorize", { rubricIds: [999999] })).status, 404);
  const odd = await post("/repertorize", { rubricIds: [3, 5], method: "x; drop", minGrade: 99, exclude: [5, "Ars."], weights: { "3": "a", "5": 2 }, limit: -4 });
  assert.equal(odd.status, 200);
  assert.equal(odd.body.method, "grades"); assert.equal(odd.body.min_grade, 3);
  assert.ok(!odd.body.rows.some((x: any) => x.abbrev === "Ars."));
});

await t("routes: a repertory that is not loaded answers 503 with a plain message", async () => {
  const broken: RepertoryStore = {
    ...store,
    sources: async () => { throw new DbUnavailableError("repertory sources: Could not find the table 'public.repertory_sources'"); },
    children: async () => { throw new DbUnavailableError("repertory children: relation does not exist"); },
  };
  useRepertoryStoreForTests(broken);
  const a = await get("/sources"); const b = await get("/chapters");
  assert.equal(a.status, 503); assert.equal(b.status, 503);
  assert.match(a.body.message, /not available/); assert.equal(a.body.loaded, false);
  assert.ok(!JSON.stringify(a.body).includes("repertory_sources"), "no table names leak to the browser");
  useRepertoryStoreForTests(store);
});

await t("themes: totals are split Mind / Generals / Particulars, and a theme can be required in full", async () => {
  const r = repertorize({ rubrics: byId([3, 5, 8]), names: NAMES });
  const ars = r.rows.find((x) => x.abbrev === "Ars.")!;
  assert.deepEqual(ars.themes, { mental: 6, general: 0, particular: 0 });
  const bell = r.rows.find((x) => x.abbrev === "Bell.")!;
  assert.deepEqual(bell.themes, { mental: 0, general: 0, particular: 3 });
  assert.deepEqual(r.rubrics.map((x) => x.theme), ["mental", "mental", "particular"]);
  const gate = repertorize({ rubrics: byId([3, 5, 8]), names: NAMES, coverTheme: "mental" });
  assert.deepEqual(gate.rows.map((x) => x.abbrev).sort(), ["Acon.", "Ars."]);       // both Mind rubrics, nothing else
  assert.equal(repertorize({ rubrics: byId([3, 5, 8]), names: NAMES, coverTheme: "general" }).rows.length, r.rows.length, "no General rubric chosen: nothing is required");
});

await t("compare: one remedy, three methods, ranks and scores", async () => {
  const c = compareMethods({ rubrics: byId([3, 5]), names: NAMES });
  assert.deepEqual(c.methods, ["grades", "presence", "emphasis"]);
  const ars = c.rows.find((x) => x.abbrev === "Ars.")!;
  assert.deepEqual(ars.scores, { grades: 6, presence: 2, emphasis: 18 });
  assert.equal(ars.ranks.grades, 1); assert.equal(ars.ranks.emphasis, 1);
  assert.equal(ars.scores.presence, c.rows.find((x) => x.abbrev === "Acon.")!.scores.presence, "presence ties them (the tie is broken by name)");
  assert.equal(c.rows[0].abbrev, "Ars.");
  // Acon.: grade 1 in rubric 3 and grade 3 in 5 -> 4 / 2 / 10 and ranks behind Ars.
  const acon = c.rows.find((x) => x.abbrev === "Acon.")!;
  assert.deepEqual(acon.scores, { grades: 4, presence: 2, emphasis: 10 });
  assert.ok(acon.ranks.grades > 1);
});

await t("by remedy: rubrics holding all included remedies at a grade, none of the excluded, narrowest first", async () => {
  const ids = async (q: any) => (await store.byRemedies(q)).map((r) => r.id);
  assert.deepEqual(await ids({ include: ["Acon."], exclude: ["Puls."], minGrade: 3 }), [5, 4]);
  assert.deepEqual(await ids({ include: ["Acon.", "Ars."], minGrade: 3 }), [5, 2]);
  assert.deepEqual(await ids({ include: [] }), []);
  assert.ok(!(await ids({ include: ["Acon."] })).includes(1), "chapter roots are not rubrics");
  const hit = (await store.byRemedies({ include: ["Acon.", "Ars."], minGrade: 3 }))[0];
  assert.deepEqual(hit.grades, { "Acon.": 3, "Ars.": 3 });
  assert.equal(pickProfile("x", []), null);
});

await t("remedy profile matching: exact name first, else same first word, general text before a single lecture", async () => {
  const C = (id: number, name: string, source_site: string) => ({ id, slug: String(id), name, common_name: null, source_site });
  const list = [C(1, "SULPHURIC ACID", "materiamedica.info/kent"), C(2, "SULPHUR IODATUM", "materiamedica.info"), C(3, "SULPHUR", "materiamedica.info")];
  assert.equal(pickProfile("Sulphur", list)!.id, 3);
  assert.equal(pickProfile("Pulsatilla Pratensis", [C(4, "PULSATILLA", "materiamedica.info"), C(5, "PULSATILLA NUTTALLIANA", "materiamedica.info")])!.id, 4);
  assert.equal(pickProfile("Calcarea carbonica", [C(6, "KENT CALCAREA", "materiamedica.info/kent"), C(7, "CALCAREA PHOSPHORICA", "materiamedica.info")])!.id, 7);
  assert.equal(pickProfile("Zincum", list), null);
});

await t("routes: remedies list, by-remedy validation, compare, theme gate, unknown remedy profile", async () => {
  const names = await get("/remedies");
  assert.equal(names.body.length, 7); assert.equal(names.body[0].name, "Aconitum napellus");
  const ok = await post("/by-remedy", { include: ["Acon."], exclude: ["Puls."], minGrade: 3 });
  assert.equal(ok.status, 200); assert.deepEqual(ok.body.rubrics.map((x: any) => x.id), [5, 4]);
  assert.equal(ok.body.include[0].name, "Aconitum napellus");
  assert.equal((await post("/by-remedy", {})).status, 400);
  assert.equal((await post("/by-remedy", { include: [] })).status, 400);
  assert.equal((await post("/by-remedy", { include: ["Nope."] })).status, 400);
  assert.equal((await post("/by-remedy", { include: [5, "x".repeat(40)] })).status, 400);
  const many = await post("/by-remedy", { include: ["Acon.", "Ars.", "Bell.", "Bry.", "Phos.", "Puls.", "Rhus-t."], minGrade: 99, limit: 99999, offset: -5 });
  assert.equal(many.status, 200); assert.equal(many.body.include.length, 5);              // capped at five remedies
  const cmp = await post("/compare", { rubricIds: [3, 5] });
  assert.equal(cmp.status, 200); assert.equal(cmp.body.rows[0].abbrev, "Ars.");
  assert.equal((await post("/compare", { rubricIds: [] })).status, 400);
  assert.equal((await post("/compare", { rubricIds: [999999] })).status, 404);
  const gate = await post("/repertorize", { rubricIds: [3, 5, 8], coverTheme: "mental" });
  assert.deepEqual(gate.body.rows.map((x: any) => x.abbrev).sort(), ["Acon.", "Ars."]);
  assert.equal((await post("/repertorize", { rubricIds: [3, 5, 8], coverTheme: "nonsense" })).body.rows.length, 4);
  assert.equal((await get("/remedy/Nope.")).status, 404);
  assert.equal((await get("/remedy/" + "x".repeat(40))).status, 400);
});

server.close();
console.log(`\n${n} checks passed`);
