import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export default supabase

// ================================================================
// DATABASE SUMMARY (all online — no local storage)
// ----------------------------------------------------------------
// remedies          → 476  rows  (scraper: remedy names)
// remedy_symptoms   → 17,678 rows (scraper: detailed materia medica)
// remedy_sections   → 4,644  rows (scraper: full text sections)
// symptoms          → 15,000 rows (our import: rubrics + grades)
// patients          → user profiles
// search_history    → consultation history
// ================================================================

// ================================================================
// AUTH
// ================================================================
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
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ================================================================
// SEARCH HISTORY
// ================================================================
export async function saveSearchHistory(symptoms, results, healthHistory = '') {
  const user = await getCurrentUser()
  if (!user) return null
  const { error } = await supabase.from('search_history').insert({
    patient_id:     user.id,
    symptoms:       symptoms,
    results:        results,
    health_history: healthHistory ? { text: healthHistory } : null
  })
  if (error) console.error('saveSearchHistory:', error)
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
  if (error) { console.error('getSearchHistory:', error); return [] }
  return data || []
}

export async function deleteHistoryItem(id) {
  const user = await getCurrentUser()
  if (!user) return
  await supabase.from('search_history').delete()
    .eq('id', id).eq('patient_id', user.id)
}

// ================================================================
// MAIN SCORING — 3 strategies, all from Supabase
// ================================================================
export async function scoreRemediesFromSupabase(symptoms, filters = {}) {
  if (!symptoms || symptoms.length === 0) return []

  // Clean search terms
  const searchTerms = symptoms
    .map(s => s.toLowerCase().trim())
    .filter(s =>
      s.length > 2 &&
      !s.startsWith('category:') &&
      !s.startsWith('clinical report:') &&
      !s.startsWith('health history:') &&
      !s.startsWith('age group:') &&
      !s.startsWith('age:') &&
      !s.startsWith('gender:') &&
      !s.startsWith('disease duration:')
    )

  if (searchTerms.length === 0) return []

  const category = filters.symptom_location || filters.category || ''

  // Strategy 1: remedy_symptoms (17,678 rows — scraper materia medica)
  const s1 = await searchRemedySymptoms(searchTerms, category)
  if (s1.length >= 3) return s1

  // Strategy 2: symptoms table (15,000 rows — our rubric import)
  const s2 = await searchSymptomsTable(searchTerms, category)
  if (s2.length >= 3) return s2

  // Strategy 3: merge both
  return mergeScoredResults(s1, s2)
}

// ── Strategy 1: remedy_symptoms (scraper data — most detailed) ──
async function searchRemedySymptoms(searchTerms, category) {
  try {
    // Build OR conditions
    const orParts = searchTerms.map(t => `symptom.ilike.%${t}%`).join(',')

    let query = supabase
      .from('remedy_symptoms')
      .select('remedy_name, heading, symptom')
      .or(orParts)
      .limit(500)

    if (category) query = query.ilike('heading', `%${category}%`)

    const { data, error } = await query
    if (error || !data?.length) return []

    const scoreMap = {}
    data.forEach(row => {
      const name = row.remedy_name
      const termMatches = searchTerms.filter(t =>
        row.symptom?.toLowerCase().includes(t) ||
        row.heading?.toLowerCase().includes(t)
      ).length
      if (!termMatches) return

      if (!scoreMap[name]) {
        scoreMap[name] = {
          name, totalScore: 0, matchCount: 0,
          matchedSymptoms: [], headings: new Set(),
          modalities: { better: [], worse: [] }
        }
      }
      scoreMap[name].totalScore  += 3 * termMatches   // weight 3 for scraper data
      scoreMap[name].matchCount  += 1
      scoreMap[name].matchedSymptoms.push(row.symptom)
      scoreMap[name].headings.add(row.heading)
    })

    return buildResults(scoreMap, category, 'scraper')
  } catch (e) {
    console.error('Strategy 1 error:', e)
    return []
  }
}

// ── Strategy 2: symptoms table (our 15k rubric import) ──
async function searchSymptomsTable(searchTerms, category) {
  try {
    const orParts = searchTerms.map(t => `symptom.ilike.%${t}%`).join(',')

    let query = supabase
      .from('symptoms')
      .select('id, remedy, symptom, category, intensity')
      .or(orParts)
      .limit(400)

    if (category) query = query.ilike('category', `%${category}%`)

    const { data, error } = await query
    if (error || !data?.length) return []

    const scoreMap = {}
    data.forEach(row => {
      const name = row.remedy
      const termMatches = searchTerms.filter(t =>
        row.symptom?.toLowerCase().includes(t)
      ).length
      if (!termMatches) return

      if (!scoreMap[name]) {
        scoreMap[name] = {
          name, totalScore: 0, matchCount: 0,
          matchedSymptoms: [], headings: new Set(),
          modalities: { better: [], worse: [] }
        }
      }
      scoreMap[name].totalScore  += (row.intensity || 1) * termMatches * 2
      scoreMap[name].matchCount  += 1
      scoreMap[name].matchedSymptoms.push(row.symptom)
      scoreMap[name].headings.add(row.category || '')
    })

    return buildResults(scoreMap, category, 'rubrics')
  } catch (e) {
    console.error('Strategy 2 error:', e)
    return []
  }
}

// ── Merge two result arrays ──
function mergeScoredResults(arr1, arr2) {
  const merged = {}
  ;[...arr1, ...arr2].forEach(r => {
    const name = r.remedy.name
    if (!merged[name]) {
      merged[name] = r
    } else {
      merged[name].score = Math.min(100, merged[name].score + Math.floor(r.score * 0.3))
      merged[name].matching_symptoms = [
        ...new Set([...merged[name].matching_symptoms, ...r.matching_symptoms])
      ].slice(0, 6)
    }
  })
  return Object.values(merged).sort((a, b) => b.score - a.score).slice(0, 10)
}

// ── Build result objects ──
function buildResults(scoreMap, category, source) {
  if (!Object.keys(scoreMap).length) return []

  const maxScore = Math.max(...Object.values(scoreMap).map(r => r.totalScore))

  return Object.values(scoreMap)
    .map(r => {
      const pct   = Math.round((r.totalScore / maxScore) * 100)
      const grade = pct >= 75 ? 3 : pct >= 45 ? 2 : 1
      const headingsList = [...r.headings].filter(Boolean).slice(0, 2).join(', ')

      return {
        remedy: {
          id:          r.name.toLowerCase().replace(/\s+/g, '-'),
          name:        r.name,
          category:    headingsList || category || 'General',
          condition:   [...new Set(r.matchedSymptoms)].slice(0, 2).join('; '),
          description: `${r.name} matched ${r.matchCount} symptom(s) in ${source === 'scraper' ? 'Materia Medica' : 'Repertory'}.`,
          dosage:
            grade === 3 ? '200C — 3 pellets twice daily for 3 days, then once weekly' :
            grade === 2 ? '30C — 3 pellets three times daily for 5 days' :
                          '6C — 3 pellets four times daily for 7 days',
          symptoms:        [...new Set(r.matchedSymptoms)].slice(0, 5),
          keywords:        [],
          modalities:      { better: [], worse: [] },
          potencies:       ['6C', '30C', '200C'],
          age_groups:      ['child', 'adult', 'senior'],
          genders:         ['male', 'female', 'any'],
          synonym_names:   []
        },
        score:               pct,
        matching_symptoms:   [...new Set(r.matchedSymptoms)].slice(0, 5),
        confidence:          Math.min(100, r.matchCount * 10)
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}

// ================================================================
// MATERIA MEDICA — full remedy details from scraper
// ================================================================
export async function getRemedyDetail(remedyName) {
  const { data: remedy, error } = await supabase
    .from('remedies')
    .select('*')
    .ilike('name', remedyName)
    .single()
  if (error || !remedy) return null

  const { data: sections } = await supabase
    .from('remedy_sections')
    .select('heading, heading_order, content')
    .eq('remedy_id', remedy.id)
    .order('heading_order')

  const { data: symptoms } = await supabase
    .from('remedy_symptoms')
    .select('heading, symptom, symptom_order')
    .eq('remedy_id', remedy.id)
    .order('symptom_order')

  return { ...remedy, sections: sections || [], symptoms: symptoms || [] }
}

export async function getAllRemedies() {
  const { data, error } = await supabase
    .from('remedies')
    .select('id, slug, name, common_name, section_count')
    .order('name')
  if (error) console.error('getAllRemedies:', error)
  return data || []
}

export async function searchRemediesByName(query) {
  const { data, error } = await supabase
    .from('remedies')
    .select('id, slug, name, common_name')
    .or(`name.ilike.%${query}%,common_name.ilike.%${query}%`)
    .order('name').limit(20)
  if (error) console.error(error)
  return data || []
}

export async function searchBySymptom(symptom) {
  const { data, error } = await supabase
    .from('remedy_symptoms')
    .select('remedy_name, heading, symptom')
    .ilike('symptom', `%${symptom}%`)
    .order('remedy_name').limit(50)
  if (error) console.error(error)
  return data || []
}
