import assert from "node:assert/strict";
import { scoreRemedies, splitMatches } from "../services/scoringService";

// The scraped database labels mental rubrics "mind" (990 of them); the code used to look for
// "mental" only, so those rubrics got the weight of an ordinary physical symptom.
const match = (code: string) => ({ rubric_code: code, label: code, confidence: 1, original_symptom: code, is_eliminating: false });
const row = (code: string, type: string, weight: number, remedy: string) =>
  ({ rubric_code: code, rubric_label: code, body_system: "x", symptom_type: type, weight, is_negative: false, remedy_name: remedy, grade: 1 });

const result = scoreRemedies(
  [match("1"), match("2")],
  [row("1", "mind", 3, "aconitum napellus"), row("2", "particular", 1, "belladonna")]
);
const byName = Object.fromEntries(result.remedies.map((r) => [r.remedy_name, r]));
assert.equal(byName["aconitum napellus"].covered_rubrics[0].weight, 3);
assert.ok(byName["aconitum napellus"].raw_score > byName["belladonna"].raw_score, "a mind rubric must outweigh a particular one");
console.log("ok   mind rubrics get the mental weight");

const split = splitMatches([
  { label: "Fear of death", weight: 3 },
  { label: "Throbbing headache", weight: 1 },
  { label: "Thirstless", weight: 2 },
  { label: "Fear of death", weight: 3 },        // same rubric twice -> listed once
  { label: "", weight: 1 },
]);
assert.deepEqual(split.mental, ["Fear of death"]);
assert.deepEqual(split.physical, ["Throbbing headache", "Thirstless"]);
assert.equal(split.keynote, true);
assert.equal(splitMatches([{ label: "Cough", weight: 1 }]).keynote, false);
assert.equal(splitMatches([]).keynote, false);
console.log("ok   mental and physical matches are split; a mental match marks a keynote");
