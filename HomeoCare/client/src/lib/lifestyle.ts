// DO's AND DON'TS
//
// General everyday guidance that suits the kind of complaint the patient described (food, sleep, habits,
// when to see a doctor). It is chosen from the topics found in the symptoms, so a hair complaint and a
// stomach complaint no longer get the same list. It never names a medicine or a dose. When the AI writes
// a list for the case, that list replaces these; these are what is shown otherwise.

import { detectTopics } from "./caseTaking";

export interface Lifestyle { do: string[]; avoid: string[] }

const BY_TOPIC: Record<string, Lifestyle> = {
  hair: {
    do: [
      "Eat protein-rich food: dal, eggs, paneer, sprouts",
      "Massage the scalp gently with lukewarm oil",
      "Wash with a mild shampoo, 2 to 3 times a week",
      "Sleep 7 to 8 hours and keep stress in check",
      "Get thyroid, iron, vitamin D and B12 tested if the loss continues",
    ],
    avoid: [
      "Very hot water on the hair",
      "Tight hairstyles and rough combing, especially when wet",
      "Crash diets and skipping meals",
      "Harsh chemical treatments: colour, straightening",
      "Scratching an itchy scalp or picking at dandruff",
    ],
  },
  mind: {
    do: [
      "Keep a fixed time for sleep and meals",
      "Walk or exercise for 20 to 30 minutes a day",
      "Slow breathing for a few minutes when stress rises",
      "Talk to someone you trust instead of keeping it inside",
      "See a doctor or counsellor if it affects daily life",
    ],
    avoid: [
      "Too much tea, coffee and other stimulants",
      "Alcohol and smoking",
      "Late nights and overthinking in bed",
      "Long hours on social media or news",
      "Staying alone and cut off for long periods",
    ],
  },
  head: {
    do: [
      "Drink enough water through the day",
      "Eat on time and do not skip meals",
      "Rest in a quiet, dim room when the pain comes",
      "Take screen breaks and keep a regular sleep time",
      "See a doctor at once for a sudden severe headache, or one with weakness or vomiting",
    ],
    avoid: [
      "Skipping meals or long fasting",
      "Bright screens in a dark room",
      "Loud noise and strong smells",
      "Too much tea, coffee and alcohol",
      "Taking painkillers again and again without advice",
    ],
  },
  fever: {
    do: [
      "Rest and drink plenty of fluids",
      "Eat light, easily digested food",
      "Wear light clothes and keep the room comfortable",
      "Check the temperature regularly",
      "See a doctor if fever lasts over 3 days or is very high",
    ],
    avoid: [
      "Heavy, oily or spicy food",
      "Cold baths during chills, or heavy blankets during heat",
      "Going out or working while unwell",
      "Starving, or forcing food when not hungry",
      "Ignoring rash, stiff neck, fits or trouble breathing",
    ],
  },
  stomach: {
    do: [
      "Eat small meals at fixed times",
      "Chew slowly and stop before you feel full",
      "Drink water between meals, not in large amounts with them",
      "Eat fresh, home-cooked, simple food",
      "Walk for 10 to 15 minutes after meals",
    ],
    avoid: [
      "Spicy, fried and oily food",
      "Late-night heavy meals",
      "Tea or coffee on an empty stomach",
      "Carbonated drinks and too much junk food",
      "Lying down straight after eating",
    ],
  },
  respiration: {
    do: [
      "Drink warm water and keep well hydrated",
      "Keep the chest and feet warm in cold weather",
      "Rest and avoid dusty places",
      "Sleep with the head slightly raised if the cough is worse lying down",
      "See a doctor if there is breathlessness, blood in phlegm or fever for days",
    ],
    avoid: [
      "Smoking and smoke from others",
      "Ice cream and very cold drinks",
      "Direct air conditioner or cold wind on the chest",
      "Dust, fumes and strong smells",
      "Suppressing the cough with strong syrups without advice",
    ],
  },
  throat: {
    do: [
      "Gargle with warm salt water",
      "Sip warm fluids through the day",
      "Rest the voice",
      "Keep the nose and throat clean and warm",
      "See a doctor if swallowing is very painful or fever stays",
    ],
    avoid: [
      "Cold drinks and ice cream",
      "Spicy, sour and fried food",
      "Shouting or whispering hard",
      "Smoking and dusty places",
      "Sudden changes between hot and cold rooms",
    ],
  },
  skin: {
    do: [
      "Keep the skin clean and dry",
      "Use a mild, fragrance-free soap and moisturiser",
      "Wear loose, soft cotton clothes",
      "Keep nails short",
      "Note what makes it worse: food, soap, weather",
    ],
    avoid: [
      "Scratching or picking at the area",
      "Very hot water for bathing",
      "Harsh soaps, strong creams and cosmetics",
      "Tight or synthetic clothes",
      "Applying strong medicines or steroid creams without advice",
    ],
  },
  joints: {
    do: [
      "Keep moving gently; short walks and light stretching",
      "Apply warmth if stiffness is worse in the cold",
      "Keep a good sitting and sleeping posture",
      "Maintain a healthy weight",
      "See a doctor if there is swelling, fever or numbness",
    ],
    avoid: [
      "Sitting in one position for hours",
      "Lifting heavy weights suddenly",
      "Cold, damp places and wet clothes",
      "Sleeping on a very soft mattress",
      "Overexertion and long climbing or squatting",
    ],
  },
  urinary: {
    do: [
      "Drink plenty of water through the day",
      "Pass urine when you feel the urge",
      "Keep the private area clean and dry",
      "Wear loose cotton underwear",
      "See a doctor if there is blood, fever or back pain",
    ],
    avoid: [
      "Holding urine for long",
      "Too little water",
      "Too much tea, coffee, alcohol and spicy food",
      "Tight clothing",
      "Delaying a check if burning lasts more than 2 days",
    ],
  },
  sleep: {
    do: [
      "Go to bed and wake up at the same time daily",
      "Keep the bedroom dark, quiet and cool",
      "Have a light early dinner",
      "Wind down without screens for an hour before bed",
      "Get some daylight and exercise during the day",
    ],
    avoid: [
      "Tea, coffee and cola in the evening",
      "Phone or TV in bed",
      "Heavy or late meals",
      "Long daytime naps",
      "Going to bed worried; write the worry down instead",
    ],
  },
  female: {
    do: [
      "Keep a record of cycle dates and symptoms",
      "Eat iron-rich food: greens, dates, jaggery, pulses",
      "Walk or stretch lightly, especially around periods",
      "Keep warm and rest when there is pain",
      "See a doctor for very heavy bleeding, missed periods or severe pain",
    ],
    avoid: [
      "Skipping meals or crash dieting",
      "Heavy exertion on heavy-flow days",
      "Too much tea, coffee and smoking",
      "Stressful, sleepless routines around periods",
      "Ignoring bleeding between periods or after menopause",
    ],
  },
};

const GENERAL: Lifestyle = {
  do: [
    "Sleep 7 to 8 hours at a regular time",
    "Drink enough water and eat fresh, simple food on time",
    "Walk or move for 20 to 30 minutes a day",
    "Keep stress in check with slow breathing or a short walk",
    "Note what makes it better or worse, and see a doctor if it gets worse",
  ],
  avoid: [
    "Too much tea, coffee and strong stimulants",
    "Alcohol and smoking",
    "Processed and junk food",
    "Irregular sleep and long late nights",
    "Taking strong medicines on your own without advice",
  ],
};

const take = (a: string[], b: string[], max = 6): string[] => {
  const out = [...a.slice(0, 4)];
  for (const x of b) if (out.length < max && !out.includes(x)) out.push(x);
  return out;
};

/** The topics of the complaint (from what was typed; the chosen category only when nothing typed says more). */
export function lifestyleTopics(symptoms: string[], category = ""): string[] {
  const typed = symptoms.filter((s) => !s.startsWith("🔍"));
  const found = detectTopics(typed);
  return (found.length ? found : detectTopics([], category)).filter((t) => BY_TOPIC[t]);
}

/** Do's and don'ts for the complaint: the first topic leads, a second adds a few items, nothing found gives the general list. */
export function lifestyleFor(symptoms: string[], category = ""): { topics: string[]; lifestyle: Lifestyle } {
  const topics = lifestyleTopics(symptoms, category).slice(0, 2);
  if (!topics.length) return { topics: [], lifestyle: GENERAL };
  const [first, second] = topics.map((t) => BY_TOPIC[t]);
  return {
    topics,
    lifestyle: second
      ? { do: take(first.do, second.do), avoid: take(first.avoid, second.avoid) }
      : { do: first.do, avoid: first.avoid },
  };
}

export const LIFESTYLE_TOPICS = Object.keys(BY_TOPIC);
