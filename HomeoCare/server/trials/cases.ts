// Classical keynote cases. A case passes when the expected remedy is in the top 5 results.
// These are well-known textbook pictures, used as a sanity check of the search engine, not as medical advice.
export interface TrialCase { name: string; symptoms: string[]; expect: string[] }

export const CASES: TrialCase[] = [
  { name: "Fright, anticipation, diarrhoea before exams", symptoms: ["anticipation anxiety before exams", "diarrhoea from excitement", "fear of failure"], expect: ["Argentum nitricum", "Gelsemium"] },
  { name: "Restless, fear of death, midnight, thirst for sips", symptoms: ["anxiety restlessness at night", "fear of death", "burning pains better warmth", "thirst small sips"], expect: ["Arsenicum album"] },
  { name: "Sudden fever after cold wind with fear", symptoms: ["sudden fever after cold dry wind", "fear and restlessness", "dry skin hot"], expect: ["Aconitum napellus"] },
  { name: "Throbbing headache, flushed face, light sensitive", symptoms: ["sudden throbbing headache", "red hot face", "worse light", "worse noise"], expect: ["Belladonna"] },
  { name: "Joint pain worse first motion better continued motion", symptoms: ["stiffness joints worse beginning of motion", "better continued motion", "worse damp weather", "restlessness"], expect: ["Rhus toxicodendron"] },
  { name: "Joint pain worse every motion, better rest", symptoms: ["pain worse least motion", "better lying still", "better pressure", "dry mouth thirst for large quantities", "irritable"], expect: ["Bryonia alba"] },
  { name: "Grief, weeps alone, sighing", symptoms: ["grief silent", "sighing", "worse consolation", "mood changeable"], expect: ["Ignatia amara"] },
  { name: "Weepy, better open air, changeable symptoms, no thirst", symptoms: ["weeps easily", "better consolation", "better open air", "thirstless", "changeable symptoms"], expect: ["Pulsatilla nigricans"] },
  { name: "Bruised sore feeling after injury", symptoms: ["injury bruised sore feeling", "bed feels too hard", "says nothing is the matter"], expect: ["Arnica montana"] },
  { name: "Chilly, constipation no urging, irritable overwork", symptoms: ["irritable oversensitive", "constipation ineffectual urging", "worse morning", "chilly", "after coffee and overwork"], expect: ["Nux vomica"] },
  { name: "Dry cough tickling, worse talking, better warm drinks", symptoms: ["dry cough", "worse talking", "worse cold air", "better warm drink"], expect: ["Rumex crispus", "Bryonia alba", "Phosphorus"] },
  { name: "Burning acidity, worse after eating, wants cold drinks", symptoms: ["burning stomach", "desire cold drinks", "vomiting when water becomes warm in stomach", "fear of thunderstorm"], expect: ["Phosphorus"] },
];
