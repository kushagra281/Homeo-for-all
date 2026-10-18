// Type declarations for supabase.js (kept loose on purpose: the helpers return Supabase rows).
export const supabase: any;
declare const _default: any;
export default _default;
export function signUp(email: string, password: string, name: string): Promise<any>;
export function signIn(email: string, password: string): Promise<any>;
export function signOut(): Promise<void>;
export function getCurrentUser(): Promise<any>;
export function saveSearchHistory(symptoms: string[], results: any[], healthHistory?: string): Promise<void>;
export function getSearchHistory(): Promise<any[]>;
export function deleteHistoryItem(id: string | number): Promise<void>;
export function scoreRemediesFromSupabase(symptoms: string[], filters?: any, questionAnswers?: any, healthHistory?: string): Promise<any[]>;
export function getHealthProfile(): Promise<any>;
export function saveHealthProfile(profileData: any): Promise<void>;
export function getAllRemedies(): Promise<any[]>;
export function searchBySymptom(symptom: string): Promise<any[]>;
