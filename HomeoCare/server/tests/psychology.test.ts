import assert from "node:assert/strict";
import { PSY_QUESTIONS, PSY_SECTIONS, VERIFIED_WORDS, psychologyPhrases, psychologySummary } from "../../client/src/lib/psychology";
import { extractKeywords } from "../utils/keywords";

const t = (name: string, fn: () => void) => { fn(); console.log("ok  ", name); };

t("all 35 questions, in 7 sections, with unique ids", () => {
  assert.equal(PSY_QUESTIONS.length, 35);
  assert.deepEqual(PSY_QUESTIONS.map((x) => x.id), Array.from({ length: 35 }, (_, i) => i + 1));
  assert.equal(new Set(PSY_QUESTIONS.map((x) => x.section)).size, PSY_SECTIONS.length);
  for (const x of PSY_QUESTIONS) assert.ok(x.options.length >= 2, `question ${x.id} needs options`);
});
t("every search word is one the materia medica data really contains", () => {
  for (const x of PSY_QUESTIONS) for (const op of x.options) for (const p of op.phrases)
    for (const w of p.split(" ")) assert.ok(VERIFIED_WORDS.has(w), `Q${x.id} "${op.label}": "${w}" is not in the data`);
});
t("a clear Yes is searched, Sometimes and No are not", () => {
  assert.deepEqual(psychologyPhrases({ 15: ["Yes"] }), ["weeping"]);
  assert.deepEqual(psychologyPhrases({ 15: ["Sometimes"] }), []);
  assert.deepEqual(psychologyPhrases({ 15: ["No"] }), []);
});
t("answers without a symptom (calm, perfectionist) add nothing", () => {
  assert.deepEqual(psychologyPhrases({ 1: ["Calm and composed"], 25: ["Yes"], 13: ["Yes"] }), []);
});
t("multiple choices are merged without duplicates", () => {
  // questionnaire order: question 8 first, then 9; "fear" appears once
  assert.deepEqual(psychologyPhrases({ 9: ["Death", "Disease"], 8: ["Yes"] }), ["dread", "fear", "fear death", "fear disease"]);
  assert.deepEqual(psychologyPhrases({ 5: ["Family", "Relationships"] }), ["anxiety"]);
});
t("each phrase becomes keywords the search engine understands", () => {
  const phrases = psychologyPhrases({ 7: ["Worse alone"], 19: ["Comfort and sympathy help"], 21: ["Yes"] });
  assert.ok(phrases.length >= 3);
  const kw = extractKeywords(phrases);
  assert.ok(kw.groups.length >= 3, "phrases must turn into keyword groups");
});
t("summary lists only answered questions", () => {
  const s = psychologySummary({ 2: ["Yes"], 26: ["Alone"] });
  assert.equal(s.length, 2);
  assert.equal(s[0].answer, "Yes");
});
