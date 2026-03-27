import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export default supabase

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

  // Save to patients table
  if (data.user) {
    await supabase.from('patients').upsert({
      id: data.user.id,
      email,
      name
    })
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

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })
}

// ================================================================
// SEARCH HISTORY — save & get consultation history
// Table: search_history (id, patient_id, symptoms, results, health_history, created_at)
// ================================================================
export async function saveSearchHistory(symptoms, results, healthHistory = '') {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase.from('search_history').insert({
    patient_id: user.id,
    symptoms: symptoms,
    results: results,
    health_history: healthHistory ? { text: healthHistory } : null
  })

  if (error) console.error('saveSearchHistory error:', error)
  return data
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

  if (error) {
    console.error('getSearchHistory error:', error)
    return []
  }
  return data || []
}

export async function deleteHistoryItem(id) {
  const user = await getCurrentUser()
  if (!user) return

  await supabase.from('search_history').delete().eq('id', id).eq('patient_id', user.id)
}

// ================================================================
// SCORING — uses symptoms table + remedy_symptoms table
// Table: symptoms (id, remedy, symptom, category, intensity)
// Table: remedy_symptoms (from scraped materia medica)
// ================================================================
export async function scoreRemediesFromSupabase(symptoms, filters = {}) {
  if (!symptoms || symptoms.length === 0) return []

  // Clean search terms — remove metadata prefixes
  const searchTerms = symptoms
    .map(s => s.toLowerCase().trim())
    .filter(s =>
      s.length > 2 &&
      !s.startsWith('category:') &&
      !s.startsWith('clinical report:') &&
      !s.startsWith('health history:') &&
      !s.startsWith('age group:') &&
      !s.startsWith('gender:') &&
      !s.startsWith('disease duration:') &&
      !s.startsWith('age:')
    )

  if (searchTerms.length === 0) return []

  const category = filters.symptom_location || filters.category || ''

  // ── STRATEGY 1: Search in symptoms table (5000 rubrics if imported) ──
  const strategy1Results = await searchInSymptomsTable(searchTerms, category)
  if (strategy1Results.length > 0) return strategy1Results

  // ── STRATEGY 2: Search in remedy_symptoms table (scraped materia medica) ──
  const strategy2Results = await searchInRemedySymptoms(searchTerms, category)
  if (strategy2Results.length > 0) return strategy2Results

  // ── STRATEGY 3: Search in remedies table by name ──
  return await searchInRemediesTable(searchTerms)
}

// Strategy 1: symptoms table (id, remedy, symptom, category, intensity)
async function searchInSymptomsTable(searchTerms, category) {
  try {
    // Build OR conditions for each search term
    const conditions = searchTerms.map(t => `symptom.ilike.%${t}%`).join(',')

    let query = supabase
      .from('symptoms')
      .select('id, remedy, symptom, category, intensity')
      .or(conditions)
      .limit(300)

    if (category) {
      query = query.ilike('category', `%${category}%`)
    }

    const { data, error } = await query

    if (error || !data || data.length === 0) return []

    // Score remedies
    const scoreMap = {}
    data.forEach(row => {
      const name = row.remedy
      const matchCount = searchTerms.filter(t => row.symptom?.toLowerCase().includes(t)).length
      if (matchCount === 0) return

      if (!scoreMap[name]) {
        scoreMap[name] = {
          name,
          totalScore: 0,
          matchCount: 0,
          matchedSymptoms: [],
          category: row.category || category || 'General'
        }
      }
      scoreMap[name].totalScore += (row.intensity || 1) * matchCount
      scoreMap[name].matchCount += 1
      scoreMap[name].matchedSymptoms.push(row.symptom)
    })

    return buildResults(scoreMap, category)
  } catch (e) {
    console.error('Strategy 1 error:', e)
    return []
  }
}

// Strategy 2: remedy_symptoms table (from scraped data)
async function searchInRemedySymptoms(searchTerms, category) {
  try {
    const conditions = searchTerms.map(t =>
      `symptom.ilike.%${t}%,heading.ilike.%${t}%`
    ).join(',')

    let query = supabase
      .from('remedy_symptoms')
      .select('remedy_name, heading, symptom')
      .or(conditions)
      .limit(300)

    if (category) {
      query = query.ilike('heading', `%${category}%`)
    }

    const { data, error } = await query

    if (error || !data || data.length === 0) return []

    const scoreMap = {}
    data.forEach(row => {
      const name = row.remedy_name
      const matchCount = searchTerms.filter(t =>
        row.symptom?.toLowerCase().includes(t) ||
        row.heading?.toLowerCase().includes(t)
      ).length
      if (matchCount === 0) return

      if (!scoreMap[name]) {
        scoreMap[name] = { name, totalScore: 0, matchCount: 0, matchedSymptoms: [], category: row.heading || category }
      }
      scoreMap[name].totalScore += 2 * matchCount
      scoreMap[name].matchCount += 1
      scoreMap[name].matchedSymptoms.push(row.symptom)
    })

    return buildResults(scoreMap, category)
  } catch (e) {
    console.error('Strategy 2 error:', e)
    return []
  }
}

// Strategy 3: remedies table
async function searchInRemediesTable(searchTerms) {
  try {
    const conditions = searchTerms.map(t =>
      `name.ilike.%${t}%,common_name.ilike.%${t}%`
    ).join(',')

    const { data, error } = await supabase
      .from('remedies')
      .select('id, name, common_name, slug')
      .or(conditions)
      .limit(10)

    if (error || !data || data.length === 0) return []

    return data.map((r, idx) => ({
      remedy: {
        id: r.id || r.slug,
        name: r.name,
        category: 'General',
        condition: r.common_name || r.name,
        description: `${r.name} matches your search terms.`,
        dosage: '30C potency, 3 pellets three times daily',
        symptoms: searchTerms,
        keywords: searchTerms,
        modalities: { better: [], worse: [] },
        potencies: ['30C', '200C'],
        age_groups: ['child', 'adult', 'senior'],
        genders: ['male', 'female', 'any'],
        synonym_names: []
      },
      score: Math.max(30, 80 - (idx * 15)),
      matching_symptoms: searchTerms,
      confidence: 40
    }))
  } catch (e) {
    console.error('Strategy 3 error:', e)
    return []
  }
}

// Build formatted results from scoreMap
function buildResults(scoreMap, category) {
  if (Object.keys(scoreMap).length === 0) return []

  const maxScore = Math.max(...Object.values(scoreMap).map(r => r.totalScore))

  return Object.values(scoreMap)
    .map(r => {
      const pct = Math.round((r.totalScore / maxScore) * 100)
      const grade = pct >= 80 ? 3 : pct >= 50 ? 2 : 1
      return {
        remedy: {
          id: r.name.toLowerCase().replace(/\s+/g, '-'),
          name: r.name,
          category: r.category || category || 'General',
          condition: [...new Set(r.matchedSymptoms)].slice(0, 2).join('; '),
          description: `${r.name} matches ${r.matchCount} symptom(s) in the database.`,
          dosage: grade === 3
            ? '200C potency — 3 pellets twice daily for 3 days, then once weekly'
            : grade === 2
              ? '30C potency — 3 pellets three times daily for 5 days'
              : '6C potency — 3 pellets four times daily for 7 days',
          symptoms: [...new Set(r.matchedSymptoms)].slice(0, 5),
          keywords: [],
          modalities: { better: [], worse: [] },
          potencies: ['6C', '30C', '200C'],
          age_groups: ['child', 'adult', 'senior'],
          genders: ['male', 'female', 'any'],
          synonym_names: []
        },
        score: pct,
        matching_symptoms: [...new Set(r.matchedSymptoms)].slice(0, 5),
        confidence: Math.min(100, r.matchCount * 12)
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
}

// ================================================================
// MATERIA MEDICA (400+ remedies from scraped data)
// ================================================================
export async function getAllRemedies() {
  const { data, error } = await supabase
    .from('remedies')
    .select('id, slug, name, common_name, section_count')
    .order('name')
  if (error) console.error('getAllRemedies:', error)
  return data || []
}

export async function getRemedyBySlug(slug) {
  const { data: remedy, error } = await supabase
    .from('remedies').select('*').eq('slug', slug).single()
  if (error) return null

  const { data: sections } = await supabase
    .from('remedy_sections')
    .select('heading, heading_order, content')
    .eq('remedy_id', remedy.id)
    .order('heading_order')

  return { ...remedy, sections: sections || [] }
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
