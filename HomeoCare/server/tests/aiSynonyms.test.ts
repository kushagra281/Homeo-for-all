// Run: npx tsx server/tests/aiSynonyms.test.ts   (no database, no AI key needed)
import assert from "node:assert/strict";
import { parseExpansion, cleanTerm, expandSymptoms, _clearCache, hasNonLatin, parseEnglish, translateSymptoms, _clearTranslateCache } from "../services/aiSynonyms";
import { extractKeywords } from "../utils/keywords";

let n = 0; const t = async (name: string, fn: () => Promise<void> | void) => { await fn(); n++; console.log("ok  ", name); };

(async () => {
  await t("cleanTerm keeps only plain lowercase words", () => {
    assert.equal(cleanTerm("Profuse"), "profuse"); assert.equal(cleanTerm("two words"), "");
    assert.equal(cleanTerm("a1b"), ""); assert.equal(cleanTerm("x"), ""); assert.equal(cleanTerm(5), "");
  });
  await t("parseExpansion cuts untrusted output down to safe words", () => {
    const r = parseExpansion('noise {"terms":{"gushing":["Profuse","copious","<script>","gushing","spurting","watery","fluent"],"bad key!":["x"],"dast":"nope"}} more');
    assert.deepEqual(r, { gushing: ["profuse", "copious", "spurting", "watery"] });
  });
  await t("parseExpansion survives garbage", () => {
    for (const g of ["", "no json", "{", '{"terms":[]}', '{"terms":null}', "[1,2]"]) assert.deepEqual(parseExpansion(g), {});
  });
  await t("extra words reach the keyword group, after the built-in ones, at most 10 in all", () => {
    const g = extractKeywords(["chubhi pain"], 12, { chubhi: ["prick", "puncture", "stab"] }).groups.find((x) => x.key === "chubhi")!;
    assert.ok(g.variants.some((v) => v.text === "prick") && g.variants.some((v) => v.text === "puncture"));
    const f = extractKeywords(["gushing"], 12, { gushing: ["aaa", "bbb", "ccc", "ddd", "eee", "fff"] }).groups[0];
    assert.ok(f.variants.length <= 10);
  });
  await t("no extra words: keywords are exactly as before", () => {
    assert.deepEqual(extractKeywords(["dry cough at night"]), extractKeywords(["dry cough at night"], 12, {}));
  });
  await t("expandSymptoms: good answer is used and cached (second call does not ask again)", async () => {
    _clearCache(); let calls = 0;
    const ask = async () => { calls++; return '{"terms":{"chubhi":["prick"]}}'; };
    assert.deepEqual(await expandSymptoms(["Chubhi  pain"], ask), { chubhi: ["prick"] });
    assert.deepEqual(await expandSymptoms(["chubhi pain"], ask), { chubhi: ["prick"] });
    assert.equal(calls, 1);
  });
  await t("expandSymptoms: a failing model gives {} and is not cached", async () => {
    _clearCache(); let calls = 0;
    const ask = async () => { calls++; throw new Error("boom"); };
    assert.deepEqual(await expandSymptoms(["x pain"], ask), {});
    await expandSymptoms(["x pain"], ask);
    assert.equal(calls, 2);
  });
  await t("expandSymptoms: a slow model is cut off by the timeout", async () => {
    _clearCache();
    const slow = () => new Promise<string>((res) => setTimeout(() => res('{"terms":{"a":["abc"]}}'), 500));
    const t0 = Date.now();
    assert.deepEqual(await expandSymptoms(["slow case"], slow, 100), {});
    assert.ok(Date.now() - t0 < 400);
  });
  await t("expandSymptoms: no key means no call at all", async () => {
    _clearCache(); const save = { a: process.env.GROQ_API_KEY, b: process.env.GROQ_OPENAI_API };
    delete process.env.GROQ_API_KEY; delete process.env.GROQ_OPENAI_API;
    assert.deepEqual(await expandSymptoms(["anything"]), {});
    if (save.a) process.env.GROQ_API_KEY = save.a; if (save.b) process.env.GROQ_OPENAI_API = save.b;
  });
  await t("AI_SYNONYMS=off switches it off", async () => {
    _clearCache(); process.env.AI_SYNONYMS = "off";
    assert.deepEqual(await expandSymptoms(["x"], async () => '{"terms":{"x":["abc"]}}'), {});
    delete process.env.AI_SYNONYMS;
  });
  await t("hasNonLatin: Devanagari yes, Hinglish and English no", () => {
    assert.ok(hasNonLatin(["सिरदर्द और बुखार"])); assert.ok(hasNonLatin(["head ache सिर"]));
    assert.ok(!hasNonLatin(["sar dard bukhar"])); assert.ok(!hasNonLatin(["café headache"]));
  });
  await t("parseEnglish keeps clean single words only", () => {
    assert.deepEqual(parseEnglish('x {"english":["Headache","fever","two words","<b>","headache"]}'), ["headache", "fever"]);
    assert.deepEqual(parseEnglish("garbage"), []); assert.deepEqual(parseEnglish('{"english":"no"}'), []);
  });
  await t("translateSymptoms: Latin-only input never calls the AI", async () => {
    _clearTranslateCache(); let calls = 0;
    assert.deepEqual(await translateSymptoms(["sar dard"], async () => { calls++; return '{"english":["x"]}'; }), []);
    assert.equal(calls, 0);
  });
  await t("translateSymptoms: Devanagari is translated, cached, and failure gives []", async () => {
    _clearTranslateCache(); let calls = 0;
    const ok = async () => { calls++; return '{"english":["headache","fever"]}'; };
    assert.deepEqual(await translateSymptoms(["सिरदर्द बुखार"], ok), ["headache", "fever"]);
    await translateSymptoms(["सिरदर्द बुखार"], ok);
    assert.equal(calls, 1);
    _clearTranslateCache();
    assert.deepEqual(await translateSymptoms(["सिरदर्द"], async () => { throw new Error("x"); }), []);
  });
  await t("translated words joined by spaces keep 'worse' attached to 'night'", () => {
    const space = extractKeywords(["headache worse night"]).modalities.map((m) => `${m.dir}:${m.key}`);
    assert.deepEqual(space, ["worse:night"]);
    const comma = extractKeywords(["headache, worse, night"]).modalities;
    assert.equal(comma.length, 0);   // why the join must use spaces
  });
  console.log(`${n} checks passed`);
})();
