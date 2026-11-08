// Run: npx tsx server/tests/layPhrases.test.ts   (no database needed)
import assert from "node:assert/strict";
import { rewriteLay, LAY_RULE_COUNT } from "../utils/layPhrases";
import { extractKeywords } from "../utils/keywords";

let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log("ok  ", name); };
const rw = (s: string) => rewriteLay(s);

t("everyday phrases become the repertory's wording", () => {
  const cases: Array<[string, string]> = [
    ["cannot bear any movement", "worse motion"],
    ["short tempered", "irritability"],
    ["burning when I pee", "urination burning"],
    ["afraid to be alone", "fear alone"],
    ["can't stop crying", "weeping"],
    ["feels like pins and needles", "tingling"],
    ["afraid of dying", "fear death"],
    ["ringing in the ears", "ear noises"],
  ];
  for (const [said, wording] of cases) assert.ok(rw(said).includes(wording), `${said} -> ${rw(said)}`);
});
t("restlessness is not read as 'better at rest' (negative forms come first)", () => {
  assert.equal(rw("cannot lie still"), "restlessness");
  assert.ok(!rw("cannot lie still").includes("motion"));
  assert.equal(rw("wants to lie still"), "worse motion");
});
t("the textbook words are left alone", () => {
  assert.equal(rw("sensitive to touch"), "sensitive to touch");
  assert.equal(rw("cold applications"), "cold applications");
  assert.equal(rw("sprain of tendons"), "sprain of tendons");
  assert.equal(rw("bruised"), "bruised");
});
t("the body part and the qualifier survive the rewrite", () => {
  assert.equal(rw("shooting pain after crushing fingers"), "shooting pain after injury fingers");
  assert.equal(rw("constipation ineffectual urging"), "constipation urging ineffectual");
  assert.equal(rw("cold damp feet"), "cold damp feet");
});
t("a rule never re-matches the wording another rule produced", () => {
  for (const s of ["worse motion", "fear death", "urination burning", "irritability", "weeping", "sore bruised"]) assert.equal(rw(s), s);
});
t("rewriting is a pure function of the text and tolerates odd input", () => {
  assert.equal(rw("Can’t  STAND   movement"), "worse motion");
  assert.equal(rw(""), "");
  assert.equal(rw("   "), "");
  assert.equal(rw("headache"), "headache");
  assert.equal(rw("cannot bear any movement"), rw("cannot bear any movement"));
});
t("it is wired into the keyword step: the patient's phrase reaches the repertory's words", () => {
  const keys = (s: string[]) => extractKeywords(s).groups.map((g) => g.key);
  assert.ok(keys(["cannot bear any movement"]).includes("motion"), keys(["cannot bear any movement"]).join());
  const m = extractKeywords(["cannot bear any movement"]).modalities;
  assert.deepEqual(m.map((x) => `${x.dir}:${x.key}`), ["worse:motion"]);
  assert.ok(keys(["short tempered"]).includes("irritability"));
});
t("rule list is non-trivial and every rule compiles", () => {
  assert.ok(LAY_RULE_COUNT > 60, String(LAY_RULE_COUNT));
});
console.log(`\n${n} checks passed`);
