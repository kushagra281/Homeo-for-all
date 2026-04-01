import { createClient } from '@supabase/supabase-js'

// ── HomeoWell Supabase (Auth + Search History) ──────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default supabase

// ── Scraper Supabase (Remedies & Symptoms from materia-medica-scraper) ──
const scraperSupabase = createClient(
  'https://rtfjnfepikhahzospnqq.supabase.co',
  import.meta.env.VITE_SCRAPER_SUPABASE_ANON_KEY || ''
)

// ================================================================
// AUTH FUNCTIONS
// ================================================================

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  })
  if (error) throw error

  if (data.user) {
    await supabase.from('patients').insert({
      id: data.user.id,
      email,
      name
    })
  }
  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })
}

// ================================================================
// SEARCH HISTORY FUNCTIONS
// ================================================================

export async function saveSearchHistory(symptoms, results) {
  const user = await getCurrentUser()
  if (!user) return

  const { error } = await supabase.from('search_history').insert({
    patient_id: user.id,
    symptoms,
    results
  })
  if (error) console.error('History save error:', error)
}

export async function getSearchHistory() {
  const user = await getCurrentUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('search_history')
    .select('*')
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) console.error(error)
  return data || []
}

// ================================================================
// SCRAPER DB — REMEDY FUNCTIONS
// (Reads from materia-medica-scraper Supabase)
// ================================================================

export async function getAllRemedies() {
  const { data, error } = await scraperSupabase
    .from('remedies')
    .select('id, slug, name, common_name, section_count')
    .order('name')
  if (error) {
    console.error('Scraper DB error:', error)
    return []
  }
  return data || []
}

export async function getRemedyBySlug(slug) {
  const { data: remedy, error } = await scraperSupabase
    .from('remedies')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) { console.error(error); return null }

  const { data: sections } = await scraperSupabase
    .from('remedy_sections')
    .select('heading, heading_order, content')
    .eq('remedy_id', remedy.id)
    .order('heading_order')

  return { ...remedy, sections }
}

export async function searchRemediesByName(query) {
  const { data, error } = await scraperSupabase
    .from('remedies')
    .select('id, slug, name, common_name')
    .or(`name.ilike.%${query}%,common_name.ilike.%${query}%`)
    .order('name')
    .limit(20)
  if (error) { console.error(error); return [] }
  return data || []
}

export async function searchBySymptom(symptom) {
  const { data, error } = await scraperSupabase
    .from('remedy_symptoms')
    .select('remedy_name, heading, symptom')
    .ilike('symptom', `%${symptom}%`)
    .order('remedy_name')
    .limit(50)
  if (error) { console.error(error); return [] }
  return data || []
}

export async function getSymptomsByRemedy(remedyId) {
  const { data, error } = await scraperSupabase
    .from('remedy_symptoms')
    .select('heading, symptom, symptom_order')
    .eq('remedy_id', remedyId)
    .order('symptom_order')
  if (error) { console.error(error); return {} }

  const grouped = {}
  data?.forEach(row => {
    if (!grouped[row.heading]) grouped[row.heading] = []
    grouped[row.heading].push(row.symptom)
  })
  return grouped
}

export async function getRemediesByBodyPart(bodyPart) {
  const { data, error } = await scraperSupabase
    .from('remedy_symptoms')
    .select('remedy_name, symptom')
    .eq('heading', bodyPart)
    .order('remedy_name')
  if (error) { console.error(error); return [] }
  return data || []
}

// Search symptoms from scraper DB — used by server-side scoring fallback
export async function searchSymptomsFromScraper(query) {
  const { data, error } = await scraperSupabase
    .from('remedy_symptoms')
    .select('remedy_name, heading, symptom')
    .ilike('symptom', `%${query}%`)
    .limit(100)
  if (error) { console.error(error); return [] }
  return data || []
}
