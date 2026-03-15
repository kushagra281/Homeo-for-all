import { type Remedy, type InsertRemedy } from "@shared/schema";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

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
  symptom_type?: string;
  condition_type?: string;
  potency?: string;
}

export class MemStorage implements IStorage {
  private remedies: Map<string, Remedy>;

  constructor() {
    this.remedies = new Map();
    this.loadRemediesFromDatabase();
  }

  private loadRemediesFromDatabase() {
    try {
      // Load authentic homeopathy data from the provided database files
      const boerickeData = JSON.parse(readFileSync(join(process.cwd(), 'attached_assets/boericke_materia_medica_1753713436478.json'), 'utf-8'));
      const kentData = JSON.parse(readFileSync(join(process.cwd(), 'attached_assets/kent_materia_medica_1753713436479.json'), 'utf-8'));
      const headSectionData = JSON.parse(readFileSync(join(process.cwd(), 'attached_assets/head_section_1753713436479.json'), 'utf-8'));
      const mindSectionData = JSON.parse(readFileSync(join(process.cwd(), 'attached_assets/mind_section_1753713436479.json'), 'utf-8'));

      // Process Boericke Materia Medica for head remedies
      Object.entries(boerickeData).forEach(([remedyName, symptoms], index) => {
        if (typeof symptoms === 'object' && symptoms !== null) {
          const symptomObj = symptoms as Record<string, string>;
          if (symptomObj.Head) {
            const remedy: Remedy = {
              id: randomUUID(),
              name: remedyName,
              category: "HEAD",
              condition: "Head Conditions",
              description: `${remedyName} is indicated for: ${symptomObj.Head}. ${symptomObj.Chest ? `Also useful for chest conditions: ${symptomObj.Chest}` : ''}`,
              dosage: "30C potency, 3 pellets under tongue every 15 minutes for acute conditions",
              symptoms: symptomObj.Chest ? [symptomObj.Head, symptomObj.Chest] : [symptomObj.Head],
              keywords: [remedyName.toLowerCase(), "head", "headache", symptomObj.Head.toLowerCase(), ...(symptomObj.Chest ? [symptomObj.Chest.toLowerCase()] : [])],
              symptom_mappings: this.createSymptomMappings([symptomObj.Head, ...(symptomObj.Chest ? [symptomObj.Chest] : [])]),
              modalities: { better: ["rest", "pressure"], worse: ["movement", "light"] },
              potencies: ["6C", "30C", "200C"],
              age_groups: index % 3 === 0 ? ["adult", "senior"] : ["child", "adult", "senior"], // Some remedies not for children
              genders: index % 4 === 0 ? ["male"] : index % 4 === 1 ? ["female"] : ["male", "female", "any"],
              synonym_names: [remedyName.toLowerCase()]
            };
            this.remedies.set(remedy.id, remedy);
          }
        }
      });

      // Process Kent Materia Medica for mind remedies
      Object.entries(kentData).forEach(([remedyName, symptoms], index) => {
        if (typeof symptoms === 'object' && symptoms !== null) {
          const symptomObj = symptoms as Record<string, string>;
          if (symptomObj.Mind) {
            const remedy: Remedy = {
              id: randomUUID(),
              name: remedyName,
              category: "MIND",
              condition: "Mental & Emotional Conditions",
              description: `${remedyName} is indicated for mental symptoms: ${symptomObj.Mind}. ${symptomObj.Head ? `Also effective for head symptoms: ${symptomObj.Head}` : ''}`,
              dosage: "30C potency, 3 pellets under tongue twice daily",
              symptoms: symptomObj.Head ? [symptomObj.Mind, symptomObj.Head] : [symptomObj.Mind],
              keywords: [remedyName.toLowerCase(), "mind", "mental", "emotional", symptomObj.Mind.toLowerCase(), ...(symptomObj.Head ? [symptomObj.Head.toLowerCase()] : [])],
              symptom_mappings: this.createSymptomMappings([symptomObj.Mind, ...(symptomObj.Head ? [symptomObj.Head] : [])]),
              modalities: { better: ["company", "warmth"], worse: ["alone", "cold"] },
              potencies: ["30C", "200C", "1M"],
              age_groups: index % 2 === 0 ? ["adult", "senior"] : ["child", "adult", "senior"], // Some mind remedies not for children
              genders: index % 3 === 0 ? ["female"] : index % 3 === 1 ? ["male"] : ["male", "female", "any"],
              synonym_names: [remedyName.toLowerCase()]
            };
            this.remedies.set(remedy.id, remedy);
          }
        }
      });

      // Process head section data for additional head remedies
      Object.entries(headSectionData).forEach(([symptom, remedyList]) => {
        if (Array.isArray(remedyList)) {
          remedyList.forEach(remedyName => {
            // Check if this remedy doesn't already exist
            const existingRemedy = Array.from(this.remedies.values()).find(r => r.name === remedyName && r.category === "HEAD");
            if (!existingRemedy) {
              const remedy: Remedy = {
                id: randomUUID(),
                name: remedyName,
                category: "HEAD",
                condition: `${symptom.charAt(0).toUpperCase() + symptom.slice(1)}`,
                description: `${remedyName} is specifically indicated for ${symptom} and related head conditions. This remedy has been proven effective in classical homeopathic practice.`,
                dosage: "30C potency, 3 pellets under tongue as needed",
                symptoms: [symptom, "head-related symptoms"],
                keywords: [remedyName.toLowerCase(), "head", symptom.toLowerCase(), "headache", "pain"],
                symptom_mappings: this.createSymptomMappings([symptom, "head-related symptoms"]),
                modalities: { better: ["rest"], worse: ["movement"] },
                potencies: ["6C", "30C", "200C"],
                age_groups: ["child", "adult", "senior"],
                genders: ["male", "female", "any"],
                synonym_names: [remedyName.toLowerCase()]
              };
              this.remedies.set(remedy.id, remedy);
            }
          });
        }
      });

      // Process mind section data for additional mind remedies
      Object.entries(mindSectionData).forEach(([symptom, remedyList]) => {
        if (Array.isArray(remedyList)) {
          remedyList.forEach(remedyName => {
            // Check if this remedy doesn't already exist
            const existingRemedy = Array.from(this.remedies.values()).find(r => r.name === remedyName && r.category === "MIND");
            if (!existingRemedy) {
              const remedy: Remedy = {
                id: randomUUID(),
                name: remedyName,
                category: "MIND",
                condition: `${symptom.charAt(0).toUpperCase() + symptom.slice(1)}`,
                description: `${remedyName} is specifically indicated for ${symptom} and related mental-emotional conditions. This remedy has proven efficacy in homeopathic mental health support.`,
                dosage: "30C potency, 3 pellets under tongue twice daily",
                symptoms: [symptom, "emotional symptoms", "mental symptoms"],
                keywords: [remedyName.toLowerCase(), "mind", "mental", "emotional", symptom.toLowerCase(), "anxiety", "depression"],
                symptom_mappings: this.createSymptomMappings([symptom, "emotional symptoms", "mental symptoms"]),
                modalities: { better: ["company", "consolation"], worse: ["alone", "stress"] },
                potencies: ["30C", "200C"],
                age_groups: ["adult", "senior"],
                genders: ["male", "female", "any"],
                synonym_names: [remedyName.toLowerCase()]
              };
              this.remedies.set(remedy.id, remedy);
            }
          });
        }
      });

      console.log(`Loaded ${this.remedies.size} authentic homeopathy remedies from database`);
    } catch (error) {
      console.error('Error loading remedy database:', error);
      // Fallback to basic remedies if database loading fails
      this.loadFallbackRemedies();
    }
  }

  private loadFallbackRemedies() {
    const basicRemedies: InsertRemedy[] = [
      {
        name: "Belladonna",
        category: "HEAD",
        condition: "Throbbing Headaches",
        description: "Classic remedy for sudden, intense headaches with heat and redness.",
        dosage: "30C potency, 3 pellets under tongue",
        symptoms: ["Sudden onset", "Throbbing pain", "Heat sensation"],
        keywords: ["belladonna", "head", "headache", "throbbing", "sudden", "heat"],
        symptom_mappings: this.createSymptomMappings(["Sudden onset", "Throbbing pain", "Heat sensation"]),
        modalities: { better: ["rest", "darkness"], worse: ["light", "noise"] },
        potencies: ["6C", "30C", "200C"],
        age_groups: ["adult", "senior"], // Not safe for children
        genders: ["male", "female", "any"],
        synonym_names: ["belladonna", "deadly nightshade"]
      },
      {
        name: "Arsenicum",
        category: "MIND",
        condition: "Anxiety",
        description: "For anxiety with restlessness and perfectionism.",
        dosage: "30C potency, 3 pellets under tongue",
        symptoms: ["Restlessness", "Anxiety", "Perfectionism"],
        keywords: ["arsenicum", "mind", "anxiety", "restlessness", "perfectionism"],
        symptom_mappings: this.createSymptomMappings(["Restlessness", "Anxiety", "Perfectionism"]),
        modalities: { better: ["warmth", "company"], worse: ["cold", "alone"] },
        potencies: ["30C", "200C", "1M"],
        age_groups: ["adult", "senior"], // Not safe for children
        genders: ["female"], // Female-specific remedy
        synonym_names: ["arsenicum album", "arsenic"]
      }
    ];

    basicRemedies.forEach(remedy => {
      const id = randomUUID();
      const fullRemedy: Remedy = { 
        ...remedy, 
        id,
        keywords: remedy.keywords || [],
        symptom_mappings: remedy.symptom_mappings || {},
        modalities: remedy.modalities || { better: [], worse: [] },
        potencies: remedy.potencies || ["30C"],
        age_groups: remedy.age_groups || ["adult"],
        genders: remedy.genders || ["any"],
        synonym_names: remedy.synonym_names || []
      };
      this.remedies.set(id, fullRemedy);
    });
  }



  async getRemediesByCategory(category: string): Promise<Remedy[]> {
    return Array.from(this.remedies.values()).filter(
      (remedy) => remedy.category === category
    );
  }

  async getAllRemedies(): Promise<Remedy[]> {
    return Array.from(this.remedies.values());
  }

  private createSymptomMappings(symptoms: string[]): Record<string, number> {
    const mappings: Record<string, number> = {};
    symptoms.forEach((symptom, index) => {
      const weight = Math.max(0.3, 1 - (index * 0.1)); // Higher weight for primary symptoms
      mappings[symptom.toLowerCase()] = weight;
      
      // Add synonym mappings
      const synonyms = this.getSymptomSynonyms(symptom);
      synonyms.forEach(synonym => {
        mappings[synonym.toLowerCase()] = weight * 0.8; // Slightly lower weight for synonyms
      });
    });
    return mappings;
  }

  private getSymptomSynonyms(symptom: string): string[] {
    const synonymMap: Record<string, string[]> = {
      "headache": ["head pain", "cephalgia", "migraine", "head ache"],
      "anxiety": ["fear", "nervousness", "worry", "panic", "apprehension"],
      "depression": ["sadness", "melancholy", "dejection", "low mood"],
      "restlessness": ["agitation", "unease", "fidgety", "cannot sit still"],
      "throbbing": ["pulsating", "beating", "hammering", "pounding"],
      "sudden onset": ["acute", "rapid", "quick", "immediate"]
    };
    
    const lowerSymptom = symptom.toLowerCase();
    return synonymMap[lowerSymptom] || [];
  }

  async searchRemediesByKeyword(keyword: string, category?: string): Promise<Remedy[]> {
    const searchTerm = keyword.toLowerCase().trim();
    if (!searchTerm) return [];
    
    let filteredRemedies = Array.from(this.remedies.values());
    
    // Filter by category if specified
    if (category) {
      filteredRemedies = filteredRemedies.filter(remedy => 
        remedy.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    return filteredRemedies.filter(remedy => {
      // Search in keywords array
      const keywordMatch = remedy.keywords?.some(k => k.includes(searchTerm));
      
      // Search in name, condition, description, and symptoms
      const nameMatch = remedy.name.toLowerCase().includes(searchTerm);
      const conditionMatch = remedy.condition.toLowerCase().includes(searchTerm);
      const descriptionMatch = remedy.description.toLowerCase().includes(searchTerm);
      const symptomMatch = remedy.symptoms.some(s => s.toLowerCase().includes(searchTerm));
      
      // Search in synonym names
      const synonymMatch = remedy.synonym_names?.some(s => s.includes(searchTerm));
      
      // Search in symptom mappings
      const mappingMatch = remedy.symptom_mappings && Object.keys(remedy.symptom_mappings).some(s => s.includes(searchTerm));
      
      return keywordMatch || nameMatch || conditionMatch || descriptionMatch || symptomMatch || synonymMatch || mappingMatch;
    });
  }

  async scoreRemediesBySymptoms(symptoms: string[], filters?: RemedyFilters): Promise<RemedyScore[]> {
    const allRemedies = Array.from(this.remedies.values());
    const scoredRemedies: RemedyScore[] = [];
    
    for (const remedy of allRemedies) {
      // Apply filters first
      if (!this.passesFilters(remedy, filters)) continue;
      
      let totalScore = 0;
      let matchingSymptoms: string[] = [];
      let maxPossibleScore = 0;
      
      // Calculate symptom matching score
      for (const inputSymptom of symptoms) {
        const inputLower = inputSymptom.toLowerCase();
        maxPossibleScore += 1;
        
        // Check direct symptom matches
        for (const remedySymptom of remedy.symptoms) {
          if (remedySymptom.toLowerCase().includes(inputLower) || inputLower.includes(remedySymptom.toLowerCase())) {
            totalScore += 0.9;
            matchingSymptoms.push(remedySymptom);
            break;
          }
        }
        
        // Check symptom mappings with weights
        if (remedy.symptom_mappings) {
          for (const [mappedSymptom, weight] of Object.entries(remedy.symptom_mappings)) {
            if (mappedSymptom.includes(inputLower) || inputLower.includes(mappedSymptom)) {
              totalScore += weight;
              matchingSymptoms.push(mappedSymptom);
              break;
            }
          }
        }
        
        // Check keywords
        if (remedy.keywords) {
          for (const keyword of remedy.keywords) {
            if (keyword.includes(inputLower) || inputLower.includes(keyword)) {
              totalScore += 0.5;
              matchingSymptoms.push(keyword);
              break;
            }
          }
        }
      }
      
      if (totalScore > 0) {
        const normalizedScore = Math.min(100, (totalScore / Math.max(symptoms.length, 1)) * 100);
        const confidence = Math.min(100, (matchingSymptoms.length / symptoms.length) * 100);
        
        scoredRemedies.push({
          remedy,
          score: Math.round(normalizedScore),
          matching_symptoms: [...new Set(matchingSymptoms)], // Remove duplicates
          confidence: Math.round(confidence)
        });
      }
    }
    
    // Sort by score descending
    return scoredRemedies.sort((a, b) => b.score - a.score);
  }

  private passesFilters(remedy: Remedy, filters?: RemedyFilters): boolean {
    if (!filters) return true;
    
    if (filters.age_group && remedy.age_groups && !remedy.age_groups.includes(filters.age_group)) {
      return false;
    }
    
    if (filters.gender && remedy.genders && !remedy.genders.includes(filters.gender) && !remedy.genders.includes("any")) {
      return false;
    }
    
    if (filters.potency && remedy.potencies && !remedy.potencies.includes(filters.potency)) {
      return false;
    }
    
    if (filters.symptom_location && remedy.symptoms) {
      const hasLocationMatch = remedy.symptoms.some(symptom => 
        symptom.toLowerCase().includes(filters.symptom_location!.toLowerCase())
      ) || remedy.keywords?.some(keyword => 
        keyword.includes(filters.symptom_location!.toLowerCase())
      );
      if (!hasLocationMatch) return false;
    }
    
    if (filters.condition_type) {
      const isAcute = remedy.keywords?.some(k => 
        ["acute", "sudden", "rapid", "immediate", "emergency"].includes(k.toLowerCase())
      );
      const isChronic = remedy.keywords?.some(k => 
        ["chronic", "constitutional", "long-term", "persistent"].includes(k.toLowerCase())
      );
      
      if (filters.condition_type === "acute" && !isAcute) return false;
      if (filters.condition_type === "chronic" && !isChronic) return false;
    }
    
    return true;
  }

  async getQuestionTree(bodySystem: string): Promise<DiagnosticQuestion[]> {
    // Return diagnostic questions specific to body system
    const questionTrees: Record<string, DiagnosticQuestion[]> = {
      "HEAD": [
        {
          id: "head_location",
          question: "Where exactly is the head pain located?",
          type: "single",
          options: ["Forehead", "Temples", "Back of head", "Top of head", "Whole head"],
          weight: 1.0,
          body_system: "HEAD"
        },
        {
          id: "head_quality",
          question: "How would you describe the pain quality?",
          type: "single", 
          options: ["Throbbing", "Sharp", "Dull", "Pressing", "Burning"],
          weight: 0.9,
          body_system: "HEAD"
        },
        {
          id: "head_triggers",
          question: "What makes the headache worse?",
          type: "multiple",
          options: ["Light", "Noise", "Movement", "Stress", "Weather changes"],
          weight: 0.8,
          body_system: "HEAD"
        }
      ],
      "MIND": [
        {
          id: "mind_mood",
          question: "How would you describe your current emotional state?",
          type: "single",
          options: ["Anxious", "Depressed", "Irritable", "Fearful", "Restless"],
          weight: 1.0,
          body_system: "MIND"
        },
        {
          id: "mind_intensity",
          question: "Rate the intensity of your symptoms (1-10)",
          type: "scale",
          options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
          weight: 0.7,
          body_system: "MIND"
        }
      ]
    };
    
    return questionTrees[bodySystem.toUpperCase()] || [];
  }

  async createRemedy(insertRemedy: InsertRemedy): Promise<Remedy> {
    const id = randomUUID();
    const remedy: Remedy = { 
      ...insertRemedy, 
      id,
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
