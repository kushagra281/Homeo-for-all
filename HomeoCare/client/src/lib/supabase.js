import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export default supabase

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
  if (error) throw error
  if (data.user) {
    try {
      await fetch('/api/profile/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id, email, profile: { name } }),
      })
    } catch (e) { console.warn('Could not pre-create patient row:', e) }
  }
  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
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

export async function getHealthProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  try {
    const response = await fetch(`/api/profile/${user.id}`)
    if (!response.ok) return null
    return await response.json()
  } catch (e) {
    console.error('getHealthProfile error:', e)
    return null
  }
}

export async function saveHealthProfile(profile) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not logged in')
  const response = await fetch('/api/profile/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, email: user.email, profile }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to save profile')
  }
  return response.json()
}

export async function saveSearchHistory(symptoms, results, healthHistory = '') {
  const user = await getCurrentUser()
  if (!user) return null
  const { error } = await supabase.from('search_history').insert({
    patient_id: user.id, symptoms, results,
    health_history: healthHistory ? { text: healthHistory } : null,
  })
  if (error) console.error('saveSearchHistory:', error)
}

export async function getSearchHistory() {
  const user = await getCurrentUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('search_history').select('id, symptoms, results, health_history, created_at')
    .eq('patient_id', user.id).order('created_at', { ascending: false }).limit(20)
  if (error) { console.error('getSearchHistory:', error); return [] }
  return data || []
}

export async function deleteHistoryItem(id) {
  const user = await getCurrentUser()
  if (!user) return
  await supabase.from('search_history').delete().eq('id', id).eq('patient_id', user.id)
}

export async function getRemedyDetail(remedyName) {
  const { data: remedy, error } = await supabase.from('remedies').select('*').ilike('name', remedyName).single()
  if (error || !remedy) return null
  const { data: sections } = await supabase.from('remedy_sections').select('heading, heading_order, content').eq('remedy_id', remedy.id).order('heading_order')
  const { data: symptoms } = await supabase.from('remedy_symptoms').select('heading, symptom').eq('remedy_id', remedy.id).order('symptom_order')
  return { ...remedy, sections: sections || [], symptoms: symptoms || [] }
}

export async function getAllRemedies() {
  const { data, error } = await supabase.from('remedies').select('id, slug, name, common_name, section_count').order('name')
  if (error) console.error('getAllRemedies:', error)
  return data || []
}

export async function searchRemediesByName(query) {
  const { data, error } = await supabase.from('remedies').select('id, slug, name, common_name')
    .or(`name.ilike.%${query}%,common_name.ilike.%${query}%`).order('name').limit(20)
  if (error) console.error(error)
  return data || []
}

export async function searchBySymptom(symptom) {
  const { data, error } = await supabase.from('remedy_symptoms').select('remedy_name, heading, symptom')
    .ilike('symptom', `%${symptom}%`).order('remedy_name').limit(50)
  if (error) console.error(error)
  return data || []
}
