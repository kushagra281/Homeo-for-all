import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { Search, LogOut, User, Clock, ChevronRight } from "lucide-react"
import { getCurrentUser, signOut, getSearchHistory } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

const RUBRIC_CATEGORIES = [
  { name: "Mind", icon: "🧠", desc: "Mental & Emotional" },
  { name: "Generalities", icon: "🧍", desc: "General Symptoms" },
  { name: "Vertigo", icon: "🧠", desc: "Dizziness, Balance" },
  { name: "Head", icon: "👤", desc: "Headache, Scalp" },
  { name: "Eye", icon: "👁️", desc: "Vision, Pain" },
  { name: "Ear", icon: "👂", desc: "Hearing, Tinnitus" },
  { name: "Nose", icon: "👃", desc: "Cold, Sinusitis" },
  { name: "Face", icon: "😬", desc: "Facial Pain, Skin" },
  { name: "Teeth", icon: "🦷", desc: "Toothache, Gums" },
  { name: "Mouth", icon: "👅", desc: "Ulcers, Taste" },
  { name: "Throat", icon: "🗣️", desc: "Pain, Infection" },
  { name: "Stomach", icon: "🍽️", desc: "Digestion, Nausea" },
  { name: "Abdomen", icon: "🧪", desc: "Pain, Bloating" },
  { name: "Rectum", icon: "🚽", desc: "Piles, Fissure" },
  { name: "Stool", icon: "💩", desc: "Diarrhea, Constipation" },
  { name: "Bladder", icon: "🚻", desc: "Urinary Complaints" },
  { name: "Urine", icon: "🚻", desc: "Infection, Burning" },
  { name: "Male Genitalia", icon: "🧬", desc: "Male Complaints" },
  { name: "Female Genitalia", icon: "🧬", desc: "Female Complaints" },
  { name: "Pregnancy", icon: "🤰", desc: "Maternity, Labor" },
  { name: "Respiration", icon: "🫁", desc: "Breathing Issues" },
  { name: "Cough", icon: "🗣️", desc: "Dry, Wet, Chronic" },
  { name: "Chest", icon: "🫀", desc: "Lungs, Bronchitis" },
  { name: "Heart", icon: "❤️", desc: "Palpitations, Pain" },
  { name: "Back", icon: "🦴", desc: "Spine, Lumbago" },
  { name: "Extremities", icon: "🦵", desc: "Joints, Limbs" },
  { name: "Sleep", icon: "😴", desc: "Insomnia, Dreams" },
  { name: "Chill", icon: "🌡️", desc: "Cold, Shivering" },
  { name: "Fever", icon: "🔥", desc: "Temperature, Heat" },
  { name: "Perspiration", icon: "💦", desc: "Sweating, Night sweats" },
  { name: "Skin", icon: "🧴", desc: "Rashes, Eruptions" },
  { name: "Generals", icon: "⚡", desc: "Modalities, Weather" },
  { name: "Clinical", icon: "🧪", desc: "Pathological, Diagnosis" },
]

export default function Home() {
  const [, setLocation] = useLocation()
  const [user, setUser] = useState(null)
  const [query, setQuery] = useState("")
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    getCurrentUser().then(u => {
      setUser(u)
      if (u) {
        getSearchHistory().then(setHistory)
      }
    })
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    // Go directly to symptom analysis with query
    setLocation(`/symptom-analysis?q=${encodeURIComponent(query.trim())}`)
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch(e)
  }

  const handleRubricClick = (category) => {
    setLocation(`/symptom-analysis?category=${encodeURIComponent(category)}`)
  }

  const handleLogout = async () => {
    await signOut()
    setUser(null)
    setHistory([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="font-bold text-green-700 text-lg">HomeoWell</span>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-green-700"
                >
                  <Clock size={16} />
                  <span className="hidden sm:inline">History</span>
                </button>
                <div className="flex items-center gap-1 text-sm text-gray-700 bg-green-50 px-3 py-1 rounded-full">
                  <User size={14} />
                  <span className="hidden sm:inline">{user.user_metadata?.name || user.email}</span>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-500">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Button
                onClick={() => setLocation("/auth")}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Find Your Homeopathic Remedy
          </h1>
          <p className="text-gray-500 text-base">
            Enter your symptoms and get AI-powered remedy suggestions
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <form onSubmit={handleSearch}>
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. headache with fever, anxiety at night, joint pain..."
                  className="pl-12 pr-4 py-4 text-base rounded-xl border-2 border-green-200 focus:border-green-500 shadow-sm"
                />
              </div>
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl text-base font-medium"
              >
                Search
              </Button>
            </div>
          </form>

          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {["Headache", "Anxiety", "Fever", "Joint pain", "Insomnia", "Cold"].map(s => (
              <button
                key={s}
                onClick={() => {
                  setQuery(s)
                  setLocation(`/symptom-analysis?q=${encodeURIComponent(s)}`)
                }}
                className="text-xs bg-white border border-green-200 text-green-700 px-3 py-1 rounded-full hover:bg-green-50 transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Search History */}
        {showHistory && history.length > 0 && (
          <Card className="mb-6 p-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock size={16} /> Recent Searches
            </h3>
            <div className="space-y-2">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => setLocation(`/symptom-analysis?q=${encodeURIComponent(h.symptoms?.join(", ") || "")}`)}
                  className="w-full text-left flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 group"
                >
                  <span className="text-sm text-gray-600">{h.symptoms?.join(", ")}</span>
                  <ChevronRight size={14} className="text-gray-400 group-hover:text-green-600" />
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Rubrics Section */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Browse by Rubric Category
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {RUBRIC_CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleRubricClick(cat.name)}
                className="bg-white border border-gray-100 rounded-xl p-3 text-left hover:border-green-400 hover:shadow-md transition-all group"
              >
                <div className="text-2xl mb-1">{cat.icon}</div>
                <div className="font-medium text-gray-800 text-sm group-hover:text-green-700">
                  {cat.name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{cat.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-8">
          ⚠️ For educational purposes only. Always consult a qualified homeopath.
        </p>
      </main>
    </div>
  )
}
