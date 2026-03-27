import { useState, useEffect, useRef } from "react"
import { useLocation } from "wouter"
import { Search, LogOut, User, Clock, ChevronRight, Paperclip, ArrowLeft, Globe, X } from "lucide-react"
import { getCurrentUser, signOut, getSearchHistory } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const RUBRIC_CATEGORIES = [
  { name: "Mind", icon: "🧠", desc: "Mental & Emotional" },
  { name: "Head", icon: "👤", desc: "Headache, Vertigo" },
  { name: "Eye", icon: "👁️", desc: "Vision, Pain" },
  { name: "Ear", icon: "👂", desc: "Hearing, Tinnitus" },
  { name: "Nose", icon: "👃", desc: "Cold, Sinusitis" },
  { name: "Face", icon: "😬", desc: "Facial Pain" },
  { name: "Mouth", icon: "👄", desc: "Ulcers, Dryness" },
  { name: "Tongue", icon: "👅", desc: "Coating, Pain" },
  { name: "Taste", icon: "🫧", desc: "Bitter, Metallic" },
  { name: "Gums", icon: "🦷", desc: "Swelling, Bleeding" },
  { name: "Teeth", icon: "🦷", desc: "Toothache, Decay" },
  { name: "Throat", icon: "🗣️", desc: "Pain, Infection" },
  { name: "Stomach", icon: "🍽️", desc: "Digestion, Nausea" },
  { name: "Abdomen", icon: "🫃", desc: "Pain, Bloating" },
  { name: "Urinary System", icon: "🚻", desc: "Infection, Burning" },
  { name: "Male Genitalia", icon: "🧬", desc: "Male Complaints" },
  { name: "Female Genitalia", icon: "🧬", desc: "Female Complaints" },
  { name: "Heart", icon: "❤️", desc: "Palpitations, Pain" },
  { name: "Hands, Legs & Back", icon: "🦴", desc: "Joints, Spine" },
  { name: "Respiration", icon: "🫁", desc: "Breathing, Cough" },
  { name: "Skin", icon: "🧴", desc: "Rashes, Eruptions" },
  { name: "Fever", icon: "🌡️", desc: "Temperature, Chills" },
  { name: "Nervous System", icon: "⚡", desc: "Nerves, Neurological" },
  { name: "Others", icon: "🔵", desc: "General, Misc" },
]

function getCommonSymptoms(category: string): string[] {
  const map: Record<string, string[]> = {
    "Mind": ["Anxiety", "Depression", "Anger", "Fear", "Grief", "Sleeplessness"],
    "Head": ["Throbbing headache", "One-sided headache", "Headache with nausea", "Vertigo"],
    "Fever": ["High fever", "Fever with chills", "Fever with sweating", "Low-grade fever"],
    "Stomach": ["Nausea", "Acidity", "Bloating", "Loss of appetite", "Vomiting"],
    "Respiration": ["Dry cough", "Wet cough", "Breathlessness", "Wheezing"],
    "Skin": ["Itching", "Rash", "Eczema", "Dry skin", "Hives"],
    "Hands, Legs & Back": ["Joint pain", "Back pain", "Stiffness", "Swollen joints"],
    "Urinary System": ["Burning urination", "Frequent urination", "UTI symptoms"],
    "Heart": ["Palpitations", "Chest pain", "High BP symptoms"],
    "Eye": ["Redness", "Itching eyes", "Watering", "Pain in eye"],
    "Ear": ["Earache", "Ringing in ear", "Ear discharge"],
    "Nose": ["Blocked nose", "Running nose", "Sneezing fits"],
    "Throat": ["Sore throat", "Difficulty swallowing", "Hoarseness"],
    "Female Genitalia": ["Irregular menses", "Painful periods", "White discharge", "PMS"],
  }
  return map[category] || ["Pain", "Swelling", "Discharge", "Weakness", "Fever"]
}

export default function Home() {
  const [, setLocation] = useLocation()
  const [user, setUser] = useState<any>(null)
  const [query, setQuery] = useState("")
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryQuery, setCategoryQuery] = useState("")
  const [showTranslate, setShowTranslate] = useState(false)
  const translateRef = useRef<HTMLDivElement>(null)

  // Load Google Translate script
  useEffect(() => {
    if ((window as any).googleTranslateLoaded) return
    ;(window as any).googleTranslateLoaded = true
    ;(window as any).googleTranslateElementInit = () => {
      new (window as any).google.translate.TranslateElement({
        pageLanguage: "en",
        includedLanguages: "hi,en,ur,gu,mr,pa,bn,ta,te,kn,ml,ar,fr,de,es,zh-CN",
        layout: (window as any).google?.translate?.TranslateElement?.InlineLayout?.SIMPLE,
        autoDisplay: false,
      }, "google_translate_element")
    }
    const script = document.createElement("script")
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
    script.async = true
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    getCurrentUser().then(u => {
      if (!u) { setLocation("/auth"); return }
      setUser(u)
      loadHistory()
    })
  }, [])

  const loadHistory = async () => {
    const h = await getSearchHistory()
    setHistory(h || [])
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
    if (e.target.files?.length) {
      setLocation(`/symptom-analysis?category=Clinical`)
    }
  }

  const handleLogout = async () => {
    await signOut()
    setLocation("/auth")
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
                  <Input
                    value={categoryQuery}
                    onChange={e => setCategoryQuery(e.target.value)}
                    placeholder=""
                    className="pl-10 py-5 border-2 border-green-200 focus:border-green-500"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 px-5">Search</Button>
              </div>
            </form>

            <div>
              <p className="text-xs text-gray-400 mb-2">Common symptoms:</p>
              <div className="flex flex-wrap gap-2">
                {getCommonSymptoms(cat.name).map(s => (
                  <button key={s} onClick={() => handleCategorySearch(selectedCategory, s)}
                    className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-100 transition">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t">
              <Button onClick={() => handleCategorySearch(selectedCategory)} variant="outline"
                className="w-full border-green-300 text-green-700 hover:bg-green-50">
                Browse all {cat.name} remedies with AI questions →
              </Button>
            </div>
          </Card>
        </main>
      </div>
    )
  }

  // ── MAIN HOME ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {/* Google Translate hidden container */}
      <div id="google_translate_element" className="hidden" ref={translateRef} />

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
            <button
              onClick={() => setShowTranslate(prev => !prev)}
              className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition ${showTranslate ? "bg-green-50 border-green-300 text-green-700" : "border-gray-200 text-gray-500 hover:text-green-700 hover:bg-green-50"}`}
              title="Translate page"
            >
              <Globe size={14} />
              <span className="hidden sm:inline">Translate</span>
            </button>

            {user && (
              <>
                {/* History button */}
                <button
                  onClick={() => { setShowHistory(prev => !prev); if (!showHistory) loadHistory() }}
                  className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition ${showHistory ? "bg-green-50 border-green-300 text-green-700" : "border-gray-200 text-gray-500 hover:text-green-700 hover:bg-green-50"}`}
                >
                  <Clock size={14} />
                  <span className="hidden sm:inline">History</span>
                  {history.length > 0 && (
                    <span className="bg-green-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
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
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 p-1.5" title="Logout">
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Google Translate dropdown */}
        {showTranslate && (
          <div className="bg-green-50 border-t border-green-100 px-4 py-3">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <Globe size={16} className="text-green-600 shrink-0" />
              <div id="google_translate_element" className="flex-1" />
              <button onClick={() => setShowTranslate(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Homeopathic Remedy</h1>
          <p className="text-gray-500">Enter symptoms or select a category below</p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <form onSubmit={handleSearch}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={19} />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder=""
                  className="pl-12 pr-4 py-6 text-base rounded-xl border-2 border-green-200 focus:border-green-500 shadow-sm"
                />
              </div>

              {/* Clinical upload */}
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
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
          <Card className="mb-6 p-4 border-green-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2 text-sm">
                <Clock size={15} className="text-green-600" /> Consultation History
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No history yet. Search for remedies to save history.</p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 8).map((h, i) => (
                  <button key={i}
                    onClick={() => setLocation(`/symptom-analysis?q=${encodeURIComponent(h.symptoms?.slice(0, 3).join(", ") || "")}`)}
                    className="w-full text-left flex items-center justify-between p-2.5 rounded-lg hover:bg-green-50 group border border-transparent hover:border-green-200 transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">
                        {h.symptoms?.slice(0, 3).join(", ")}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {h.created_at ? new Date(h.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                        {h.results?.length > 0 ? ` · ${Math.min(h.results.length, 3)} remedies found` : ""}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 group-hover:text-green-600 shrink-0 ml-2" />
                  </button>
                ))}
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
