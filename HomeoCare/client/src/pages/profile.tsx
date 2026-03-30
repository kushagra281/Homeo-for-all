import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { ArrowLeft, Save, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import supabase, { getCurrentUser } from "@/lib/supabase"

const CHRONIC_OPTIONS = [
  "Diabetes", "High Blood Pressure", "Low Blood Pressure",
  "Gastritis", "Asthma", "Thyroid", "Arthritis",
  "Heart Disease", "Kidney Disease", "Liver Disease",
  "Anxiety Disorder", "Depression", "Migraine", "None"
]

const MOOD_OPTIONS = [
  "Cheerful", "Calm", "Anxious", "Irritable",
  "Sad", "Restless", "Tired", "Normal"
]

export default function ProfilePage() {
  const [, setLocation] = useLocation()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    name: "",
    gender: "",
    age: "",
    weight: "",
    height: "",
    chronic_disorders: [] as string[],
    general_mood: "",
    injury_operation: "",
  })

  useEffect(() => {
    const loadProfile = async () => {
      const user = await getCurrentUser()
      if (!user) { setLocation("/auth"); return }

      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("id", user.id)
        .single()

      if (data) {
        setForm({
          name: data.name || "",
          gender: data.gender || "",
          age: data.age ? String(data.age) : "",
          weight: data.weight || "",
          height: data.height || "",
          chronic_disorders: data.chronic_disorders || [],
          general_mood: data.general_mood || "",
          injury_operation: data.injury_operation || "",
        })
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  const toggleChronic = (disorder: string) => {
    setForm(prev => ({
      ...prev,
      chronic_disorders: prev.chronic_disorders.includes(disorder)
        ? prev.chronic_disorders.filter(d => d !== disorder)
        : [...prev.chronic_disorders, disorder]
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    const user = await getCurrentUser()
    if (!user) return

    await supabase.from("patients").upsert({
      id: user.id,
      email: user.email,
      name: form.name,
      gender: form.gender,
      age: parseInt(form.age) || null,
      weight: form.weight,
      height: form.height,
      chronic_disorders: form.chronic_disorders,
      general_mood: form.general_mood,
      injury_operation: form.injury_operation,
    })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🌿</span>
            </div>
            <span className="font-bold text-green-700 text-lg">HomeoWell</span>
          </button>
          <button onClick={() => setLocation("/")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <User size={24} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Health Profile</h1>
            <p className="text-sm text-gray-500">Used to improve remedy recommendations</p>
          </div>
        </div>

        {/* Basic Info */}
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 text-lg border-b pb-2">Basic Information</h2>

          <div>
            <label className="text-sm font-medium text-gray-600 block mb-1">Full Name</label>
            <Input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Your name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Gender</label>
              <div className="flex gap-2">
                {["Male", "Female", "Other"].map(g => (
                  <button
                    key={g}
                    onClick={() => setForm(p => ({ ...p, gender: g }))}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition ${
                      form.gender === g
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-gray-200 text-gray-600 hover:border-green-300"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Age (years)</label>
              <Input
                type="number"
                value={form.age}
                onChange={e => setForm(p => ({ ...p, age: e.target.value }))}
                placeholder="e.g. 35"
                min="0" max="120"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Weight (kg)</label>
              <Input
                value={form.weight}
                onChange={e => setForm(p => ({ ...p, weight: e.target.value }))}
                placeholder="e.g. 70 kg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 block mb-1">Height (cm)</label>
              <Input
                value={form.height}
                onChange={e => setForm(p => ({ ...p, height: e.target.value }))}
                placeholder="e.g. 170 cm"
              />
            </div>
          </div>
        </Card>

        {/* Chronic Disorders */}
        <Card className="p-6">
          <h2 className="font-semibold text-gray-700 text-lg border-b pb-2 mb-4">Chronic Disorders</h2>
          <p className="text-xs text-gray-400 mb-3">Select all that apply:</p>
          <div className="flex flex-wrap gap-2">
            {CHRONIC_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => toggleChronic(d)}
                className={`px-3 py-1.5 rounded-full text-sm border-2 font-medium transition ${
                  form.chronic_disorders.includes(d)
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-600 hover:border-green-300"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          {form.chronic_disorders.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              <span className="text-xs text-gray-400 mr-1">Selected:</span>
              {form.chronic_disorders.map(d => (
                <Badge key={d} className="bg-green-100 text-green-700 text-xs">{d}</Badge>
              ))}
            </div>
          )}
        </Card>

        {/* General Mood */}
        <Card className="p-6">
          <h2 className="font-semibold text-gray-700 text-lg border-b pb-2 mb-4">General Mood</h2>
          <div className="flex flex-wrap gap-2">
            {MOOD_OPTIONS.map(m => (
              <button
                key={m}
                onClick={() => setForm(p => ({ ...p, general_mood: m }))}
                className={`px-3 py-1.5 rounded-full text-sm border-2 font-medium transition ${
                  form.general_mood === m
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-200 text-gray-600 hover:border-green-300"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Card>

        {/* Injury / Operation */}
        <Card className="p-6">
          <h2 className="font-semibold text-gray-700 text-lg border-b pb-2 mb-4">Injury / Operation History</h2>
          <textarea
            value={form.injury_operation}
            onChange={e => setForm(p => ({ ...p, injury_operation: e.target.value }))}
            placeholder="e.g. Appendix removed in 2015, knee injury 2020..."
            className="w-full border-2 border-gray-200 rounded-lg p-3 text-sm focus:border-green-500 outline-none resize-none h-24"
          />
        </Card>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-base font-medium rounded-xl"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              Saving...
            </span>
          ) : saved ? (
            "✓ Saved!"
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Save size={18} /> Save Profile
            </span>
          )}
        </Button>

        <p className="text-center text-xs text-gray-400 pb-6">
          Your health data is private and only used to improve remedy suggestions.
        </p>
      </main>
    </div>
  )
}
