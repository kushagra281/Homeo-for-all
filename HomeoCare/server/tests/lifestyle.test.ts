import assert from "node:assert/strict";
import { lifestyleFor, lifestyleTopics, LIFESTYLE_TOPICS } from "../../client/src/lib/lifestyle";
import { detectTopics } from "../../client/src/lib/caseTaking";

const t = (name: string, fn: () => void) => { fn(); console.log("ok  ", name); };
// Nothing treatment-like may ever appear in the static lists: no medicine names, doses or cure claims.
const TREATMENT = /\b(\d+\s?(mg|ml|mcg|iu)|tablets?|capsules?|syrup|prescri\w*|antibiotics?|doses?|dosage|potency|cures?|remed(y|ies))\b/i;

t("a hair complaint and a stomach complaint no longer get the same list", () => {
  const hair = lifestyleFor(["hair loss"]);
  const stomach = lifestyleFor(["acidity after meals"]);
  assert.deepEqual(hair.topics, ["hair"]);
  assert.deepEqual(stomach.topics, ["stomach"]);
  assert.notDeepEqual(hair.lifestyle.do, stomach.lifestyle.do);
  assert.notDeepEqual(hair.lifestyle.avoid, stomach.lifestyle.avoid);
  assert.ok(hair.lifestyle.do.some((x) => /scalp|protein|thyroid|iron/i.test(x)));
});

t("the lists have both sides, are short, and carry no treatment advice", () => {
  for (const s of ["hair loss", "acidity", "headache", "fever", "cough", "sore throat", "itching skin", "knee pain", "burning urine", "no sleep", "irregular periods", "anxiety", "nothing known here"]) {
    const { lifestyle } = lifestyleFor([s]);
    assert.ok(lifestyle.do.length >= 4 && lifestyle.do.length <= 6, `${s}: do`);
    assert.ok(lifestyle.avoid.length >= 4 && lifestyle.avoid.length <= 6, `${s}: avoid`);
    for (const x of [...lifestyle.do, ...lifestyle.avoid]) {
      assert.ok(x.length >= 6 && x.length <= 100, `${s}: "${x}" length`);
      assert.ok(!TREATMENT.test(x), `${s}: "${x}" reads like treatment`);
    }
  }
});

t("a mixed complaint blends two topics without repeating an item", () => {
  const { topics, lifestyle } = lifestyleFor(["hair loss", "acidity"]);
  assert.equal(topics.length, 2);
  assert.ok(lifestyle.do.length <= 6 && new Set(lifestyle.do).size === lifestyle.do.length);
  assert.ok(lifestyle.do.some((x) => /scalp|protein/i.test(x)) && lifestyle.do.some((x) => /meal|chew|water/i.test(x)));
});

t("typed words win; the chosen category is used only when nothing typed says more", () => {
  assert.deepEqual(lifestyleFor(["hair loss"], "Stomach").topics[0], "hair");
  assert.deepEqual(lifestyleFor(["tiredness"], "Skin").topics, ["skin"]);
  assert.deepEqual(lifestyleFor(["tiredness"], "Stomach").topics, ["stomach"]);
  assert.deepEqual(lifestyleTopics(["🔍 acidity"], "Throat"), ["throat"], "search-box markers are not complaints");
});

t("heart complaints and the Heart category get a heart list, not the general one", () => {
  for (const s of ["palpitations", "chest pain on climbing stairs", "high blood pressure", "dhadkan tez", "heart disease"]) {
    assert.equal(lifestyleFor([s]).topics[0], "heart", s);
  }
  assert.deepEqual(lifestyleFor(["tiredness"], "Heart").topics, ["heart"]);
  assert.deepEqual(lifestyleFor(["hair loss"], "Heart").topics[0], "hair", "typed words win over the category");
  const { lifestyle } = lifestyleFor(["palpitations"]);
  assert.ok(lifestyle.do.some((x) => /salt/i.test(x)) && lifestyle.avoid.some((x) => /smok/i.test(x)));
  assert.ok(lifestyle.do.some((x) => /doctor/i.test(x)), "a warning to see a doctor for chest pain");
  assert.notDeepEqual(lifestyle.do, lifestyleFor(["zzz qqq"]).lifestyle.do);
});

t("with nothing recognised the general list is shown, with no topic labels", () => {
  const r = lifestyleFor(["zzz qqq"]);
  assert.deepEqual(r.topics, []);
  assert.ok(r.lifestyle.do.length === 5 && r.lifestyle.avoid.length === 5);
  assert.notDeepEqual(r.lifestyle.do, lifestyleFor(["hair loss"]).lifestyle.do);
});

t("every list topic is recognised from a sample word", () => {
  const sample: Record<string, string> = {
    hair: "hair loss", heart: "palpitations", mind: "anxiety", head: "headache", fever: "fever", stomach: "acidity", respiration: "cough", throat: "sore throat",
    skin: "itching rash", joints: "joint pain", urinary: "burning urine", sleep: "insomnia", female: "irregular menses",
  };
  assert.deepEqual([...LIFESTYLE_TOPICS].sort(), Object.keys(sample).sort(), "a sample word for every list");
  for (const [topic, word] of Object.entries(sample)) {
    if (topic !== "heart") assert.ok(detectTopics([word]).includes(topic), `${word} -> ${topic}`);   // the heart is recognised in lifestyle.ts itself
    assert.equal(lifestyleFor([word]).topics[0], topic, `${word} -> ${topic}`);
    const { lifestyle } = lifestyleFor([word]);
    assert.ok(lifestyle.do.length >= 4 && lifestyle.avoid.length >= 4, topic);
  }
});
