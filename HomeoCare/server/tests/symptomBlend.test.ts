// Run: npx tsx server/tests/symptomBlend.test.ts   (no database needed)
import assert from "node:assert/strict";
import { extractKeywords } from "../utils/keywords";
import { blendSymptomRows } from "../services/symptomBlend";
import type { RemedyScore } from "../services/scoringService";

let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok  ", name); };
const mk = (name: string, raw: number): RemedyScore => ({
  remedy_name: name, raw_score: raw, score: 0, confidence: 0, rubric_count: 1, grade_sum: 1,
  covered_rubrics: [{ rubric_code: "1", label: "x", grade: 1, weight: 1, contribution: raw }], explanation: [], eliminated: false,
});
const kw = extractKeywords(["spasmodic cough", "worse after midnight", "whooping"]);

t("no sentence rows: list is returned unchanged", () => {
  const base = [mk("A", 5), mk("B", 3)];
  assert.deepEqual(blendSymptomRows(base, [], kw), base);
});
t("a remedy with matching sentences moves above one without", () => {
  const out = blendSymptomRows([mk("bryonia alba", 5), mk("drosera rotundifolia", 4.5)], [
    { remedy_name: "DROSERA ROTUNDIFOLIA", symptom: "Spasmodic, dry cough, like whooping-cough" },
    { remedy_name: "DROSERA", symptom: "Worse, after midnight" },
  ], kw);
  assert.equal(out[0].remedy_name, "drosera rotundifolia");
});
t("an unknown remedy needs a sentence with two keywords", () => {
  const one = blendSymptomRows([mk("A", 5)], [{ remedy_name: "NEWREM", symptom: "cough" }], kw);
  assert.ok(!one.some((r) => r.remedy_name.startsWith("NEWREM")));
  const two = blendSymptomRows([mk("A", 5)], [{ remedy_name: "NEWREM", symptom: "spasmodic cough like whooping" }], kw);
  assert.ok(two.some((r) => r.remedy_name.toLowerCase().startsWith("newrem")));
});
t("same sentence from two sites counts once; at most 5 sentences per remedy", () => {
  const rows = Array.from({ length: 12 }, (_, i) => ({ remedy_name: "DROSERA", symptom: `spasmodic cough variant ${i}` }));
  rows.push({ remedy_name: "DROSERA", symptom: "spasmodic cough variant 0" });
  const out = blendSymptomRows([mk("drosera rotundifolia", 1)], rows, kw);
  assert.equal(out[0].covered_rubrics.filter((c) => c.rubric_code.startsWith("sym:")).length, 5);
});
t("scores are re-normalised to 100 for the leader", () => {
  const out = blendSymptomRows([mk("a", 5), mk("b", 2)], [{ remedy_name: "B", symptom: "spasmodic cough whooping" }], kw);
  assert.equal(out[0].score, 100);
});
console.log(`${n} checks passed`);
