import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const remedies = pgTable("remedies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  latinName: text("latin_name"),
  categories: text("categories").array().notNull(),
  description: text("description").notNull(),
  keySymptoms: text("key_symptoms").array().notNull(),
  modalities: jsonb("modalities").$type<{
    better: string[];
    worse: string[];
  }>(),
  potencies: text("potencies").array().notNull(),
  dosage: text("dosage").notNull(),
  constitution: text("constitution"),
  mental: text("mental"),
  physical: text("physical"),
  isPopular: boolean("is_popular").default(false),
  ageRange: text("age_range"),
  gender: text("gender"),
  modalityCategories: text("modality_categories").array().notNull().default([]),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  remedyCount: integer("remedy_count").default(0),
});

export const keywords = pgTable("keywords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  remedyIds: text("remedy_ids").array().notNull(),
  synonyms: text("synonyms").array().notNull().default([]),
});

export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  remedyId: varchar("remedy_id").references(() => remedies.id).notNull(),
});

export const medicalTerms = pgTable("medical_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  term: text("term").notNull().unique(),
  definition: text("definition").notNull(),
  category: text("category").notNull(),
  synonyms: text("synonyms").array().notNull(),
  relatedRemedies: text("related_remedies").array().notNull(),
  translations: jsonb("translations").$type<Record<string, string>>(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertRemedySchema = createInsertSchema(remedies).omit({
  id: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export const insertKeywordSchema = createInsertSchema(keywords).omit({
  id: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
});

export const insertMedicalTermSchema = createInsertSchema(medicalTerms).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertRemedy = z.infer<typeof insertRemedySchema>;
export type Remedy = typeof remedies.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertKeyword = z.infer<typeof insertKeywordSchema>;
export type Keyword = typeof keywords.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;
export type InsertMedicalTerm = z.infer<typeof insertMedicalTermSchema>;
export type MedicalTerm = typeof medicalTerms.$inferSelect;
