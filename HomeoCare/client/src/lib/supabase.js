import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export default supabase

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
  if (!user) return

  const { error } = await supabase.from('search_history').insert({
    patient_id:     user.id,
    symptoms:       Array.isArray(symptoms) ? symptoms : [],
    results:        Array.isArray(results)  ? results.slice(0, 3) : [],
    // FIX: save as { text: "..." } — not null
    health_history: healthHistory && healthHistory.trim()
      ? { text: healthHistory.trim() }
      : null
  })
  if (error) console.error('saveSearchHistory error:', error)
}

export async function getSearchHistory() {
  const user = await getCurrentUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('search_history')
    .select('id, symptoms, results, health_history, created_at')
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
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

  // Try backend first (Groq AI enhanced)
  try {
    const res = await fetch('/api/remedies/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms, filters, questionAnswers, healthHistory })
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch (e) {
    console.warn('Backend unavailable, using direct search:', e)
  }

  // Fallback: direct Supabase search
  const terms = symptoms
    .map(s => s.toLowerCase().trim())
    .filter(s => s.length > 2 && !s.includes(':'))
    .slice(0, 5)

  if (!terms.length) return []

  const category = filters.symptom_location || filters.category || ''
  const rows = []

  for (const term of terms) {
    let q = supabase
      .from('remedy_symptoms')
      .select('remedy_name, heading, symptom')
      .ilike('symptom', `%${term}%`)
      .limit(200)
    if (category) q = q.ilike('heading', `%${category}%`)
    const { data } = await q
    if (data) rows.push(...data)
  }

  if (!rows.length) return []

  const map = {}
  rows.forEach(r => {
    const n = r.remedy_name
    if (!n) return
    const hits = terms.filter(t => r.symptom?.toLowerCase().includes(t)).length
    if (!hits) return
    if (!map[n]) map[n] = { name: n, display: toTitleCase(n), score: 0, count: 0, syms: new Set(), heads: new Set() }
    map[n].score += 3 * hits
    map[n].count += 1
    map[n].syms.add(r.symptom)
    map[n].heads.add(r.heading)
  })

  const vals = Object.values(map)
  if (!vals.length) return []
  const max = Math.max(...vals.map(r => r.score))

  return vals.map(r => {
    const pct = Math.round((r.score / max) * 100)
    const g   = pct >= 75 ? 3 : pct >= 45 ? 2 : 1
    return {
      remedy: {
        id: r.name.toLowerCase().replace(/\s+/g, '-'),
        name: r.display,
        category: [...r.heads].filter(Boolean).slice(0, 2).join(', ') || category || 'General',
        condition: [...r.syms].slice(0, 2).join('; '),
        description: `${r.display} matched ${r.count} symptom(s).`,
        dosage: g === 3 ? '200C — 3 pellets twice daily for 3 days, then once weekly'
              : g === 2 ? '30C — 3 pellets three times daily for 5 days'
                        : '6C — 3 pellets four times daily for 7 days',
        symptoms: [...r.syms].slice(0, 5),
        modalities: { better: [], worse: [] },
        potencies: ['6C', '30C', '200C'],
        age_groups: ['child', 'adult', 'senior'],
        genders: ['male', 'female', 'any'],
        synonym_names: []
      },
      score: pct,
      matching_symptoms: [...r.syms].slice(0, 5),
      confidence: Math.min(100, r.count * 8)
    }
  }).sort((a, b) => b.score - a.score).slice(0, 10)
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
