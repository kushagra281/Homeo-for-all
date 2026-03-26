import { type Remedy, type InsertRemedy } from "@shared/schema";
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

// NOTE: Real scoring is done via Supabase on the frontend.
// This backend storage is kept minimal for API compatibility only.
export class MemStorage implements IStorage {
  private remedies: Map<string, Remedy> = new Map();

  constructor() {
    console.log("HomeoWell: Using Supabase as primary database");
    console.log("Scoring is handled by frontend Supabase client");
  }

  async getRemediesByCategory(category: string): Promise<Remedy[]> {
    return [];
  }

  async getAllRemedies(): Promise<Remedy[]> {
    return [];
  }

  async searchRemediesByKeyword(keyword: string, category?: string): Promise<Remedy[]> {
    return [];
  }

  async scoreRemediesBySymptoms(symptoms: string[], filters?: RemedyFilters): Promise<RemedyScore[]> {
    // Real scoring happens in frontend via Supabase
    return [];
  }

  async getQuestionTree(bodySystem: string): Promise<DiagnosticQuestion[]> {
    return [];
  }

  async createRemedy(insertRemedy: InsertRemedy): Promise<Remedy> {
    const id = randomUUID();
    const remedy: Remedy = {
      ...insertRemedy, id,
      keywords: insertRemedy.keywords || [],
      symptom_mappings: insertRemedy.symptom_mappings || {},
      modalities: insertRemedy.modalities || { better: [], worse: [] },
      potencies: insertRemedy.potencies || ["30C"],
      age_groups: insertRemedy.age_groups || ["adult"],
      genders: insertRemedy.genders || ["any"],
      synonym_names: insertRemedy.synonym_names || []
    };
    this.remedies.set(id, remedy);
    return remedy;
  }
}

export const storage = new MemStorage();
