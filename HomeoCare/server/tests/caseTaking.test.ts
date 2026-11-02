import assert from "node:assert/strict";
import {
  ALL_QUESTIONS, MAX_QUESTIONS, answerLines, answerPhrases, detectTopics, nextQuestion, psyAnswersOf, queueFor, type CaseState,
} from "../../client/src/lib/caseTaking";
import { extractKeywords } from "../utils/keywords";

const t = (name: string, fn: () => void) => { fn(); console.log("ok  ", name); };

// Plays an interview: always takes the first option (or the named one) until no question is left.
function interview(symptoms: string[], pick: Record<string, string[]> = {}, category = "") {
  const state: CaseState = { symptoms, category, answers: {} };
  const asked: string[] = [];
  for (let i = 0; i < 40; i++) {
    const q = nextQuestion(state);
    if (!q) break;
    asked.push(q.id);
    state.answers[q.id] = pick[q.id] || [q.options[0].label];
  }
  return { state, asked };
}

t("topics are read from the symptoms, English and Hinglish", () => {
  assert.equal(detectTopics(["I feel anxiety and fear at night"])[0], "mind");
  assert.equal(detectTopics(["sar dard aur chakkar"])[0], "head");
  assert.equal(detectTopics(["bukhar with chills"])[0], "fever");
  assert.equal(detectTopics(["khansi raat ko"])[0], "respiration");
  assert.equal(detectTopics(["pain in knee joint"])[0], "joints");
  assert.deepEqual(detectTopics(["nothing recognisable"]), []);
  assert.equal(detectTopics([], "Skin")[0], "skin");   // the category button also sets the topic
});

t("an emotional symptom is followed by psychology questions, not generic ones", () => {
  const { asked } = interview(["anxiety and fear before exams"]);
  assert.ok(asked.some((id) => id.startsWith("psy-")), "psychology questions are asked");
  assert.ok(asked.indexOf("mind-cause") >= 0);
  assert.ok(asked.length >= 8, `a mind case gets a real interview, got ${asked.length}`);
  // the first thing asked is about the mind, not about temperature or time
  assert.ok(["mind-cause", "psy-5"].includes(asked[0]) || asked[0].startsWith("psy-"), asked[0]);
});

t("the strongest-emotion question is skipped when the patient already named it", () => {
  assert.ok(!interview(["very anxious"]).asked.includes("mind-main"));
  assert.ok(interview(["feeling low and not myself, can't explain"], {}, "Mind").asked.includes("mind-main"));
});

t("the questions follow the emotion: anger gets anger questions, sadness gets sadness questions", () => {
  const anger = interview(["constant anger and irritability"]).asked;
  const sad = interview(["depressed, cries all day"]).asked;
  assert.ok(anger.includes("psy-10") && !anger.includes("psy-15"));
  assert.ok(sad.includes("psy-15") && !sad.includes("psy-10"));
});

t("different symptoms give different questions", () => {
  const head = interview(["throbbing headache"]).asked;
  const stomach = interview(["acidity and bloating"]).asked;
  const skin = interview(["itching rash"]).asked;
  assert.ok(head.some((x) => x.startsWith("head-")) && !head.some((x) => x.startsWith("stomach-")));
  assert.ok(stomach.some((x) => x.startsWith("stomach-")));
  assert.ok(skin.some((x) => x.startsWith("skin-")));
  assert.notDeepEqual(head, stomach);
});

t("nothing is asked twice and modalities are not repeated", () => {
  for (const sy of [["anxiety"], ["headache worse light"], ["fever with chills"], ["cough"], ["itching rash"], ["knee pain"]]) {
    const { asked } = interview(sy);
    assert.equal(new Set(asked).size, asked.length, `repeat in ${sy}`);
    assert.ok(asked.length <= MAX_QUESTIONS);
    const covers = asked.map((id) => ALL_QUESTIONS.find((q) => q.id === id)!.covers || []);
    const seen = new Set<string>();
    covers.forEach((cs, i) => {
      if (!asked[i].startsWith("gen-")) return;
      for (const c of cs) assert.ok(!seen.has(c), `${asked[i]} repeats ${c} for ${sy}`);
    });
    // a general modality is not asked after a topic question already settled that kind
    const topicCovers = new Set(covers.flatMap((cs, i) => (asked[i].startsWith("gen-") ? [] : cs)));
    asked.filter((id) => id.startsWith("gen-")).forEach((id) => {
      for (const c of ALL_QUESTIONS.find((q) => q.id === id)!.covers || []) assert.ok(!topicCovers.has(c), `${id} repeats topic ${c}`);
    });
  }
});

t("what the patient already wrote is not asked again", () => {
  const a = interview(["throbbing headache in the forehead, worse at night, very thirsty"]).asked;
  assert.ok(!a.includes("head-type") && !a.includes("head-where") && !a.includes("gen-time") && !a.includes("gen-thirst"));
});

t("a new symptom typed during the interview changes the next questions", () => {
  const state: CaseState = { symptoms: ["headache"], answers: {} };
  assert.ok(nextQuestion(state)!.id.startsWith("head-"));
  state.symptoms.push("anxiety and fear");
  const ids = queueFor(state).map((q) => q.id);
  assert.ok(ids.some((id) => id.startsWith("psy-") || id.startsWith("mind-")), "mind questions join the interview");
});

t("answers become search phrases, so they change the diagnosis", () => {
  const { state } = interview(["headache"], {
    "head-type": ["Throbbing"], "head-worse": ["Light", "Noise"], "head-better": ["Pressure"],
  });
  const p = answerPhrases(state);
  for (const want of ["throbbing headache", "worse light", "worse noise", "better pressure"]) assert.ok(p.includes(want), want);
});

t("psychology answers are searched and also shown in the mind summary", () => {
  const state: CaseState = { symptoms: ["anxiety"], answers: { "psy-8": ["Yes"], "psy-7": ["Worse alone"], "psy-9": ["Death"] } };
  const p = answerPhrases(state);
  assert.ok(p.includes("dread") && p.includes("anxiety alone") && p.includes("fear death"));
  assert.deepEqual(psyAnswersOf(state), { 7: ["Worse alone"], 8: ["Yes"], 9: ["Death"] });
  assert.equal(answerLines(state).length, 3);
});

t("Sometimes, No and None add nothing; a skipped question adds nothing", () => {
  const state: CaseState = { symptoms: ["anxiety"], answers: { "psy-8": ["Sometimes"], "psy-15": ["No"], "mind-body": ["None of these"], "psy-9": [] } };
  assert.deepEqual(answerPhrases(state), []);
  assert.deepEqual(answerLines(state), [
    { question: "Do you feel that something bad is going to happen?", answer: "Sometimes" },
    { question: "Do you cry easily?", answer: "No" },
    { question: "Does it come with any body symptoms?", answer: "None of these" },
  ]);
});

t("an answer keeps its search phrases even if the topics change afterwards", () => {
  const state: CaseState = { symptoms: ["xyz"], answers: { "head-worse": ["Light"] } };
  assert.deepEqual(answerPhrases(state), ["worse light"]);
});

t("every question is well formed and every phrase is understood by the keyword search", () => {
  const ids = new Set<string>();
  for (const q of ALL_QUESTIONS) {
    assert.ok(!ids.has(q.id), `duplicate id ${q.id}`); ids.add(q.id);
    assert.ok(q.text && q.why && q.options.length >= 2, q.id);
    assert.equal(new Set(q.options.map((x) => x.label)).size, q.options.length, `duplicate option in ${q.id}`);
    for (const op of q.options) for (const ph of op.phrases) {
      const k = extractKeywords([ph]);
      assert.ok(k.groups.length + k.modalities.length > 0, `${q.id} "${ph}" gives no keyword`);
    }
  }
});

t("the interview ends: no endless questions, no empty interview for known symptoms", () => {
  for (const sy of [["anxiety"], ["headache"], ["acidity"], ["random unknown thing"]]) {
    const { asked } = interview(sy);
    assert.ok(asked.length <= MAX_QUESTIONS);
    assert.ok(asked.length >= 3, `${sy} asks at least 3 questions, got ${asked.length}`);
  }
});
