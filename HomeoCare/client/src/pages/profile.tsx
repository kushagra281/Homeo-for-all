import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { ArrowLeft, User, Save, CheckCircle, Clock } from "lucide-react"
import { getCurrentUser, getHealthProfile, saveHealthProfile, getSearchHistory, deleteHistoryItem } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Trash2, ChevronRight } from "lucide-react"

// ── Pill selector component ──────────────────────────────────
function PillGroup({ options, value, onChange }: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt === value ? "" : opt)}
          className={`px-3 py-1.5 rounded-full text-sm border-2 transition-all font-medium ${
            value === opt
              ? "bg-green-600 border-green-600 text-white"
              : "bg-white border-gray-200 text-gray-600 hover:border-green-400"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ── Section heading ──────────────────────────────────────────
function SectionHeading({ icon, label }: { icon: string; label: string }) {
  return (
    <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
      <span>{icon}</span> {label}
    </p>
  )
}

// ── History tab ──────────────────────────────────────────────
function HistoryTab() {
  const [, setLocation] = useLocation()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSearchHistory().then(h => { setHistory(h || []); setLoading(false) })
  }, [])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteHistoryItem(id)
    setHistory(prev => prev.filter(h => h.id !== id))
  }

  const formatSymptoms = (h: any) => {
    const syms = Array.isArray(h.symptoms) ? h.symptoms : []
    return syms.filter((s: string) =>
      !s.startsWith("category:") && !s.startsWith("health history:") &&
      !s.startsWith("age") && !s.startsWith("gender:")
    ).slice(0, 3).join(", ") || "Consultation"
  }

  const formatTop = (h: any) => {
    const r = Array.isArray(h.results) ? h.results : []
    return r[0]?.remedy?.name ? `→ ${r[0].remedy.name}` : ""
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  )

  if (history.length === 0) return (
    <div className="text-center py-16">
      <Clock size={40} className="text-gray-200 mx-auto mb-3" />
      <p className="text-gray-400 text-sm">No consultation history yet.</p>
      <p className="text-xs text-gray-300 mt-1">Searches save automatically after each session.</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {history.map((h, i) => (
        <div key={h.id || i}
          className="flex items-center justify-between p-3 rounded-xl hover:bg-green-50 group border border-transparent hover:border-green-200 transition cursor-pointer"
          onClick={() => {
            const syms = Array.isArray(h.symptoms)
              ? h.symptoms.filter((s: string) => !s.startsWith("category:") && !s.startsWith("health history:") && !s.startsWith("age") && !s.startsWith("gender:")).slice(0, 3).join(", ")
              : ""
            if (syms) setLocation(`/symptom-analysis?q=${encodeURIComponent(syms)}`)
          }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{formatSymptoms(h)}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {formatTop(h) && <span className="text-xs text-green-600 font-medium">{formatTop(h)}</span>}
              <span className="text-xs text-gray-400">
                {h.created_at ? new Date(h.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            <ChevronRight size={14} className="text-gray-400 group-hover:text-green-600" />
            <button onClick={e => handleDelete(h.id, e)}
              className="text-transparent group-hover:text-red-400 hover:!text-red-600 transition p-0.5">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main profile page ────────────────────────────────────────
export default function ProfilePage() {
  const [, setLocation] = useLocation()
  const [tab, setTab]         = useState<"profile" | "history">("profile")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState("")

  const [form, setForm] = useState({
    name: "", age: "", height_cm: "", weight_kg: "", gender: "",
    diabetes: "", blood_pressure: "", obesity: "", hair_fall: "",
    cholesterol: "", asthma: "", allergy: "", thyroid: "",
    gastritis: "", constipation: "", pcod: "", arthritis: "",
    kidney: "", heart_disease: "", migraine: "", skin_condition: "",
    depression_anxiety: "", injury_history: "", other_conditions: ""
  })

  useEffect(() => {
    const load = async () => {
      const user = await getCurrentUser()
      if (!user) { setLocation("/auth"); return }
      const profile = await getHealthProfile()
      if (profile) {
        setForm({
          name:               profile.name || "",
          age:                profile.age ? String(profile.age) : "",
          height_cm:          profile.height_cm ? String(profile.height_cm) : "",
          weight_kg:          profile.weight_kg ? String(profile.weight_kg) : "",
          gender:             profile.gender || "",
          diabetes:           profile.diabetes || "",
          blood_pressure:     profile.blood_pressure || "",
          obesity:            profile.obesity || "",
          hair_fall:          profile.hair_fall || "",
          cholesterol:        profile.cholesterol || "",
          asthma:             profile.asthma || "",
          allergy:            profile.allergy || "",
          thyroid:            profile.thyroid || "",
          gastritis:          profile.gastritis || "",
          constipation:       profile.constipation || "",
          pcod:               profile.pcod || "",
          arthritis:          profile.arthritis || "",
          kidney:             profile.kidney || "",
          heart_disease:      profile.heart_disease || "",
          migraine:           profile.migraine || "",
          skin_condition:     profile.skin_condition || "",
          depression_anxiety: profile.depression_anxiety || "",
          injury_history:     profile.injury_history || "",
          other_conditions:   profile.other_conditions || "",
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError("")
    try {
      await saveHealthProfile(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 hover:opacity-80">
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-lg">🌿</span>
            </div>
            <span className="font-bold text-green-700 text-lg">HomeoWell</span>
          </button>
          <button onClick={() => setLocation("/")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={15} /> Back
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">

        {/* Tab switcher */}
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden mb-5 shadow-sm">
          <button
            onClick={() => setTab("profile")}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition ${
              tab === "profile" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50"
            }`}>
            <User size={15} /> Health Profile
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition ${
              tab === "history" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50"
            }`}>
            <Clock size={15} /> History
          </button>
        </div>

        {tab === "history" ? (
          <Card className="p-4"><HistoryTab /></Card>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">

            {/* Basic Info */}
            <Card className="p-5">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">Basic Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
                  <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Your name" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Age</label>
                  <Input type="number" value={form.age} onChange={e => set("age", e.target.value)} placeholder="e.g. 35" min="1" max="120" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Height (cm)</label>
                  <Input type="number" value={form.height_cm} onChange={e => set("height_cm", e.target.value)} placeholder="e.g. 170" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Weight (kg)</label>
                  <Input type="number" value={form.weight_kg} onChange={e => set("weight_kg", e.target.value)} placeholder="e.g. 70" />
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                <PillGroup options={["Male", "Female", "Other"]} value={form.gender} onChange={v => set("gender", v)} />
              </div>
            </Card>

            {/* Conditions */}
            <Card className="p-5 space-y-5">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">Medical Conditions</p>

              <div>
                <SectionHeading icon="🩸" label="Diabetes" />
                <PillGroup options={["None", "Type 1", "Type 2", "Pre-Diabetes", "Gestational"]} value={form.diabetes} onChange={v => set("diabetes", v)} />
              </div>

              <div>
                <SectionHeading icon="❤️" label="Blood Pressure" />
                <PillGroup options={["Normal", "High BP", "Low BP", "Borderline"]} value={form.blood_pressure} onChange={v => set("blood_pressure", v)} />
              </div>

              <div>
                <SectionHeading icon="⚖️" label="Obesity / Weight" />
                <PillGroup options={["Normal", "Overweight", "Obese", "Underweight"]} value={form.obesity} onChange={v => set("obesity", v)} />
              </div>

              <div>
                <SectionHeading icon="🫀" label="Cholesterol" />
                <PillGroup options={["Normal", "High", "Low", "Borderline High"]} value={form.cholesterol} onChange={v => set("cholesterol", v)} />
              </div>

              <div>
                <SectionHeading icon="🦋" label="Thyroid" />
                <PillGroup options={["None", "Hypothyroid", "Hyperthyroid", "Hashimoto's", "Goitre"]} value={form.thyroid} onChange={v => set("thyroid", v)} />
              </div>

              <div>
                <SectionHeading icon="🌬️" label="Asthma / Respiratory" />
                <PillGroup options={["None", "Mild", "Moderate", "Severe", "Allergic Asthma"]} value={form.asthma} onChange={v => set("asthma", v)} />
              </div>

              <div>
                <SectionHeading icon="🤧" label="Allergy" />
                <PillGroup options={["None", "Dust", "Pollen", "Food", "Skin/Contact", "Drug/Medicine", "Multiple"]} value={form.allergy} onChange={v => set("allergy", v)} />
              </div>

              <div>
                <SectionHeading icon="🔥" label="Gastritis / Acidity" />
                <PillGroup options={["None", "Mild", "Chronic", "GERD/Acid Reflux", "Ulcer"]} value={form.gastritis} onChange={v => set("gastritis", v)} />
              </div>

              <div>
                <SectionHeading icon="🪢" label="Constipation / IBS" />
                <PillGroup options={["None", "Mild", "Chronic", "IBS", "Crohn's"]} value={form.constipation} onChange={v => set("constipation", v)} />
              </div>

              <div>
                <SectionHeading icon="🌸" label="PCOD / PCOS" />
                <PillGroup options={["None", "Confirmed", "Suspected", "Post-Treatment"]} value={form.pcod} onChange={v => set("pcod", v)} />
              </div>

              <div>
                <SectionHeading icon="🦴" label="Arthritis / Joint" />
                <PillGroup options={["None", "Osteoarthritis", "Rheumatoid", "Gout", "Cervical"]} value={form.arthritis} onChange={v => set("arthritis", v)} />
              </div>

              <div>
                <SectionHeading icon="💧" label="Kidney / Urinary" />
                <PillGroup options={["None", "Kidney Stones", "UTI (Recurring)", "CKD", "Enlarged Prostate"]} value={form.kidney} onChange={v => set("kidney", v)} />
              </div>

              <div>
                <SectionHeading icon="🫶" label="Heart Disease" />
                <PillGroup options={["None", "Angina", "Previous Heart Attack", "Valve Problem", "Palpitations"]} value={form.heart_disease} onChange={v => set("heart_disease", v)} />
              </div>

              <div>
                <SectionHeading icon="🧠" label="Migraine / Headache" />
                <PillGroup options={["None", "Occasional", "Frequent", "Chronic Daily", "Cluster"]} value={form.migraine} onChange={v => set("migraine", v)} />
              </div>

              <div>
                <SectionHeading icon="🧴" label="Skin Condition" />
                <PillGroup options={["None", "Eczema", "Psoriasis", "Vitiligo", "Acne (Severe)", "Urticaria"]} value={form.skin_condition} onChange={v => set("skin_condition", v)} />
              </div>

              <div>
                <SectionHeading icon="💆" label="Anxiety / Depression" />
                <PillGroup options={["None", "Mild Anxiety", "Moderate", "Severe", "On Medication"]} value={form.depression_anxiety} onChange={v => set("depression_anxiety", v)} />
              </div>

              <div>
                <SectionHeading icon="💈" label="Hair Fall" />
                <PillGroup options={["None", "Mild", "Moderate", "Severe", "Alopecia"]} value={form.hair_fall} onChange={v => set("hair_fall", v)} />
              </div>
            </Card>

            {/* Text fields */}
            <Card className="p-5 space-y-4">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">History & Other</p>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Injury / Operation History</label>
                <textarea
                  value={form.injury_history}
                  onChange={e => set("injury_history", e.target.value)}
                  placeholder="e.g. Appendix removed 2018, knee fracture 2021..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Other Conditions / Medications</label>
                <textarea
                  value={form.other_conditions}
                  onChange={e => set("other_conditions", e.target.value)}
                  placeholder="e.g. Cancer history, Epilepsy, current medications..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 resize-none"
                />
              </div>
            </Card>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
            )}

            <Button type="submit" disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2">
              {saved
                ? <><CheckCircle size={18} /> Saved!</>
                : saving
                ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</>
                : <><Save size={18} /> Save Profile</>
              }
            </Button>

            <p className="text-center text-xs text-gray-400 pb-4">
              Your health data is private and only used to improve remedy recommendations.
            </p>
          </form>
        )}
      </main>
    </div>
  )
}
