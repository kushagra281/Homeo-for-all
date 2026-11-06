import assert from "node:assert/strict";
import {
  ALL_QUESTIONS, MAX_QUESTIONS, answerLines, answerPhrases, detectTopics, generalLeft, inferCovers, nextQuestion, psyAnswersOf, queueFor,
  type CaseQuestion, type CaseState,
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

// An AI-written question as the app stores it while the interview runs.
const aiQ = (id: string, text: string): CaseQuestion =>
  ({ id, topic: "ai", text, why: "", multi: false, options: [{ label: "Yes", phrases: [] }, { label: "No", phrases: [] }] });

// The general areas every case must cover before the interview can end.
const REQUIRED = ["gen-temp", "gen-thirst", "gen-digestion", "gen-bowels", "gen-desire", "gen-sleep", "gen-sweat", "gen-time", "gen-motion"];

t("topics are read from the symptoms, English and Hinglish", () => {
  assert.equal(detectTopics(["I feel anxiety and fear at night"])[0], "mind");
  assert.equal(detectTopics(["sar dard aur chakkar"])[0], "head");
  assert.equal(detectTopics(["bukhar with chills"])[0], "fever");
  assert.equal(detectTopics(["khansi raat ko"])[0], "respiration");
  assert.equal(detectTopics(["pain in knee joint"])[0], "joints");
  assert.deepEqual(detectTopics(["nothing recognisable"]), []);
  assert.equal(detectTopics([], "Skin")[0], "skin");   // the category button also sets the topic
});

t("the heart is its own topic: words, the Heart category, and heartburn staying a stomach complaint", () => {
  for (const w of ["palpitations", "chest pain on climbing stairs", "high blood pressure", "dhadkan tez", "heart disease"]) {
    assert.equal(detectTopics([w])[0], "heart", w);
  }
  assert.equal(detectTopics(["heartburn and acidity"])[0], "stomach", "heartburn is not a heart complaint");
  assert.ok(!detectTopics(["heartburn"]).includes("heart"));
  assert.equal(detectTopics(["tiredness"], "Heart")[0], "heart", "the Heart category sets the topic");
  // the case from the app: a Heart-category case with an acidity word keeps heart first, stomach second
  assert.deepEqual(detectTopics(["Palpitations", "Acidity after meal"], "Heart").slice(0, 2), ["heart", "stomach"]);
});

t("a heart case gets heart questions (with a doctor warning), then the general review", () => {
  const { asked, state } = interview(["palpitations"], {}, "Heart");
  for (const id of ["heart-trigger", "heart-better", "heart-with", "heart-health"]) assert.ok(asked.includes(id), `${id} is asked`);
  assert.ok(!asked.includes("heart-main"), "palpitations already says the main complaint");
  assert.ok(asked.indexOf("heart-trigger") < asked.indexOf("gen-temp"), "the heart comes before the general review");
  const warn = ALL_QUESTIONS.filter((q) => q.id === "heart-with");
  assert.ok(warn.length === 1 && /doctor/i.test(warn[0].why), "chest pain with sweating needs a doctor at once");
  assert.ok(asked.length <= MAX_QUESTIONS && generalLeft(state) === 0);
  // a heart case with no typed detail is asked what the problem is
  assert.ok(interview(["tiredness"], {}, "Heart").asked.includes("heart-main"));
});

t("heart answers reach the search as phrases", () => {
  const state: CaseState = { symptoms: ["palpitations"], category: "Heart", answers: {
    "heart-trigger": ["Effort or climbing stairs", "Emotion or stress"], "heart-with": ["Sweating", "Anxiety or fear of dying"], "heart-health": ["Known high blood pressure"],
  } };
  const ph = answerPhrases(state);
  for (const p of ["worse exertion", "worse emotion", "perspiration", "anxiety death", "high blood pressure"]) assert.ok(ph.includes(p), p);
});

t("time of day and motion are settled by what the AI asked", () => {
  assert.ok(inferCovers("At what time of day is it worse?").includes("time"));
  assert.ok(inferCovers("Is it worse in the morning or at night?").includes("time"));
  assert.ok(inferCovers("Does walking or rest make it better or worse?").includes("motion"));
  assert.ok(inferCovers("Does lying down relieve the pain?").includes("motion"));
  assert.ok(inferCovers("At what time is the pain worse?").includes("time"));
  assert.ok(inferCovers("At what time of day do the symptoms become worse?").includes("time"));
  assert.ok(inferCovers("Does it trouble you more in the morning or at night?").includes("time"));
  // onset and waking questions are not about the time of aggravation (Codex finding on PR #54)
  for (const q of ["What time did the palpitations begin?", "At what time did the hair fall start?", "What time of day does the cough start?",
    "Did it start in the morning or at night?", "How long ago did it begin, in the morning or evening?", "What time do you wake at night?", "What time do you usually sleep?"]) {
    assert.ok(!inferCovers(q).includes("time"), `${q} must not settle the time question`);
  }
  assert.ok(inferCovers("When did it begin and is it worse in the evening?").includes("time"), "an onset question that also asks what is worse still counts");
  assert.ok(!inferCovers("Where exactly is the pain?").includes("time"));
  assert.ok(!inferCovers("Do you have any family history of heart disease?").includes("motion"));
  const state: CaseState = { symptoms: ["x"], answers: { "ai-1": ["Evening"], "ai-2": ["Rest"] }, custom: {
    "ai-1": aiQ("ai-1", "At what time of day is the pain worse?"), "ai-2": aiQ("ai-2", "Does movement or rest make it worse?"),
  } };
  const ids = queueFor(state, { generalOnly: true }).map((q) => q.id);
  assert.ok(!ids.includes("gen-time") && !ids.includes("gen-motion"), "an AI question on time and motion settles them");
});

t("an AI onset question leaves the required time question open, and the sleep hour does not settle it", () => {
  const state: CaseState = { symptoms: ["palpitations"], answers: { "ai-1": ["2 weeks ago"] }, custom: { "ai-1": aiQ("ai-1", "What time did the palpitations begin?") } };
  assert.ok(queueFor(state, { generalOnly: true }).map((q) => q.id).includes("gen-time"), "gen-time is still asked");
  const sleep = interview(["cannot sleep"], {}, "Sleep");
  assert.ok(sleep.asked.includes("sleep-hour") && sleep.asked.includes("gen-time"), "the sleep case still gets the time-of-aggravation question");
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

t("a skipped question does not settle its modalities", () => {
  const state: CaseState = { symptoms: ["throbbing headache"], answers: { "head-worse": [], "head-better": [] } };
  const ids = queueFor(state).map((q) => q.id);
  assert.ok(ids.includes("gen-time") && ids.includes("gen-motion"), "time and motion are still asked");
  state.answers["head-worse"] = ["Light"];
  assert.ok(!queueFor(state).some((q) => q.id === "gen-time"), "an answered one still settles time");
});

t("a mixed complaint asks which emotion leads and covers every emotion named", () => {
  const state: CaseState = { symptoms: ["anxiety and anger"], answers: {} };
  assert.ok(queueFor(state).some((q) => q.id === "mind-main"), "the clarifier is kept");
  const ids = queueFor(state).map((q) => q.id);
  assert.ok(ids.includes("psy-5") && ids.includes("psy-10"), "anxiety and anger sections both present");
  state.answers["mind-main"] = ["Anger or irritability"];
  assert.ok(queueFor(state).some((q) => q.id === "psy-10"));
});

// ── hair loss and the general review ────────────────────────────────
t("hair complaints are recognised, English and Hinglish", () => {
  assert.equal(detectTopics(["hair loss"])[0], "hair");
  assert.equal(detectTopics(["Hairloss", "Dandruff"])[0], "hair");
  assert.equal(detectTopics(["baal jhad rahe hain"])[0], "hair");
  assert.equal(detectTopics(["itching scalp"])[0], "hair");
  assert.equal(detectTopics(["bald patches"])[0], "hair");
});

t("a hair complaint gets hair questions, then the general review", () => {
  const { asked } = interview(["hair loss"]);
  assert.ok(asked.includes("hair-pattern") && asked.includes("hair-onset") && asked.includes("hair-health"));
  for (const id of REQUIRED) {
    assert.ok(asked.includes(id), `${id} is part of the interview`);
  }
});

t("the new general questions answer into search phrases (so they reach the diagnosis)", () => {
  const state: CaseState = { symptoms: ["hair loss"], answers: {
    "gen-digestion": ["Indigestion after meals", "Acidity or heartburn"], "gen-sweat": ["Mostly on the head"], "hair-pattern": ["Round bald patches"],
  } };
  const ph = answerPhrases(state);
  for (const p of ["indigestion", "acidity heartburn", "perspiration head", "baldness patches"]) assert.ok(ph.includes(p), p);
});

t("what the AI already asked is not asked again in the general top-up", () => {
  const state: CaseState = {
    symptoms: ["hair loss"],
    answers: { "ai-1": ["Yes"], "ai-2": ["Yes"], "ai-3": ["No"] },
    custom: {
      "ai-1": aiQ("ai-1", "Do you wake up at a particular time at night?"),
      "ai-2": aiQ("ai-2", "Are you generally thirsty or thirstless?"),
      "ai-3": aiQ("ai-3", "How is your digestion and appetite?"),
    },
  };
  const ids = queueFor(state, { generalOnly: true }).map((q) => q.id);
  assert.ok(!ids.includes("gen-sleep") && !ids.includes("gen-thirst") && !ids.includes("gen-digestion"));
  assert.deepEqual(ids.sort(), ["gen-bowels", "gen-desire", "gen-motion", "gen-sweat", "gen-temp", "gen-time"], "asking about digestion does not settle the bowels");
  assert.equal(generalLeft(state), 6);
});

t("a top-up question the AI skipped is still asked, and the top-up ends when all are settled", () => {
  const state: CaseState = { symptoms: ["hair loss"], answers: {}, custom: {} };
  assert.equal(generalLeft(state), REQUIRED.length, "nothing covered: every required area is open");
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    const q = nextQuestion(state, { generalOnly: true });
    if (!q) break;
    seen.push(q.id);
    state.answers[q.id] = [q.options[0].label];
  }
  assert.deepEqual(seen.sort(), [...REQUIRED].sort());
  assert.equal(generalLeft(state), 0);
});

t("a skipped AI question settles nothing, and the top-up works past the normal question cap", () => {
  const custom = { "ai-1": aiQ("ai-1", "How is your sleep?") };
  assert.ok(queueFor({ symptoms: ["x"], answers: { "ai-1": [] }, custom }, { generalOnly: true }).some((q) => q.id === "gen-sleep"));
  const many: Record<string, string[]> = {};
  for (let i = 0; i < MAX_QUESTIONS + 2; i++) many[`ai-${i}`] = ["Yes"];
  assert.ok(nextQuestion({ symptoms: ["x"], answers: many }, { generalOnly: true }), "the cap does not hide the required questions");
  const q = nextQuestion({ symptoms: ["x"], answers: many });
  assert.ok(q && q.required, "past the cap only a required general question can still come");
  const allRequired: Record<string, string[]> = { ...many };
  for (const id of REQUIRED) allRequired[id] = ["Normal"];
  assert.equal(nextQuestion({ symptoms: ["x"], answers: allRequired }), null, "the full interview stops at the cap once the required ones are done");
});

t("what a question text settles is read correctly", () => {
  assert.deepEqual(inferCovers("How are your appetite and digestion?"), ["digestion"]);
  assert.deepEqual(inferCovers("How are your appetite, digestion and bowel habit?").sort(), ["bowels", "digestion"]);
  assert.ok(inferCovers("Do you sweat a lot at night?").includes("sweat"));
  assert.ok(inferCovers("Are you chilly or hot by nature?").includes("temp"));
  assert.deepEqual(inferCovers("Where exactly is the pain?"), []);
});

t("the typed words settle the general questions too", () => {
  const ids = queueFor({ symptoms: ["hair loss", "constipation and acidity", "poor sleep"], answers: {} }).map((q) => q.id);
  assert.ok(!ids.includes("gen-digestion") && !ids.includes("gen-sleep") && !ids.includes("gen-bowels"));
});

t("a long mind-led case still reaches every required general question, inside the cap", () => {
  for (const symptoms of [["anxiety and fear"], ["anxiety", "anger", "sadness"], ["hair loss"], ["acidity"], ["headache"]]) {
    const state: CaseState = { symptoms, answers: {} };
    const asked: string[] = [];
    for (let i = 0; i < 40; i++) {
      const q = nextQuestion(state);
      if (!q) break;
      asked.push(q.id);
      state.answers[q.id] = [q.options[0].label];
    }
    assert.ok(asked.length <= MAX_QUESTIONS, `${symptoms.join("+")}: ${asked.length} questions is within the cap`);
    // every required area is settled: asked, or already answered by a topic question or the typed words
    assert.equal(generalLeft(state), 0, `${symptoms.join("+")}: required general questions still open`);
  }
});

t("required general questions come before the optional ones, and optional ones are the first to go", () => {
  const ids = queueFor({ symptoms: ["x"], answers: {} }).map((q) => q.id);
  const lastRequired = Math.max(...ids.map((id, i) => (REQUIRED.includes(id) ? i : -1)));
  const firstOptional = Math.min(...ids.map((id, i) => (["gen-air", "gen-energy"].includes(id) ? i : 999)));
  assert.ok(lastRequired < firstOptional);
  // nearly at the cap: a topic question gives way to a required one
  const many: Record<string, string[]> = {};
  for (let i = 0; i < MAX_QUESTIONS - REQUIRED.length; i++) many[`ai-${i}`] = ["Yes"];
  const q = nextQuestion({ symptoms: ["anxiety"], answers: many });
  assert.ok(q && q.required, "only the required ones fit under the cap: the next one is a required one");
});
