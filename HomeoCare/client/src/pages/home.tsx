import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { Search, LogOut, User, Clock, ChevronRight, Paperclip } from "lucide-react"
import { getCurrentUser, signOut, getSearchHistory } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

const RUBRIC_CATEGORIES = [
  { name: "Mind", icon: "🧠", desc: "Mental & Emotional" },
  { name: "Head", icon: "👤", desc: "Headache, Vertigo" },
  { name: "Eye", icon: "👁️", desc: "Vision, Pain" },
  { name: "Ear", icon: "👂", desc: "Hearing, Tinnitus" },
  { name: "Nose", icon: "👃", desc: "Cold, Sinusitis" },
  { name: "Face", icon: "😬", desc: "Facial Pain, Skin" },
  { name: "Mouth", icon: "👄", desc: "Ulcers, Taste" },
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

export default function Home() {
  const [, setLocation] = useLocation()
  const [user, setUser] = useState<any>(null)
  const [query, setQuery] = useState("")
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    getCurrentUser().then(u => {
      if (!u) {
        setLocation("/auth")
        return
      }
      setUser(u)
      getSearchHistory().then(setHistory)
    })
  }, [])

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim() && !selectedCategory) return
    const params = new URLSearchParams()
    if (query.trim()) params.set("q", query.trim())
    if (selectedCategory) params.set("category", selectedCategory)
    setLocation(`/symptom-analysis?${params.toString()}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch()
  }

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(prev => prev === category ? null : category)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLocation(`/symptom-analysis?category=Clinical`)
  }

  const handleLogout = async () => {
    await signOut()
    setLocation("/auth")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo as home button */}
          <button
            onClick={() => { setQuery(""); setSelectedCategory(null); setLocation("/") }}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🌿</span>
            </div>
            <span className="font-bold text-green-700 text-lg">HomeoWell</span>
          </button>

          <div className="flex items-center gap-2">
            {user && (
              <>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-green-700 px-2 py-1 rounded-lg hover:bg-green-50"
                >
                  <Clock size={15} />
                  <span className="hidden sm:inline text-xs">History</span>
                </button>
                <div className="flex items-center gap-1 bg-green-50 px-3 py-1 rounded-full">
                  <User size={14} className="text-gray-600" />
                  <span className="hidden sm:inline text-xs text-gray-700">
                    {user.user_metadata?.name || user.email}
                  </span>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 p-1">
                  <LogOut size={17} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">

        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Find Your Homeopathic Remedy
          </h1>
          <p className="text-gray-500 text-base">
            Enter symptoms or select a category below
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <form onSubmit={handleSearch}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. headache with fever, anxiety at night..."
                  className="pl-12 pr-4 py-6 text-base rounded-xl border-2 border-green-200 focus:border-green-500 shadow-sm"
                />
              </div>

              {/* Clinical file upload */}
              <div className="relative">
                <input
                  type="file"
                  id="file-upload"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-full px-3 rounded-xl border-2 border-green-200 hover:border-green-400 hover:bg-green-50 flex flex-col items-center justify-center gap-0.5"
                  title="Upload Clinical Report / Photo for AI diagnosis"
                >
                  <Paperclip size={18} className="text-green-600" />
                  <span className="text-xs text-green-600 leading-none">Clinical</span>
                </Button>
              </div>

              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 rounded-xl text-base font-medium"
              >
                Search
              </Button>
            </div>
          </form>

          {/* Selected category indicator */}
          {selectedCategory && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">Selected:</span>
              <span className="bg-green-100 text-green-700 text-sm px-3 py-1 rounded-full font-medium flex items-center gap-1">
                {selectedCategory}
                <button onClick={() => setSelectedCategory(null)} className="ml-1 hover:text-red-500 font-bold">×</button>
              </span>
              <button
                onClick={() => setLocation(`/symptom-analysis?category=${encodeURIComponent(selectedCategory)}`)}
                className="text-sm text-green-600 underline hover:text-green-800"
              >
                Search in this category →
              </button>
            </div>
          )}

          {/* Quick suggestions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {["Headache", "Anxiety", "Fever", "Joint pain", "Insomnia", "Cold"].map(s => (
              <button
                key={s}
                onClick={() => setLocation(`/symptom-analysis?q=${encodeURIComponent(s)}`)}
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
            <div className="space-y-1">
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

        {/* Categories */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {RUBRIC_CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                onClick={() => handleCategoryClick(cat.name)}
                className={`rounded-xl p-3 text-left transition-all border-2 ${
                  selectedCategory === cat.name
                    ? "border-green-500 bg-green-50 shadow-md"
                    : "bg-white border-gray-100 hover:border-green-300 hover:shadow-sm"
                }`}
              >
                <div className="text-2xl mb-1">{cat.icon}</div>
                <div className={`font-medium text-sm ${selectedCategory === cat.name ? "text-green-700" : "text-gray-800"}`}>
                  {cat.name}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{cat.desc}</div>
                {selectedCategory === cat.name && (
                  <div className="text-xs text-green-600 mt-1 font-medium">✓ Selected</div>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Select a category then press Search, or click "Search in this category"
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ⚠️ For educational purposes only. Always consult a qualified homeopath.
        </p>
      </main>
    </div>
  )
}
