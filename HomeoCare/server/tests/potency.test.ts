// Run: npx tsx server/tests/potency.test.ts
import assert from "node:assert/strict";
import { suggestPotency, potencyLine } from "../../shared/potency";

let passed = 0;
function t(name: string, fn: () => void) { fn(); passed++; console.log("ok  ", name); }

t("a recent complaint gets a short acute course", () => {
  const s = suggestPotency({ symptoms: ["sore throat since yesterday", "worse at night"], age: 30 });
  assert.equal(s.basis, "acute"); assert.equal(s.potency, "30C"); assert.match(s.repeat, /2-3 times a day/); assert.match(s.stop, /Stop as soon as/);
});
t("months or years, or 'recurrent', means chronic: once a day, then review, and a homeopath for the rest", () => {
  for (const txt of ["headache for 3 months", "eczema since childhood", "recurrent sinusitis", "chronic cough for years", "joint pain 2 years"]) {
    const s = suggestPotency({ symptoms: [txt] });
    assert.equal(s.basis, "chronic", txt); assert.match(s.repeat, /once a day/); assert.match(s.caution, /constitutional/);
  }
});
t("weeks and days are not chronic", () => {
  assert.equal(suggestPotency({ symptoms: ["cough for 5 days"] }).basis, "acute");
  assert.equal(suggestPotency({ symptoms: ["cold for 2 weeks"] }).basis, "acute");
});
t("children and older adults start lower and are sent to a homeopath", () => {
  const c = suggestPotency({ symptoms: ["fever"], age: "8" }); assert.equal(c.basis, "child"); assert.equal(c.potency, "6C or 30C"); assert.match(c.caution, /Child/);
  const o = suggestPotency({ symptoms: ["fever"], age: 75 }); assert.equal(o.basis, "senior"); assert.equal(o.potency, "6C or 30C");
});
t("a baby gets no number at all", () => {
  const s = suggestPotency({ symptoms: ["colic"], age: 1 }); assert.equal(s.basis, "infant"); assert.equal(s.potency, ""); assert.match(s.caution, /paediatrician/);
});
t("warning signs: no potency, see a doctor first (even for an adult)", () => {
  const s = suggestPotency({ symptoms: ["headache"], age: 30, redFlags: true }); assert.equal(s.basis, "red-flag"); assert.equal(s.potency, "");
  assert.match(potencyLine(s), /See a doctor first/);
});
t("heart or kidney history adds a check-first line; an unusable age is ignored", () => {
  assert.match(suggestPotency({ symptoms: ["cough"], heartOrKidney: true }).caution, /heart or kidney/);
  for (const age of ["", "abc", -3, 400, null, undefined]) assert.equal(suggestPotency({ symptoms: ["cough"], age }).basis, "acute");
});
t("potencyLine gives one readable string", () => {
  const line = potencyLine(suggestPotency({ symptoms: ["cough"] }));
  assert.match(line, /^30C - 3 pellets/);
});
console.log(`\n${passed} checks passed`);
