// Type definitions for HomeoWell — Supabase JS client used directly, no Drizzle ORM

export const BODY_SYSTEMS = [
  "GENERALITIES", "MIND", "HEAD", "EYES", "EARS", "NOSE", "FACE",
  "MOUTH", "TONGUE", "TASTE", "GUMS", "TEETH", "THROAT", "STOMACH",
  "ABDOMEN", "URINARY SYSTEM", "MALE SEXUAL SYSTEM", "FEMALE SEXUAL SYSTEM",
  "CIRCULATORY SYSTEM", "LOCOMOTOR SYSTEM", "RESPIRATORY SYSTEM (CHEST)",
  "SKIN", "FEVER", "NERVOUS SYSTEM", "MODALITIES", "BIOCHEMIC COMBINATIONS",
  "SCHÜSSLER SALTS (Tissue Remedies)"
] as const;

export const SYMPTOM_TYPES = [
  "Physical", "Mental", "Emotional", "Behavioral",
  "Sensory", "Temperature", "Pain", "Discharge", "Functional"
] as const;

export const SYMPTOM_LOCATIONS = [
  "Head", "Face", "Eyes", "Ears", "Nose", "Throat", "Neck",
  "Chest", "Heart", "Lungs", "Abdomen", "Stomach", "Liver",
  "Back", "Arms", "Hands", "Legs", "Feet", "Skin", "Joints",
  "Muscles", "Nervous System", "Whole Body"
] as const;

export const CONDITION_TYPES = ["acute", "chronic"] as const;
export const AGE_GROUPS = ["child", "adult", "senior"] as const;
export const GENDERS = ["male", "female", "any"] as const;
export const POTENCIES = ["6C", "12C", "30C", "200C", "1M", "10M"] as const;

export interface Remedy {
  id: string;
  name: string;
  category: string;
  condition: string;
  description: string;
  dosage: string;
  symptoms: string[];
  keywords: string[];
  modalities: { better: string[]; worse: string[] };
  potencies: string[];
  age_groups: string[];
  genders: string[];
  synonym_names: string[];
  ai_indication?: string;
}

export interface InsertRemedy extends Omit<Remedy, "id"> {}

export interface DiagnosticQuestion {
  id: string;
  question: string;
  type: "single" | "multiple" | "scale" | "text";
  options?: string[];
  weight: number;
  next_questions?: string[];
  body_system: string;
}

export interface RemedyScore {
  remedy: Remedy;
  score: number;
  matching_symptoms: string[];
  confidence: number;
}
