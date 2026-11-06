// Run: tsx server/tests/profileNumbers.test.ts
// Age, height and weight: a number in a believable range is kept; anything else is saved as empty (null).
import assert from "node:assert/strict";
process.env.SUPABASE_URL = "http://main.test"; process.env.SUPABASE_ANON_KEY = "k";
const { profileNumber } = await import("../utils/supabase");

const t = (name: string, fn: () => void) => { fn(); console.log("ok  ", name); };

t("normal values are kept (age is rounded)", () => {
  assert.equal(profileNumber("age", "34"), 34);
  assert.equal(profileNumber("age", 34.6), 35);
  assert.equal(profileNumber("height_cm", "170.5"), 170.5);
  assert.equal(profileNumber("weight_kg", 70), 70);
});

t("empty, text and non-numbers become null", () => {
  for (const v of ["", "  ", "35 yrs", "abc", null, undefined, NaN, Infinity, {}, []]) {
    assert.equal(profileNumber("age", v), null, String(v));
  }
});

t("values outside a believable range become null (they used to be saved, or broke the whole save)", () => {
  assert.equal(profileNumber("age", -5), null);
  assert.equal(profileNumber("age", 150), null);
  assert.equal(profileNumber("height_cm", -5), null);
  assert.equal(profileNumber("height_cm", 3), null);
  assert.equal(profileNumber("weight_kg", 99999999), null);
  assert.equal(profileNumber("weight_kg", 0), null);
});

t("the limits themselves are allowed", () => {
  assert.equal(profileNumber("age", 0), 0);
  assert.equal(profileNumber("age", 120), 120);
  assert.equal(profileNumber("height_cm", 30), 30);
  assert.equal(profileNumber("weight_kg", 500), 500);
});

t("an unknown column is never saved as a number", () => assert.equal(profileNumber("shoe_size", 42), null));

console.log("\n5 checks passed (profile numbers)");
process.exit(0);
