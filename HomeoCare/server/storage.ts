import { type User, type InsertUser, type Remedy, type InsertRemedy, type Category, type InsertCategory, type Keyword, type InsertKeyword, type Favorite, type InsertFavorite, type MedicalTerm, type InsertMedicalTerm } from "@shared/schema";
import { randomUUID } from "crypto";
import medicalDictionaryData from "../attached_assets/homeopathic_medical_dictionary_1753724702324.json";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Remedy methods
  getRemedy(id: string): Promise<Remedy | undefined>;
  getRemedies(): Promise<Remedy[]>;
  getRemediesByCategory(category: string): Promise<Remedy[]>;
  getRemediesByKeywords(keywords: string[]): Promise<Remedy[]>;
  searchRemedies(query: string): Promise<Remedy[]>;
  getFeaturedRemedies(): Promise<Remedy[]>;
  createRemedy(remedy: InsertRemedy): Promise<Remedy>;

  // Category methods
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;

  // Keywords methods
  getKeywords(): Promise<Keyword[]>;
  getKeywordsByCategory(category: string): Promise<Keyword[]>;
  createKeyword(keyword: InsertKeyword): Promise<Keyword>;
  updateKeywordSynonyms(keywordId: string, synonyms: string[]): Promise<Keyword | undefined>;
  updateSynonymsFromFile(synonymsData: Record<string, string[]>): Promise<{ updatedCount: number; newCount: number }>;
  exportSynonyms(): Promise<Record<string, string[]>>;

  // Advanced search methods
  searchRemediesWithScore(symptoms: string[], filters?: {
    age?: string;
    gender?: string;
    modality?: string;
  }): Promise<Array<Remedy & { matchScore: number }>>;

  // Favorites methods
  getUserFavorites(userId: string): Promise<Favorite[]>;
  addFavorite(favorite: InsertFavorite): Promise<Favorite>;
  removeFavorite(userId: string, remedyId: string): Promise<boolean>;

  // Medical terms methods
  getMedicalTerms(): Promise<MedicalTerm[]>;
  getMedicalTerm(id: string): Promise<MedicalTerm | undefined>;
  getMedicalTermsByCategory(category: string): Promise<MedicalTerm[]>;
  searchMedicalTerms(query: string): Promise<MedicalTerm[]>;
  createMedicalTerm(medicalTerm: InsertMedicalTerm): Promise<MedicalTerm>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private remedies: Map<string, Remedy>;
  private categories: Map<string, Category>;
  private keywords: Map<string, Keyword>;
  private favorites: Map<string, Favorite>;
  private medicalTerms: Map<string, MedicalTerm>;

  constructor() {
    this.users = new Map();
    this.remedies = new Map();
    this.categories = new Map();
    this.keywords = new Map();
    this.favorites = new Map();
    this.medicalTerms = new Map();
    this.seedData();
  }

  private seedData() {
    // Seed categories
    const categoriesData = [
      { name: "generalities", displayName: "GENERALITIES", description: "Constitutional remedies & general symptoms", icon: "user", color: "red", remedyCount: 45 },
      { name: "eyes", displayName: "EYES", description: "Vision, conjunctivitis, eye strain", icon: "eye", color: "blue", remedyCount: 28 },
      { name: "ears", displayName: "EARS", description: "Hearing, infections, tinnitus", icon: "ear", color: "purple", remedyCount: 22 },
      { name: "nose", displayName: "NOSE", description: "Sinusitis, congestion, allergies", icon: "wind", color: "green", remedyCount: 31 },
      { name: "face", displayName: "FACE", description: "Facial pain, neuralgia, expressions", icon: "smile", color: "orange", remedyCount: 26 },
      { name: "mouth", displayName: "MOUTH", description: "Ulcers, dry mouth, taste", icon: "circle", color: "pink", remedyCount: 24 },
      { name: "tongue", displayName: "TONGUE", description: "Tongue symptoms, coating, taste", icon: "circle", color: "indigo", remedyCount: 18 },
      { name: "taste", displayName: "TASTE", description: "Altered taste, metallic, bitter", icon: "circle", color: "yellow", remedyCount: 15 },
      { name: "gums", displayName: "GUMS", description: "Gingivitis, bleeding, swelling", icon: "circle", color: "teal", remedyCount: 16 },
      { name: "teeth", displayName: "TEETH", description: "Toothache, teething, grinding", icon: "circle", color: "cyan", remedyCount: 20 },
      { name: "throat", displayName: "THROAT", description: "Sore throat, hoarseness, swallowing", icon: "circle", color: "violet", remedyCount: 29 },
      { name: "stomach", displayName: "STOMACH", description: "Indigestion, nausea, gastritis", icon: "circle", color: "orange", remedyCount: 35 },
      { name: "abdomen", displayName: "ABDOMEN", description: "Abdominal pain, bloating, cramps", icon: "circle", color: "lime", remedyCount: 32 },
      { name: "urinary", displayName: "URINARY SYSTEM", description: "Bladder, kidneys, urination", icon: "droplets", color: "blue", remedyCount: 27 },
      { name: "male", displayName: "MALE SEXUAL SYSTEM", description: "Male reproductive health", icon: "circle", color: "blue", remedyCount: 23 },
      { name: "female", displayName: "FEMALE SEXUAL SYSTEM", description: "Female reproductive health", icon: "circle", color: "pink", remedyCount: 34 },
      { name: "circulatory", displayName: "CIRCULATORY SYSTEM", description: "Heart, blood pressure, circulation", icon: "heart", color: "red", remedyCount: 25 },
      { name: "locomotor", displayName: "LOCOMOTOR SYSTEM", description: "Muscles, joints, bones", icon: "bone", color: "gray", remedyCount: 41 },
      { name: "respiratory", displayName: "RESPIRATORY SYSTEM", description: "Cough, asthma, bronchitis", icon: "lungs", color: "cyan", remedyCount: 38 },
      { name: "skin", displayName: "SKIN", description: "Eczema, psoriasis, rashes", icon: "scan-face", color: "yellow", remedyCount: 39 },
      { name: "fever", displayName: "FEVER", description: "Temperature, chills, sweating", icon: "thermometer", color: "red", remedyCount: 21 },
      { name: "nervous", displayName: "NERVOUS SYSTEM", description: "Anxiety, depression, stress", icon: "brain", color: "pink", remedyCount: 42 },
      { name: "modalities", displayName: "MODALITIES", description: "Conditions & triggers", icon: "settings", color: "blue", remedyCount: 0 }
    ];

    categoriesData.forEach(cat => {
      const id = randomUUID();
      this.categories.set(id, { id, ...cat });
    });

    // Seed comprehensive remedy data
    const remediesData = [
      {
        name: "Arnica Montana",
        latinName: "Arnica montana",
        categories: ["locomotor", "nervous", "generalities"],
        description: "The premier remedy for trauma, bruising, and shock. Excellent for physical injuries, overexertion, and when the person feels bruised and sore all over.",
        keySymptoms: ["Bruising", "Soreness", "Trauma", "Shock", "Overexertion", "Restlessness"],
        modalities: {
          better: ["Lying down", "Rest"],
          worse: ["Touch", "Motion", "Jarring"]
        },
        potencies: ["6C", "30C", "200C"],
        dosage: "Take 3-5 pellets under tongue every 2-4 hours as needed",
        constitution: "Robust people who overexert themselves",
        mental: "Says nothing is wrong when clearly injured, wants to be left alone",
        physical: "Bruised, sore feeling all over body, swelling from injury",
        isPopular: true,
        ageRange: "all",
        gender: "all",
        modalityCategories: ["physical", "trauma"]
      },
      {
        name: "Belladonna",
        latinName: "Atropa belladonna",
        categories: ["fever", "nervous", "eyes", "throat"],
        description: "For sudden, violent onset of symptoms with heat, redness, and throbbing. The keynote is suddenness and intensity.",
        keySymptoms: ["High fever", "Throbbing", "Redness", "Dilated pupils", "Hot skin", "Delirium"],
        modalities: {
          better: ["Rest", "Warmth", "Sitting up"],
          worse: ["Touch", "Jarring", "Light", "Noise"]
        },
        potencies: ["30C", "200C"],
        dosage: "Take 3-5 pellets every 1-2 hours during acute phase",
        constitution: "Robust, full-blooded individuals",
        mental: "Delirium, fear, restlessness, violence during fever",
        physical: "Intense heat, redness, throbbing pains, dilated pupils",
        isPopular: true
      },
      {
        name: "Chamomilla",
        latinName: "Matricaria chamomilla",
        categories: ["nervous", "teeth", "stomach", "female"],
        description: "The great remedy for irritability and hypersensitivity. Especially useful for teething children and colicky babies.",
        keySymptoms: ["Irritability", "Teething", "Restless", "One cheek red", "Colic", "Impatience"],
        modalities: {
          better: ["Being carried", "Warm wet weather"],
          worse: ["Anger", "Wind", "Open air", "Teething"]
        },
        potencies: ["6C", "30C"],
        dosage: "Take 3-5 pellets every 30 minutes to 2 hours as needed",
        constitution: "Hypersensitive, irritable temperament",
        mental: "Extreme irritability, impatience, nothing pleases",
        physical: "One cheek red and hot, teething troubles, colic",
        isPopular: true
      },
      {
        name: "Aconitum Napellus",
        latinName: "Aconitum napellus",
        categories: ["nervous", "fever", "respiratory", "eyes"],
        description: "For sudden, violent onset after shock, fright, or exposure to cold wind. The remedy of acute fear and panic.",
        keySymptoms: ["Sudden onset", "Fear", "Panic", "Restlessness", "High fever", "Dry cough"],
        modalities: {
          better: ["Open air"],
          worse: ["Evening", "Night", "Dry cold winds", "Fright"]
        },
        potencies: ["30C", "200C"],
        dosage: "Take 3-5 pellets every 15-30 minutes in acute cases",
        constitution: "Strong, robust people suddenly taken ill",
        mental: "Great fear, anxiety, restlessness, predicts time of death",
        physical: "Sudden violent onset, high fever, dry burning heat",
        isPopular: true
      },
      {
        name: "Pulsatilla",
        latinName: "Pulsatilla nigricans",
        categories: ["respiratory", "female", "eyes", "stomach", "nervous"],
        description: "For mild, gentle, yielding disposition. Symptoms are changeable and often better in open air.",
        keySymptoms: ["Changeable symptoms", "Mild disposition", "Thick yellow discharge", "Weepy", "Clingy"],
        modalities: {
          better: ["Open air", "Gentle motion", "Cold applications", "Sympathy"],
          worse: ["Heat", "Rich foods", "Stuffy rooms", "Evening"]
        },
        potencies: ["6C", "30C", "200C"],
        dosage: "Take 3-5 pellets 2-3 times daily",
        constitution: "Fair, mild, gentle, yielding disposition",
        mental: "Weepy, seeks sympathy and consolation, changeable moods",
        physical: "Thick, bland, yellow-green discharges, changeable symptoms",
        isPopular: true
      },
      {
        name: "Nux Vomica",
        latinName: "Strychnos nux-vomica",
        categories: ["stomach", "nervous", "locomotor", "male"],
        description: "For the effects of modern lifestyle - overwork, overeating, stimulants, sedentary habits, and stress.",
        keySymptoms: ["Irritability", "Digestive issues", "Overindulgence", "Chilly", "Constipation", "Insomnia"],
        modalities: {
          better: ["Warmth", "Rest", "Damp weather"],
          worse: ["Cold", "Dry weather", "Mental exertion", "Stimulants", "Spicy foods"]
        },
        potencies: ["6C", "30C", "200C"],
        dosage: "Take 3-5 pellets morning and evening",
        constitution: "Ambitious, competitive, impatient business types",
        mental: "Irritable, impatient, fault-finding, hypersensitive",
        physical: "Digestive complaints from overindulgence, constipation, chilly",
        isPopular: true
      },
      {
        name: "Rhus Toxicodendron",
        latinName: "Rhus toxicodendron",
        categories: ["locomotor", "skin", "fever", "nervous"],
        description: "For stiffness and pain that improves with movement. Excellent for joint and muscle problems.",
        keySymptoms: ["Stiffness", "Restless", "Better with motion", "Skin eruptions", "Joint pain"],
        modalities: {
          better: ["Motion", "Warmth", "Hot baths", "Stretching"],
          worse: ["Rest", "Cold damp weather", "First motion", "Night"]
        },
        potencies: ["6C", "30C"],
        dosage: "Take 3-5 pellets 2-3 times daily",
        constitution: "Restless, anxious, can't stay still",
        mental: "Anxious, restless, sad, thoughts of suicide",
        physical: "Stiff, painful joints better with motion, skin eruptions",
        isPopular: true
      },
      {
        name: "Bryonia Alba",
        latinName: "Bryonia alba",
        categories: ["respiratory", "locomotor", "stomach", "nervous"],
        description: "For conditions where any movement aggravates. The patient wants to lie still and be left alone.",
        keySymptoms: ["Worse from motion", "Irritable", "Thirsty", "Dry mucous membranes", "Wants to be alone"],
        modalities: {
          better: ["Rest", "Lying on painful side", "Pressure", "Cool air"],
          worse: ["Movement", "Heat", "Touch", "Morning"]
        },
        potencies: ["6C", "30C", "200C"],
        dosage: "Take 3-5 pellets every 2-4 hours",
        constitution: "Irritable when disturbed, wants to be alone",
        mental: "Irritable, wants to be quiet and alone, talks of business",
        physical: "Sharp stitching pains worse from movement, very thirsty",
        isPopular: true
      },
      {
        name: "Apis Mellifica",
        latinName: "Apis mellifica",
        categories: ["skin", "urinary", "throat", "eyes"],
        description: "For swelling, burning, stinging pains like bee stings. Excellent for allergic reactions.",
        keySymptoms: ["Swelling", "Burning", "Stinging", "Hot", "Red", "Puffy"],
        modalities: {
          better: ["Cold applications", "Open air"],
          worse: ["Heat", "Touch", "Pressure", "After sleeping"]
        },
        potencies: ["30C", "200C"],
        dosage: "Take 3-5 pellets every 1-2 hours in acute cases",
        constitution: "Busy, active, jealous disposition",
        mental: "Restless, fidgety, hard to please, jealous",
        physical: "Puffy swelling, burning stinging pains, worse from heat",
        isPopular: true
      },
      {
        name: "Ignatia Amara",
        latinName: "Ignatia amara",
        categories: ["nervous", "stomach", "throat", "female"],
        description: "The great grief remedy. For emotional shock, disappointment, and contradictory symptoms.",
        keySymptoms: ["Grief", "Emotional shock", "Sighing", "Lump in throat", "Contradictory symptoms"],
        modalities: {
          better: ["Distraction", "Warmth", "Pressure"],
          worse: ["Emotions", "Coffee", "Tobacco", "Strong odors"]
        },
        potencies: ["30C", "200C", "1M"],
        dosage: "Take 3-5 pellets as needed for emotional symptoms",
        constitution: "Sensitive, artistic, emotional types",
        mental: "Silent grief, sighing, mood swings, hysterical symptoms",
        physical: "Sensation of lump in throat, contradictory symptoms",
        isPopular: true
      }
    ];

    remediesData.forEach(remedy => {
      const id = randomUUID();
      this.remedies.set(id, { 
        id, 
        ...remedy,
        ageRange: remedy.ageRange || null,
        gender: remedy.gender || null,
        modalityCategories: remedy.modalityCategories || []
      });
    });

    // Seed keywords
    const keywordData = [
      { name: "Headache", category: "nervous", remedyIds: [], synonyms: ["head pain", "cephalgia", "migraine"] },
      { name: "Nausea", category: "stomach", remedyIds: [], synonyms: ["sick feeling", "queasiness", "stomach upset"] },
      { name: "Fatigue", category: "generalities", remedyIds: [], synonyms: ["tiredness", "exhaustion", "weakness"] },
      { name: "Fever", category: "fever", remedyIds: [], synonyms: ["high temperature", "pyrexia", "hot"] },
      { name: "Anxiety", category: "nervous", remedyIds: [], synonyms: ["worry", "nervousness", "fear", "stress"] },
      { name: "Cough", category: "respiratory", remedyIds: [], synonyms: ["coughing", "hacking", "throat clearing"] },
      { name: "Insomnia", category: "nervous", remedyIds: [], synonyms: ["sleeplessness", "sleep problems", "can't sleep"] },
      { name: "Allergies", category: "generalities", remedyIds: [], synonyms: ["allergic reaction", "hypersensitivity"] },
      { name: "Indigestion", category: "stomach", remedyIds: [], synonyms: ["dyspepsia", "stomach upset", "heartburn"] },
      { name: "Joint pain", category: "locomotor", remedyIds: [], synonyms: ["arthritis", "joint ache", "stiff joints"] },
      { name: "Skin rash", category: "skin", remedyIds: [], synonyms: ["eruption", "skin irritation", "dermatitis"] },
      { name: "Sore throat", category: "throat", remedyIds: [], synonyms: ["throat pain", "pharyngitis", "throat irritation"] }
    ];

    keywordData.forEach(keyword => {
      const id = randomUUID();
      this.keywords.set(id, { id, ...keyword });
    });

    // Enhanced keyword seeding with comprehensive synonyms
    const comprehensiveKeywordData = [
      { 
        name: "Headache", 
        category: "nervous", 
        remedyIds: [], 
        synonyms: ["pain in head", "migraine", "head pain", "temple ache", "forehead pain", "ache in skull", "cephalgia"] 
      },
      { 
        name: "Fever", 
        category: "fever", 
        remedyIds: [], 
        synonyms: ["high temperature", "chills", "shivering", "raised body heat", "pyrexia", "hot"] 
      },
      { 
        name: "Cough", 
        category: "respiratory", 
        remedyIds: [], 
        synonyms: ["dry cough", "wet cough", "hacking cough", "tickling throat", "whooping", "throat irritation", "coughing", "throat clearing"] 
      },
      { 
        name: "Cold", 
        category: "nose", 
        remedyIds: [], 
        synonyms: ["runny nose", "blocked nose", "sneezing", "nasal discharge", "stuffed nose"] 
      },
      { 
        name: "Sore throat", 
        category: "throat", 
        remedyIds: [], 
        synonyms: ["throat pain", "throat inflammation", "pharyngitis", "irritated throat", "raw throat"] 
      },
      { 
        name: "Diarrhea", 
        category: "stomach", 
        remedyIds: [], 
        synonyms: ["loose motion", "frequent stools", "watery stools", "bowel urgency", "runny stool"] 
      },
      { 
        name: "Constipation", 
        category: "stomach", 
        remedyIds: [], 
        synonyms: ["hard stool", "difficulty in passing stool", "infrequent stool", "dry stool", "no bowel movement"] 
      },
      { 
        name: "Abdominal pain", 
        category: "abdomen", 
        remedyIds: [], 
        synonyms: ["stomach ache", "belly pain", "tummy ache", "cramping", "gut pain"] 
      },
      { 
        name: "Vomiting", 
        category: "stomach", 
        remedyIds: [], 
        synonyms: ["throwing up", "nausea with expulsion", "retching", "emesis", "projectile vomit"] 
      },
      { 
        name: "Nausea", 
        category: "stomach", 
        remedyIds: [], 
        synonyms: ["urge to vomit", "sick feeling", "queasiness", "stomach upset"] 
      },
      { 
        name: "Fatigue", 
        category: "generalities", 
        remedyIds: [], 
        synonyms: ["tiredness", "exhaustion", "weakness"] 
      },
      { 
        name: "Anxiety", 
        category: "nervous", 
        remedyIds: [], 
        synonyms: ["worry", "nervousness", "fear", "stress"] 
      },
      { 
        name: "Insomnia", 
        category: "nervous", 
        remedyIds: [], 
        synonyms: ["sleeplessness", "sleep problems", "can't sleep", "cannot fall asleep", "restless sleep"] 
      },
      { 
        name: "Allergies", 
        category: "generalities", 
        remedyIds: [], 
        synonyms: ["allergic reaction", "hypersensitivity"] 
      },
      { 
        name: "Indigestion", 
        category: "stomach", 
        remedyIds: [], 
        synonyms: ["dyspepsia", "stomach upset", "heartburn"] 
      },
      { 
        name: "Joint pain", 
        category: "locomotor", 
        remedyIds: [], 
        synonyms: ["arthritis", "joint ache", "stiff joints"] 
      },
      { 
        name: "Skin rash", 
        category: "skin", 
        remedyIds: [], 
        synonyms: ["eruption", "skin irritation", "dermatitis"] 
      }
    ];

    comprehensiveKeywordData.forEach(keyword => {
      const id = randomUUID();
      this.keywords.set(id, { id, ...keyword });
    });

    // Seed medical dictionary
    medicalDictionaryData.forEach(term => {
      const id = randomUUID();
      this.medicalTerms.set(id, { 
        id, 
        term: term.term,
        definition: term.definition,
        category: term.category,
        synonyms: term.synonyms,
        relatedRemedies: term.related_remedies || [],
        translations: term.translations || null
      });
    });
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Remedy methods
  async getRemedy(id: string): Promise<Remedy | undefined> {
    return this.remedies.get(id);
  }

  async getRemedies(): Promise<Remedy[]> {
    return Array.from(this.remedies.values());
  }

  async getRemediesByCategory(category: string): Promise<Remedy[]> {
    return Array.from(this.remedies.values()).filter(
      remedy => remedy.categories.includes(category)
    );
  }

  async getRemediesByKeywords(keywords: string[]): Promise<Remedy[]> {
    return Array.from(this.remedies.values()).filter(remedy =>
      keywords.some(keyword =>
        remedy.keySymptoms.some(symptom =>
          symptom.toLowerCase().includes(keyword.toLowerCase())
        ) ||
        remedy.description.toLowerCase().includes(keyword.toLowerCase()) ||
        remedy.name.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  }

  async searchRemedies(query: string): Promise<Remedy[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.remedies.values()).filter(remedy =>
      remedy.name.toLowerCase().includes(lowerQuery) ||
      remedy.description.toLowerCase().includes(lowerQuery) ||
      remedy.keySymptoms.some(symptom => symptom.toLowerCase().includes(lowerQuery)) ||
      remedy.categories.some(cat => cat.toLowerCase().includes(lowerQuery))
    );
  }

  async getFeaturedRemedies(): Promise<Remedy[]> {
    return Array.from(this.remedies.values()).filter(remedy => remedy.isPopular);
  }

  async createRemedy(insertRemedy: InsertRemedy): Promise<Remedy> {
    const id = randomUUID();
    const remedy: Remedy = { 
      id,
      name: insertRemedy.name,
      categories: insertRemedy.categories,
      description: insertRemedy.description,
      keySymptoms: insertRemedy.keySymptoms,
      potencies: insertRemedy.potencies,
      dosage: insertRemedy.dosage,
      latinName: insertRemedy.latinName || null,
      modalities: insertRemedy.modalities ? {
        better: insertRemedy.modalities.better as string[],
        worse: insertRemedy.modalities.worse as string[]
      } : null,
      constitution: insertRemedy.constitution || null,
      mental: insertRemedy.mental || null,
      physical: insertRemedy.physical || null,
      isPopular: insertRemedy.isPopular || false,
      ageRange: insertRemedy.ageRange || null,
      gender: insertRemedy.gender || null,
      modalityCategories: insertRemedy.modalityCategories || []
    };
    this.remedies.set(id, remedy);
    return remedy;
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getCategory(id: string): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(cat => cat.name === name);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const category: Category = { 
      id, 
      ...insertCategory,
      remedyCount: insertCategory.remedyCount || null
    };
    this.categories.set(id, category);
    return category;
  }

  // Keywords methods
  async getKeywords(): Promise<Keyword[]> {
    return Array.from(this.keywords.values());
  }

  async getKeywordsByCategory(category: string): Promise<Keyword[]> {
    return Array.from(this.keywords.values()).filter(k => k.category === category);
  }

  async createKeyword(insertKeyword: InsertKeyword): Promise<Keyword> {
    const id = randomUUID();
    const keyword: Keyword = { 
      id, 
      ...insertKeyword,
      synonyms: insertKeyword.synonyms || []
    };
    this.keywords.set(id, keyword);
    return keyword;
  }

  // Favorites methods
  async getUserFavorites(userId: string): Promise<Favorite[]> {
    return Array.from(this.favorites.values()).filter(fav => fav.userId === userId);
  }

  async addFavorite(insertFavorite: InsertFavorite): Promise<Favorite> {
    const id = randomUUID();
    const favorite: Favorite = { 
      id, 
      ...insertFavorite,
      userId: insertFavorite.userId || null
    };
    this.favorites.set(id, favorite);
    return favorite;
  }

  async removeFavorite(userId: string, remedyId: string): Promise<boolean> {
    const favorite = Array.from(this.favorites.values()).find(
      f => f.userId === userId && f.remedyId === remedyId
    );
    if (favorite) {
      this.favorites.delete(favorite.id);
      return true;
    }
    return false;
  }

  // Medical terms methods
  async getMedicalTerms(): Promise<MedicalTerm[]> {
    return Array.from(this.medicalTerms.values());
  }

  async getMedicalTerm(id: string): Promise<MedicalTerm | undefined> {
    return this.medicalTerms.get(id);
  }

  async getMedicalTermsByCategory(category: string): Promise<MedicalTerm[]> {
    return Array.from(this.medicalTerms.values()).filter(term => term.category === category);
  }

  async searchMedicalTerms(query: string): Promise<MedicalTerm[]> {
    const searchQuery = query.toLowerCase();
    return Array.from(this.medicalTerms.values()).filter(term =>
      term.term.toLowerCase().includes(searchQuery) ||
      term.definition.toLowerCase().includes(searchQuery) ||
      term.synonyms.some(synonym => synonym.toLowerCase().includes(searchQuery))
    );
  }

  async createMedicalTerm(insertMedicalTerm: InsertMedicalTerm): Promise<MedicalTerm> {
    const id = randomUUID();
    const medicalTerm: MedicalTerm = { 
      id, 
      ...insertMedicalTerm,
      translations: insertMedicalTerm.translations || null
    };
    this.medicalTerms.set(id, medicalTerm);
    return medicalTerm;
  }

  async updateKeywordSynonyms(keywordId: string, synonyms: string[]): Promise<Keyword | undefined> {
    const keyword = this.keywords.get(keywordId);
    if (keyword) {
      keyword.synonyms = synonyms;
      this.keywords.set(keywordId, keyword);
      return keyword;
    }
    return undefined;
  }

  async updateSynonymsFromFile(synonymsData: Record<string, string[]>): Promise<{ updatedCount: number; newCount: number }> {
    let updatedCount = 0;
    let newCount = 0;

    for (const [symptomName, synonyms] of Object.entries(synonymsData)) {
      // Find existing keyword by name (case-insensitive)
      const existingKeyword = Array.from(this.keywords.values()).find(
        k => k.name.toLowerCase() === symptomName.toLowerCase()
      );

      if (existingKeyword) {
        // Update existing keyword with new synonyms
        existingKeyword.synonyms = Array.from(new Set([...existingKeyword.synonyms, ...synonyms]));
        this.keywords.set(existingKeyword.id, existingKeyword);
        updatedCount++;
      } else {
        // Create new keyword
        const id = randomUUID();
        const newKeyword: Keyword = {
          id,
          name: symptomName.charAt(0).toUpperCase() + symptomName.slice(1),
          category: this.categorizeSymptom(symptomName),
          remedyIds: [],
          synonyms: synonyms
        };
        this.keywords.set(id, newKeyword);
        newCount++;
      }
    }

    return { updatedCount, newCount };
  }

  async exportSynonyms(): Promise<Record<string, string[]>> {
    const synonymsMap: Record<string, string[]> = {};

    Array.from(this.keywords.values()).forEach(keyword => {
      if (keyword.synonyms.length > 0) {
        synonymsMap[keyword.name.toLowerCase()] = keyword.synonyms;
      }
    });

    return synonymsMap;
  }

  private categorizeSymptom(symptom: string): string {
    const symptomLower = symptom.toLowerCase();

    // Simple categorization logic based on symptom name
    if (symptomLower.includes('head') || symptomLower.includes('migraine')) return 'nervous';
    if (symptomLower.includes('fever') || symptomLower.includes('temperature')) return 'fever';
    if (symptomLower.includes('cough') || symptomLower.includes('throat')) return 'respiratory';
    if (symptomLower.includes('stomach') || symptomLower.includes('nausea') || symptomLower.includes('diarrhea')) return 'stomach';
    if (symptomLower.includes('skin') || symptomLower.includes('rash')) return 'skin';
    if (symptomLower.includes('joint') || symptomLower.includes('muscle')) return 'locomotor';
    if (symptomLower.includes('eye')) return 'eyes';
    if (symptomLower.includes('ear')) return 'ears';
    if (symptomLower.includes('nose') || symptomLower.includes('cold')) return 'nose';

    return 'generalities'; // Default category
  }

  async searchRemediesWithScore(symptoms: string[], filters?: {
    age?: string;
    gender?: string;
    modality?: string;
  }): Promise<Array<Remedy & { matchScore: number }>> {
    const allRemedies = Array.from(this.remedies.values());
    const allKeywords = Array.from(this.keywords.values());

    // Create expanded search terms including synonyms
    const expandedSymptoms = symptoms.flatMap(symptom => {
      const matchingKeywords = allKeywords.filter(k => 
        k.name.toLowerCase().includes(symptom.toLowerCase()) ||
        k.synonyms.some(s => s.toLowerCase().includes(symptom.toLowerCase()))
      );
      return [symptom, ...matchingKeywords.flatMap(k => [k.name, ...k.synonyms])];
    });

    const scoredRemedies = allRemedies.map(remedy => {
      let score = 0;
      let totalSymptoms = expandedSymptoms.length;

      // Check key symptoms
      expandedSymptoms.forEach(symptom => {
        const symptomLower = symptom.toLowerCase();
        if (remedy.keySymptoms.some(s => s.toLowerCase().includes(symptomLower))) {
          score += 3; // High weight for key symptoms
        }
        if (remedy.description.toLowerCase().includes(symptomLower)) {
          score += 2; // Medium weight for description
        }
        if (remedy.mental?.toLowerCase().includes(symptomLower) || 
            remedy.physical?.toLowerCase().includes(symptomLower)) {
          score += 1; // Lower weight for mental/physical
        }
      });

      // Apply filters
      if (filters?.age && remedy.ageRange && remedy.ageRange !== 'all' && remedy.ageRange !== filters.age) {
        score *= 0.5; // Reduce score if age doesn't match
      }
      if (filters?.gender && remedy.gender && remedy.gender !== 'all' && remedy.gender !== filters.gender) {
        score *= 0.5; // Reduce score if gender doesn't match
      }
      if (filters?.modality && remedy.modalityCategories && !remedy.modalityCategories.includes(filters.modality)) {
        score *= 0.7; // Reduce score if modality doesn't match
      }

      const matchScore = totalSymptoms > 0 ? Math.round((score / (totalSymptoms * 3)) * 100) : 0;

      return { ...remedy, matchScore };
    }).filter(remedy => remedy.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);

    return scoredRemedies;
  }
}

export const storage = new MemStorage();