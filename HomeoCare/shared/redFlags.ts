// RED FLAGS — warning signs that mean "see a doctor first", not "pick a remedy".
// Taken from the case-taking pipeline: the remedy search never replaces medical care.
//
// Works on the text the patient typed or chose (symptoms, answers, history). English and
// common Hindi/Hinglish words. A sign that is denied ("no fever", "bukhar nahi") is ignored.

export type RedFlagLevel = "danger" | "warning";
export interface RedFlag { code: string; level: RedFlagLevel; message: string }

interface Rule { code: string; level: RedFlagLevel; message: string; test: (t: string) => boolean }

// A match counts only if it is not denied just before it ("no", "not", "without", "nahi" ...).
const DENIAL = /(?:\bno\b|\bnot\b|\bwithout\b|\bdenies\b|\bnil\b|\bnahi\b|\bnahin\b|\bna\b|\bbina\b)[^.;,\n]{0,18}$/;

function has(text: string, re: RegExp): boolean {
  const g = new RegExp(re.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 24), m.index);
    // "bukhar nahi" - denial placed after the word
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (DENIAL.test(before)) continue;
    if (/^\s*(?:nahi|nahin|nil|absent|na\b)/i.test(after)) continue;
    return true;
  }
  return false;
}

const FEVER = /\bfever\b|\btemperature\b|\bbukh[ae]r\b|\bjwar\b/;
const HEADACHE = /\bheadache\b|\bhead pain\b|\bmigraine\b|\bsir (?:me )?(?:dard|darad)\b|\bsir dard\b/;

const RULES: Rule[] = [
  {
    code: "suicidal", level: "danger",
    message: "You mentioned thoughts of ending your life. Please talk to someone right now: a family member or friend, "
      + "or call Tele-MANAS (India) on 14416. If you are in immediate danger, call your local emergency number.",
    test: (t) => has(t, /\bsuicid|\bkill (?:myself|me)\b|\bend (?:my|this) life\b|\bwant to die\b|\bwish to die\b|\bmarna chah|\bjeena nahi|\bjaan dene\b/),
  },
  {
    code: "thunderclap", level: "danger",
    message: "A sudden, 'worst ever' headache needs emergency medical evaluation. Do not wait for a remedy.",
    test: (t) => has(t, /worst (?:headache|pain) (?:of|in) (?:my )?life|worst headache ever|thunderclap|sudden(?:ly)? (?:severe|worst|terrible) headache|achanak (?:bahut )?tez (?:sir )?dard/),
  },
  {
    code: "meningism", level: "danger",
    message: "Fever or headache with a stiff neck, rash or confusion can be meningitis. Seek emergency care immediately.",
    test: (t) => (has(t, FEVER) || has(t, HEADACHE)) && (
      has(t, /stiff(?:ness)? (?:of )?(?:the )?neck|neck (?:stiffness|rigidity|is stiff)|rigid neck|\bgardan (?:me )?akad|gardan akdi/)
      || (has(t, FEVER) && has(t, /\brash\b|\bpurple spots\b|\bchakatte\b/))),
  },
  {
    code: "unconscious", level: "danger",
    message: "Fainting, loss of consciousness, a seizure or new confusion needs emergency medical care.",
    test: (t) => has(t, /\bseizure|\bconvulsion|\bepilep|\bhad (?:a )?fit\b|\bfitting\b|\bunconscious|\bfaint(?:ed|ing)\b|\bpassed out\b|\bconfus(?:ed|ion)\b|\bdisoriented\b|\bbehosh|\bdaura\b|\bmirgi\b/),
  },
  {
    code: "stroke", level: "danger",
    message: "Weakness or numbness on one side, a drooping face or slurred speech can be a stroke. Call emergency services now.",
    test: (t) => has(t, /one[- ]sided (?:weakness|numbness)|weakness (?:on|in) one side|numbness (?:on|in) one side|(?:left|right) (?:side|arm|leg) (?:weak|numb)|facial droop|face (?:is )?drooping|slurred speech|difficulty (?:in )?speaking|trouble speaking|\bbolne me (?:dikkat|takleef)|\bzubaan ladkhad|\blakwa\b|\bparalysis\b/),
  },
  {
    code: "vision_loss", level: "danger",
    message: "Sudden loss of vision needs urgent eye or emergency care.",
    test: (t) => has(t, /sudden(?:ly)? (?:loss of vision|vision loss|blind)|lost (?:my )?vision|suddenly (?:cannot|can't|couldn't) see|achanak (?:dikhna band|nazar)/),
  },
  {
    code: "chest", level: "danger",
    message: "Chest pain or pressure, or trouble breathing, can be a heart or lung emergency. Get emergency help.",
    test: (t) => has(t, /chest (?:pain|pressure|tightness)|pain in (?:the )?chest|\bseene me (?:dard|bhaari)|difficulty (?:in )?breathing|trouble breathing|breathless(?:ness)? at rest|can'?t breathe|cannot breathe|\bsans (?:lene )?me (?:takleef|dikkat)|blue (?:lips|face)/),
  },
  {
    code: "bleeding", level: "danger",
    message: "Vomiting or coughing blood, or black/bloody stools, needs urgent medical evaluation.",
    test: (t) => has(t, /vomit(?:ing)? (?:of )?blood|blood in (?:the )?(?:vomit|stool|sputum)|bloody stool|black (?:tarry )?stool|\bcough(?:ing)? (?:up )?blood|\bkhoon (?:ki ulti|wali ulti|aana)/),
  },
  {
    code: "allergy", level: "danger",
    message: "Swelling of the lips, tongue or throat, or a spreading allergic reaction with breathlessness, needs emergency care.",
    test: (t) => has(t, /swelling (?:of|in) (?:the )?(?:lips?|tongue|throat|face)|throat (?:is )?(?:closing|swelling)|anaphyla/),
  },
  {
    code: "high_fever", level: "danger",
    message: "A very high fever (104 °F / 40 °C or more) needs prompt medical attention.",
    test: (t) => has(t, /\b10[4-9](?:\.\d)?\s*(?:°|degrees?)?\s*f\b|\b4[0-2](?:\.\d)?\s*(?:°|degrees?)?\s*c\b/),
  },
  {
    code: "migraine_pattern", level: "warning",
    message: "Repeated severe headache with vomiting and light or sound sensitivity fits migraine and needs a doctor's assessment. "
      + "A remedy search is not a substitute for it.",
    test: (t) => HEADACHE.test(t) && has(t, /vomit|\bulti\b/) && has(t, /\blight\b|\bphotophobia\b|\bnoise\b|\bsound\b|\broshni\b|\bshor\b/),
  },
  {
    code: "severe_pain", level: "warning",
    message: "Pain rated 9 or 10 out of 10 should be seen by a doctor, especially if it keeps coming back.",
    test: (t) => has(t, /\b(?:9|10)\s*\/\s*10\b|\b(?:9|10) out of 10\b|\bunbearable pain\b/),
  },
];

/** Warning signs found in the patient's text. Most serious first. */
export function detectRedFlags(texts: Array<string | undefined | null>, profile?: { age?: number } | null): RedFlag[] {
  const text = texts.filter((t): t is string => typeof t === "string" && t.trim() !== "").join(" . ").toLowerCase();
  const out: RedFlag[] = [];
  if (text) {
    for (const r of RULES) {
      try { if (r.test(text)) out.push({ code: r.code, level: r.level, message: r.message }); } catch { /* a bad rule must never break the search */ }
    }
  }
  if (text && profile?.age != null && profile.age < 1 && has(text, FEVER)) {
    out.push({ code: "infant_fever", level: "danger", message: "A fever in a baby under one year needs a doctor the same day." });
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === "danger" ? -1 : 1));
}
