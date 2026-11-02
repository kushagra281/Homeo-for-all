// MIND / PSYCHOLOGY QUESTIONNAIRE — the 35 questions of the case-taking pipeline.
//
// Each answer maps to short search phrases. Only words that actually occur in the materia
// medica data are used (see VERIFIED_WORDS): a word the data never contains would match nothing
// and only lower the relevance of every rubric. Answers with no phrase ("Calm", "No") are kept
// for the patient's own record but do not change the search. "Sometimes" is deliberately not
// searched: only a clear "Yes" counts as a symptom.

export interface PsyOption { label: string; phrases: string[] }
export interface PsyQuestion {
  id: number;
  section: string;
  text: string;
  multi: boolean;
  options: PsyOption[];
}

export const PSY_SECTIONS = [
  "Emotional nature",
  "Anxiety and fear",
  "Anger and irritability",
  "Sadness, grief and sensitivity",
  "Thinking and mental behaviour",
  "Social behaviour",
  "Stress response",
] as const;

const o = (label: string, ...phrases: string[]): PsyOption => ({ label, phrases });
const yn = (...phrases: string[]): PsyOption[] => [o("Yes", ...phrases), o("Sometimes"), o("No")];
const q = (id: number, section: number, text: string, multi: boolean, options: PsyOption[]): PsyQuestion =>
  ({ id, section: PSY_SECTIONS[section], text, multi, options });

export const PSY_QUESTIONS: PsyQuestion[] = [
  // A. Emotional nature
  q(1, 0, "How would you describe your nature?", true, [
    o("Calm and composed"), o("Irritable", "irritability"), o("Sensitive", "sensitive"), o("Emotional", "weeping", "mood"),
    o("Reserved"), o("Overthinking", "thinking", "brooding"), o("Aggressive", "anger")]),
  q(2, 0, "Do small things hurt your feelings?", false, yn("sensitive")),
  q(3, 0, "Do you take other people's words to heart?", false, yn("sensitive")),
  q(4, 0, "Do you express your feelings easily or keep them inside?", false, [
    o("Express easily"), o("Keep them inside", "silent", "brooding")]),

  // B. Anxiety and fear
  q(5, 1, "What do you worry about most?", true, [
    o("Future", "anxiety future"), o("Health", "anxiety fear disease"), o("Family", "anxiety"), o("Financial security", "worry"),
    o("Relationships", "anxiety"), o("Work", "worry"), o("Unknown fear", "fear", "dread")]),
  q(6, 1, "What happens when you are anxious?", true, [
    o("Heartbeat increases", "anxiety"), o("Restlessness", "restlessness"), o("Sweating", "anxiety"),
    o("Breathlessness", "anxiety"), o("Nervousness in the stomach", "anxiety"), o("Thinking again and again", "thinking")]),
  q(7, 1, "Is anxiety worse when you are alone or among people?", false, [
    o("Worse alone", "anxiety alone", "fear alone"), o("Worse in company", "anxiety company"), o("No difference")]),
  q(8, 1, "Do you feel that something bad is going to happen?", false, yn("dread", "fear")),
  q(9, 1, "Are you afraid of anything in particular?", true, [
    o("Darkness", "fear darkness"), o("Death", "fear death"), o("Disease", "fear disease"),
    o("Failure", "fear"), o("Rejection", "fear"), o("The future", "fear future")]),

  // C. Anger and irritability
  q(10, 2, "What makes you angry?", true, [
    o("Contradiction", "anger"), o("Small things", "irritability"), o("Criticism", "irritability", "sensitive"),
    o("Injustice", "anger"), o("Noise", "irritability")]),
  q(11, 2, "How do you react when angry?", true, [
    o("Shouting", "anger"), o("Crying", "weeping", "anger"), o("Going silent", "silent"),
    o("Throwing things", "anger"), o("Walking away alone", "alone")]),
  q(12, 2, "How long does the anger last?", false, [o("Minutes"), o("Hours"), o("Days", "brooding")]),
  q(13, 2, "Do you regret it afterwards?", false, yn()),
  q(14, 2, "Do you express your anger or suppress it?", false, [o("Express it"), o("Suppress it", "silent", "anger")]),

  // D. Sadness, grief and sensitivity
  q(15, 3, "Do you cry easily?", false, yn("weeping")),
  q(16, 3, "How do you feel after crying?", false, [o("Relief"), o("Worse", "weeping", "grief"), o("No change")]),
  q(17, 3, "Do events from the past keep coming back to you?", false, yn("past", "brooding")),
  q(18, 3, "Do you feel that nobody understands you?", false, yn()),
  q(19, 3, "Do you want emotional support, or prefer to be alone?", false, [
    o("Comfort and sympathy help", "better consolation"), o("Comforting makes me worse", "worse consolation"),
    o("I prefer to be alone", "alone")]),

  // E. Thinking and mental behaviour
  q(20, 4, "Do you keep thinking about a task again and again?", false, yn("thinking", "brooding")),
  q(21, 4, "Do you find it hard to make decisions?", false, yn("indecision")),
  q(22, 4, "Is your concentration weak?", false, yn("concentration")),
  q(23, 4, "Do you keep remembering small things and get upset?", false, yn("brooding")),
  q(24, 4, "Do you find other people's criticism hard to bear?", false, yn("sensitive")),
  q(25, 4, "Are you a perfectionist?", false, yn()),

  // F. Social behaviour
  q(26, 5, "Do you prefer to be alone or in company?", false, [o("Alone", "alone"), o("Company", "company"), o("Depends")]),
  q(27, 5, "Do you hesitate to meet new people?", false, yn("timid", "shy")),
  q(28, 5, "Do you trust people easily?", false, [o("Yes, easily"), o("No, I am suspicious", "suspicious")]),
  q(29, 5, "Do you need sympathy and attention?", false, yn("sympathy")),
  q(30, 5, "Do you share your problems with others?", false, yn()),

  // G. Stress response
  q(31, 6, "When stressed, what changes first?", true, [
    o("Headache", "headache"), o("Acidity"), o("Sleep", "sleeplessness"), o("Appetite"), o("Irritability", "irritability"), o("Palpitations")]),
  q(32, 6, "Under stress, do you work more or avoid work?", false, [o("Work more", "restlessness"), o("Avoid work", "indifferent")]),
  q(33, 6, "Does stress wake you at night?", false, yn("sleeplessness")),
  q(34, 6, "Do you feel mentally exhausted?", false, yn("exhaustion")),
  q(35, 6, "Have you had panic-like episodes?", false, yn("anxiety", "fear")),
];

/** Words that occur in the materia medica data (checked against the live database). */
export const VERIFIED_WORDS = new Set([
  "fear", "irritability", "anxiety", "restlessness", "sensitive", "memory", "alone", "forgetful", "weeping", "death",
  "mood", "concentration", "dread", "grief", "company", "indifferent", "disease", "anger", "thinking", "timid",
  "suspicious", "future", "silent", "consolation", "brooding", "indecision", "sleeplessness", "exhaustion", "shy",
  "worry", "darkness", "sympathy", "past", "headache", "worse", "better",
]);

export type PsyAnswers = Record<number, string[]>;

/** Search phrases for the chosen answers (no duplicates, order of the questionnaire). */
export function psychologyPhrases(answers: PsyAnswers): string[] {
  const out: string[] = [];
  for (const question of PSY_QUESTIONS) {
    const chosen = answers[question.id] || [];
    for (const label of chosen) {
      const option = question.options.find((x) => x.label === label);
      for (const p of option?.phrases || []) if (!out.includes(p)) out.push(p);
    }
  }
  return out;
}

/** Plain-language lines for the patient's record: "Cry easily: Yes". */
export function psychologySummary(answers: PsyAnswers): Array<{ question: string; answer: string }> {
  return PSY_QUESTIONS
    .filter((x) => (answers[x.id] || []).length > 0)
    .map((x) => ({ question: x.text, answer: answers[x.id].join(", ") }));
}
