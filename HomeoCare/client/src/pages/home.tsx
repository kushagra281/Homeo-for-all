import { useState, useEffect, useRef } from "react"
import { useLocation } from "wouter"
import {
  Search, LogOut, User, Clock, ChevronRight,
  Paperclip, ArrowLeft, Save, Globe
} from "lucide-react"
import { getCurrentUser, signOut, getSearchHistory } from "@/lib/supabase"
import supabase from "@/lib/supabase"
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
  { name: "Face", icon: "😬", desc: "Facial Pain, Skin" },
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

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "bn", label: "বাংলা" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ml", label: "മലയാളം" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "اردو" },
]

declare global {
  interface Window {
    googleTranslateElementInit?: () => void
    google?: any
  }
}

// ── COMPACT TRANSLATE WIDGET ─────────────────────────────────
function TranslateWidget() {
  const [open, setOpen] = useState(false)
  const [activeLang, setActiveLang] = useState("en")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load Google Translate script only once
    if (!document.getElementById("google-translate-script")) {
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          { pageLanguage: "en", autoDisplay: false },
          "google_translate_hidden"
        )
      }
      const s = document.createElement("script")
      s.id = "google-translate-script"
      s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
      s.async = true
      document.head.appendChild(s)
    }

    // Close dropdown when clicking outside
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const selectLang = (code: string) => {
    setActiveLang(code)
    setOpen(false)
    // Find hidden Google Translate combo and trigger it
    const combo = document.querySelector(".goog-te-combo") as HTMLSelectElement | null
    if (combo) {
      combo.value = code
      combo.dispatchEvent(new Event("change"))
    } else {
      // Retry after script loads
      setTimeout(() => {
        const c = document.querySelector(".goog-te-combo") as HTMLSelectElement | null
        if (c) { c.value = code; c.dispatchEvent(new Event("change")) }
      }, 1500)
    }
  }

  const current = LANGUAGES.find(l => l.code === activeLang)

  return (
    <>
      {/* Hidden Google Translate mount point */}
      <div id="google_translate_hidden" style={{ display: "none", position: "absolute" }} />

      {/* Custom compact trigger */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 transition text-xs text-green-700 font-medium"
          title="Select language"
        >
          <Globe size={13} />
          <span className="hidden sm:inline">{current?.label || "EN"}</span>
          <span className="text-green-400 text-xs">▾</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => selectLang(lang.code)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-green-50 transition ${
                  activeLang === lang.code ? "bg-green-50 text-green-700 font-semibold" : "text-gray-700"
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

// ── HEALTH HISTORY PROFILE VIEW ──────────────────────────────
function ProfileView({
  user,
  history,
  onBack,
  onLogout,
  onNavigate,
}: {
  user: any
  history: any[]
  onBack: () => void
  onLogout: () => void
  onNavigate: (path: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"history" | "health">("health")

  const [health, setHealth] = useState({
    name: "",
    age: "",
    gender: "",
    height: "",
    weight: "",
    diabetes: "none",
    blood_pressure: "normal",
    obesity: "no",
    hairfall: "none",
    injury_operation: "",
    other_conditions: "",
  })

  useEffect(() => {
    supabase
      .from("patients")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setHealth({
            name: data.name || "",
            age: data.age ? String(data.age) : "",
            gender: data.gender || "",
            height: data.height || "",
            weight: data.weight || "",
            diabetes: data.diabetes || "none",
            blood_pressure: data.blood_pressure || "normal",
            obesity: data.obesity || "no",
            hairfall: data.hairfall || "none",
            injury_operation: data.injury_operation || "",
            other_conditions: data.other_conditions || "",
          })
        }
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await supabase.from("patients").upsert({
      id: user.id,
      email: user.email,
      name: health.name,
      age: parseInt(health.age) || null,
      gender: health.gender,
      height: health.height,
      weight: health.weight,
      diabetes: health.diabetes,
      blood_pressure: health.blood_pressure,
      obesity: health.obesity,
      hairfall: health.hairfall,
      injury_operation: health.injury_operation,
      other_conditions: health.other_conditions,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const set = (key: string, val: string) => setHealth(p => ({ ...p, [key]: val }))

  const ToggleGroup = ({
    field, options,
  }: { field: string; options: { val: string; label: string }[] }) => (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.val}
          onClick={() => set(field, o.val)}
          className={`px-3 py-1.5 rounded-full text-xs border-2 font-medium transition ${
            (health as any)[field] === o.val
              ? "border-green-500 bg-green-50 text-green-700"
              : "border-gray-200 text-gray-500 hover:border-green-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2">
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🌿</span>
            </div>
            <span className="font-bold text-green-700 text-lg">HomeoWell</span>
          </button>
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-16">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700">
            {health.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="font-bold text-gray-900">{health.name || user?.email?.split("@")[0]}</p>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {(["health", "history"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-green-600 text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-green-300"
              }`}
            >
              {tab === "health" ? "🩺 Health Profile" : "📋 History"}
            </button>
          ))}
        </div>

        {/* ── HEALTH PROFILE TAB ── */}
        {activeTab === "health" && (
          <Card className="p-5 space-y-5">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin h-6 w-6 border-b-2 border-green-600 rounded-full" />
              </div>
            ) : (
              <>
                {/* Basic */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">Basic Info</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Full Name</label>
                      <Input value={health.name} onChange={e => set("name", e.target.value)} placeholder="Your name" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Age</label>
                      <Input value={health.age} onChange={e => set("age", e.target.value)} placeholder="e.g. 35" type="number" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Height (cm)</label>
                      <Input value={health.height} onChange={e => set("height", e.target.value)} placeholder="e.g. 170" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Weight (kg)</label>
                      <Input value={health.weight} onChange={e => set("weight", e.target.value)} placeholder="e.g. 70" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-gray-500 block mb-2">Gender</label>
                    <ToggleGroup field="gender" options={[
                      { val: "male", label: "Male" },
                      { val: "female", label: "Female" },
                      { val: "other", label: "Other" },
                    ]} />
                  </div>
                </div>

                {/* Diabetes */}
                <div>
                  <label className="text-xs text-gray-500 block mb-2 font-semibold">🍬 Diabetes</label>
                  <ToggleGroup field="diabetes" options={[
                    { val: "none", label: "None" },
                    { val: "type1", label: "Type 1" },
                    { val: "type2", label: "Type 2" },
                    { val: "prediabetes", label: "Pre-Diabetes" },
                    { val: "gestational", label: "Gestational" },
                  ]} />
                </div>

                {/* Blood Pressure */}
                <div>
                  <label className="text-xs text-gray-500 block mb-2 font-semibold">❤️ Blood Pressure</label>
                  <ToggleGroup field="blood_pressure" options={[
                    { val: "normal", label: "Normal" },
                    { val: "high", label: "High (Hypertension)" },
                    { val: "low", label: "Low (Hypotension)" },
                    { val: "borderline", label: "Borderline" },
                  ]} />
                </div>

                {/* Obesity */}
                <div>
                  <label className="text-xs text-gray-500 block mb-2 font-semibold">⚖️ Obesity / Weight Issue</label>
                  <ToggleGroup field="obesity" options={[
                    { val: "no", label: "No" },
                    { val: "overweight", label: "Overweight" },
                    { val: "obese", label: "Obese" },
                    { val: "underweight", label: "Underweight" },
                  ]} />
                </div>

                {/* Hairfall */}
                <div>
                  <label className="text-xs text-gray-500 block mb-2 font-semibold">💇 Hair Fall</label>
                  <ToggleGroup field="hairfall" options={[
                    { val: "none", label: "None" },
                    { val: "mild", label: "Mild" },
                    { val: "moderate", label: "Moderate" },
                    { val: "severe", label: "Severe" },
                    { val: "alopecia", label: "Alopecia" },
                  ]} />
                </div>

                {/* Injury / Operation */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-semibold">🏥 Injury / Operation History</label>
                  <textarea
                    value={health.injury_operation}
                    onChange={e => set("injury_operation", e.target.value)}
                    placeholder="e.g. Appendix removed 2018, knee fracture 2021..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none resize-none h-20"
                  />
                </div>

                {/* Other Conditions */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1 font-semibold">🩺 Other Chronic Conditions</label>
                  <textarea
                    value={health.other_conditions}
                    onChange={e => set("other_conditions", e.target.value)}
                    placeholder="e.g. Asthma, Thyroid, Gastritis, Arthritis..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none resize-none h-20"
                  />
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl"
                >
                  {saving ? (
                    <span className="flex items-center gap-2 justify-center">
                      <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />
                      Saving...
                    </span>
                  ) : saved ? "✓ Saved!" : (
                    <span className="flex items-center gap-2 justify-center">
                      <Save size={16} /> Save Health Profile
                    </span>
                  )}
                </Button>
              </>
            )}
          </Card>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <Card className="p-5">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-green-600" /> Consultation History
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">
                No consultations yet. Search for symptoms to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {history.slice(0, 15).map((h: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => onNavigate(`/symptom-analysis?q=${encodeURIComponent(h.symptoms?.join(", ") || "")}`)}
                    className="p-3 bg-green-50 rounded-xl border border-green-100 cursor-pointer hover:border-green-400 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {h.symptoms?.join(", ") || "—"}
                        </p>
                        {h.results?.[0]?.remedy?.name && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Top: {h.results[0].remedy.name}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 ml-2 shrink-0">
                        {h.created_at ? new Date(h.created_at).toLocaleDateString("en-IN") : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        <Button
          onClick={onLogout}
          variant="outline"
          className="w-full mt-4 border-red-200 text-red-500 hover:bg-red-50"
        >
          <LogOut size={15} className="mr-2" /> Sign Out
        </Button>
      </main>
    </div>
  )
}

// ── MAIN HOME COMPONENT ───────────────────────────────────────
export default function Home() {
  const [, setLocation] = useLocation()
  const [user, setUser] = useState<any>(null)
  const [query, setQuery] = useState("")
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryQuery, setCategoryQuery] = useState("")

  useEffect(() => {
    getCurrentUser().then(u => {
      if (!u) { setLocation("/auth"); return }
      setUser(u)
      getSearchHistory().then(setHistory)
    })
  }, [])

  const handleLogout = async () => {
    await signOut()
    setLocation("/auth")
  }

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLocation(`/symptom-analysis?q=${encodeURIComponent(query.trim())}`)
  }

  const handleCategoryOpen = (cat: string) => {
    setSelectedCategory(cat)
    setCategoryQuery("")
  }

  const handleCategorySearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    const params = new URLSearchParams()
    params.set("category", selectedCategory!)
    if (categoryQuery.trim()) params.set("q", categoryQuery.trim())
    setLocation(`/symptom-analysis?${params.toString()}`)
  }

  const handleFileUpload = () => {
    setLocation(`/symptom-analysis?category=Clinical`)
  }

  // ── PROFILE VIEW ──
  if (showProfile) {
    return (
      <ProfileView
        user={user}
        history={history}
        onBack={() => setShowProfile(false)}
        onLogout={handleLogout}
        onNavigate={(path) => { setShowProfile(false); setLocation(path) }}
      />
    )
  }

  // ── CATEGORY VIEW ──
  if (selectedCategory) {
    const cat = RUBRIC_CATEGORIES.find(c => c.name === selectedCategory)!
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
          <div className="max-w-4
