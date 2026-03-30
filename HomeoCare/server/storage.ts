import { type Remedy, type InsertRemedy } from "@shared/schema";
import { randomUUID } from "crypto";
import { readFileSync, existsSync } from "fs";
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

  // Try multiple paths to find a file
  private findFile(filenames: string[]): string | null {
    const searchDirs = [
      join(process.cwd(), 'attached_assets'),
      join(process.cwd(), 'server/data'),
      join(process.cwd(), 'data'),
      process.cwd(),
    ];
    for (const dir of searchDirs) {
      for (const filename of filenames) {
        const fullPath = join(dir, filename);
        if (existsSync(fullPath)) return fullPath;
      }
    }
    return null;
  }

  private loadRemediesFromDatabase() {
    try {
      // Load Boericke Materia Medica
      const boerPath = this.findFile(['boericke_materia_medica_1753713436478.json', 'boericke_materia_medica.json']);
      if (boerPath) {
        const boerickeData = JSON.parse(readFileSync(boerPath, 'utf-8'));
        Object.entries(boerickeData).forEach(([remedyName, symptoms], index) => {
          if (typeof symptoms === 'object' && symptoms !== null) {
            const symptomObj = symptoms as Record<string, string>;
            if (symptomObj.Head) {
              const remedy: Remedy = {
                id: randomUUID(), name: remedyName, category: "HEAD",
                condition: "Head Conditions",
                description: `${remedyName} is indicated for: ${symptomObj.Head}.${symptomObj.Chest ? ` Also: ${symptomObj.Chest}` : ''}`,
                dosage: "30C potency, 3 pellets under tongue",
                symptoms: symptomObj.Chest ? [symptomObj.Head, symptomObj.Chest] : [symptomObj.Head],
                keywords: [remedyName.toLowerCase(), "head", "headache", symptomObj.Head.toLowerCase()],
                symptom_mappings: this.createSymptomMappings([symptomObj.Head]),
                modalities: { better: ["rest", "pressure"], worse: ["movement", "light"] },
                potencies: ["6C", "30C", "200C"],
                age_groups: index % 3 === 0 ? ["adult", "senior"] : ["child", "adult", "senior"],
                genders: index % 4 === 0 ? ["male"] : index % 4 === 1 ? ["female"] : ["male", "female", "any"],
                synonym_names: [remedyName.toLowerCase()]
              };
              this.remedies.set(remedy.id, remedy);
            }
          }
        });
      }

      // Load Kent Materia Medica
      const kentPath = this.findFile(['kent_materia_medica_1753713436479.json', 'kent_materia_medica.json']);
      if (kentPath) {
        const kentData = JSON.parse(readFileSync(kentPath, 'utf-8'));
        Object.entries(kentData).forEach(([remedyName, symptoms], index) => {
          if (typeof symptoms === 'object' && symptoms !== null) {
            const symptomObj = symptoms as Record<string, string>;
            if (symptomObj.Mind) {
              const remedy: Remedy = {
                id: randomUUID(), name: remedyName, category: "MIND",
                condition: "Mental & Emotional Conditions",
                description: `${remedyName} for mental symptoms: ${symptomObj.Mind}.`,
                dosage: "30C potency, 3 pellets twice daily",
                symptoms: symptomObj.Head ? [symptomObj.Mind, symptomObj.Head] : [symptomObj.Mind],
                keywords: [remedyName.toLowerCase(), "mind", "mental", "emotional", symptomObj.Mind.toLowerCase()],
                symptom_mappings: this.createSymptomMappings([symptomObj.Mind]),
                modalities: { better: ["company", "warmth"], worse: ["alone", "cold"] },
                potencies: ["30C", "200C", "1M"],
                age_groups: index % 2 === 0 ? ["adult", "senior"] : ["child", "adult", "senior"],
                genders: index % 3 === 0 ? ["female"] : index % 3 === 1 ? ["male"] : ["male", "female", "any"],
                synonym_names: [remedyName.toLowerCase()]
              };
              this.remedies.set(remedy.id, remedy);
            }
          }
        });
      }

      // Load Head Section
      const headPath = this.findFile(['head_section_1753713436479.json', 'head_section.json']);
      if (headPath) {
        const headSectionData = JSON.parse(readFileSync(headPath, 'utf-8'));
        Object.entries(headSectionData).forEach(([symptom, remedyList]) => {
          if (Array.isArray(remedyList)) {
            remedyList.forEach(remedyName => {
              const existing = Array.from(this.remedies.values()).find(r => r.name === remedyName && r.category === "HEAD");
              if (!existing) {
                const remedy: Remedy = {
                  id: randomUUID(), name: remedyName, category: "HEAD",
                  condition: `${symptom.charAt(0).toUpperCase() + symptom.slice(1)}`,
                  description: `${remedyName} indicated for ${symptom} and head conditions.`,
                  dosage: "30C potency, 3 pellets as needed",
                  symptoms: [symptom, "head-related symptoms"],
                  keywords: [remedyName.toLowerCase(), "head", symptom.toLowerCase(), "headache"],
                  symptom_mappings: this.createSymptomMappings([symptom]),
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
      }

      // Load Mind Section
      const mindPath = this.findFile(['mind_section_1753713436479.json', 'mind_section.json']);
      if (mindPath) {
        const mindSectionData = JSON.parse(readFileSync(mindPath, 'utf-8'));
        Object.entries(mindSectionData).forEach(([symptom, remedyList]) => {
          if (Array.isArray(remedyList)) {
            remedyList.forEach(remedyName => {
              const existing = Array.from(this.remedies.values()).find(r => r.name === remedyName && r.category === "MIND");
              if (!existing) {
                const remedy: Remedy = {
                  id: randomUUID(), name: remedyName, category: "MIND",
                  condition: `${symptom.charAt(0).toUpperCase() + symptom.slice(1)}`,
                  description: `${remedyName} indicated for ${symptom} and mental-emotional conditions.`,
                  dosage: "30C potency, 3 pellets twice daily",
                  symptoms: [symptom, "emotional symptoms", "mental symptoms"],
                  keywords: [remedyName.toLowerCase(), "mind", "mental", "emotional", symptom.toLowerCase()],
                  symptom_mappings: this.createSymptomMappings([symptom, "emotional symptoms"]),
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
      }

      // ── Load 5000 Symptoms Database ──────────────────────────────
      const symptomsPath = this.findFile([
  'homeopathy_symptoms_2000.json',
  'homeopathy_5000_symptoms.json',
  'homeopathy_2000_symptoms.json',
  'symptoms.json'
]);

      if (symptomsPath) {
        console.log(`Loading symptoms database from: ${symptomsPath}`);
        const symptomsData = JSON.parse(readFileSync(symptomsPath, 'utf-8'));
        const symptomsList = symptomsData.symptoms || symptomsData;

        symptomsList.forEach((sym: any) => {
          const remediesArr = sym.remedies || sym.remedy_list || [];
          remediesArr.forEach((r: any) => {
            const remedyName = r.name || r.remedy || r;
            const grade = r.grade || 1;
            const remedy: Remedy = {
              id: randomUUID(),
              name: remedyName,
              category: (sym.category || sym.section || "GENERALS").toUpperCase(),
              condition: sym.rubric || sym.symptom || sym.name || "",
              description: `${remedyName} is indicated for: ${sym.rubric || sym.symptom || ""}. Location: ${sym.location || "general"}.`,
              dosage: "30C potency, 3 pellets as needed",
              symptoms: [sym.rubric || sym.symptom || "", sym.location || ""].filter(Boolean),
              keywords: [
                remedyName.toLowerCase(),
                (sym.category || "").toLowerCase(),
                (sym.location || "").toLowerCase(),
                ...(sym.rubric || sym.symptom || "").toLowerCase().split(/[\s\-]+/).filter((w: string) => w.length > 2),
                ...(sym.modalities?.worse || []).map((w: string) => w.toLowerCase()),
                ...(sym.modalities?.better || []).map((b: string) => b.toLowerCase()),
              ].filter(Boolean),
              symptom_mappings: this.createSymptomMappings([sym.rubric || sym.symptom || "", sym.location || ""]),
              modalities: {
                better: sym.modalities?.better || [],
                worse: sym.modalities?.worse || [],
              },
              potencies: ["6C", "30C", "200C"],
              age_groups: ["child", "adult", "senior"],
              genders: ["male", "female", "any"],
              synonym_names: [remedyName.toLowerCase()],
            };
            this.remedies.set(remedy.id, remedy);
          });
        });
        console.log(`Loaded symptoms database: ${symptomsList.length} symptoms processed`);
      } else {
        console.warn('⚠️ Symptoms database not found — using fallback only');
      }

      console.log(`✅ Total remedies loaded: ${this.remedies.size}`);

    } catch (error) {
      console.error('Error loading remedy database:', error);
      this.loadFallbackRemedies();
    }
  }

  private loadFallbackRemedies() {
    const basicRemedies: InsertRemedy[] = [
      {
        name: "Belladonna", category: "HEAD", condition: "Throbbing Headaches",
        description: "Classic remedy for sudden, intense headaches with heat and redness.",
        dosage: "30C potency, 3 pellets under tongue",
        symptoms: ["Sudden onset", "Throbbing pain", "Heat sensation"],
        keywords: ["belladonna", "head", "headache", "throbbing", "sudden", "heat"],
        symptom_mappings: this.createSymptomMappings(["Sudden onset", "Throbbing pain"]),
        modalities: { better: ["rest", "darkness"], worse: ["light", "noise"] },
        potencies: ["6C", "30C", "200C"], age_groups: ["adult", "senior"],
        genders: ["male", "female", "any"], synonym_names: ["belladonna", "deadly nightshade"]
      },
      {
        name: "Arsenicum Album", category: "MIND", condition: "Anxiety",
        description: "For anxiety with restlessness and perfectionism.",
        dosage: "30C potency, 3 pellets under tongue",
        symptoms: ["Restlessness", "Anxiety", "Perfectionism"],
        keywords: ["arsenicum", "mind", "anxiety", "restlessness"],
        symptom_mappings: this.createSymptomMappings(["Restlessness", "Anxiety"]),
        modalities: { better: ["warmth", "company"], worse: ["cold", "alone"] },
        potencies: ["30C", "200C", "1M"], age_groups: ["adult", "senior"],
        genders: ["male", "female", "any"], synonym_names: ["arsenicum album", "arsenic"]
      },
      {
        name: "Nux Vomica", category: "STOMACH", condition: "Digestive complaints",
        description: "For digestive issues from overindulgence, stress, sedentary lifestyle.",
        dosage: "30C potency, 3 pellets under tongue",
        symptoms: ["Nausea", "Constipation", "Irritability", "Overwork"],
        keywords: ["nux vomica", "stomach", "digestion", "nausea", "constipation", "liver"],
        symptom_mappings: this.createSymptomMappings(["Nausea", "Constipation"]),
        modalities: { better: ["warmth", "rest"], worse: ["morning", "cold", "overwork"] },
        potencies: ["6C", "30C", "200C"], age_groups: ["adult", "senior"],
        genders: ["male", "female", "any"], synonym_names: ["nux vomica", "poison nut"]
      },
      {
        name: "Pulsatilla", category: "FEMALE", condition: "Female complaints",
        description: "For weepy, gentle patients who need consolation.",
        dosage: "30C potency, 3 pellets twice daily",
        symptoms: ["Weeping", "Changeable symptoms", "Craving consolation"],
        keywords: ["pulsatilla", "female", "weeping", "changeable", "menses"],
        symptom_mappings: this.createSymptomMappings(["Weeping", "Changeable symptoms"]),
        modalities: { better: ["open air", "consolation"], worse: ["heat", "rich food"] },
        potencies: ["30C", "200C"], age_groups: ["child", "adult", "senior"],
        genders: ["female"], synonym_names: ["pulsatilla", "windflower"]
      },
      {
        name: "Rhus Toxicodendron", category: "EXTREMITIES", condition: "Joint and muscle pain",
        description: "For stiffness and pain worse on first motion, better continued movement.",
        dosage: "30C potency, 3 pellets as needed",
        symptoms: ["Joint stiffness", "Pain worse rest", "Pain better movement", "Restlessness"],
        keywords: ["rhus tox", "joints", "muscles", "stiffness", "arthritis", "rheumatism"],
        symptom_mappings: this.createSymptomMappings(["Joint stiffness", "Pain worse rest"]),
        modalities: { better: ["movement", "warmth"], worse: ["rest", "cold", "damp"] },
        potencies: ["6C", "30C", "200C"], age_groups: ["child", "adult", "senior"],
        genders: ["male", "female", "any"], synonym_names: ["rhus tox", "poison ivy"]
      }
    ];

    basicRemedies.forEach(remedy => {
      const id = randomUUID();
      this.remedies.set(id, {
        ...remedy, id,
        keywords: remedy.keywords || [],
        symptom_mappings: remedy.symptom_mappings || {},
        modalities: remedy.modalities || { better: [], worse: [] },
        potencies: remedy.potencies || ["30C"],
        age_groups: remedy.age_groups || ["adult"],
        genders: remedy.genders || ["any"],
        synonym_names: remedy.synonym_names || []
      });
    });
    console.log(`Fallback: loaded ${this.remedies.size} basic remedies`);
  }

  async getRemediesByCategory(category: string): Promise<Remedy[]> {
    return Array.from(this.remedies.values()).filter(
      r => r.category.toLowerCase() === category.toLowerCase()
    );
  }

  async getAllRemedies(): Promise<Remedy[]> {
    return Array.from(this.remedies.values());
  }

  private createSymptomMappings(symptoms: string[]): Record<string, number> {
    const mappings: Record<string, number> = {};
    symptoms.forEach((symptom, index) => {
      if (!symptom) return;
      const weight = Math.max(0.3, 1 - (index * 0.1));
      mappings[symptom.toLowerCase()] = weight;
      this.getSymptomSynonyms(symptom).forEach(syn => {
        mappings[syn.toLowerCase()] = weight * 0.8;
      });
    });
    return mappings;
  }

  private getSymptomSynonyms(symptom: string): string[] {
    const synonymMap: Record<string, string[]> = {
      "headache": ["head pain", "cephalgia", "migraine"],
      "anxiety": ["fear", "nervousness", "worry", "panic"],
      "depression": ["sadness", "melancholy", "low mood"],
      "restlessness": ["agitation", "fidgety"],
      "throbbing": ["pulsating", "beating", "pounding"],
    };
    return synonymMap[symptom.toLowerCase()] || [];
  }

  async searchRemediesByKeyword(keyword: string, category?: string): Promise<Remedy[]> {
    const searchTerm = keyword.toLowerCase().trim();
    if (!searchTerm) return [];
    let filtered = Array.from(this.remedies.values());
    if (category) filtered = filtered.filter(r => r.category.toLowerCase() === category.toLowerCase());
    return filtered.filter(r =>
      r.keywords?.some(k => k.includes(searchTerm)) ||
      r.name.toLowerCase().includes(searchTerm) ||
      r.condition.toLowerCase().includes(searchTerm) ||
      r.description.toLowerCase().includes(searchTerm) ||
      r.symptoms.some(s => s.toLowerCase().includes(searchTerm)) ||
      r.synonym_names?.some(s => s.includes(searchTerm)) ||
      (r.symptom_mappings && Object.keys(r.symptom_mappings).some(s => s.includes(searchTerm)))
    );
  }

  async scoreRemediesBySymptoms(symptoms: string[], filters?: RemedyFilters): Promise<RemedyScore[]> {
    const allRemedies = Array.from(this.remedies.values());
    const scoredRemedies: RemedyScore[] = [];

    for (const remedy of allRemedies) {
      if (!this.passesFilters(remedy, filters)) continue;

      let totalScore = 0;
      let matchingSymptoms: string[] = [];

      for (const inputSymptom of symptoms) {
        const inputLower = inputSymptom.toLowerCase();

        for (const remedySymptom of remedy.symptoms) {
          if (remedySymptom.toLowerCase().includes(inputLower) || inputLower.includes(remedySymptom.toLowerCase())) {
            totalScore += 0.9;
            matchingSymptoms.push(remedySymptom);
            break;
          }
        }

        if (remedy.symptom_mappings) {
          for (const [mappedSymptom, weight] of Object.entries(remedy.symptom_mappings)) {
            if (mappedSymptom.includes(inputLower) || inputLower.includes(mappedSymptom)) {
              totalScore += weight;
              matchingSymptoms.push(mappedSymptom);
              break;
            }
          }
        }

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
        scoredRemedies.push({
          remedy,
          score: Math.round(normalizedScore),
          matching_symptoms: [...new Set(matchingSymptoms)],
          confidence: Math.round(normalizedScore)
        });
      }
    }

    return scoredRemedies.sort((a, b) => b.score - a.score);
  }

  private passesFilters(remedy: Remedy, filters?: RemedyFilters): boolean {
    if (!filters) return true;
    if (filters.age_group && remedy.age_groups) {
      const ageNum = parseInt(filters.age_group.split('-')[0]);
      const isChild = ageNum <= 13;
      const isSenior = ageNum >= 63;
      if (isChild && !remedy.age_groups.includes("child")) return false;
      if (isSenior && !remedy.age_groups.includes("senior")) return false;
    }
    if (filters.gender && remedy.genders) {
      const g = filters.gender.toLowerCase();
      if (!remedy.genders.includes(g) && !remedy.genders.includes("any")) return false;
    }
    if (filters.potency && remedy.potencies && !remedy.potencies.includes(filters.potency)) return false;
    if (filters.symptom_location && remedy.symptoms) {
      const hasMatch = remedy.symptoms.some(s => s.toLowerCase().includes(filters.symptom_location!.toLowerCase()))
        || remedy.keywords?.some(k => k.includes(filters.symptom_location!.toLowerCase()));
      if (!hasMatch) return false;
    }
    return true;
  }

  async getQuestionTree(bodySystem: string): Promise<DiagnosticQuestion[]> {
    const questionTrees: Record<string, DiagnosticQuestion[]> = {
      "HEAD": [
        { id: "head_location", question: "Where is the head pain?", type: "single", options: ["Forehead", "Temples", "Back of head", "Top of head", "Whole head"], weight: 1.0, body_system: "HEAD" },
        { id: "head_quality", question: "How would you describe the pain?", type: "single", options: ["Throbbing", "Sharp", "Dull", "Pressing", "Burning"], weight: 0.9, body_system: "HEAD" },
        { id: "head_triggers", question: "What makes it worse?", type: "multiple", options: ["Light", "Noise", "Movement", "Stress", "Weather"], weight: 0.8, body_system: "HEAD" }
      ],
      "MIND": [
        { id: "mind_mood", question: "Primary emotional state?", type: "single", options: ["Anxious", "Depressed", "Irritable", "Fearful", "Restless"], weight: 1.0, body_system: "MIND" },
        { id: "mind_intensity", question: "Intensity (1-10)?", type: "scale", options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], weight: 0.7, body_system: "MIND" }
      ]
    };
    return questionTrees[bodySystem.toUpperCase()] || [];
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
