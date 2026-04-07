// Remedy type matching your JSON
export interface Remedy {
  id: string
  rubric: string
  category: string
  location: string
  modalities: {
    worse: string[]
    better: string[]
  }
  remedies: Array<{
    name: string
    grade: number
  }>
}

export interface RemedyScore {
  name: string
  score: number
  percentage: number
  matchedSymptoms: number
  grade: number
}

export const BODY_SYSTEMS = [
  "Mind", "Head", "Eyes", "Ears", "Nose", "Face",
  "Mouth", "Throat", "Chest", "Stomach", "Abdomen",
  "Rectum", "Back", "Extremities", "Skin", "Fever",
  "Sleep", "Generalities", "Respiration",
  "Urinary", "Male", "Female"
] as const

export const AGE_GROUPS = ["Child", "Adult", "Elderly"]
export const GENDERS = ["Male", "Female", "Any"]
export const POTENCIES = ["6C", "30C", "200C", "1M"]
export const SYMPTOM_LOCATIONS = [
  "Head", "Eyes", "Chest", "Abdomen", "Back", "Extremities"
]
export const CONDITION_TYPES = ["Acute", "Chronic"]
export const SYMPTOM_TYPES = ["Physical", "Mental", "Emotional"]
