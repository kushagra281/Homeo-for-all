import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export default supabase

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
  await supabase.from('search_history')
    .delete().eq('id', id).eq('patient_id', user.id)
}

// ================================================================
// FORMAT: "CALCAREA CARBONICA" → "Calcarea Carbonica"
// ================================================================
function toTitleCase(str) {
  if (!str) return ''
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

// ================================================================
// MAIN SCORING — uses remedy_symptoms (476 remedies, 17,678 rows)
// ================================================================
export async function scoreRemediesFromSupabase(symptoms, filters = {}) {
  if (!symptoms || symptoms.length === 0) return []

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

  const [scraperResults, rubricResults] = await Promise.all([
    searchRemedySymptoms(searchTerms, category),
    searchSymptomsTable(searchTerms, category)
  ])

  const merged = mergeResults(scraperResults, rubricResults)
  return merged.length > 0 ? merged : scraperResults.length > 0 ? scraperResults : rubricResults
}

// ── Strategy 1: remedy_symptoms table (scraper — 476 remedies) ──
async function searchRemedySymptoms(searchTerms, category) {
  try {
    const allData = []

    for (const term of searchTerms.slice(0, 4)) {
      let query = supabase
        .from('remedy_symptoms')
        .select('remedy_name, heading, symptom')
        .ilike('symptom', `%${term}%`)
        .limit(300)

      if (category) {
        query = query.ilike('heading', `%${category}%`)
      }

      const { data } = await query
      if (data) allData.push(...data)
    }

    if (!allData.length) return []

    const scoreMap = {}
    allData.forEach(row => {
      const name = row.remedy_name
      const termMatches = searchTerms.filter(t =>
        row.symptom?.toLowerCase().includes(t) ||
        row.heading?.toLowerCase().includes(t)
      ).length
      if (!termMatches) return

      if (!scoreMap[name]) {
        scoreMap[name] = {
          name,
          displayName:     toTitleCase(name),
          totalScore:      0,
          matchCount:      0,
          matchedSymptoms: [],
          headings:        new Set()
        }
      }
      scoreMap[name].totalScore  += 3 * termMatches
      scoreMap[name].matchCount  += 1
      scoreMap[name].matchedSymptoms.push(row.symptom)
      scoreMap[name].headings.add(row.heading)
    })

    return buildResults(scoreMap, category)
  } catch (e) {
    console.error('Strategy 1 error:', e)
    return []
  }
}

// ── Strategy 2: symptoms table (our 15,000 rubrics) ──
async function searchSymptomsTable(searchTerms, category) {
  try {
    const allData = []

    for (const term of searchTerms.slice(0, 4)) {
      let query = supabase
        .from('symptoms')
        .select('remedy_name, heading, symptom')
        .ilike('symptom', `%${term}%`)
        .limit(200)

      if (category) query = query.ilike('heading', `%${category}%`)

      const { data } = await query
      if (data) allData.push(...data)
    }

    if (!allData.length) return []

    const scoreMap = {}
    allData.forEach(row => {
      const name = row.remedy_name
      const termMatches = searchTerms.filter(t =>
        row.symptom?.toLowerCase().includes(t)
      ).length
      if (!termMatches) return

      if (!scoreMap[name]) {
        scoreMap[name] = {
          name,
          displayName:     toTitleCase(name),
          totalScore:      0,
          matchCount:      0,
          matchedSymptoms: [],
          headings:        new Set()
        }
      }
      scoreMap[name].totalScore  += termMatches * 2
      scoreMap[name].matchCount  += 1
      scoreMap[name].matchedSymptoms.push(row.symptom)
      scoreMap[name].headings.add(row.heading || '')
    })

    return buildResults(scoreMap, category)
  } catch (e) {
    console.error('Strategy 2 error:', e)
    return []
  }
}

// ── Merge two result arrays by remedy name ──
function mergeResults(arr1, arr2) {
  const map = {}

  arr1.forEach(r => {
    map[r.remedy.name] = { ...r }
  })

  arr2.forEach(r => {
    const key = r.remedy.name
    if (map[key]) {
      map[key].score = Math.min(100, map[key].score + Math.round(r.score * 0.4))
      map[key].matching_symptoms = [
        ...new Set([...map[key].matching_symptoms, ...r.matching_symptoms])
      ].slice(0, 6)
    } else {
      map[key] = { ...r }
    }
  })

  return Object.values(map)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}

// ── Build formatted result objects ──
function buildResults(scoreMap, category) {
  if (!Object.keys(scoreMap).length) return []

  const maxScore = Math.max(...Object.values(scoreMap).map(r => r.totalScore))

  return Object.values(scoreMap)
    .map(r => {
      const pct     = Math.round((r.totalScore / maxScore) * 100)
      const grade   = pct >= 75 ? 3 : pct >= 45 ? 2 : 1
      const headings = [...r.headings].filter(Boolean).slice(0, 2).join(', ')

      return {
        remedy: {
          id:           r.name.toLowerCase().replace(/\s+/g, '-'),
          name:         r.displayName,
          category:     headings || category || 'General',
          condition:    [...new Set(r.matchedSymptoms)].slice(0, 2).join('; '),
          description:  `${r.displayName} matched ${r.matchCount} symptom(s) for your complaint.`,
          dosage:
            grade === 3 ? '200C — 3 pellets twice daily for 3 days, then once weekly' :
            grade === 2 ? '30C — 3 pellets three times daily for 5 days' :
                          '6C — 3 pellets four times daily for 7 days',
          symptoms:      [...new Set(r.matchedSymptoms)].slice(0, 5),
          keywords:      [],
          modalities:    { better: [], worse: [] },
          potencies:     ['6C', '30C', '200C'],
          age_groups:    ['child', 'adult', 'senior'],
          genders:       ['male', 'female', 'any'],
          synonym_names: []
        },
        score:             pct,
        matching_symptoms: [...new Set(r.matchedSymptoms)].slice(0, 5),
        confidence:        Math.min(100, r.matchCount * 8)
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}

// ================================================================
// MATERIA MEDICA
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
    .select('heading, symptom')
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

// ================================================================
// HEALTH PROFILE
// ================================================================
export async function getHealthProfile() {
  const user = await getCurrentUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('patients')
    .select('name, age, gender, blood_group, weight_kg, height_cm, chronic_conditions, allergies, current_medications, dietary_preference')
    .eq('id', user.id)
    .single()
  if (error) { console.error('getHealthProfile:', error); return null }
  return data
}

export async function saveHealthProfile(profile) {
  const user = await getCurrentUser()
  if (!user) return
  const { error } = await supabase
    .from('patients')
    .upsert({
      id:                   user.id,
      email:                user.email,
      name:                 profile.name,
      age:                  profile.age ? parseInt(profile.age) : null,
      gender:               profile.gender,
      blood_group:          profile.blood_group,
      weight_kg:            profile.weight_kg ? parseFloat(profile.weight_kg) : null,
      height_cm:            profile.height_cm ? parseFloat(profile.height_cm) : null,
      chronic_conditions:   profile.chronic_conditions,
      allergies:            profile.allergies,
      current_medications:  profile.current_medications,
      dietary_preference:   profile.dietary_preference,
    })
  if (error) throw error
}
