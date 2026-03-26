import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user || null)
  })
}

// ================================================================
// SEARCH HISTORY
// ================================================================
export async function saveSearchHistory(symptoms, results) {
  const user = await getCurrentUser()
  if (!user) return
  await supabase.from('search_history').insert({
    patient_id: user.id,
    symptoms,
    results
  })
}

export async function getSearchHistory() {
  const user = await getCurrentUser()
  if (!user) return []
  const { data } = await supabase
    .from('search_history')
    .select('*')
    .eq('patient_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
  return data || []
}

// ================================================================
// MATERIA MEDICA (400+ remedies from your scraped data)
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
    .from('remedies')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) { console.error('getRemedyBySlug:', error); return null }

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
    .order('name')
    .limit(20)
  if (error) console.error('searchRemediesByName:', error)
  return data || []
}

export async function searchBySymptom(symptom) {
  const { data, error } = await supabase
    .from('remedy_symptoms')
    .select('remedy_name, heading, symptom')
    .ilike('symptom', `%${symptom}%`)
    .order('remedy_name')
    .limit(50)
  if (error) console.error('searchBySymptom:', error)
  return data || []
}

export async function getRemediesByBodyPart(bodyPart) {
  const { data, error } = await supabase
    .from('remedy_symptoms')
    .select('remedy_name, symptom')
    .eq('heading', bodyPart)
    .order('remedy_name')
  if (error) console.error('getRemediesByBodyPart:', error)
  return data || []
}

// ================================================================
// SYMPTOM SCORING — Uses symptoms + symptom_remedies tables
// This is the MAIN AI scoring function
// ================================================================
export async function scoreRemediesFromSupabase(symptoms, filters = {}) {
  if (!symptoms || symptoms.length === 0) return []

  try {
    // Build search terms from symptoms
    const searchTerms = symptoms
      .map(s => s.toLowerCase().trim())
      .filter(s => s.length > 2 && !s.startsWith('category:') && !s.startsWith('clinical report:'))

    if (searchTerms.length === 0) return []

    // Search in symptoms table using rubric text matching
    let query = supabase
      .from('symptoms')
      .select(`
        id, rubric, category, location, worse, better,
        symptom_remedies (remedy_name, grade)
      `)

    // Filter by category if provided
    if (filters.symptom_location || filters.category) {
      const cat = filters.symptom_location || filters.category
      query = query.ilike('category', `%${cat}%`)
    }

    // Search for each term
    const orConditions = searchTerms.map(t => `rubric.ilike.%${t}%,location.ilike.%${t}%`).join(',')
    query = query.or(orConditions).limit(200)

    const { data: matchedSymptoms, error } = await query

    if (error) {
      console.error('Supabase score error:', error)
      // Fallback to remedy_symptoms table search
      return await scoreFromRemedySymptoms(searchTerms, filters)
    }

    if (!matchedSymptoms || matchedSymptoms.length === 0) {
      // Fallback to remedy_symptoms table
      return await scoreFromRemedySymptoms(searchTerms, filters)
    }

    // Calculate scores
    const remedyScores = {}

    matchedSymptoms.forEach(sym => {
      const termMatches = searchTerms.filter(t =>
        sym.rubric?.toLowerCase().includes(t) ||
        sym.location?.toLowerCase().includes(t)
      ).length

      if (termMatches === 0) return

      sym.symptom_remedies?.forEach(sr => {
        const name = sr.remedy_name
        if (!remedyScores[name]) {
          remedyScores[name] = {
            name,
            totalScore: 0,
            matchCount: 0,
            maxGrade: 0,
            matchedRubrics: [],
            modalities: { better: [], worse: [] }
          }
        }
        const score = sr.grade * termMatches
        remedyScores[name].totalScore += score
        remedyScores[name].matchCount += 1
        remedyScores[name].maxGrade = Math.max(remedyScores[name].maxGrade, sr.grade)
        remedyScores[name].matchedRubrics.push(sym.rubric)

        // Collect modalities
        if (sym.worse) remedyScores[name].modalities.worse.push(...sym.worse)
        if (sym.better) remedyScores[name].modalities.better.push(...sym.better)
      })
    })

    if (Object.keys(remedyScores).length === 0) {
      return await scoreFromRemedySymptoms(searchTerms, filters)
    }

    const maxScore = Math.max(...Object.values(remedyScores).map((r) => r.totalScore))

    return Object.values(remedyScores)
      .map((r) => ({
        remedy: {
          id: r.name.toLowerCase().replace(/\s+/g, '-'),
          name: r.name,
          category: filters.symptom_location || 'General',
          condition: r.matchedRubrics.slice(0, 2).join('; '),
          description: `${r.name} matches ${r.matchCount} rubric(s) for your symptoms.`,
          dosage: r.maxGrade >= 3 ? '200C potency, 3 pellets twice daily' : r.maxGrade === 2 ? '30C potency, 3 pellets three times daily' : '6C potency, 3 pellets four times daily',
          symptoms: [...new Set(r.matchedRubrics)].slice(0, 5),
          keywords: searchTerms,
          modalities: {
            better: [...new Set(r.modalities.better)].slice(0, 4),
            worse: [...new Set(r.modalities.worse)].slice(0, 4)
          },
          potencies: ['6C', '30C', '200C'],
          age_groups: ['child', 'adult', 'senior'],
          genders: ['male', 'female', 'any'],
          synonym_names: []
        },
        score: Math.round((r.totalScore / maxScore) * 100),
        matching_symptoms: [...new Set(r.matchedRubrics)].slice(0, 5),
        confidence: Math.min(100, r.matchCount * 15)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

  } catch (err) {
    console.error('scoreRemediesFromSupabase error:', err)
    return await scoreFromRemedySymptoms(symptoms, filters)
  }
}

// Fallback: search in remedy_symptoms table (from scraped materia medica)
async function scoreFromRemedySymptoms(searchTerms, filters) {
  try {
    const orConditions = searchTerms.map(t => `symptom.ilike.%${t}%,heading.ilike.%${t}%`).join(',')

    let query = supabase
      .from('remedy_symptoms')
      .select('remedy_name, heading, symptom')
      .or(orConditions)
      .limit(200)

    if (filters.symptom_location) {
      query = query.ilike('heading', `%${filters.symptom_location}%`)
    }

    const { data, error } = await query
    if (error || !data?.length) return []

    const remedyScores = {}
    data.forEach(row => {
      const name = row.remedy_name
      if (!remedyScores[name]) {
        remedyScores[name] = { name, totalScore: 0, matchCount: 0, matchedSymptoms: [] }
      }
      remedyScores[name].totalScore += 2
      remedyScores[name].matchCount += 1
      remedyScores[name].matchedSymptoms.push(row.symptom)
    })

    const maxScore = Math.max(...Object.values(remedyScores).map((r) => r.totalScore))

    return Object.values(remedyScores)
      .map((r) => ({
        remedy: {
          id: r.name.toLowerCase().replace(/\s+/g, '-'),
          name: r.name,
          category: filters.symptom_location || 'General',
          condition: r.matchedSymptoms.slice(0, 2).join('; '),
          description: `${r.name} is indicated for: ${r.matchedSymptoms.slice(0, 3).join(', ')}.`,
          dosage: '30C potency, 3 pellets three times daily',
          symptoms: [...new Set(r.matchedSymptoms)].slice(0, 5),
          keywords: searchTerms,
          modalities: { better: [], worse: [] },
          potencies: ['30C', '200C'],
          age_groups: ['child', 'adult', 'senior'],
          genders: ['male', 'female', 'any'],
          synonym_names: []
        },
        score: Math.round((r.totalScore / maxScore) * 100),
        matching_symptoms: [...new Set(r.matchedSymptoms)].slice(0, 5),
        confidence: Math.min(100, r.matchCount * 10)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  } catch (err) {
    console.error('scoreFromRemedySymptoms error:', err)
    return []
  }
}
