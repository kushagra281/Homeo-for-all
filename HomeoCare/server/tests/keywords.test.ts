// Run: npx tsx server/tests/keywords.test.ts   (no database needed)
import assert from "node:assert/strict";
import { extractKeywords, stem, groupMatches, modalityScore, normalizeRemedyName } from "../utils/keywords";
import { sectionPatterns } from "../utils/sections";

const keys = (s: string[]) => extractKeywords(s).groups.map((g) => g.key);
let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok  ", name); };

t("short body words are kept", () => {
  const k = keys(["pain in leg", "left eye red", "ear ache", "arm numb", "dry cough at night"]);
  for (const w of ["leg", "eye", "ear", "arm", "dry", "red"]) assert.ok(k.includes(w), `missing ${w}: ${k}`);
});
t("stemming", () => {
  assert.equal(stem("coughing"), "cough"); assert.equal(stem("headaches"), "headache");
  assert.equal(stem("vomiting"), "vomit"); assert.equal(stem("throbbing"), "throb");
  assert.equal(stem("pressing"), "press"); assert.equal(stem("morning"), "morning");
  assert.equal(stem("eating"), "eating"); assert.equal(stem("stress"), "stress");
});
t("worse/better become modalities, not search terms", () => {
  const e = extractKeywords(["headache worse from light and noise", "better by warmth"]);
  assert.ok(!e.groups.some((g) => g.key === "worse" || g.key === "better"));
  assert.deepEqual(e.modalities.map((m) => `${m.dir}:${m.key}`), ["worse:light", "worse:noise", "better:warmth"]);
});
t("modality direction scoring", () => {
  const m = extractKeywords(["worse at night"]).modalities;
  assert.equal(modalityScore("anxiety; worse at night", m), 1);
  assert.equal(modalityScore("anxiety; better at night", m), -1);
  assert.equal(modalityScore("anxiety, night", m), 0);          // no direction word → neutral
});
t("negation: 'no thirst' / 'none' / severity are not searched", () => {
  const k = keys(["fever with chills", "no thirst", "None", "Nothing", "Mild"]);
  assert.deepEqual(k.sort(), ["chill", "fever"].sort());
});
t("no more first-10 truncation: 13 distinct words, 12 kept by default, all kept with a higher cap", () => {
  const input = ["throbbing headache on right side worse from light and noise", "nausea and vomiting with dizziness", "restless sleep with anxiety at night", "Temples", "Rest"];
  const dflt = keys(input);
  assert.equal(dflt.length, 12);                       // old code searched only 10 terms, and synonyms used up slots
  for (const w of ["sleep", "anxiety", "night", "temple"]) assert.ok(dflt.includes(w), `missing ${w}: ${dflt}`);
  const all = extractKeywords(input, 16).groups.map((g) => g.key);
  assert.equal(all.length, 13); assert.ok(all.includes("rest"));
});
t("generic words rank after specific ones when capped", () => {
  const e = extractKeywords(["pain", "burning", "throbbing", "itching", "vomiting", "dizziness", "swelling", "thirst", "fever", "cough", "rash", "weakness", "palpitations"], 12);
  assert.equal(e.groups.length, 12);
  assert.ok(!e.groups.some((g) => g.key === "pain"), "generic 'pain' should be dropped first");
});
t("synonym groups: old vocabulary matches", () => {
  const g = extractKeywords(["running nose"]).groups;
  const runn = g.find((x) => x.key === "run");  // 'running' isn't stemmed below 4 chars
  assert.ok(!runn, "running should stay whole");
  const w = extractKeywords(["watering eyes"]).groups.find((x) => x.key === "watering")!;
  assert.ok(groupMatches("lachrymation, burning", w));
  const a = extractKeywords(["anxious"]).groups[0];
  assert.ok(groupMatches("great anxiety at night", a));
});
t("short-word matching is word-start only (ear ≠ heart)", () => {
  const ear = extractKeywords(["ear"]).groups[0];
  assert.ok(groupMatches("pain in ear", ear)); assert.ok(groupMatches("ears ring", ear));
  assert.ok(!groupMatches("palpitation of heart", ear)); assert.ok(!groupMatches("fear of death", ear));
});
t("variants are safe for PostgREST filters (letters+spaces only)", () => {
  for (const s of [["a, b (c) 50% ; d.e"], ["headache; worse, cold & damp"]])
    for (const g of extractKeywords(s).groups) for (const v of g.variants) assert.match(v.text, /^[a-z ]+$/);
});
t("remedy name normalisation", () => {
  assert.equal(normalizeRemedyName("ARSENICUM ALBUM."), normalizeRemedyName("Arsenicum  album"));
});
t("category → section patterns", () => {
  assert.deepEqual(sectionPatterns("Respiration"), ["respirat", "cough", "chest", "larynx"]);
  assert.ok(sectionPatterns("Hands, Legs & Back")!.includes("extremit"));
  // checked against real data: "ear" must not match Heart, "male" must not match Female
  assert.ok(sectionPatterns("Ear")!.every((x) => x !== "ear"));
  assert.ok(sectionPatterns("Male Genitalia")!.includes("^male") && !sectionPatterns("Male Genitalia")!.includes("male"));
  assert.equal(sectionPatterns("Others"), undefined); assert.equal(sectionPatterns("Clinical"), undefined);
  assert.equal(sectionPatterns(undefined), undefined);
});
console.log(`\n${n} checks passed`);
