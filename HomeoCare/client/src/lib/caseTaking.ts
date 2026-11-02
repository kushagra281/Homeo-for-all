// SYMPTOM-DRIVEN CASE TAKING
//
// The next question depends on what the patient has typed and already answered:
//   * the symptoms are read for topics (mind, head, stomach, fever, ...);
//   * each topic has its own questions; a mind complaint first asks which emotion is strongest
//     and then goes through the matching psychology questions (anxiety, anger, sadness ...);
//   * general modality questions (time, temperature, motion, thirst) are asked at most once, and
//     never when the patient already wrote the answer or a topic question already covered it;
//   * every answer carries its own search phrases, so it changes the result.

import { PSY_QUESTIONS, type PsyAnswers } from "./psychology";

export interface CaseOption { label: string; phrases: string[] }
export interface CaseQuestion {
  id: string;
  topic: string;
  text: string;
  why: string;
  multi: boolean;
  options: CaseOption[];
  covers?: string[];                  // modality kinds this question settles: time, temp, motion, thirst ...
  skipIf?: RegExp;                    // patient already said it in the symptom text
  when?: (ctx: Ctx) => boolean;       // only after earlier answers make it relevant
}
interface Ctx { text: string; has: (id: string, label: string) => boolean; answered: (id: string) => boolean }

const o = (label: string, ...phrases: string[]): CaseOption => ({ label, phrases });
const NONE = "None of these";
const none = () => o(NONE);
const worse = (label: string, extra = label.toLowerCase()) => o(label, `worse ${extra}`);
const better = (label: string, extra = label.toLowerCase()) => o(label, `better ${extra}`);

// ── Topic detection (English and common Hinglish) ─────────────────
export const TOPIC_LABELS: Record<string, string> = {
  mind: "Mind and emotions", head: "Head", fever: "Fever", stomach: "Stomach and digestion",
  respiration: "Cough and breathing", throat: "Throat and cold", skin: "Skin", joints: "Joints, back and limbs",
  urinary: "Urinary", sleep: "Sleep", female: "Female complaints",
};
const TOPIC_PATTERNS: Array<[string, RegExp]> = [
  ["mind", /anxi|fear|afraid|panic|depress|sad|grief|anger|angry|irritab|restless|weep|cry|crying|mood|stress|worr|tension|lonely|hopeless|nervous|phobia|ghabra|dar\b|darr|gussa|udaas|udas|rona|chinta|tanav|mental|emotion|jealous|suicid|memory|forget/i],
  ["head", /head|migraine|sar\s*dard|sir\s*dard|temple|forehead|vertigo|dizz|chakkar/i],
  ["fever", /fever|bukhar|chill|shiver|temperature|sweat/i],
  ["stomach", /stomach|pet\b|abdom|nausea|vomit|acid|heartburn|bloat|gas\b|constipat|diarrh|loose motion|digest|appetite|indigest|ulti|kabz|dast|gastric|liver|colic|flatul/i],
  ["respiration", /cough|khansi|khasi|breath|asthma|wheez|sputum|phlegm|chest|saans|bronch/i],
  ["throat", /throat|gala\b|tonsil|cold\b|sneez|nose|nasal|sinus|jukam|zukam|hoarse|voice/i],
  ["skin", /skin|rash|itch|eczema|boil|pimple|acne|eruption|wart|hives|urticaria|khujli|daad|psoria|scab/i],
  ["joints", /joint|knee|back\b|backache|spine|shoulder|neck|arthr|rheuma|sciatic|muscle|cramp|stiff|gathiya|kamar|ghutne|limb|sprain|gout/i],
  ["urinary", /urin|bladder|kidney|burning micturition|peshab|prostate|stone/i],
  ["sleep", /sleep|insomnia|neend|nightmare|dream|snor/i],
  ["female", /menses|menstru|period|leucorrh|pregnan|ovar|uterus|pcos|breast|menopaus|periods/i],
];
const CATEGORY_TOPIC: Record<string, string> = {
  "Mind": "mind", "Head": "head", "Fever": "fever", "Stomach": "stomach", "Respiration": "respiration",
  "Skin": "skin", "Hands, Legs & Back": "joints", "Urinary System": "urinary", "Throat": "throat",
};

export function detectTopics(texts: string[], category = ""): string[] {
  const scored: Array<[string, number]> = [];
  const forced = CATEGORY_TOPIC[category];
  for (const [topic, re] of TOPIC_PATTERNS) {
    let n = 0;
    for (const t of texts) if (re.test(t)) n += 1;
    if (topic === forced) n += 100;
    if (n > 0) scored.push([topic, n]);
  }
  return scored.sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

// ── Mind: which emotion is strongest, then its own psychology section ──
const EMOTION_FROM_TEXT: Array<[string, RegExp]> = [
  ["anxiety", /anxi|fear|afraid|panic|worr|nervous|phobia|ghabra|dar\b|darr|chinta|tension|dread/i],
  ["anger", /anger|angry|irritab|gussa|rage|temper/i],
  ["sadness", /depress|sad|grief|weep|cry|rona|udaas|udas|hopeless|lonely|sorrow|loss/i],
];
const EMOTION_SECTION: Record<string, string> = {
  anxiety: "Anxiety and fear", anger: "Anger and irritability", sadness: "Sadness, grief and sensitivity",
};
export function emotionFromText(text: string): string | null {
  for (const [e, re] of EMOTION_FROM_TEXT) if (re.test(text)) return e;
  return null;
}

const psyQuestion = (n: number): CaseQuestion => {
  const p = PSY_QUESTIONS.find((x) => x.id === n)!;
  return {
    id: `psy-${n}`, topic: "mind", text: p.text, multi: p.multi,
    why: `Mind and emotions: ${p.section.toLowerCase()}. The mental picture often decides the remedy.`,
    options: p.options.map((x) => ({ label: x.label, phrases: x.phrases })),
  };
};

const MIND_OPENER: CaseQuestion = {
  id: "mind-main", topic: "mind", multi: true,
  text: "Which feeling is strongest right now?",
  why: "The strongest emotion decides which mind questions come next.",
  options: [
    o("Anxiety or worry", "anxiety"), o("Fear", "fear"), o("Anger or irritability", "anger", "irritability"),
    o("Sadness or low mood", "weeping", "mood"), o("Grief or loss", "grief"), o("Restlessness", "restlessness"),
    o("Feeling indifferent or empty", "indifferent"), o("Mood swings", "mood"),
  ],
  skipIf: /anxi|fear|afraid|panic|worr|nervous|ghabra|dar\b|darr|chinta|anger|angry|irritab|gussa|depress|sad|grief|weep|cry|rona|udaas|udas|restless|indifferent/i,
};
const MIND_TRIGGER: CaseQuestion = {
  id: "mind-cause", topic: "mind", multi: false,
  text: "Did it start after a particular event?",
  why: "Complaints that begin after grief, shock or humiliation point to specific remedies.",
  options: [
    o("Grief or loss", "grief"), o("Fright or shock", "fear"), o("Anger or humiliation", "anger"),
    o("Disappointed love or betrayal", "grief"), o("Overwork or study", "exhaustion"), o("Nothing special"),
  ],
};
const MIND_BODY: CaseQuestion = {
  id: "mind-body", topic: "mind", multi: true,
  text: "Does it come with any body symptoms?",
  why: "Mind and body symptoms together make a complete picture.",
  options: [
    o("Sleeplessness", "sleeplessness"), o("Palpitations", "anxiety"), o("Headache", "headache"),
    o("Loss of appetite"), o("Weakness", "exhaustion"), o("Forgetfulness", "memory"), o(NONE),
  ],
};

function mindQuestions(emotion: string | null): CaseQuestion[] {
  const out: CaseQuestion[] = [MIND_OPENER, MIND_TRIGGER];
  const bySection = (name: string) => PSY_QUESTIONS.filter((x) => x.section === name).map((x) => psyQuestion(x.id));
  if (emotion && EMOTION_SECTION[emotion]) out.push(...bySection(EMOTION_SECTION[emotion]));
  // Company, support and thinking apply to every emotional complaint.
  out.push(psyQuestion(19), psyQuestion(26), psyQuestion(20), psyQuestion(21), psyQuestion(33), psyQuestion(34));
  if (emotion !== "anxiety") out.push(psyQuestion(7));
  out.push(MIND_BODY);
  return out;
}

// ── Other topics ──────────────────────────────────────────────────
const TOPIC_BANKS: Record<string, CaseQuestion[]> = {
  head: [
    { id: "head-type", topic: "head", multi: false, text: "What is the pain like?", why: "The kind of pain separates headache remedies.",
      options: [o("Throbbing", "throbbing headache"), o("Pressing", "pressing headache"), o("Burning", "burning headache"), o("Shooting", "shooting headache"), o("Dull ache", "dull headache"), o("Band-like", "band headache")],
      skipIf: /throb|press|burn|shoot|dull|band/i },
    { id: "head-where", topic: "head", multi: false, text: "Where is it?", why: "Side and place of the pain are strong guiding symptoms.",
      options: [o("Forehead", "forehead headache"), o("Temples", "temples headache"), o("Back of head", "occiput headache"), o("Top of head", "vertex headache"), o("Right side", "right headache"), o("Left side", "left headache"), o("Whole head")],
      skipIf: /forehead|temple|occiput|vertex|right side|left side/i },
    { id: "head-worse", topic: "head", multi: true, text: "What makes the headache worse?", why: "Aggravations separate remedies that look alike.", covers: ["motion", "time", "temp"],
      options: [worse("Light"), worse("Noise"), worse("Motion", "motion"), worse("Stooping", "stooping"), worse("Heat"), worse("Cold"), worse("Morning"), worse("Evening"), worse("Sun", "sun"), worse("Reading or screen", "eyestrain"), none()] },
    { id: "head-better", topic: "head", multi: true, text: "What makes it better?", why: "Ameliorations are as important as aggravations.", covers: ["better"],
      options: [better("Rest"), better("Pressure"), better("Cold applications", "cold"), better("Lying down"), better("Open air"), better("Darkness"), better("Sleep"), none()] },
    { id: "head-assoc", topic: "head", multi: true, text: "Anything that comes with the headache?", why: "Accompanying symptoms often decide the remedy.",
      options: [o("Nausea or vomiting", "nausea", "vomiting"), o("Eye symptoms", "eyes"), o("Giddiness", "vertigo"), o("Stiff neck", "neck"), o("Watering from nose", "coryza"), o("Flushed face", "flushed face"), o(NONE)] },
  ],
  fever: [
    { id: "fever-stage", topic: "fever", multi: false, text: "Which stage is most marked?", why: "Chill, heat and sweat stages point to different remedies.",
      options: [o("Chill", "chill"), o("Heat", "heat fever"), o("Sweat", "sweat"), o("All stages equally")] },
    { id: "fever-onset", topic: "fever", multi: false, text: "How did it start?", why: "Sudden and slow fevers belong to different remedy groups.",
      options: [o("Suddenly, after cold wind", "sudden fever"), o("Slowly over days", "gradual fever"), o("After getting wet", "wet fever"), o("After sun or heat", "sun fever"), o("After fright", "fear")] },
    { id: "fever-thirst", topic: "fever", multi: false, text: "Thirst during fever?", why: "Thirst or no thirst is a classic fever guide.", covers: ["thirst"],
      options: [o("Very thirsty", "thirst"), o("No thirst", "thirstless"), o("Thirst for small sips", "thirst small quantities"), o("Thirsty only in chill", "thirst chill")], skipIf: /thirst|pyaas/i },
    { id: "fever-time", topic: "fever", multi: false, text: "When does it rise?", why: "Time of fever is a strong key.", covers: ["time"],
      options: [o("Morning", "morning fever"), o("Afternoon", "afternoon fever"), o("Evening", "evening fever"), o("Night", "night fever"), o("No fixed time")], skipIf: /morning|evening|night|afternoon|subah|raat/i },
    { id: "fever-assoc", topic: "fever", multi: true, text: "What else is present?", why: "Accompanying symptoms narrow down the remedy.",
      options: [o("Body ache", "aching body"), o("Restlessness", "restlessness"), o("Drowsiness", "drowsiness"), o("Headache", "headache"), o("Rash", "eruption"), o("Cough", "cough"), o("Vomiting", "vomiting"), o(NONE)] },
  ],
  stomach: [
    { id: "stomach-main", topic: "stomach", multi: true, text: "What is the main complaint?", why: "Tells which part of the digestion is involved.",
      options: [o("Nausea", "nausea"), o("Vomiting", "vomiting"), o("Acidity or heartburn", "acidity heartburn"), o("Bloating or gas", "flatulence"), o("Pain", "abdominal pain"), o("Constipation", "constipation"), o("Loose motions", "diarrhoea"), o("Poor appetite", "loss of appetite")],
      skipIf: /nausea|vomit|acid|heartburn|bloat|gas|constip|diarrh|loose|appetite|ulti|kabz|dast/i },
    { id: "stomach-food", topic: "stomach", multi: true, text: "Which food or drink worsens it?", why: "Food aggravations are reliable digestive guides.",
      options: [worse("Milk", "milk"), worse("Fatty food", "fat"), worse("Cold drinks", "cold drinks"), worse("Spicy food", "spicy"), worse("Eating too much", "overeating"), worse("Bread or wheat", "bread"), worse("Fruit", "fruit"), none()] },
    { id: "stomach-after", topic: "stomach", multi: false, text: "When is it worst in relation to eating?", why: "Before, during and after meals point to different remedies.",
      options: [o("Better after eating", "better eating"), o("Worse after eating", "worse eating"), o("Worse on empty stomach", "worse hunger"), o("Worse immediately on eating", "worse eating immediately"), o("No relation")] },
    { id: "stomach-pain", topic: "stomach", multi: false, text: "What type of pain?", why: "The character of the pain helps choosing the remedy.", covers: ["motion", "pressure"],
      options: [o("Burning", "burning pain"), o("Cramping, better bending double", "colic better bending"), o("Cutting", "cutting pain"), o("Pressing like a stone", "pressing pain"), o("Better by hard pressure", "better pressure"), o("No pain")] },
    { id: "stomach-desire", topic: "stomach", multi: true, text: "Strong cravings or dislikes?", why: "Food desires and aversions are important general symptoms.",
      options: [o("Sweets", "desire sweets"), o("Salt", "desire salt"), o("Sour things", "desire sour"), o("Cold drinks", "desire cold drinks"), o("Warm food", "desire warm"), o("Aversion to milk", "aversion milk"), o(NONE)] },
  ],
  respiration: [
    { id: "cough-type", topic: "respiration", multi: false, text: "What kind of cough?", why: "Type of cough is the first guide for chest remedies.",
      options: [o("Dry", "dry cough"), o("Loose, with phlegm", "loose cough"), o("Barking", "barking cough"), o("Spasmodic or whooping", "spasmodic cough"), o("Tickling", "tickling cough")], skipIf: /dry cough|loose cough|barking|spasmodic|whooping/i },
    { id: "cough-time", topic: "respiration", multi: false, text: "When is the cough worst?", why: "Time of day is a strong key.", covers: ["time"],
      options: [o("Night", "cough night"), o("Morning", "cough morning"), o("After midnight", "cough midnight"), o("Lying down", "cough lying"), o("In cold air", "cough cold air"), o("No pattern")], skipIf: /night|morning|midnight|raat|subah/i },
    { id: "cough-sputum", topic: "respiration", multi: false, text: "What does the phlegm look like?", why: "Colour and thickness help decide.", when: (c) => !c.has("cough-type", "Dry"),
      options: [o("Clear or watery", "expectoration watery"), o("White", "expectoration white"), o("Yellow or green", "expectoration yellow"), o("Thick and sticky", "expectoration tenacious"), o("Blood-streaked", "expectoration blood"), o("No phlegm")] },
    { id: "cough-breath", topic: "respiration", multi: true, text: "How is the breathing?", why: "Breathing troubles and their modalities are decisive in chest cases.", covers: ["motion"],
      options: [o("Worse lying down", "worse lying breathing"), o("Worse on exertion", "worse exertion breathing"), o("Wheezing", "wheezing"), o("Tightness in chest", "constriction chest"), o("Needs to sit up", "sit up breathing"), o("Normal")] },
  ],
  throat: [
    { id: "throat-main", topic: "throat", multi: true, text: "What do you feel?", why: "Pinpoints the part that is affected.",
      options: [o("Sore throat", "sore throat"), o("Pain on swallowing", "pain swallowing"), o("Blocked nose", "obstruction nose"), o("Runny nose", "coryza"), o("Sneezing", "sneezing"), o("Hoarse voice", "hoarseness"), o("Swollen tonsils", "tonsils")] },
    { id: "throat-side", topic: "throat", multi: false, text: "Which side is worse?", why: "Side of the sore throat is a classic guide.",
      options: [o("Right", "throat right"), o("Left", "throat left"), o("Both equally"), o("Starts right, goes left", "throat right left")] },
    { id: "throat-disch", topic: "throat", multi: false, text: "What is the discharge like?", why: "The nature of discharge separates cold remedies.",
      options: [o("Watery, burning the lip", "coryza watery excoriating"), o("Thick yellow or green", "coryza yellow"), o("Bland and white", "coryza white"), o("Dry, no discharge", "dryness nose")] },
    { id: "throat-drink", topic: "throat", multi: false, text: "Hot or cold drinks?", why: "Preference for warm or cold fluids is a general key.", covers: ["temp"],
      options: [better("Warm drinks", "warm drinks"), better("Cold drinks", "cold drinks"), o("No difference")] },
  ],
  skin: [
    { id: "skin-type", topic: "skin", multi: false, text: "What does it look like?", why: "The type of eruption narrows the remedies.",
      options: [o("Red rash", "rash"), o("Blisters", "vesicles"), o("Dry and scaly", "dry scaly eruption"), o("Moist, oozing", "moist eruption"), o("Pimples", "pimples"), o("Cracks", "cracks")], skipIf: /rash|blister|vesic|scaly|oozing|pimple|crack/i },
    { id: "skin-sens", topic: "skin", multi: false, text: "What does it feel like?", why: "The sensation guides the choice strongly.",
      options: [o("Itching", "itching"), o("Burning", "burning skin"), o("Stinging", "stinging"), o("Painful", "painful skin"), o("No sensation")], skipIf: /itch|burn|sting|khujli/i },
    { id: "skin-worse", topic: "skin", multi: true, text: "What makes it worse?", why: "Aggravations separate skin remedies.", covers: ["temp", "time"],
      options: [worse("Heat or warmth", "warmth"), worse("Cold"), worse("Night"), worse("Scratching", "scratching"), worse("Washing", "washing"), worse("Bed warmth", "warmth bed"), none()] },
    { id: "skin-better", topic: "skin", multi: true, text: "What helps?", why: "What relieves itching or burning is a strong key.", covers: ["better"],
      options: [better("Cold applications", "cold"), better("Warm applications", "warmth"), better("Scratching", "scratching"), better("Open air"), none()] },
    { id: "skin-where", topic: "skin", multi: true, text: "Where is it?", why: "Place on the body matters.",
      options: [o("Face", "eruption face"), o("Scalp", "eruption scalp"), o("Hands", "eruption hands"), o("Folds or behind ears", "eruption folds"), o("Legs", "eruption legs"), o("All over")] },
  ],
  joints: [
    { id: "joint-type", topic: "joints", multi: true, text: "What is the complaint?", why: "Kind of pain helps with the choice.",
      options: [o("Joint pain", "joint pain"), o("Muscle pain", "muscle pain"), o("Stiffness", "stiffness"), o("Swelling", "swelling joints"), o("Weakness", "weakness limbs"), o("Numbness", "numbness"), o("Shooting or tearing pain", "tearing pain")], skipIf: /joint pain|muscle pain|stiff|swell|numb|tearing/i },
    { id: "joint-motion", topic: "joints", multi: false, text: "How does motion affect it?", why: "Motion is the key modality of joint complaints.", covers: ["motion"],
      options: [o("Worse on first movement, better on continued", "worse first motion better continued motion"), o("Worse on any movement", "worse motion"), o("Better by rest", "better rest"), o("Worse by rest", "worse rest"), o("No relation")] },
    { id: "joint-weather", topic: "joints", multi: true, text: "Effect of weather and warmth?", why: "Damp, cold and heat modalities are classical keys.", covers: ["temp"],
      options: [o("Worse by cold", "worse cold"), o("Worse in damp weather", "worse damp"), o("Worse before a storm", "worse storm"), o("Better by warmth", "better warmth"), o("Better by hot application", "better heat"), o("Worse by heat", "worse heat"), none()] },
    { id: "joint-where", topic: "joints", multi: true, text: "Where is it?", why: "Place and side of the pain matter.",
      options: [o("Neck", "neck pain"), o("Upper back", "back pain"), o("Lower back", "lumbar pain"), o("Shoulder", "shoulder pain"), o("Knee", "knee pain"), o("Hip or thigh", "hip pain"), o("Right side"), o("Left side")] },
  ],
  urinary: [
    { id: "urine-main", topic: "urinary", multi: true, text: "What do you notice?", why: "Tells which urinary symptom leads.",
      options: [o("Burning while passing urine", "burning urination"), o("Frequent urge", "frequent urination"), o("Cannot hold urine", "involuntary urine"), o("Difficult or dribbling", "difficult urination"), o("Blood in urine", "blood urine"), o("Pain in loins", "pain loins")] },
    { id: "urine-urge", topic: "urinary", multi: false, text: "Urging and flow?", why: "Urging pattern is a guiding symptom.",
      options: [o("Constant urging, little passes", "urging urine"), o("Must hurry", "urgent urination"), o("Slow start", "slow urination"), o("Only at night", "night urination")] },
    { id: "urine-smell", topic: "urinary", multi: false, text: "Colour or smell of urine?", why: "Appearance of urine helps choosing.",
      options: [o("Dark and hot", "urine dark"), o("Strong smell", "urine offensive"), o("Cloudy", "urine turbid"), o("Pale and profuse", "urine profuse"), o("Normal")] },
  ],
  sleep: [
    { id: "sleep-type", topic: "sleep", multi: true, text: "What is the sleep problem?", why: "Different sleep problems have different remedies.",
      options: [o("Cannot fall asleep", "sleeplessness"), o("Wakes at a fixed hour", "waking night"), o("Unrefreshing sleep", "sleep unrefreshing"), o("Vivid dreams", "dreams"), o("Nightmares", "dreams"), o("Restless, tossing", "restlessness night")] },
    { id: "sleep-why", topic: "sleep", multi: true, text: "What keeps you awake?", why: "The reason for sleeplessness points to the mental picture.",
      options: [o("Racing thoughts", "thinking"), o("Worry", "anxiety"), o("Pain or discomfort"), o("Heat in bed", "heat bed"), o("Noise", "noise"), o("No reason")] },
    { id: "sleep-hour", topic: "sleep", multi: false, text: "At what time do you wake?", why: "Time of waking is a classical key.", covers: ["time"],
      options: [o("11 pm to 1 am", "waking midnight"), o("2 to 4 am", "waking 3 am"), o("Early morning, cannot sleep again", "waking early"), o("Varies")] },
  ],
  female: [
    { id: "fem-main", topic: "female", multi: true, text: "What is the complaint?", why: "Tells which women's complaint leads.",
      options: [o("Irregular periods", "menses irregular"), o("Painful periods", "dysmenorrhoea"), o("Heavy bleeding", "menses profuse"), o("Scanty periods", "menses scanty"), o("White discharge", "leucorrhoea"), o("Menopause symptoms", "climacteric"), o("Mood change before periods", "mood menses")] },
    { id: "fem-pain", topic: "female", multi: false, text: "How is the period pain?", why: "Nature of period pain is decisive.", covers: ["motion", "temp"],
      options: [o("Cramping, better bending double", "cramping better bending"), o("Better by warmth", "better warmth"), o("Better by pressure", "better pressure"), o("Worse by motion", "worse motion"), o("No pain")] },
    { id: "fem-blood", topic: "female", multi: false, text: "Colour of menstrual blood?", why: "Quality of blood guides the remedy.",
      options: [o("Bright red", "menses bright red"), o("Dark", "menses dark"), o("Clotted", "menses clotted"), o("Watery or pale", "menses pale")] },
    { id: "fem-mood", topic: "female", multi: true, text: "Mood around periods?", why: "Mental state before and during periods matters a lot.",
      options: [o("Irritable", "irritability"), o("Weepy", "weeping"), o("Anxious", "anxiety"), o("Wants to be alone", "alone"), o("No change")] },
  ],
};

// ── General modalities: asked once, only if not already known ────────
const GENERAL: CaseQuestion[] = [
  { id: "gen-temp", topic: "general", multi: false, text: "Are you generally chilly or too warm?", why: "Body heat is one of the most important general symptoms.", covers: ["temp"],
    options: [o("Chilly, wants warm clothes", "chilly"), o("Hot, wants open air", "hot"), o("Depends"), o("Cannot say")], skipIf: /chilly|warm blooded|hot patient|feel cold|feel hot|thand|garmi/i },
  { id: "gen-time", topic: "general", multi: false, text: "At what time is the whole complaint worse?", why: "Time of aggravation is a classical modality.", covers: ["time"],
    options: [worse("Morning"), worse("Afternoon"), worse("Evening"), worse("Night"), worse("After midnight", "midnight"), o("No fixed time")], skipIf: /morning|afternoon|evening|night|midnight|subah|shaam|raat/i },
  { id: "gen-motion", topic: "general", multi: false, text: "Motion or rest?", why: "Whether movement helps or hurts is a core modality.", covers: ["motion"],
    options: [o("Better by motion", "better motion"), o("Worse by motion", "worse motion"), o("Better by rest", "better rest"), o("No effect")], skipIf: /motion|movement|rest\b|walking/i },
  { id: "gen-thirst", topic: "general", multi: false, text: "How is your thirst?", why: "Thirst is a general symptom that separates similar remedies.", covers: ["thirst"],
    options: [o("Very thirsty", "thirst"), o("Thirstless", "thirstless"), o("Normal")], skipIf: /thirst|pyaas/i },
  { id: "gen-air", topic: "general", multi: false, text: "Open air or closed room?", why: "Air preference is another general modality.", covers: ["air"],
    options: [o("Better in open air", "better open air"), o("Worse in open air", "worse open air"), o("Worse in a closed room", "worse closed room"), o("No effect")], skipIf: /open air|fresh air|closed room|hawa/i },
];

// ── Choosing the next question ─────────────────────────────────────
export interface CaseState {
  symptoms: string[];                       // what the patient wrote or the AI extracted
  category?: string;
  answers: Record<string, string[]>;        // question id -> chosen labels (empty array = skipped)
}
export const MAX_QUESTIONS = 16;

function context(state: CaseState): Ctx {
  const text = state.symptoms.filter((s) => !s.startsWith("🔍")).join(" . ").toLowerCase();
  return {
    text,
    has: (id, label) => (state.answers[id] || []).includes(label),
    answered: (id) => id in state.answers,
  };
}

export function queueFor(state: CaseState): CaseQuestion[] {
  const ctx = context(state);
  const texts = state.symptoms.filter((s) => !s.startsWith("🔍"));
  const topics = detectTopics(texts, state.category || "");
  const queue: CaseQuestion[] = [];
  const emotion = emotionFromText(ctx.text) ||
    (state.answers["mind-main"]?.some((l) => /anxiety|fear/i.test(l)) ? "anxiety" :
     state.answers["mind-main"]?.some((l) => /anger|irritab/i.test(l)) ? "anger" :
     state.answers["mind-main"]?.some((l) => /sad|grief/i.test(l)) ? "sadness" : null);

  const take = (topic: string) => {
    const bank = topic === "mind" ? mindQuestions(emotion) : TOPIC_BANKS[topic] || [];
    // a mind-led case gets its full section; a secondary topic only its first 3 questions
    const limited = topic === "mind" || topics[0] === topic ? bank : bank.slice(0, 3);
    queue.push(...limited);
  };
  for (const t of topics.slice(0, 3)) take(t);

  // answered or skipped questions stay in the list so the progress count is stable
  const covered = new Set<string>();
  for (const q of queue) if (ctx.answered(q.id)) for (const c of q.covers || []) covered.add(c);
  const general = GENERAL.filter((g) => !g.covers!.some((c) => covered.has(c)));

  const out: CaseQuestion[] = [];
  const seen = new Set<string>();
  for (const q of [...queue, ...general]) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    if (q.id.startsWith("gen-") && (q.covers || []).some((c) => covered.has(c))) continue;
    if (!ctx.answered(q.id)) {
      if (q.skipIf && q.skipIf.test(ctx.text)) continue;
      if (q.when && !q.when(ctx)) continue;
    }
    out.push(q);
  }
  return out;
}

/** The next unanswered question, or null when the case is complete enough. */
export function nextQuestion(state: CaseState): CaseQuestion | null {
  if (Object.keys(state.answers).length >= MAX_QUESTIONS) return null;
  return queueFor(state).find((q) => !(q.id in state.answers)) || null;
}

/** Rough size of the interview, for the progress bar (answered + still to come, capped). */
export function plannedCount(state: CaseState): number {
  return Math.min(MAX_QUESTIONS, queueFor(state).length);
}

// ── From answers to diagnosis ──────────────────────────────────────
// Every question that can ever be asked, so an answer keeps its phrases even if the topics change later.
export const ALL_QUESTIONS: CaseQuestion[] = [
  MIND_OPENER, MIND_TRIGGER, MIND_BODY,
  ...PSY_QUESTIONS.map((x) => psyQuestion(x.id)),
  ...Object.values(TOPIC_BANKS).flat(),
  ...GENERAL,
];
const BY_ID = new Map(ALL_QUESTIONS.map((q) => [q.id, q]));
function findQuestion(_state: CaseState, id: string): CaseQuestion | undefined {
  return BY_ID.get(id);
}

/** Search phrases for all answers (no duplicates). A skipped or "no" answer adds nothing. */
export function answerPhrases(state: CaseState): string[] {
  const out: string[] = [];
  for (const [id, labels] of Object.entries(state.answers)) {
    const q = findQuestion(state, id);
    if (!q) continue;
    // only a clear Yes counts for yes / sometimes / no psychology questions
    for (const label of labels) {
      const opt = q.options.find((x) => x.label === label);
      for (const p of opt?.phrases || []) if (!out.includes(p)) out.push(p);
    }
  }
  return out;
}

/** The psychology answers in the old format, for the "Mind and emotions considered" line. */
export function psyAnswersOf(state: CaseState): PsyAnswers {
  const out: PsyAnswers = {};
  for (const [id, labels] of Object.entries(state.answers)) {
    const m = /^psy-(\d+)$/.exec(id);
    if (m && labels.length) out[Number(m[1])] = labels;
  }
  return out;
}

/** "Question: answer" lines for display and the red-flag scan. */
export function answerLines(state: CaseState): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = [];
  for (const [id, labels] of Object.entries(state.answers)) {
    if (!labels.length) continue;
    const q = findQuestion(state, id);
    if (q) out.push({ question: q.text, answer: labels.join(", ") });
  }
  return out;
}
