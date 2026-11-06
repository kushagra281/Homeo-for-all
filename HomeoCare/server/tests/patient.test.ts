import assert from "node:assert/strict";
import { CASES } from "../trials/cases";
import { PERSONAS } from "../trials/personas";
import { PERFECT, TYPICAL, answerQuestion, hashSeed, interview, rng } from "../trials/patient";
import { ALL_QUESTIONS, MAX_QUESTIONS, answerPhrases } from "../../client/src/lib/caseTaking";

const t = (name: string, fn: () => void) => { fn(); console.log("ok  ", name); };
const q = (id: string) => ALL_QUESTIONS.find((x) => x.id === id)!;

t("every persona belongs to its case and says something", () => {
  const seen = new Set<number>();
  for (const p of PERSONAS) {
    const c = CASES[p.n - 1];
    assert.ok(c && c.name.startsWith(p.of), `persona ${p.n} "${p.of}" vs case "${c?.name}"`);
    assert.ok(!seen.has(p.n), `case ${p.n} has two personas`); seen.add(p.n);
    assert.ok(p.typed.length > 0 && p.picks.length > 0, p.of);
  }
  assert.ok(PERSONAS.length >= 40);
});

t("every fact a persona confirms is an option somewhere in the question bank (no typos)", () => {
  for (const p of PERSONAS) assert.deepEqual(interview(p, PERFECT).unknown, [], p.of);
});

t("the random generator is seeded: the same seed gives the same numbers", () => {
  const a = rng(7), b = rng(7), c = rng(8);
  const xs = [a(), a(), a()], ys = [b(), b(), b()], zs = [c(), c(), c()];
  assert.deepEqual(xs, ys);
  assert.notDeepEqual(xs, zs);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notEqual(hashSeed("Sepia", 0), hashSeed("Sepia", 1));
});

t("a perfect patient ticks exactly the options that match the true facts", () => {
  const facts = new Set(["chilly", "thirstless", "worse evening"]);
  assert.deepEqual(answerQuestion(q("gen-temp"), facts, PERFECT, rng(1)), ["Chilly, wants warm clothes"]);
  assert.deepEqual(answerQuestion(q("gen-thirst"), facts, PERFECT, rng(1)), ["Thirstless"]);
  assert.deepEqual(answerQuestion(q("gen-time"), facts, PERFECT, rng(1)), ["Evening"]);
  assert.deepEqual(answerQuestion(q("gen-sweat"), facts, PERFECT, rng(1)), [], "nothing fits: nothing is ticked");
  // a single-choice question takes one answer even when two options fit
  assert.equal(answerQuestion(q("gen-time"), new Set(["worse morning", "worse night"]), PERFECT, rng(1)).length, 1);
  // a multiple-choice question takes all that fit
  assert.deepEqual(answerQuestion(q("gen-desire"), new Set(["desire sweets", "desire salt"]), PERFECT, rng(1)), ["Sweets", "Salty food"]);
});

t("a typical patient forgets, misclicks and skips, and is the same every time for one seed", () => {
  const facts = new Set(["desire sweets", "desire salt", "desire sour", "desire spicy", "desire fat", "desire cold drinks"]);
  const full = answerQuestion(q("gen-desire"), facts, PERFECT, rng(3)).length;
  let lost = 0, skipped = 0, extra = 0;
  for (let i = 0; i < 300; i++) {
    const a = answerQuestion(q("gen-desire"), facts, TYPICAL, rng(i));
    assert.deepEqual(a, answerQuestion(q("gen-desire"), facts, TYPICAL, rng(i)), "same seed, same answer");
    if (!a.length) skipped++; else if (a.length < full) lost++;
    if (a.length > 0 && a.some((l) => !["Sweets", "Salty food", "Sour things", "Spicy food", "Fatty or rich food", "Cold drinks"].includes(l))) extra++;
  }
  assert.ok(lost > 50 && skipped > 5 && extra > 5, `forgot ${lost}, skipped ${skipped}, misclicked ${extra}`);
});

t("the interview is the app's own, ends inside the limit and builds the search words like the app", () => {
  for (const p of PERSONAS) {
    const iv = interview(p, PERFECT);
    assert.ok(iv.asked.length > 0 && iv.asked.length <= MAX_QUESTIONS, `${p.of}: ${iv.asked.length} questions`);
    assert.equal(new Set(iv.asked).size, iv.asked.length, "no question twice");
    assert.deepEqual(iv.symptoms.slice(0, p.typed.length), p.typed, "the typed words come first");
    assert.deepEqual(iv.symptoms.slice(p.typed.length, p.typed.length + answerPhrases(iv.state).length), answerPhrases(iv.state));
    assert.equal(iv.symptoms.includes(`category: ${p.category}`), !!p.category);
    assert.deepEqual(iv.filters, p.category ? { symptom_location: p.category } : {});
  }
});

t("the interview follows the case: a heart patient is asked the heart questions, a hair patient is not", () => {
  const cactus = PERSONAS.find((p) => p.of === "Cactus:")!;
  const iv = interview(cactus, PERFECT);
  assert.ok(iv.asked.includes("heart-trigger") && iv.asked.includes("heart-with"));
  assert.ok(iv.symptoms.some((s) => /worse lying/.test(s)) && iv.symptoms.some((s) => /anxiety death/.test(s)));
  assert.ok(!iv.asked.some((id) => id.startsWith("hair-")));
});

t("a typical patient confirms fewer true facts than a perfect one, and each run is a different patient", () => {
  let perfect = 0, typical = 0, differ = 0;
  for (const p of PERSONAS) {
    const facts = new Set(p.picks);
    const trueHits = (iv: ReturnType<typeof interview>) => answerPhrases(iv.state).filter((ph) => facts.has(ph)).length;
    const b = interview(p, TYPICAL, 0), c = interview(p, TYPICAL, 1);
    perfect += trueHits(interview(p, PERFECT)); typical += trueHits(b);
    if (b.symptoms.join("|") !== c.symptoms.join("|")) differ++;
    assert.deepEqual(interview(p, TYPICAL, 0).symptoms, b.symptoms, "run 0 is always the same patient");
  }
  assert.ok(typical < perfect * 0.9, `true facts confirmed: typical ${typical}, perfect ${perfect}`);
  assert.ok(differ > PERSONAS.length / 2, `${differ} personas differ between runs`);
});

t("facts the patient already typed are not reported as gaps in the question bank", () => {
  const spongia = PERSONAS.find((p) => p.of === "Spongia:")!;     // typed "dry barking cough like croup"
  const gaps = interview(spongia, PERFECT).gaps;
  assert.ok(!gaps.includes("dry cough") && !gaps.includes("barking cough"), gaps.join(", "));
});
