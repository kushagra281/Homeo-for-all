import { useState, useEffect, useRef } from "react";
import { Search, TrendingUp, ArrowLeft, HelpCircle, Camera, Paperclip, X, CheckCircle, Heart } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import AdvancedFilters, { FilterState } from "./advanced-filters";
import { scoreRemediesFromSupabase, saveSearchHistory } from "@/lib/supabase";

// ── AI QUESTIONS ──────────────────────────────────────────────
const MIND_QUESTIONS = [
  { q: "Primary emotional state?", options: ["Anxiety", "Depression", "Anger", "Fear", "Grief", "Restlessness", "Irritability", "Sadness"] },
  { q: "How long have you had this?", options: ["Few days", "Few weeks", "Few months", "Over a year", "Years"] },
  { q: "When is it worse?", options: ["Night", "Morning", "Alone", "In company", "After eating", "Before menses", "On waking"] },
  { q: "Associated physical symptoms?", options: ["Palpitations", "Sweating", "Trembling", "Insomnia", "Loss of appetite", "Headache", "None"] },
  { q: "What triggered it?", options: ["Grief/Loss", "Work stress", "Relationship issues", "Health concern", "Financial stress", "Unknown", "No trigger"] },
  { q: "Sleep pattern?", options: ["Cannot fall asleep", "Wake frequently", "Early waking", "Nightmares", "Sleep too much", "Normal"] },
  { q: "Appetite changes?", options: ["Decreased", "Increased", "Craving sweets", "Craving salt", "No appetite", "Normal"] },
  { q: "Social behavior?", options: ["Wants to be alone", "Craves company", "Irritable with family", "Withdrawn", "Clingy", "Normal"] },
  { q: "Memory & concentration?", options: ["Forgetful", "Cannot concentrate", "Confused thoughts", "Racing thoughts", "Slow thinking", "Normal"] },
  { q: "Weeping tendency?", options: ["Cries easily", "Cannot cry (wants to)", "Cries alone", "Cries with company", "Never cries", "N/A"] },
  { q: "Fear type (if any)?", options: ["Fear of death", "Fear of disease", "Fear of being alone", "Fear of crowd", "Fear of dark", "No fear"] },
  { q: "What makes you feel better?", options: ["Consolation", "Being alone", "Music", "Open air", "Company", "Warmth", "Work"] },
  { q: "Energy level?", options: ["Exhausted", "Low energy", "Normal in morning, tired evening", "Worse on exertion", "Normal", "Hyperactive"] },
  { q: "Irritability?", options: ["Easily angered", "Angry from contradiction", "Angry then repent", "Suppressed anger", "Never angry", "N/A"] },
  { q: "Any obsessive thoughts?", options: ["Yes - about health", "Yes - about cleanliness", "Yes - about work", "Yes - intrusive thoughts", "No"] },
  { q: "Relationship with others?", options: ["Quarrelsome", "Jealous", "Suspicious", "Over-sensitive", "Indifferent", "Normal"] },
  { q: "Self-esteem?", options: ["Very low", "Self-critical", "Feeling worthless", "Over-confident", "Normal", "N/A"] },
  { q: "Any suicidal thoughts?", options: ["No", "Passive (life not worth living)", "Active thoughts", "Prefer not to say"] },
]

const CATEGORY_QUESTIONS: Record<string, Array<{ q: string; options: string[] }>> = {
  "Mind": MIND_QUESTIONS,
  "Head": [
    { q: "Type of headache?", options: ["Throbbing", "Pressing", "Burning", "Shooting", "Dull ache", "Band-like"] },
    { q: "Location?", options: ["Forehead", "Temples", "Back of head", "Top of head", "One side (right)", "One side (left)", "Whole head"] },
    { q: "Time of headache?", options: ["Morning on waking", "Afternoon", "Evening", "Night", "After eating", "Continuous"] },
    { q: "What makes it worse?", options: ["Light", "Noise", "Movement", "Heat", "Cold", "Stress", "Bending down"] },
    { q: "What makes it better?", options: ["Rest in dark", "Pressure", "Cold compress", "Warmth", "Open air", "Vomiting", "Sleep"] },
    { q: "Associated symptoms?", options: ["Nausea/Vomiting", "Visual disturbance", "Vertigo", "Neck stiffness", "Sensitivity to light", "None"] },
  ],
  "Fever": [
    { q: "Stage of fever?", options: ["Chill then heat", "Heat only", "Sweating after heat", "All three stages", "Irregular"] },
    { q: "Time of fever?", options: ["Morning", "Afternoon (1-3 PM)", "Evening", "Night", "Irregular pattern"] },
    { q: "Thirst during fever?", options: ["Very thirsty", "Thirsty for cold drinks", "Thirsty for warm drinks", "No thirst at all"] },
    { q: "Perspiration?", options: ["Profuse sweating", "No sweating", "Sweating relieves", "Sweating doesn't relieve", "Only on certain parts"] },
    { q: "Associated symptoms?", options: ["Body ache", "Headache", "Rash", "Vomiting", "Delirium", "Fits/Convulsions"] },
  ],
  "Stomach": [
    { q: "Main complaint?", options: ["Nausea", "Vomiting", "Acidity/Heartburn", "Bloating/Gas", "Pain", "Loss of appetite"] },
    { q: "Relation to eating?", options: ["Better after eating", "Worse immediately after", "Worse 1-2 hrs after", "Better with fasting", "No relation"] },
    { q: "Type of pain?", options: ["Burning", "Cramping/Spasm", "Cutting/Sharp", "Pressing/Heavy", "Colicky", "No pain"] },
    { q: "Vomiting type (if any)?", options: ["Sour", "Bitter", "Undigested food", "Blood-tinged", "Water", "No vomiting"] },
    { q: "Thirst?", options: ["Very thirsty", "Thirsty for cold", "Thirsty for warm", "No thirst", "Aversion to water"] },
  ],
  "Respiration": [
    { q: "Type of cough?", options: ["Dry/Hacking", "Wet/Productive", "Barking/Croupy", "Spasmodic/Whooping", "Night cough", "Morning cough"] },
    { q: "Sputum color?", options: ["None (dry)", "Clear/White", "Yellow", "Green", "Blood-tinged", "Rusty/Brown"] },
    { q: "Breathlessness?", options: ["Worse lying down", "Worse on exertion", "At night only", "Sudden attacks", "Constant", "None"] },
    { q: "Associated symptoms?", options: ["Wheezing", "Chest pain", "Hoarseness", "Fever", "Rattling in chest", "Sweating at night"] },
    { q: "What makes cough worse?", options: ["Cold air", "Talking", "Lying down", "Morning", "Night", "Warm room", "Eating"] },
  ],
  "Skin": [
    { q: "Type of eruption?", options: ["Rash/Urticaria", "Blisters/Vesicles", "Dry/Scaly patches", "Weeping/Oozing", "Nodules/Bumps", "Discoloration only"] },
    { q: "Sensation?", options: ["Intense itching", "Burning", "Stinging", "No sensation", "Bleeding on scratch", "Crawling feeling"] },
    { q: "Distribution?", options: ["Face", "Arms/Hands", "Legs/Feet", "Trunk/Back", "Folds of skin", "Widespread"] },
    { q: "What makes it worse?", options: ["Heat/Warmth", "Cold", "Night", "Scratching", "Washing/Water", "Wool clothing"] },
    { q: "What makes it better?", options: ["Cold application", "Warmth", "Scratching (temporarily)", "Open air", "Rest", "Nothing helps"] },
  ],
  "Hands, Legs & Back": [
    { q: "Type of complaint?", options: ["Joint pain", "Muscle pain/Soreness", "Stiffness", "Swelling/Edema", "Weakness/Paralysis", "Numbness/Tingling"] },
    { q: "Joints affected?", options: ["Fingers/Wrists", "Elbows/Shoulders", "Knees", "Ankles/Feet", "Hip", "Spine/Back", "Multiple joints"] },
    { q: "Character of pain?", options: ["Tearing", "Stitching", "Bruised/Sore", "Drawing/Pulling", "Burning", "Cramping"] },
    { q: "When worse?", options: ["Morning stiffness", "First motion", "Continued motion", "At rest/Night", "Cold/Damp", "Heat/Warmth"] },
    { q: "When better?", options: ["Continued movement", "Rest", "Warmth/Heat", "Cold application", "Pressure", "Elevation"] },
    { q: "Associated symptoms?", options: ["Redness/Heat", "Swelling", "Weakness", "Cracking sounds", "None"] },
  ],
}

const DEFAULT_QUESTIONS = [
  { q: "How severe is the complaint?", options: ["Mild - not limiting", "Moderate - affects daily life", "Severe - disabling", "Unbearable"] },
  { q: "How did it start?", options: ["Suddenly", "Gradually", "After cold/wet exposure", "After emotional stress", "After eating", "After injury", "Unknown"] },
  { q: "What makes it better?", options: ["Rest", "Movement", "Warmth", "Cold", "Pressure", "Open air", "Eating", "Nothing"] },
  { q: "What makes it worse?", options: ["Morning", "Night", "Cold", "Heat", "Exertion", "Eating", "Stress", "Touch"] },
  { q: "Thirst level?", options: ["Very thirsty - large amounts", "Thirsty - small sips", "No thirst", "Aversion to water"] },
  { q: "Sleep quality?", options: ["Normal", "Cannot fall asleep", "Wake at night", "Unrefreshing sleep", "Oversleeping"] },
]

// AVOID per category
const AVOID_MAP: Record<string, string[]> = {
  "Mind": ["Coffee and stimulants", "Alcohol", "Social media overuse before bed", "Isolation", "Suppressing emotions", "Irregular sleep schedule"],
  "Head": ["Bright screens in dark", "Skipping meals", "Dehydration", "Strong perfumes", "Loud noise", "Alcohol"],
  "Fever": ["Cold bath during chill stage", "Heavy blankets during heat stage", "Carbonated drinks", "Dairy products", "Sudden temperature change"],
  "Stomach": ["Spicy and fried food", "Coffee on empty stomach", "Carbonated drinks", "Late night eating", "Overeating", "Stress while eating"],
  "Respiration": ["Cold drinks and ice cream", "Dairy (increases mucus)", "Smoking", "AC direct exposure", "Dusty environment", "Cold food"],
  "Skin": ["Harsh soap/chemicals", "Hot water baths", "Synthetic clothing", "Scratching", "Dairy and sugar", "Cosmetics with parabens"],
  "Hands, Legs & Back": ["Cold/damp environments", "One position too long", "Heavy lifting", "High heels", "Overexertion", "Very soft mattress"],
  "Urinary System": ["Holding urine", "Less water intake", "Spicy food", "Alcohol", "Excess coffee", "Tight clothing"],
  "Heart": ["Excess salt", "Saturated fats", "Smoking", "Unmanaged stress", "Sedentary lifestyle", "Excess caffeine"],
  "Female Genitalia": ["Tight synthetic underwear", "Scented products in intimate area", "Stress", "Irregular sleep", "Cold food during menses"],
}

const DEFAULT_AVOID = ["Coffee and strong tea", "Alcohol", "Strongly scented substances", "Irregular sleep", "Processed food", "Suppressing natural urges"]

interface RemedyScorerProps {
  initialQuery?: string;
  initialCategory?: string;
}

export default function RemedyScorer({ initialQuery = "", initialCategory = "" }: RemedyScorerProps) {
  const [, setLocation] = useLocation()
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [currentSymptom, setCurrentSymptom] = useState("")
  const [healthHistory, setHealthHistory] = useState("")
  const [filters, setFilters] = useState<FilterState>({ age_group: "", gender: "", condition_type: "" })
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showResults, setShowResults] = useState(false)
  const [showQuestionnaire, setShowQuestionnaire] = useState(false)
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const activeCategory = initialCategory || ""
  const questions = CATEGORY_QUESTIONS[activeCategory] || DEFAULT_QUESTIONS
  const avoidList = AVOID_MAP[activeCategory] || DEFAULT_AVOID

  useEffect(() => {
    if (initialQuery) {
      const parts = initialQuery.split(",").map(s => s.trim()).filter(Boolean)
      if (parts.length > 0) { setSymptoms(parts); setShowQuestionnaire(true) }
    } else if (activeCategory) {
      setShowQuestionnaire(true)
    }
  }, [initialQuery, initialCategory])

  // ── SUBMIT TO SUPABASE AI ────────────────────────────────
  const submitToAI = async (syms: string[], answers: Record<string, string>) => {
    setLoading(true); setError("")
    try {
      const allSymptoms = [
        ...syms,
        ...Object.values(answers).filter(Boolean),
        ...(activeCategory ? [`category: ${activeCategory}`] : []),
        ...(healthHistory.trim() ? [`health history: ${healthHistory.trim()}`] : []),
        ...(filters.age_group ? [`age: ${filters.age_group}`] : []),
        ...(filters.gender ? [`gender: ${filters.gender}`] : []),
        ...(filters.condition_type ? [`duration: ${filters.condition_type}`] : []),
      ].filter(Boolean)

      const cleanFilters: any = {}
      if (activeCategory) cleanFilters.symptom_location = activeCategory
      if (filters.age_group) cleanFilters.age_group = filters.age_group
      if (filters.gender) cleanFilters.gender = filters.gender

      const scored = await scoreRemediesFromSupabase(allSymptoms, cleanFilters)
      setResults(scored)
      setShowResults(true)
      await saveSearchHistory(allSymptoms, scored)
    } catch (err: any) {
      setError("Could not connect to database. Please check your internet connection.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerQuestion = (answer: string) => {
    const currentQ = questions[currentQuestionIdx]
    const newAnswers = { ...questionAnswers, [currentQ.q]: answer }
    setQuestionAnswers(newAnswers)
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1)
    } else {
      setShowQuestionnaire(false)
      submitToAI(symptoms, newAnswers)
    }
  }

  const handleAddSymptom = () => {
    if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
      setSymptoms(prev => [...prev, currentSymptom.trim()])
      setCurrentSymptom("")
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedFiles(prev => [...prev, ...files])
    files.forEach(f => setSymptoms(prev => [...prev, `Clinical report: ${f.name}`]))
  }

  const resetForm = () => {
    setSymptoms([]); setCurrentSymptom(""); setHealthHistory("")
    setFilters({ age_group: "", gender: "", condition_type: "" })
    setResults([]); setShowResults(false); setShowQuestionnaire(false)
    setQuestionAnswers({}); setCurrentQuestionIdx(0)
    setUploadedFiles([]); setError("")
  }

  // Header
  const PageHeader = () => (
    <header className="bg-white border-b border-gray-100 shadow-sm mb-6 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xl">🌿</span>
          </div>
          <span className="font-bold text-green-700 text-lg">HomeoWell</span>
        </button>
        {activeCategory && <Badge className="bg-green-100 text-green-700 border-green-300">{activeCategory}</Badge>}
      </div>
    </header>
  )

  // ── QUESTIONNAIRE ────────────────────────────────────────
  if (showQuestionnaire) {
    const currentQ = questions[currentQuestionIdx]
    const progress = (currentQuestionIdx / questions.length) * 100
    const isMindCategory = activeCategory === "Mind"

    return (
      <div>
        <PageHeader />
        <div className="max-w-2xl mx-auto px-4 pb-8">
          <Card className="p-6">
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-green-700">
                  <HelpCircle size={18} />
                  <span className="font-semibold text-sm">
                    {isMindCategory ? "Psychological Assessment" : "AI is narrowing down remedies..."}
                  </span>
                </div>
                <span className="text-xs text-gray-400">{currentQuestionIdx + 1} / {questions.length}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              {activeCategory && <p className="text-xs text-gray-400 mt-1">Category: {activeCategory}</p>}
            </div>

            <h3 className="text-base font-semibold text-gray-800 mb-4">{currentQ.q}</h3>
            <div className="grid grid-cols-2 gap-2 mb-5">
              {currentQ.options.map(option => (
                <button key={option} onClick={() => handleAnswerQuestion(option)}
                  className={`p-3 rounded-xl border-2 text-left text-sm font-medium transition-all
                    ${questionAnswers[currentQ.q] === option
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 hover:border-green-400 hover:bg-green-50 text-gray-700"}`}>
                  {option}
                </button>
              ))}
            </div>

            {/* Custom symptom input during Q */}
            <div className="border-t pt-3">
              <p className="text-xs text-gray-400 mb-2">Add custom symptom:</p>
              <div className="flex gap-2">
                <Input value={currentSymptom} onChange={e => setCurrentSymptom(e.target.value)}
                  onKeyPress={e => { if (e.key === "Enter") handleAddSymptom() }}
                  placeholder="Type and press Enter..." className="flex-1 text-sm" />
                <Button size="sm" onClick={handleAddSymptom} disabled={!currentSymptom.trim()}>Add</Button>
              </div>
              {symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {symptoms.map(s => (
                    <Badge key={s} variant="secondary" className="text-xs cursor-pointer"
                      onClick={() => setSymptoms(prev => prev.filter(x => x !== s))}>
                      {s} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between mt-4">
              {currentQuestionIdx > 0 && (
                <Button variant="outline" size="sm" onClick={() => setCurrentQuestionIdx(p => p - 1)}>← Back</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => { setShowQuestionnaire(false); if (symptoms.length > 0) submitToAI(symptoms, questionAnswers) }}
                className="ml-auto text-gray-400 text-xs">
                Skip & Search →
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // ── LOADING ──────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <PageHeader />
        <div className="max-w-2xl mx-auto px-4 text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">AI is analyzing symptoms...</p>
          <p className="text-gray-400 text-sm mt-1">Searching Supabase database</p>
        </div>
      </div>
    )
  }

  // ── RESULTS ──────────────────────────────────────────────
  if (showResults) {
    const topResults = results.slice(0, 3)

    return (
      <div>
        <PageHeader />
        <div className="max-w-4xl mx-auto px-4 pb-8 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Top Remedy Recommendations</h2>
              <p className="text-sm text-gray-500">
                {topResults.length > 0 ? `${topResults.length} best matches found` : "No matches found"}
                {activeCategory ? ` — ${activeCategory}` : ""}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={resetForm}>
              <ArrowLeft size={14} className="mr-1" /> New Search
            </Button>
          </div>

          {/* Answers summary */}
          {Object.keys(questionAnswers).length > 0 && (
            <div className="p-3 bg-green-50 rounded-xl border border-green-200">
              <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                <CheckCircle size={13} /> AI refined by your answers:
              </p>
              <div className="flex flex-wrap gap-1">
                {Object.values(questionAnswers).map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {topResults.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-gray-500 mb-3">No matching remedies found in database.</p>
              <p className="text-xs text-gray-400 mb-4">Try different symptoms or a different category.</p>
              <Button onClick={resetForm} className="bg-green-600 hover:bg-green-700">Try Again</Button>
            </Card>
          )}

          {/* Remedies */}
          {topResults.map((result: any, idx: number) => (
            <Card key={result.remedy.id + idx} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <h3 className="text-lg font-bold text-gray-900">{result.remedy.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 ml-9">{result.remedy.condition}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="text-2xl font-bold text-green-600">{result.score}%</div>
                  <div className="text-xs text-gray-400">match</div>
                </div>
              </div>

              {/* Score bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${result.score}%` }} />
              </div>

              <p className="text-sm text-gray-600 mb-3">{result.remedy.description}</p>

              {/* Dosage */}
              <div className="bg-blue-50 rounded-lg p-2.5 mb-3">
                <p className="text-xs text-blue-700"><strong>💊 Dosage:</strong> {result.remedy.dosage}</p>
              </div>

              {/* Matching symptoms */}
              {result.matching_symptoms?.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1">Matched rubrics:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.matching_symptoms.slice(0, 4).map((s: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Modalities */}
              {(result.remedy.modalities?.better?.length > 0 || result.remedy.modalities?.worse?.length > 0) && (
                <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                  {result.remedy.modalities?.better?.length > 0 && (
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="font-semibold text-green-700 mb-1">✓ Better:</p>
                      {result.remedy.modalities.better.slice(0, 3).map((b: string, i: number) => (
                        <p key={i} className="text-green-600">{b}</p>
                      ))}
                    </div>
                  )}
                  {result.remedy.modalities?.worse?.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-2">
                      <p className="font-semibold text-red-700 mb-1">✗ Worse:</p>
                      {result.remedy.modalities.worse.slice(0, 3).map((w: string, i: number) => (
                        <p key={i} className="text-red-600">{w}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}

          {/* AVOID section */}
          {topResults.length > 0 && (
            <Card className="p-5 border-2 border-red-200 bg-red-50">
              <h3 className="text-base font-bold text-red-700 mb-3 flex items-center gap-2">
                ⚠️ AVOID
                <span className="text-sm font-normal text-red-500">
                  — For {activeCategory || "this condition"}
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {avoidList.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-red-500 shrink-0 mt-0.5">✗</span>
                    <span className="text-sm text-red-700">{item}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <p className="text-center text-xs text-gray-400">
            ⚠️ For educational purposes only. Always consult a qualified homeopath.
          </p>
        </div>
      </div>
    )
  }

  // ── MAIN INPUT ───────────────────────────────────────────
  return (
    <div>
      <PageHeader />
      <div className="max-w-4xl mx-auto px-4 pb-8 space-y-5">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold">Symptom Analysis</h2>
              <p className="text-sm text-neutral-500">
                {activeCategory ? `Category: ${activeCategory}` : "AI-powered remedy matching"}
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs text-neutral-400">
              <TrendingUp size={14} /><span>Supabase AI</span>
            </div>
          </div>

          {/* Symptom input */}
          <div className="space-y-4">
            <div>
              <Label>Add Symptoms</Label>
              <div className="flex gap-2 mt-1">
                <Input value={currentSymptom} onChange={e => setCurrentSymptom(e.target.value)}
                  onKeyPress={e => { if (e.key === "Enter") { e.preventDefault(); handleAddSymptom() } }}
                  placeholder="Type symptom and press Enter..." className="flex-1" autoFocus />
                <Button onClick={handleAddSymptom} disabled={!currentSymptom.trim()} className="bg-green-600 hover:bg-green-700">Add</Button>
              </div>
            </div>

            {symptoms.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-neutral-50 rounded-lg">
                {symptoms.map(s => (
                  <Badge key={s} variant="secondary" className="cursor-pointer hover:bg-red-100 text-xs"
                    onClick={() => setSymptoms(p => p.filter(x => x !== s))}>
                    {s} ×
                  </Badge>
                ))}
              </div>
            )}

            {/* Health History */}
            <div>
              <Label className="flex items-center gap-1">
                <Heart size={14} className="text-red-500" />
                Health History (optional but helps AI)
              </Label>
              <Textarea
                value={healthHistory}
                onChange={e => setHealthHistory(e.target.value)}
                placeholder="e.g. Diabetic since 10 years, BP patient, thyroid, any surgeries, allergies..."
                className="mt-1 text-sm resize-none"
                rows={2}
              />
            </div>

            {/* Clinical uploads */}
            <div>
              <Label>Clinical Reports (optional)</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    multiple onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  <Button type="button" variant="outline" className="w-full border-dashed border-2 border-gray-300 hover:border-green-400 text-sm">
                    <Paperclip size={15} className="mr-2 text-green-600" /> Upload PDF / Photos (multiple)
                  </Button>
                </div>
                <div className="relative">
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                    multiple onChange={handleFileSelect}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                  <Button type="button" variant="outline" className="border-2 border-gray-300 hover:border-green-400 px-3 h-full"
                    title="Take photo">
                    <Camera size={18} className="text-green-600" />
                  </Button>
                </div>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-green-50 rounded px-3 py-1.5">
                      <span className="text-green-700 truncate">📎 {f.name}</span>
                      <button onClick={() => setUploadedFiles(p => p.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-500 ml-2 shrink-0"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator className="my-5" />

          <AdvancedFilters onFiltersChange={setFilters} onSearch={() => submitToAI(symptoms, questionAnswers)} isLoading={loading} />

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
          )}

          <div className="flex justify-between mt-5">
            <Button variant="outline" onClick={() => { setShowQuestionnaire(true); setCurrentQuestionIdx(0) }}
              className="text-sm">
              <HelpCircle size={14} className="mr-2" /> AI Questions
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetForm} className="text-sm">Clear</Button>
              <Button onClick={() => submitToAI(symptoms, questionAnswers)}
                disabled={symptoms.length === 0 || loading}
                className="bg-green-600 hover:bg-green-700 min-w-28 text-sm">
                <Search size={14} className="mr-2" /> Find Remedies
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
