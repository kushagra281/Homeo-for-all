import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // createClient() throws on empty values, which would leave the whole app on a blank page.
  console.error('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set - login and history are disabled')
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'missing-anon-key'
)
export default supabase

// A reset link signs the person in "for recovery". Note it here, as soon as the client starts,
// so /reset-password can tell that apart from an ordinary signed-in session.
let recoveryLink = false
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') recoveryLink = true
})
export function hasRecoveryLink() { return recoveryLink }
export function clearRecoveryLink() { recoveryLink = false }

// ── AUTH ─────────────────────────────────────────────────────
export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { name } }
  })
  if (error) throw error
  if (data.user) {
    await supabase.from('patients').upsert({ id: data.user.id, email, name })
  }
  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// Sends a reset link. The answer never says whether the email has an account.
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  if (error) throw error
}

// Used on /reset-password, after the emailed link has signed the person in for recovery.
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ── HISTORY ──────────────────────────────────────────────────
export async function saveSearchHistory(symptoms, results, healthHistory) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, reason: 'not signed in' }

  // Keep only what the history list needs; the full result objects carry every matched
  // rubric and are several times larger.
  const slim = (Array.isArray(results) ? results : []).slice(0, 3).map(r => ({
    remedy: { name: r?.remedy?.name || '' },
    score: r?.score ?? null,
    matching_symptoms: (r?.matching_symptoms || []).slice(0, 5),
    history_matches: r?.history_matches || []
  }))

  const { error } = await supabase.from('search_history').insert({
    patient_id:     user.id,
    symptoms:       Array.isArray(symptoms) ? symptoms.filter(s => !String(s).startsWith('🔍')) : [],
    results:        slim,
    health_history: healthHistory && healthHistory.trim()
      ? { text: healthHistory.trim() }
      : null
  })
  if (error) {
    console.error('saveSearchHistory error:', error)
    return { ok: false, reason: error.message }
  }
  return { ok: true }
}

export const HISTORY_PAGE = 20

// One page of the person's history, newest first. Pass the number already loaded as `offset`.
export async function getSearchHistory(offset = 0, limit = HISTORY_PAGE) {
  const user = await getCurrentUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('search_history')
    .select('id, symptoms, results, health_history, created_at')
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })   // tie-breaker: rows with the same time keep a fixed place between pages
    .range(offset, offset + limit - 1)
  if (error) { console.error(error); return [] }
  return data || []
}

export async function deleteHistoryItem(id) {
  const user = await getCurrentUser()
  if (!user) return
  await supabase.from('search_history')
    .delete().eq('id', id).eq('patient_id', user.id)
}

// ── SCORING — calls backend (Groq AI) ────────────────────────
function toTitleCase(str) {
  return str ? str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : ''
}

export async function scoreRemediesFromSupabase(symptoms, filters = {}, questionAnswers = {}, healthHistory = '') {
  if (!symptoms?.length) return []

  // ALL scoring goes through backend (Groq AI + rubric engine)
  // Direct Supabase fallback REMOVED — it bypassed Groq and rubric scoring
  try {
    const res = await fetch('/api/remedies/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms, filters, questionAnswers, healthHistory })
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) return data  // return even if empty — let UI handle no results
    } else {
      console.error('[API] /api/remedies/score returned', res.status)
    }
  } catch (e) {
    console.error('[API] /api/remedies/score failed:', e)
  }

  return []
}

// ── HEALTH PROFILE ───────────────────────────────────────────
export async function getHealthProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  // The profile page and the safety checks need every saved column (age, heart disease, ...).
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/profile/me', {
    headers: { Authorization: `Bearer ${session?.access_token || ''}` }
  })
  if (!res.ok) throw new Error('profile request failed: ' + res.status)
  return (await res.json()) || null   // null = nothing saved yet
}

export async function saveHealthProfile(profileData) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Please sign in again to save your profile.')

  // The server takes the user id from this token, not from the request body.
  const { data: { session } } = await supabase.auth.getSession()
  let res
  try {
    res = await fetch('/api/profile/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token || ''}`
      },
      body: JSON.stringify({ profile: profileData })
    })
  } catch (e) {
    console.error('[API] saveHealthProfile error:', e)
    throw new Error('Could not reach the server. Your profile was NOT saved.')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('[API] saveHealthProfile failed:', res.status, err.message)
    throw new Error(res.status === 401
      ? `Your session has expired. Please sign in again.${err.message ? ' [' + err.message + ']' : ''}`
      : 'Your profile could not be saved. Please try again.')
  }
}

// ── MATERIA MEDICA ────────────────────────────────────────────
export async function getAllRemedies() {
  const { data } = await supabase.from('remedies')
    .select('id, slug, name, common_name, section_count').order('name')
  return data || []
}

export async function searchBySymptom(symptom) {
  const { data } = await supabase.from('remedy_symptoms')
    .select('remedy_name, heading, symptom')
    .ilike('symptom', `%${symptom}%`).order('remedy_name').limit(50)
  return data || []
}
