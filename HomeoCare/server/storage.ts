// ================================================================
// storage.ts — MINIMAL PLACEHOLDER
// All data is served from Supabase online database.
// This file exists only for Express API compatibility.
//
// Online Database (Supabase):
//   remedies          476  rows  — scraper materia medica
//   remedy_symptoms   17,678 rows — scraper symptoms
//   remedy_sections   4,644  rows — scraper full text
//   symptoms          15,000 rows — repertory rubrics
//   patients                    — user profiles
//   search_history              — consultation history
// ================================================================
import type { Remedy, InsertRemedy } from "@shared/schema";
import { randomUUID } from "crypto";
import type { DiagnosticQuestion, RemedyScore } from "@shared/schema";

export interface IStorage {
  getRemediesByCategory(category: string): Promise<Remedy[]>;
  getAllRemedies(): Promise<Remedy[]>;
  searchRemediesByKeyword(keyword: string, category?: string): Promise<Remedy[]>;
  scoreRemediesBySymptoms(symptoms: string[], filters?: RemedyFilters): Promise<RemedyScore[]>;
  getQuestionTree(bodySystem: string): Promise<DiagnosticQuestion[]>;
  createRemedy(remedy: InsertRemedy): Promise<Remedy>;
}

export interface RemedyFilters {
  age_group?: string;
  gender?: string;
  symptom_location?: string;
  condition_type?: string;
}

export class MemStorage implements IStorage {
  constructor() {
    console.log("HomeoWell: 100% Supabase online database");
    console.log("Tables: remedies(476) | remedy_symptoms(17678) | symptoms(15000)");
  }

  async getRemediesByCategory(_category: string): Promise<Remedy[]>          { return [] }
  async getAllRemedies():                          Promise<Remedy[]>          { return [] }
  async searchRemediesByKeyword(_kw: string):     Promise<Remedy[]>          { return [] }
  async scoreRemediesBySymptoms(_s: string[]):    Promise<RemedyScore[]>     { return [] }
  async getQuestionTree(_sys: string):            Promise<DiagnosticQuestion[]> { return [] }

  async createRemedy(insertRemedy: InsertRemedy): Promise<Remedy> {
    const id = randomUUID();
    return {
      ...insertRemedy, id,
      keywords:         insertRemedy.keywords         || [],
      symptom_mappings: insertRemedy.symptom_mappings || {},
      modalities:       insertRemedy.modalities       || { better: [], worse: [] },
      potencies:        insertRemedy.potencies        || ["30C"],
      age_groups:       insertRemedy.age_groups       || ["adult"],
      genders:          insertRemedy.genders          || ["any"],
      synonym_names:    insertRemedy.synonym_names    || []
    };
  }
}

export const storage = new MemStorage();
