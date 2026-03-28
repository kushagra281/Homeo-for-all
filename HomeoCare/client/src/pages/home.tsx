import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import {
  Search, LogOut, User, Clock, ChevronRight,
  Paperclip, ArrowLeft, Globe, X, Trash2
} from "lucide-react"
import { getCurrentUser, signOut, getSearchHistory, deleteHistoryItem } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

const RUBRIC_CATEGORIES = [
  { name: "Mind",              icon: "🧠", desc: "Mental & Emotional" },
  { name: "Head",              icon: "👤", desc: "Headache, Vertigo" },
  { name: "Eye",               icon: "👁️", desc: "Vision, Pain" },
  { name: "Ear",               icon: "👂", desc: "Hearing, Tinnitus" },
  { name: "Nose",              icon: "👃", desc: "Cold, Sinusitis" },
  { name: "Face",              icon: "😬", desc: "Facial Pain" },
  { name: "Mouth",             icon: "👄", desc: "Ulcers, Dryness" },
  { name: "Tongue",            icon: "👅", desc: "Coating, Pain" },
  { name: "Taste",             icon: "🫧", desc: "Bitter, Metallic" },
  { name: "Gums",              icon: "🦷", desc: "Swelling, Bleeding" },
  { name: "Teeth",             icon: "🦷", desc: "Toothache, Decay" },
  { name: "Throat",            icon: "🗣️", desc: "Pain, Infection" },
  { name: "Stomach",           icon: "🍽️", desc: "Digestion, Nausea" },
  { name: "Abdomen",           icon: "🫃", desc: "Pain, Bloating" },
  { name: "Urinary System",    icon: "🚻", desc: "Infection, Burning" },
  { name: "Male Genitalia",    icon: "🧬", desc: "Male Complaints" },
  { name: "Female Genitalia",  icon: "🧬", desc: "Female Complaints" },
  { name: "Heart",             icon: "❤️", desc: "Palpitations, Pain" },
  { name: "Hands, Legs & Back",icon: "🦴", desc: "Joints, Spine" },
  { name: "Respiration",       icon: "🫁", desc: "Breathing, Cough" },
  { name: "Skin",              icon: "🧴", desc: "Rashes, Eruptions" },
  { name: "Fever",             icon: "🌡️", desc: "Temperature, Chills" },
  { name: "Nervous System",    icon: "⚡", desc: "Nerves, Neurological" },
  { name: "Others",            icon: "🔵", desc: "General, Misc" },
]

function getCommonSymptoms(category: string): string[] {
  const map: Record<string, string[]> = {
    "Mind":               ["Anxiety", "Depression", "Anger", "Fear", "Grief", "Sleeplessness"],
    "Head":               ["Throbbing headache", "One-sided headache", "Headache with nausea", "Vertigo"],
    "Fever":              ["High fever", "Fever with chills", "Fever with sweating", "Low-grade fever"],
    "Stomach":            ["Nausea", "Acidity", "Bloating", "Loss of appetite", "Vomiting"],
    "Respiration":        ["Dry cough", "Wet cough", "Breathlessness", "Wheezing"],
    "Skin":               ["Itching", "Rash", "Eczema", "Dry skin", "Hives"],
    "Hands, Legs & Back": ["Joint pain", "Back pain", "Stiffness", "Swollen joints"],
    "Urinary System":     ["Burning urination", "Frequent urination", "UTI symptoms"],
    "Heart":              ["Palpitations", "Chest pain", "High BP symptoms"],
    "Eye":                ["Redness", "Itching eyes", "Watering", "Pain in eye"],
    "Ear":                ["Earache", "Ringing in ear", "Ear discharge"],
    "Nose":               ["Blocked nose", "Running nose", "Sneezing fits"],
    "Throat":             ["Sore throat", "Difficulty swallowing", "Hoarseness"],
    "Female Genitalia":   ["Irregular menses", "Painful periods", "White discharge", "PMS"],
    "Nervous System":     ["Numbness", "Tingling", "Weakness", "Trembling"],
  }
  return map[category] || ["Pain", "Swelling", "Discharge", "Weakness", "Fever"]
}

// Language options for translate
const LANGUAGES = [
  { code: "hi", name: "हिंदी (Hindi)" },
  { code: "ur", name: "اردو (Urdu)" },
  { code: "gu", name: "ગુજરાતી (Gujarati)" },
  { code: "mr", name: "मराठी (Marathi)" },
  { code: "pa", name: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "bn", name: "বাংলা (Bengali)" },
  { code: "ta", name: "தமிழ் (Tamil)" },
  { code: "te", name: "తెలుగు (Telugu)" },
  { code: "kn", name: "ಕನ್ನಡ (Kannada)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "en", name: "English" },
]

export default function Home() {
  const [, setLocation]       = useLocation()
  const [user, setUser]       = useState<any>(null)
  const [query, setQuery]     = useState("")
  const [history, setHistory] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showHistory, setShowHistory]       = useState(false)
  const [showTranslate, setShowTranslate]   = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryQuery, setCategoryQuery]       = useState("")

  useEffect(() => {
    getCurrentUser().then(u => {
      if (!u) { setLocation("/auth"); return }
      setUser(u)
    })
  }, [])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const h = await getSearchHistory()
      setHistory(h || [])
    } catch (e) {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const toggleHistory = () => {
    if (!showHistory) loadHistory()
    setShowHistory(prev => !prev)
  }

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteHistoryItem(id)
    setHistory(prev => prev.filter(h => h.id !== id))
  }

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLocation(`/symptom-analysis?q=${encodeURIComponent(query.trim())}`)
  }

  const handleCategorySearch = (cat: string, q?: string) => {
    const params = new URLSearchParams()
    params.set("category", cat)
    if (q?.trim()) params.set("q", q.trim())
    setLocation(`/symptom-analysis?${params.toString()}`)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) setLocation(`/symptom-analysis?category=Clinical`)
  }

  // Google Translate — opens in new tab with selected language
  const handleTranslateTo = (langCode: string) => {
    const url = window.location.href
    if (langCode === 'en') {
      window.location.href = url  // reload in English
      return
    }
    const translateUrl = `https://translate.google.com/translate?sl=en&tl=${langCode}&u=${encodeURIComponent(url)}`
    window.open(translateUrl, '_blank')
    setShowTranslate(false)
  }

  const handleLogout = async () => {
    await signOut()
    setLocation("/auth")
  }

  const formatSymptoms = (h: any) => {
    const syms = Array.isArray(h.symptoms) ? h.symptoms : []
    return syms
      .filter((s: string) =>
        !s.startsWith("category:") && !s.startsWith("health history:") &&
        !s.startsWith("age") && !s.startsWith("gender:") && !s.startsWith("disease")
      )
      .slice(0, 3).join(", ") || "Consultation"
  }

  const formatTopRemedy = (h: any) => {
    const results = Array.isArray(h.results) ? h.results : []
    return results[0]?.remedy?.name ? `→ ${results[0].remedy.name}` : ""
  }

  // ── CATEGORY VIEW ────────────────────────────────────────
  if (selectedCategory) {
    const cat = RUBRIC_CATEGORIES.find(c => c.name === selectedCategory)!
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <header className="bg-white border-b shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => { setSelectedCategory(null); setCategoryQuery("") }}
              className="flex items-center gap-2 hover:opacity-80">
              <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center shadow-sm">
                <span className="text-lg">🌿</span>
              </div>
              <span className="font-bold text-green-700 text-lg">HomeoWell</span>
            </button>
            <button onClick={() => { setSelectedCategory(null); setCategoryQuery("") }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft size={15} /> Back
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">{cat.icon}</div>
            <h1 className="text-2xl font-bold text-gray-900">{cat.name}</h1>
            <p className="text-gray-400 text-sm mt-1">{cat.desc}</p>
          </div>

          <Card className="p-6">
            <h2 className="font-semibold text-gray-800 mb-4">
              Search in <span className="text-green-700">{cat.name}</span>
            </h2>
            <form onSubmit={e => { e.preventDefault(); handleCategorySearch(selectedCategory, categoryQuery) }}>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                  <Input value={categoryQuery} onChange={e => setCategoryQuery(e.target.value)}
                    placeholder="" className="pl-10 py-5 border-2 border-green-200 focus:border-green-500" autoFocus />
                </div>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 px-5">Search</Button>
              </div>
            </form>

            <p className="text-xs text-gray-400 mb-2">Common symptoms:</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {getCommonSymptoms(cat.name).map(s => (
                <button key={s} onClick={() => handleCategorySearch(selectedCategory, s)}
                  className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-100 transition">
                  {s}
                </button>
              ))}
            </div>

            <Button onClick={() => handleCategorySearch(selectedCategory)} variant="outline"
              className="w-full border-green-300 text-green-700 hover:bg-green-50">
              Browse all {cat.name} remedies with AI questions →
            </Button>
          </Card>
        </main>
      </div>
    )
  }

  // ── MAIN HOME ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">

      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">

          {/* Logo */}
          <button onClick={() => { setQuery(""); setSelectedCategory(null) }}
            className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-xl">🌿</span>
            </div>
            <span className="font-bold text-green-700 text-lg">HomeoWell</span>
          </button>

          <div className="flex items-center gap-1.5">

            {/* Translate button */}
            <div className="relative">
              <button
                onClick={() => setShowTranslate(prev => !prev)}
                className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition ${
                  showTranslate
                    ? "bg-green-50 border-green-300 text-green-700"
                    : "border-gray-200 text-gray-500 hover:text-green-700 hover:bg-green-50"
                }`}
                title="Translate to your language"
              >
                <Globe size={14} />
                <span className="hidden sm:inline">Translate</span>
              </button>

              {/* Language dropdown */}
              {showTranslate && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-52 overflow-hidden">
                  <div className="px-3 py-2 bg-green-50 border-b border-green-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-green-700">Select Language</span>
                    <button onClick={() => setShowTranslate(false)} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => handleTranslateTo(lang.code)}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition border-b border-gray-50 last:border-0"
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {user && (
              <>
                {/* History */}
                <button onClick={toggleHistory}
                  className={`relative flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition ${
                    showHistory
                      ? "bg-green-50 border-green-300 text-green-700"
                      : "border-gray-200 text-gray-500 hover:text-green-700 hover:bg-green-50"
                  }`}>
                  <Clock size={14} />
                  <span className="hidden sm:inline">History</span>
                  {history.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-green-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {Math.min(history.length, 9)}
                    </span>
                  )}
                </button>

                {/* User */}
                <div className="flex items-center gap-1 bg-green-50 px-2 py-1.5 rounded-full border border-green-200">
                  <User size={13} className="text-green-600" />
                  <span className="hidden sm:inline text-xs text-gray-700 max-w-24 truncate">
                    {user.user_metadata?.name || user.email?.split("@")[0]}
                  </span>
                </div>

                {/* Logout */}
                <button onClick={handleLogout}
                  className="text-gray-400 hover:text-red-500 p-1.5 transition" title="Logout">
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Close translate on outside click */}
        {showTranslate && (
          <div className="fixed inset-0 z-40" onClick={() => setShowTranslate(false)} />
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Homeopathic Remedy</h1>
          <p className="text-gray-500">Enter symptoms or select a category below</p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <form onSubmit={handleSearch}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={19} />
                <Input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder=""
                  className="pl-12 pr-4 py-6 text-base rounded-xl border-2 border-green-200 focus:border-green-500 shadow-sm" />
              </div>
              <div className="relative">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                <Button type="button" variant="outline"
                  className="h-full px-3 rounded-xl border-2 border-green-200 hover:border-green-400 flex flex-col items-center justify-center gap-0.5"
                  title="Upload Clinical Report">
                  <Paperclip size={17} className="text-green-600" />
                  <span className="text-xs text-green-600 leading-none">Clinical</span>
                </Button>
              </div>
              <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 rounded-xl font-medium">
                Search
              </Button>
            </div>
          </form>
        </div>

        {/* History Panel */}
        {showHistory && (
          <Card className="mb-6 p-4 border border-green-200 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                <Clock size={15} className="text-green-600" />
                Consultation History
                {history.length > 0 && (
                  <span className="text-xs text-gray-400 font-normal">({history.length} saved)</span>
                )}
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-6 gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600" />
                <span className="text-sm text-gray-400">Loading...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-6">
                <Clock size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No history yet.</p>
                <p className="text-xs text-gray-300 mt-1">Searches save automatically after each consultation.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {history.slice(0, 10).map((h, i) => (
                  <div key={h.id || i}
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-green-50 group border border-transparent hover:border-green-200 transition cursor-pointer"
                    onClick={() => {
                      const syms = Array.isArray(h.symptoms)
                        ? h.symptoms.filter((s: string) =>
                            !s.startsWith("category:") && !s.startsWith("health history:") &&
                            !s.startsWith("age") && !s.startsWith("gender:")).slice(0, 3).join(", ")
                        : ""
                      if (syms) setLocation(`/symptom-analysis?q=${encodeURIComponent(syms)}`)
                    }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 font-medium truncate">{formatSymptoms(h)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {formatTopRemedy(h) && (
                          <span className="text-xs text-green-600 font-medium">{formatTopRemedy(h)}</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {h.created_at ? new Date(h.created_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                          }) : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 shrink-0">
                      <ChevronRight size={14} className="text-gray-400 group-hover:text-green-600" />
                      <button onClick={e => handleDeleteHistory(h.id, e)}
                        className="text-transparent group-hover:text-red-400 hover:!text-red-600 transition p-0.5">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
                {history.length > 10 && (
                  <p className="text-xs text-center text-gray-400 pt-1">
                    Showing 10 of {history.length} consultations
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Categories */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {RUBRIC_CATEGORIES.map(cat => (
              <button key={cat.name} onClick={() => setSelectedCategory(cat.name)}
                className="bg-white border-2 border-gray-100 rounded-xl p-3 text-left hover:border-green-400 hover:shadow-md transition-all group">
                <div className="text-2xl mb-1">{cat.icon}</div>
                <div className="font-medium text-sm text-gray-800 group-hover:text-green-700">{cat.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{cat.desc}</div>
                <div className="text-xs text-green-500 mt-1 opacity-0 group-hover:opacity-100 transition">Tap →</div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          ⚠️ For educational purposes only. Always consult a qualified homeopath.
        </p>
      </main>
    </div>
  )
}
