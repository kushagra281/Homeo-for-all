import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const remedies = pgTable("remedies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // body system category
  condition: text("condition").notNull(),
  description: text("description").notNull(),
  dosage: text("dosage").notNull(),
  symptoms: json("symptoms").$type<string[]>().notNull(),
  keywords: json("keywords").$type<string[]>().default([]),
  symptom_mappings: json("symptom_mappings").$type<Record<string, number>>().default({}), // symptom -> weight mapping
  modalities: json("modalities").$type<{better: string[], worse: string[]}>().default({better: [], worse: []}),
  potencies: json("potencies").$type<string[]>().default(["6C", "30C", "200C"]),
  age_groups: json("age_groups").$type<string[]>().default(["child", "adult", "senior"]),
  genders: json("genders").$type<string[]>().default(["male", "female", "any"]),
  synonym_names: json("synonym_names").$type<string[]>().default([]),
});

export const insertRemedySchema = createInsertSchema(remedies).omit({
  id: true,
});

// Define all body system categories
export const BODY_SYSTEMS = [
  "GENERALITIES",
  "MIND", 
  "HEAD",
  "EYES",
  "EARS", 
  "NOSE",
  "FACE",
  "MOUTH",
  "TONGUE",
  "TASTE",
  "GUMS",
  "TEETH",
  "THROAT",
  "STOMACH",
  "ABDOMEN",
  "URINARY SYSTEM",
  "MALE SEXUAL SYSTEM", 
  "FEMALE SEXUAL SYSTEM",
  "CIRCULATORY SYSTEM",
  "LOCOMOTOR SYSTEM",
  "RESPIRATORY SYSTEM (CHEST)",
  "SKIN",
  "FEVER",
  "NERVOUS SYSTEM",
  "MODALITIES",
  "BIOCHEMIC COMBINATIONS",
  "SCHÜSSLER SALTS (Tissue Remedies)",
  "SCHOLTEN MINERAL SYSTEM",
  "SCHOLTEN LANTHANIDE SYSTEM",
  "PSYCHOLOGICAL RUBRICS (Anelly Aya)"
] as const;

// Define symptom types and filters
export const SYMPTOM_TYPES = [
  "Physical",
  "Mental", 
  "Emotional",
  "Behavioral",
  "Sensory",
  "Temperature",
  "Pain",
  "Discharge",
  "Functional"
] as const;

export const SYMPTOM_LOCATIONS = [
  "Head",
  "Face", 
  "Eyes",
  "Ears",
  "Nose",
  "Throat",
  "Neck",
  "Chest",
  "Heart",
  "Lungs",
  "Abdomen",
  "Stomach",
  "Liver",
  "Back",
  "Arms",
  "Hands",
  "Legs",
  "Feet",
  "Skin",
  "Joints",
  "Muscles",
  "Nervous System",
  "Whole Body"
] as const;

export const CONDITION_TYPES = [
  "acute",
  "chronic"
] as const;

export const AGE_GROUPS = ["child", "adult", "senior"] as const;
export const GENDERS = ["male", "female", "any"] as const;
export const POTENCIES = ["6C", "12C", "30C", "200C", "1M", "10M"] as const;

// Question tree structure for diagnostic guidance
export interface DiagnosticQuestion {
  id: string;
  question: string;
  type: "single" | "multiple" | "scale" | "text";
  options?: string[];
  weight: number;
  next_questions?: string[];
  body_system: string;
}

// Remedy scoring interface
export interface RemedyScore {
  remedy: Remedy;
  score: number;
  matching_symptoms: string[];
  confidence: number;
}

export type InsertRemedy = z.infer<typeof insertRemedySchema>;
export type Remedy = typeof remedies.$inferSelect;
