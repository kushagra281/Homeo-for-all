import { useState, useEffect, useRef } from "react"
import { useLocation } from "wouter"
import { Search, LogOut, User, Clock, ChevronRight, Paperclip, ArrowLeft, Save, Globe } from "lucide-react"
import { getCurrentUser, signOut, getSearchHistory } from "@/lib/supabase"
import supabase from "@/lib/supabase"
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
const LANGS = [
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
function TranslateWidget() {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState("en")
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!document.getElementById("gt-script")) {
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          { pageLanguage: "en", autoDisplay: false },
          "gt-hidden"
        )
      }
      const s = document.createElement("script")
      s.id = "gt-script"
      s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
      s.async = true
      document.head.appendChild(s)
    }
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  const pick = (code: string) => {
    setActive(code)
    setOpen(false)
    const attempt = () => {
      const sel = document.querySelector(".goog-te-combo") as HTMLSelectElement | null
      if (sel) { sel.value = code; sel.dispatchEvent(new Event("change")) }
      else setTimeout(attempt, 800)
    }
    attempt()
  }
  return (
    <>
      <div id="gt-hidden" style={{ display: "none", position: "absolute" }} />
      <style>{`
        body { top: 0 !important; }
        .goog-te-banner-frame { display: none !important; }
        #gt-hidden { display: none !important; }
      `}</style>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 text-xs text-green-700 font-medium transition"
        >
          <Globe size={13} />
          <span className="hidden sm:inline">{LANGS.find(l => l.code === active)?.label ?? "EN"}</span>
          <span className="text-green-400">▾</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
            {LANGS.map(l => (
              <button
                key={l.code}
                onClick={() => pick(l.code)}
                className={`w-full text-left px-3 py-2 text-xs transition ${
                  active === l.code ? "bg-green-50 text-green-700 font-semibold" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
function ProfileView({
  user, history, onBack, onLogout, onGo,
}: {
  user: any; history: any[]; onBack: () => void; onLogout: () => void; onGo: (p: string) => void
}) {
  const [tab, setTab] = useState<"health" | "history">("health")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [h, setH] = useState({
    name: "", age: "", gender: "", height: "", weight: "",
    diabetes: "none", blood_pressure: "normal",
    obesity: "no", hairfall: "none",
    injury_operation: "", other_conditions: "",
  })
  useEffect(() => {
    supabase.from("patients").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) setH({
        name: data.name ?? "", age: data.age ? String(data.age) : "",
        gender: data.gender ?? "", height: data.height ?? "", weight: data.weight ?? "",
        diabetes: data.diabetes ?? "none", blood_pressure: data.blood_pressure ?? "normal",
        obesity: data.obesity ?? "no", hairfall: data.hairfall ?? "none",
        injury_operation: data.injury_operation ?? "", other_conditions: data.other_conditions ?? "",
      })
      setLoading(false)
    })
  }, [])
  const set = (k: string, v: string) => setH(p => ({ ...p, [k]: v }))
  const save = async () => {
    setSaving(true)
    await supabase.from("patients").upsert({
      id: user.id, email: user.email,
      name: h.name, age: parseInt(h.age) || null, gender: h.gender,
      height: h.height, weight: h.weight,
      diabetes: h.diabetes, blood_pressure: h.blood_pressure,
      obesity: h.obesity, hairfall: h.hairfall,
      injury_operation: h.injury_operation, other_conditions: h.other_conditions,
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }
  const Chip = ({ field, val, label }: { field: string; val: string; label: string }) => (
    <button
      onClick={() => set(field, val)}
      className={`px-3 py-1.5 rounded-full text-xs border-2 font-medium transition ${
        (h as any)[field] === val
          ? "border-green-500 bg-green-50 text-green-700"
          : "border-gray-200 text-gray-500 hover:border-green-300"
      }`}
    >
      {label}
    </button>
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
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center text-2xl font-bold text-green-700">
            {h.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="font-bold text-gray-900">{h.name || user?.email?.split("@")[0]}</p>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>
        <div className="flex gap-2 mb-5">
          {(["health", "history"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition ${
                tab === t ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-500 hover:border-green-300"
              }`}
            >
              {t === "health" ? "🩺 Health Profile" : "📋 History"}
            </button>
          ))}
        </div>
        {tab === "health" && (
          <Card className="p-5 space-y-5">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-b-2 border-green-600 rounded-full" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Basic Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Full Name</label>
                      <Input value={h.name} onChange={e => set("name", e.target.value)} placeholder="Your name" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Age</label>
                      <Input value={h.age} onChange={e => set("age", e.target.value)} placeholder="e.g. 35" type="number" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Height (cm)</label>
                      <Input value={h.height} onChange={e => set("height", e.target.value)} placeholder="e.g. 170" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Weight (kg)</label>
                      <Input value={h.weight} onChange={e => set("weight", e.target.value)} placeholder="e.g. 70" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-gray-400 block mb-2">Gender</label>
                    <div className="flex gap-2">
                      <Chip field="gender" val="male" label="Male" />
                      <Chip field="gender" val="female" label="Female" />
                      <Chip field="gender" val="other" label="Other" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">🍬 Diabetes</label>
                  <div className="flex flex-wrap gap-2">
                    <Chip field="diabetes" val="none" label="None" />
                    <Chip field="diabetes" val="type1" label="Type 1" />
                    <Chip field="diabetes" val="type2" label="Type 2" />
                    <Chip field="diabetes" val="prediabetes" label="Pre-Diabetes" />
                    <Chip field="diabetes" val="gestational" label="Gestational" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">❤️ Blood Pressure</label>
                  <div className="flex flex-wrap gap-2">
                    <Chip field="blood_pressure" val="normal" label="Normal" />
                    <Chip field="blood_pressure" val="high" label="High (Hypertension)" />
                    <Chip field="blood_pressure" val="low" label="Low (Hypotension)" />
                    <Chip field="blood_pressure" val="borderline" label="Borderline" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">⚖️ Obesity / Weight</label>
                  <div className="flex flex-wrap gap-2">
                    <Chip field="obesity" val="no" label="Normal" />
                    <Chip field="obesity" val="overweight" label="Overweight" />
                    <Chip field="obesity" val="obese" label="Obese" />
                    <Chip field="obesity" val="underweight" label="Underweight" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">💇 Hair Fall</label>
                  <div className="flex flex-wrap gap-2">
                    <Chip field="hairfall" val="none" label="None" />
                    <Chip field="hairfall" val="mild" label="Mild" />
                    <Chip field="hairfall" val="moderate" label="Moderate" />
                    <Chip field="hairfall" val="severe" label="Severe" />
                    <Chip field="hairfall" val="alopecia" label="Alopecia" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">🏥 Injury / Operation History</label>
                  <textarea
                    value={h.injury_operation}
                    onChange={e => set("injury_operation", e.target.value)}
                    placeholder="e.g. Appendix removed 2018, knee fracture 2021..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none resize-none h-20"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">🩺 Other Chronic Conditions</label>
                  <textarea
                    value={h.other_conditions}
                    onChange={e => set("other_conditions", e.target.value)}
                    placeholder="e.g. Asthma, Thyroid, Gastritis, Arthritis, PCOD..."
                    className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:border-green-400 outline-none resize-none h-20"
                  />
                </div>
                <Button
                  onClick={save}
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
        {tab === "history" && (
          <Card className="p-5">
            <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Clock size={16} className="text-green-600" /> Consultation History
            </h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No consultations yet. Search symptoms to start.</p>
            ) : (
              <div className="space-y-3">
                {history.slice(0, 15).map((item: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => onGo(`/symptom-analysis?q=${encodeURIComponent(item.symptoms?.join(", ") || "")}`)}
                    className="p-3 bg-green-50 rounded-xl border border-green-100 cursor-pointer hover:border-green-400 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.symptoms?.join(", ") || "—"}</p>
                        {item.results?.[0]?.remedy?.name && (
                          <p className="text-xs text-green-600 mt-0.5">Top: {item.results[0].remedy.name}</p>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 ml-2 shrink-0">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString("en-IN") : ""}
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
  const handleLogout = async () => { await signOut(); setLocation("/auth") }
  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLocation(`/symptom-analysis?q=${encodeURIComponent(query.trim())}`)
  }
  const handleCategorySearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    const p = new URLSearchParams()
    p.set("category", selectedCategory!)
    if (categoryQuery.trim()) p.set("q", categoryQuery.trim())
    setLocation(`/symptom-analysis?${p.toString()}`)
  }
  if (showProfile) {
    return (
      <ProfileView
        user={user}
        history={history}
        onBack={() => setShowProfile(false)}
        onLogout={handleLogout}
        onGo={(path) => { setShowProfile(false); setLocation(path) }}
      />
    )
  }
  if (selectedCategory) {
    const cat = RUBRIC_CATEGORIES.find(c => c.name === selectedCategory)!
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => { setSelectedCategory(null); setCategoryQuery("") }}
              className="flex items-center gap-2 hover:opacity-80 transition">
              <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">🌿</span>
              </div>
              <span className="font-bold text-green-700 text-lg">HomeoWell</span>
            </button>
            <button onClick={() => { setSelectedCategory(null); setCategoryQuery("") }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="text-5xl mb-3">{cat.icon}</div>
            <h1 className="text-2xl font-bold text-gray-900">{cat.name}</h1>
            <p className="text-gray-500 text-sm mt-1">{cat.desc}</p>
          </div>
          <Card className="p-6">
            <h2 className="font-semibold text-gray-800 mb-4">
              Search symptoms in <span className="text-green-700">{cat.name}</span>
            </h2>
            <form onSubmit={handleCategorySearch}>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <Input
                    value={categoryQuery}
                    onChange={e => setCategoryQuery(e.target.value)}
                    placeholder="describe your symptom..."
                    className="pl-10 py-5 border-2 border-green-200 focus:border-green-500"
                    autoFocus
                  />
                </div>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-5">Search</Button>
              </div>
            </form>
            <div>
              <p className="text-xs text-gray-400 mb-2">Common symptoms:</p>
              <div className="flex flex-wrap gap-2">
                {getCommonSymptoms(cat.name).map(s => (
                  <button key={s}
                    onClick={() => {
                      const p = new URLSearchParams()
                      p.set("category", selectedCategory!)
                      p.set("q", s)
                      setLocation(`/symptom-analysis?${p.toString()}`)
                    }}
                    className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded-full hover:bg-green-100 transition">
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 pt-4 border-t">
              <Button
                onClick={() => setLocation(`/symptom-analysis?category=${encodeURIComponent(selectedCategory!)}`)}
                variant="outline" className="w-full border-green-300 text-green-700 hover:bg-green-50">
                Browse all {cat.name} remedies with AI questions →
              </Button>
            </div>
          </Card>
        </main>
      </div>
    )
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => { setQuery(""); setSelectedCategory(null) }}
            className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🌿</span>
            </div>
            <span className="font-bold text-green-700 text-lg">HomeoWell</span>
          </button>
          <div className="flex items-center gap-2">
            <Trans
