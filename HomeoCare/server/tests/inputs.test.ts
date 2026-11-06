// Run: tsx server/tests/inputs.test.ts
// Badly shaped requests get a 400 (not a 500), and the report reader never passes odd JSON on to the page.
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

process.env.SCRAPER_SUPABASE_URL = "http://scraper.test"; process.env.SCRAPER_SUPABASE_KEY = "k";
process.env.SUPABASE_URL = "http://main.test"; process.env.SUPABASE_ANON_KEY = "k";
process.env.GROQ_API_KEY = "k";

const RUBRICS = [
  { id: 1, parent_id: null, section: "Head", rubric_text: "Headache, worse night", full_path: "Head > Headache > night", depth: 2, symptom_type: "particular", is_eliminating: false },
  { id: 2, parent_id: null, section: "Head", rubric_text: "Headache, burning", full_path: "Head > Headache > burning", depth: 2, symptom_type: "particular", is_eliminating: false },
];
const RR = [
  { id: 1, rubric_id: 1, remedy_name: "Belladonna", grade: 3 }, { id: 2, rubric_id: 2, remedy_name: "Belladonna", grade: 2 },
  { id: 3, rubric_id: 1, remedy_name: "Bryonia", grade: 2 }, { id: 4, rubric_id: 2, remedy_name: "Nux vomica", grade: 1 },
];
const embed = (r: any) => ({ rubric_text: r.rubric_text, full_path: r.full_path, section: r.section, symptom_type: r.symptom_type, depth: r.depth });
let modelReply = "";
const realFetch = globalThis.fetch;
(globalThis as any).fetch = async (input: any, init?: any) => {
  const u = typeof input === "string" ? input : input.url;
  if (u.startsWith("http://127.0.0.1")) return realFetch(input, init);
  const url = new URL(u);
  const json = (body: any) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  if (url.hostname === "api.groq.com") {
    return json({ id: "x", object: "chat.completion", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: modelReply } }] });
  }
  if (url.pathname.endsWith("/rubrics")) return json(RUBRICS);
  if (url.pathname.endsWith("/rubric_remedies")) return json(RR.map((r) => ({ ...r, rubrics: embed(RUBRICS.find((x) => x.id === r.rubric_id)) })));
  return json([]);
};
const log = console.log; console.log = console.error = console.warn = () => {};   // the engine's own logging
const remediesRouter = (await import("../routes/remedies")).default;

const app = express();
app.use(express.json());
app.use("/api/remedies", remediesRouter);

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = async (path: string, body: unknown) => {
    const r = await realFetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => null) as any };
  };
  try {
    const good = await post("/api/remedies/score", { symptoms: ["headache worse at night"], filters: { symptom_location: "Head" } });
    assert.equal(good.status, 200);
    assert.equal(good.body[0].remedy.name, "Belladonna");
    log("ok   a normal search still works");

    for (const [name, body] of [
      ["filters a list", { symptoms: ["headache"], filters: [] }],
      ["filters a text", { symptoms: ["headache"], filters: "Head" }],
      ["a number as symptom_location", { symptoms: ["headache"], filters: { symptom_location: 5 } }],
      ["an object as category", { symptoms: ["headache"], filters: { category: { a: 1 } } }],
    ] as const) {
      const r = await post("/api/remedies/score", body);
      assert.equal(r.status, 400, `${name} must be a 400, got ${r.status}`);
    }
    log("ok   /score: filters that are not text answer 400, not 500");

    const noFilters = await post("/api/remedies/score", { symptoms: ["headache worse at night"], filters: null });   // null = no filters (it used to be a 500)
    const emptyFilters = await post("/api/remedies/score", { symptoms: ["headache worse at night"], filters: { symptom_location: "", other: 5 } });
    const oddProfile = await post("/api/remedies/score", { symptoms: ["headache worse at night"], healthProfile: "abc" });
    assert.deepEqual([noFilters.status, emptyFilters.status, oddProfile.status], [200, 200, 200]);
    log("ok   /score: missing, null or empty filters, unknown filter keys and a non-object profile are fine");

    for (const generals of ["chilly", 5, { a: 1 }, [1, null, "chilly"], null]) {
      const r = await post("/api/remedies/score", { symptoms: ["headache worse at night", "chilly"], generals });
      assert.equal(r.status, 200, `generals ${JSON.stringify(generals)} must not break the search, got ${r.status}`);
    }
    log("ok   /score: an unreadable generals list is ignored, never a 500");

    // the report reader
    const report = (reply: string) => { modelReply = reply; return post("/api/remedies/analyze-report", { imageBase64: "AAAA", mimeType: "image/png" }); };
    const a = await report('{"symptoms":["headache","fever"],"conditions":["diabetes"],"summary":"ok"}');
    assert.deepEqual(a.body, { symptoms: ["headache", "fever"], conditions: ["diabetes"], summary: "ok" });
    const b = await report('{"symptoms":[{"name":"headache"},5,null,"cough"],"conditions":"diabetes","summary":{"a":1}}');
    assert.equal(b.status, 200);
    assert.deepEqual(b.body, { symptoms: ["cough"], conditions: ["diabetes"], summary: "Report analyzed" });
    log("ok   /analyze-report: odd JSON from the model is reduced to lists of short texts");

    delete process.env.GROQ_API_KEY;
    const c = await report('{"symptoms":["x1"]}');
    assert.equal(c.status, 503);
    assert.ok(!/GROQ/i.test(JSON.stringify(c.body)), "the answer must not name server settings");
    log("ok   /analyze-report without a key: 503 and no setting name in the message");

    log("\n5 checks passed (inputs)");
    server.close(); process.exit(0);
  } catch (e) {
    log("FAIL", e); server.close(); process.exit(1);
  }
});
