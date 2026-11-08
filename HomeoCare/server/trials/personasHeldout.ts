// A second way of typing for the same patients as personas.ts: other everyday words for the same complaints.
//
// personas.ts is what the search was tuned and measured with. Any word list that maps everyday words to the repertory's
// words (utils/layPhrases.ts) is built from general knowledge of how people talk, but it is easy to build one that only
// fits the first set. These phrasings were written BEFORE that list was built and are not looked at while building it:
// the same engine on both sets shows whether an improvement is general or only fits the words it was shaped by.
// Only what the patient types differs; the category and the facts they confirm in the interview stay those of personas.ts.
//
//   PERSONAS=heldout npx tsx server/trials/simulate.ts
import type { Persona } from "./personas";

const TYPED: Record<number, string> = {
  1:  "nervous before an interview and my stomach gets upset|loose stools when I am stressed",
  2:  "panic at midnight thinking I will die|cannot sit still",
  3:  "high fever came on suddenly after being out in the cold wind|very frightened",
  4:  "pounding headache with a red face and hot skin|light hurts my eyes",
  5:  "joints ache and are stiff when I get up, they loosen up once I move about|worse in rainy weather",
  6:  "joint pain gets worse with the slightest movement, I want to lie still",
  7:  "mourning after my mother died, I keep sighing|I cry when I am alone",
  8:  "I cry easily and want comfort, I feel better outdoors|my moods keep changing",
  9:  "body feels beaten up and sore after an accident, the bed feels hard",
  10: "cannot pass stool properly, frequent urge but very little|short tempered, overworked, too much coffee",
  11: "a tickle in my throat makes me cough, dry cough, worse when I speak",
  12: "burning sensation in the stomach with sour belching|I crave cold water",
  13: "swollen puffy red skin with stinging pain, better with a cold compress",
  14: "skin itches badly and burns, worse from the warmth of bed and after a bath",
  15: "belly gets full and gassy after eating just a little|worse in the evenings",
  16: "no interest in my husband and children, a dragging down feeling in the pelvis, tired",
  17: "head sweats at night while sleeping|always feel cold and tired",
  18: "cuts take a long time to heal and keep festering|feet sweat and stink",
  19: "throat feels like a splinter is stuck in it|I hate a cold draught",
  20: "drooling in sleep and bad smell from the mouth|worse at night",
  21: "baby cries and is cranky, only quiet when carried|cutting teeth",
  22: "sharp cramping stomach pain that doubles me over|pressing on the belly helps",
  23: "shooting cramps, relieved by a hot water bottle",
  24: "feel weak and shaky, eyelids droop|dull heavy headache",
  25: "stepped on a nail, the wound feels cold and ice makes it feel better",
  26: "finger got crushed in a door, shooting nerve pain",
  27: "twisted my ankle, the bones feel bruised|stiff",
  28: "burning scalding pain when I pee|keep feeling the need to go",
  29: "stabbing pain in the back near the kidneys that shoots to the groin",
  30: "pain on the left side of the throat|scarves and collars feel choking",
  31: "throat pain with deep red tonsils|ear hurts when I swallow",
  32: "fits of barking cough that make me gag|worse after midnight",
  33: "chest full of phlegm that rattles but nothing comes up",
  34: "dry hacking cough like a seal bark, croup",
  35: "nausea all the time and vomiting does not help",
  36: "vomiting and loose motions together with cold sweat on the forehead|collapsed",
  37: "sudden watery stool in the morning, no pain, comes out with force",
  38: "loose motions with a feeling the stool will slip out when I pass gas|piles",
  39: "piles that are dry and itchy|lower back ache",
  40: "skin cracks and oozes a sticky yellowish fluid like honey",
  41: "grief I never talk about, worse when people console me|headache in the sunshine",
  42: "angry but I swallow it after being humiliated",
  43: "lost my voice, chest feels raw",
  44: "thick sticky ropy phlegm from the nose|sinus pressure",
  45: "eyes watering with burning|nose discharge that is not irritating",
  46: "nose running like a tap and burns the upper lip|eyes water mildly",
  47: "asthma gets bad in humid damp weather",
  49: "ulcers in the mouth, cracks at the corners of the lips|pricking pain like splinters",
  50: "dizzy and nauseous in a car|lost sleep looking after a sick relative",
  51: "neck muscles are stiff and sore|feel low and gloomy",
  52: "feels like a tight band squeezing my heart|racing heartbeat",
  53: "bursting headache after standing in the hot sun",
  54: "migraine with sour vomiting",
  55: "pain on the left side of the head around the eye|heart flutters",
  56: "headache on the right side|palms and soles burn",
  58: "sharp stabbing chest pain|wake at 3 am every night|feel cold",
  59: "very weak after diarrhoea|stomach blown up with gas",
  60: "high fever, dazed and drowsy|whole body feels sore",
  61: "flu with severe bone pain as if the bones are breaking",
  62: "I fall ill whenever the weather turns cold and damp",
  63: "suspicious and jealous|dry cough that starts when I lie down at night",
  64: "terrified of the dark|must have the lights on and someone with me",
  65: "dread of high places|love sugar but it gives me loose motions",
  66: "afraid of lightning|crave ice cold water|nose bleeds easily",
  67: "burning pains relieved by hot applications|anxious and cannot rest",
  68: "need fresh air|belly bloated with gas|feel like collapsing",
};

export const HELDOUT_TYPED = TYPED;

/** The patients of personas.ts, typing in the other words. */
export function heldoutPersonas(base: Persona[]): Persona[] {
  return base.map((p) => {
    const t = TYPED[p.n];
    if (!t) throw new Error(`no held-out wording for persona ${p.n} (${p.of})`);
    return { ...p, typed: t.split("|").map((s) => s.trim()).filter(Boolean) };
  });
}
