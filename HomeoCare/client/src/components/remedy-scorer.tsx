import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Search, TrendingUp, ArrowLeft, HelpCircle, Camera,
  Paperclip, X, CheckCircle, FileText, ChevronDown, ChevronUp,
  ShieldAlert, Info, AlertTriangle,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import AdvancedFilters, { FilterState } from "./advanced-filters";
import { saveSearchHistory, getHealthProfile } from "@/lib/supabase";

// ── AI Questions per category ─────────────────────────────────────
const CATEGORY_QUESTIONS: Record<string, Array<{ q: string; options: string[] }>> = {
  "Mind": [
    { q: "Primary emotional state?", options: ["Anxiety", "Depression", "Anger", "Fear", "Grief", "Restlessness", "Irritability"] },
    { q: "When is it worse?", options: ["Night", "Morning", "Alone", "In company", "After eating", "Before menses", "No pattern"] },
    { q: "Associated symptoms?", options: ["Sleeplessness", "Palpitations", "Weeping", "Forgetfulness", "Mood swings", "None"] },
  ],
  "Head": [
    { q: "Type of headache?", options: ["Throbbing", "Pressing", "Burning", "Shooting", "Dull ache", "Band-like"] },
    { q: "Location of pain?", options: ["Forehead", "Temples", "Back of head", "Top of head", "One side", "Whole head"] },
    { q: "What makes it worse?", options: ["Light", "Noise", "Movement", "Heat", "Cold", "Morning", "Evening"] },
    { q: "What makes it better?", options: ["Rest", "Pressure", "Cold compress", "Lying down", "Open air", "Nothing"] },
  ],
  "Fever": [
    { q: "Stage of fever?", options: ["Chill stage", "Heat stage", "Sweating stage", "All stages"] },
    { q: "Time pattern?", options: ["Morning", "Afternoon", "Evening", "Night", "Irregular"] },
    { q: "Associated symptoms?", options: ["Thirst", "No thirst", "Body ache", "Rash", "Vomiting", "Headache"] },
  ],
  "Stomach": [
    { q: "Main complaint?", options: ["Nausea", "Vomiting", "Acidity/Heartburn", "Bloating", "Pain", "Loss of appetite"] },
    { q: "After eating?", options: ["Better after eating", "Worse after eating", "Worse immediately", "No change"] },
    { q: "Type of pain?", options: ["Burning", "Cramping", "Cutting", "Pressing", "No pain"] },
  ],
  "Respiration": [
    { q: "Type of cough?", options: ["Dry", "Wet/Productive", "Barking", "Spasmodic", "Night cough", "Morning cough"] },
    { q: "Breathing difficulty?", options: ["Worse lying down", "Worse on exertion", "At night", "During attack", "No difficulty"] },
    { q: "Sputum?", options: ["None", "Clear", "Yellow/Green", "Blood-tinged", "Thick/sticky"] },
  ],
  "Skin": [
    { q: "Type of eruption?", options: ["Rash", "Blisters", "Dry/Scaly", "Weeping/Moist", "Itching only", "Discoloration"] },
    { q: "Sensation?", options: ["Itching", "Burning", "Stinging", "No sensation", "Bleeding on scratch"] },
    { q: "What makes it worse?", options: ["Heat", "Cold", "Night", "Scratching", "Washing", "Nothing specific"] },
  ],
  "Hands, Legs & Back": [
    { q: "Type of complaint?", options: ["Joint pain", "Muscle pain", "Stiffness", "Swelling", "Weakness", "Numbness"] },
    { q: "When is it worse?", options: ["Morning stiffness", "After rest", "On movement", "At night", "In cold", "In damp"] },
    { q: "Better by?", options: ["Continued movement", "Rest", "Warmth", "Cold application", "Pressure", "Elevation"] },
  ],
};

const DEFAULT_QUESTIONS = [
  { q: "How severe is the complaint?", options: ["Mild", "Moderate", "Severe", "Unbearable"] },
  { q: "Pattern of complaints?", options: ["Sudden onset", "Gradual", "After cold exposure", "After emotional stress", "After eating", "Recurring"] },
  { q: "What makes it better?", options: ["Rest", "Movement", "Heat", "Cold", "Pressure", "Open air", "Nothing"] },
  { q: "What makes it worse?", options: ["Morning", "Night", "Cold", "Heat", "Exertion", "Eating", "Stress"] },
];

const AVOID_RECOMMENDATIONS: Record<string, string[]> = {
  "Mind": ["Coffee and stimulants", "Alcohol", "Overthinking before bed", "Social media overuse", "Skipping meals", "Isolation"],
  "Head": ["Bright screens in dark rooms", "Skipping meals (hypoglycemia)", "Dehydration", "Strong perfumes", "Loud noise", "Alcohol"],
  "Fever": ["Cold baths when chilling", "Covering with heavy blankets during heat stage", "Antibiotics without indication", "Fruit juices with preservatives", "Sudden cold exposure"],
  "Stomach": ["Spicy food", "Fried/oily food", "Late night eating", "Coffee on empty stomach", "Carbonated drinks", "Overeating"],
  "Respiration": ["Cold drinks", "Ice cream", "Air conditioning direct exposure", "Smoking/passive smoking", "Dairy products (increase mucus)", "Dusty environments"],
  "Skin": ["Soap with harsh chemicals", "Hot water baths", "Synthetic clothing", "Scratching", "Dairy and sugar (may worsen)", "Cosmetics with parabens"],
  "Hands, Legs & Back": ["Cold and damp environments", "Sitting in one position too long", "Heavy lifting", "High heels", "Sleeping on very soft mattress", "Overexertion"],
  "Urinary System": ["Holding urine for long", "Less water intake", "Spicy food", "Alcohol", "Coffee in excess", "Tight clothing"],
  "Heart": ["Excess salt", "Saturated fats", "Smoking", "Stress without management", "Sedentary lifestyle", "Excess caffeine"],
};

const DEFAULT_AVOID = [
  "Coffee and strong tea", "Alcohol", "Strongly scented substances",
  "Suppressing natural urges", "Irregular sleep schedule", "Processed and junk food",
];

// ── Safety flag component ─────────────────────────────────────────
function SafetyFlags({ flags }: { flags: Array<{ level: string; message: string }> }) {
  if (!flags || flags.length === 0) return null;
  const nonInfo = flags.filter(f => f.level !== "info");
  if (nonInfo.length === 0) return null;

  return (
    <div className="space-y-1 mb-3">
      {nonInfo.map((flag, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
            flag.level === "danger"
              ? "bg-red-50 border border-red-200 text-red-700"
              : "bg-yellow-50 border border-yellow-200 text-yellow-800"
          }`}
        >
          {flag.level === "danger"
            ? <ShieldAlert size={13} className="shrink-0 mt-0.5" />
            : <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          }
          {flag.message}
        </div>
      ))}
    </div>
  );
}

// ── Confidence badge ──────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 70 ? "bg-green-100 text-green-700 border-green-300" :
    confidence >= 40 ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                       "bg-gray-100 text-gray-500 border-gray-300";
  const label =
    confidence >= 70 ? "High confidence" :
    confidence >= 40 ? "Moderate confidence" : "Low confidence";

  return (
    <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${color}`}>
      {confidence}% — {label}
    </span>
  );
}

// ── Covered rubrics expandable panel ─────────────────────────────
function CoveredRubrics({ rubrics }: { rubrics: Array<{ rubric_code: string; label: string; grade: number; weight: number; contribution: number }> }) {
  const [open, setOpen] = useState(false);
  if (!rubrics || rubrics.length === 0) return null;

  const weightLabel = (w: number) =>
    w === 3 ? "Mental" : w === 2 ? "General" : "Particular";

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
      >
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {open ? "Hide" : "Show"} repertory rubrics ({rubrics.length})
      </button>
      {open && (
        <div className="mt-2 border border-indigo-100 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-indigo-50">
              <tr>
                <th className="text-left px-3 py-1.5 text-indigo-700">Rubric</th>
                <th className="text-center px-2 py-1.5 text-indigo-700">Type</th>
                <th className="text-center px-2 py-1.5 text-indigo-700">Grade</th>
                <th className="text-center px-2 py-1.5 text-indigo-700">Score</th>
              </tr>
            </thead>
            <tbody>
              {rubrics.map((r, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-indigo-50/30"}>
                  <td className="px-3 py-1.5 text-gray-700">{r.label}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`rounded px-1 py-0.5 ${
                      r.weight === 3 ? "bg-purple-100 text-purple-700" :
                      r.weight === 2 ? "bg-blue-100 text-blue-700" :
                                       "bg-gray-100 text-gray-600"
                    }`}>
                      {weightLabel(r.weight)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center font-bold text-indigo-700">{r.grade}</td>
                  <td className="px-2 py-1.5 text-center text-green-700 font-medium">+{r.contribution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────
interface RemedyScorerProps {
  initialQuery?: string;
  initialCategory?: string;
  category?: string;
}

// ── Main component ────────────────────────────────────────────────
export default function RemedyScorer({
  initialQuery = "",
  initialCategory = "",
  category,
}: RemedyScorerProps) {
  const [, setLocation] = useLocation();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState("");
  const [filters, setFilters] = useState<FilterState>({ age_group: "", gender: "", condition_type: "", potency: "" });
  const [showResults, setShowResults] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [analyzingFiles, setAnalyzingFiles] = useState<string[]>([]);
  const [healthProfile, setHealthProfile] = useState<Record<string, any> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const activeCategory = initialCategory || category || "";
  const questions = CATEGORY_QUESTIONS[activeCategory] || DEFAULT_QUESTIONS;
  const avoidList = AVOID_RECOMMENDATIONS[activeCategory] || DEFAULT_AVOID;

  useEffect(() => {
    getHealthProfile()
      .then((p) => { if (p) setHealthProfile(p); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialQuery) {
      const parts = initialQuery.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) { setSymptoms(parts); setShowQuestionnaire(true); }
    } else if (activeCategory) {
      setShowQuestionnaire(true);
    }
  }, [initialQuery, initialCategory]);

  const scoreMutation = useMutation({
    mutationFn: async (data: {
      symptoms: string[];
      filters: any;
      healthProfile?: Record<string, any> | null;
    }) => {
      const response = await fetch("/api/remedies/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms:      data.symptoms,
          filters:       data.filters,
          healthProfile: data.healthProfile,
        }),
      });
      if (!response.ok) throw new Error("Failed to score remedies");
      return response.json();
    },
    onSuccess: async (data, variables) => {
      setShowResults(true);
      await saveSearchHistory(variables.symptoms, data);
    },
  });

  const submitToAI = (syms: string[], answers: Record<string, string>) => {
    const allSymptoms = [
      ...syms,
      ...Object.values(answers),
      ...(activeCategory ? [`category: ${activeCategory}`] : []),
    ].filter(Boolean);

    const cleanFilters: any = Object.fromEntries(
      Object.entries(filters).filter(([_, v]) => v !== "")
    );
    if (activeCategory) cleanFilters.symptom_location = activeCategory;

    scoreMutation.mutate({ symptoms: allSymptoms, filters: cleanFilters, healthProfile });
  };

  const handleAnswerQuestion = (answer: string) => {
    const currentQ = questions[currentQuestionIdx];
    const newAnswers = { ...questionAnswers, [currentQ.q]: answer };
    setQuestionAnswers(newAnswers);
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx((prev) => prev + 1);
    } else {
      setShowQuestionnaire(false);
      submitToAI(symptoms, newAnswers);
    }
  };

  const handleSkipQuestionnaire = () => {
    setShowQuestionnaire(false);
    if (symptoms.length > 0) submitToAI(symptoms, questionAnswers);
  };

  const handleAddSymptom = () => {
    if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
      setSymptoms((prev) => [...prev, currentSymptom.trim()]);
      setCurrentSymptom("");
    }
  };

  const handleRemoveSymptom = (s: string) =>
    setSymptoms((prev) => prev.filter((x) => x !== s));

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleAddSymptom(); }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadedFiles((prev) => [...prev, ...files]);

    for (const file of files) {
      const placeholder = `🔍 Analyzing: ${file.name}...`;
      setAnalyzingFiles((prev) => [...prev, file.name]);
      setSymptoms((prev) => [...prev, placeholder]);

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const response = await fetch("/api/analyze-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type || "image/jpeg" }),
        });

        setSymptoms((prev) => prev.filter((s) => s !== placeholder));
        setAnalyzingFiles((prev) => prev.filter((n) => n !== file.name));

        if (response.ok) {
          const result = await response.json();
          const extracted = [...(result.symptoms || []), ...(result.conditions || [])].filter(Boolean);
          setSymptoms((prev) => [...prev, ...(extracted.length ? extracted : [`Report: ${file.name}`])]);
        } else {
          setSymptoms((prev) => [...prev, `Report: ${file.name}`]);
        }
      } catch {
        setSymptoms((prev) =>
          prev.filter((s) => s !== placeholder).concat(`Report: ${file.name}`)
        );
        setAnalyzingFiles((prev) => prev.filter((n) => n !== file.name));
      }
    }
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (symptoms.length === 0) return;
    submitToAI(symptoms, questionAnswers);
  };

  const resetForm = () => {
    setSymptoms([]); setCurrentSymptom(""); setUploadedFiles([]);
    setFilters({ age_group: "", gender: "", condition_type: "", potency: "" });
    setShowResults(false); setShowQuestionnaire(false);
    setQuestionAnswers({}); setCurrentQuestionIdx(0);
    setAnalyzingFiles([]);
    scoreMutation.reset();
  };

  // ── PAGE HEADER ───────────────────────────────────────────────
  const PageHeader = () => (
    <header className="bg-white border-b border-gray-100 shadow-sm mb-6 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">🌿</span>
          </div>
          <span className="font-bold text-green-700 text-lg">HomeoWell</span>
        </button>
        {activeCategory && (
          <Badge className="bg-green-100 text-green-700 border-green-300">{activeCategory}</Badge>
        )}
      </div>
    </header>
  );

  // ── QUESTIONNAIRE ─────────────────────────────────────────────
  if (showQuestionnaire) {
    const currentQ = questions[currentQuestionIdx];
    const progress = (currentQuestionIdx / questions.length) * 100;
    return (
      <div>
        <PageHeader />
        <div className="max-w-2xl mx-auto px-4">
          <Card className="p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-green-700">
                  <HelpCircle size={20} />
                  <span className="font-semibold">Narrowing down remedies...</span>
                </div>
                <span className="text-sm text-gray-400">{currentQuestionIdx + 1} / {questions.length}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              {activeCategory && <p className="text-xs text-gray-400 mt-2">Category: {activeCategory}</p>}
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mb-5">{currentQ.q}</h3>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {currentQ.options.map((option) => (
                <button key={option} onClick={() => handleAnswerQuestion(option)}
                  className="p-3 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 text-left text-sm font-medium text-gray-700 transition-all">
                  {option}
                </button>
              ))}
            </div>

            <div className="border-t pt-4 mt-2">
              <p className="text-xs text-gray-400 mb-2">Or add a custom symptom:</p>
              <div className="flex gap-2">
                <Input
                  value={currentSymptom}
                  onChange={(e) => setCurrentSymptom(e.target.value)}
                  onKeyPress={(e) => { if (e.key === "Enter") handleAddSymptom(); }}
                  placeholder="Type symptom..."
                  className="flex-1 text-sm"
                />
                <Button size="sm" onClick={handleAddSymptom} disabled={!currentSymptom.trim()}>Add</Button>
              </div>
              {symptoms.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {symptoms.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs cursor-pointer"
                      onClick={() => handleRemoveSymptom(s)}>
                      {s} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between mt-4">
              {currentQuestionIdx > 0 && (
                <Button variant="outline" size="sm"
                  onClick={() => setCurrentQuestionIdx((prev) => prev - 1)}>← Back</Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleSkipQuestionnaire}
                className="ml-auto text-gray-400">
                Skip & Search →
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────
  if (showResults && scoreMutation.data) {
    const topResults = scoreMutation.data.slice(0, 3);

    return (
      <div>
        <PageHeader />
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <Card className="p-6">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Top Remedy Recommendations</h2>
                <p className="text-neutral-500 text-sm">
                  Best {topResults.length} matches{activeCategory ? ` for ${activeCategory}` : ""}
                  {" "}— Scored by Repertory Engine
                </p>
                {healthProfile && (healthProfile.age || healthProfile.gender || healthProfile.chronic_conditions) && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                      👤 Personalized for your profile
                    </span>
                    {healthProfile.chronic_conditions && (
                      <span className="text-xs bg-orange-100 text-orange-700 rounded-full px-2 py-0.5">
                        ⚕️ {healthProfile.chronic_conditions}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={resetForm} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> New Search
              </Button>
            </div>

            {/* Answers used */}
            {Object.keys(questionAnswers).length > 0 && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle size={14} /> Refined by your answers:
                </p>
                <div className="flex flex-wrap gap-1">
                  {Object.values(questionAnswers).map((a, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Remedy cards */}
            <div className="space-y-5">
              {topResults.map((result: any, idx: number) => (
                <div key={result.remedy?.id || idx}
                  className="border rounded-xl p-4 bg-white shadow-sm">

                  {/* Title row */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-green-800">#{idx + 1}</span>
                        <h3 className="text-lg font-bold text-gray-900">{result.remedy?.name}</h3>
                        {result.remedy?.abbreviation && (
                          <span className="text-xs text-gray-400">({result.remedy.abbreviation})</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{result.remedy?.condition}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-2xl font-bold text-green-600">{result.score}%</div>
                      <div className="text-xs text-gray-400">match score</div>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                    <div className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${result.score}%` }} />
                  </div>

                  {/* Confidence badge */}
                  {result.confidence !== undefined && (
                    <div className="mb-3">
                      <ConfidenceBadge confidence={result.confidence} />
                    </div>
                  )}

                  {/* Safety flags */}
                  <SafetyFlags flags={result.safety_flags || []} />

                  {/* Why explanation — NEW from scoring engine */}
                  {result.why_explanation && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 mb-3">
                      <p className="text-xs text-indigo-800">
                        <span className="font-semibold">📊 Why this remedy:</span>{" "}
                        {result.why_explanation}
                      </p>
                    </div>
                  )}

                  {/* AI insight (legacy / supplementary) */}
                  {result.ai_insight && !result.why_explanation && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 mb-3">
                      <p className="text-xs text-purple-700">
                        <span className="font-semibold">🤖 AI insight:</span> {result.ai_insight}
                      </p>
                    </div>
                  )}

                  {/* Dosage */}
                  <div className="bg-blue-50 rounded-lg p-2 mb-3">
                    <p className="text-xs text-blue-700">
                      <strong>Dosage:</strong> {result.remedy?.dosage}
                    </p>
                  </div>

                  {/* Covered rubrics — NEW */}
                  <CoveredRubrics rubrics={result.covered_rubrics || []} />

                  {/* Matching symptoms */}
                  {result.matching_symptoms?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Matched symptoms / rubrics:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.matching_symptoms.slice(0, 6).map((s: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Modalities */}
                  {(result.remedy?.modalities?.better?.length > 0 ||
                    result.remedy?.modalities?.worse?.length > 0) && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {result.remedy.modalities?.better?.length > 0 && (
                        <div className="bg-green-50 rounded p-2">
                          <p className="font-medium text-green-700 mb-1">Better:</p>
                          {result.remedy.modalities.better.slice(0, 3).map((b: string, i: number) => (
                            <p key={i} className="text-green-600">✓ {b}</p>
                          ))}
                        </div>
                      )}
                      {result.remedy?.modalities?.worse?.length > 0 && (
                        <div className="bg-red-50 rounded p-2">
                          <p className="font-medium text-red-700 mb-1">Worse:</p>
                          {result.remedy.modalities.worse.slice(0, 3).map((w: string, i: number) => (
                            <p key={i} className="text-red-600">✗ {w}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {topResults.length === 0 && (
              <div className="text-center py-8">
                <p className="text-neutral-600 mb-4">No matching remedies found. Try different symptoms.</p>
                <Button onClick={resetForm}>Try Again</Button>
              </div>
            )}

            {/* Avoid section */}
            <div className="mt-6 border-2 border-red-200 rounded-xl p-5 bg-red-50">
              <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center gap-2">
                ⚠️ AVOID
                <span className="text-sm font-normal text-red-500">
                  — Things to avoid for {activeCategory || "this condition"}
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {avoidList.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5 shrink-0">✗</span>
                    <span className="text-sm text-red-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Info safety flag for all results */}
            <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              <Info size={13} className="shrink-0 mt-0.5 text-gray-400" />
              For educational purposes only. Always consult a qualified homeopath before treatment.
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── MAIN INPUT ────────────────────────────────────────────────
  return (
    <div>
      <PageHeader />
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Symptom Analysis</h2>
              <p className="text-neutral-500">
                {activeCategory ? `Category: ${activeCategory}` : "Enter symptoms for remedy matching"}
              </p>
              {healthProfile && (healthProfile.name || healthProfile.age) && (
                <p className="text-xs text-blue-600 mt-1">
                  👤 {healthProfile.name || ""}
                  {healthProfile.age ? `, age ${healthProfile.age}` : ""}
                  {healthProfile.gender ? `, ${healthProfile.gender}` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <TrendingUp className="w-4 h-4" />
              <span>Repertory Engine</span>
            </div>
          </div>

          {scoreMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              <span className="text-neutral-600 text-sm">Matching symptoms to repertory rubrics...</span>
              <span className="text-gray-400 text-xs">Running scoring engine...</span>
            </div>
          )}

          {!scoreMutation.isPending && (
            <>
              <div className="space-y-4">
                <div>
                  <Label>Add Symptoms</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={currentSymptom}
                      onChange={(e) => setCurrentSymptom(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type symptom and press Enter or Add..."
                      className="flex-1"
                      autoFocus
                    />
                    <Button onClick={handleAddSymptom} disabled={!currentSymptom.trim()}>Add</Button>
                  </div>
                </div>

                {symptoms.length > 0 && (
                  <div>
                    <Label>Symptoms ({symptoms.length})</Label>
                    <div className="flex flex-wrap gap-2 mt-2 p-3 bg-neutral-50 rounded-lg">
                      {symptoms.map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className={`cursor-pointer hover:bg-red-100 ${
                            s.startsWith("🔍 Analyzing:")
                              ? "bg-yellow-100 text-yellow-700 animate-pulse"
                              : ""
                          }`}
                          onClick={() => {
                            if (!s.startsWith("🔍 Analyzing:")) handleRemoveSymptom(s);
                          }}
                        >
                          {s.startsWith("🔍 Analyzing:") ? s : `${s} ×`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* File upload */}
                <div>
                  <Label>Clinical Reports (Optional)</Label>
                  <p className="text-xs text-gray-400 mb-2 mt-0.5">
                    Upload a photo or PDF — AI will extract symptoms automatically
                  </p>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        multiple
                        onChange={handleFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Button type="button" variant="outline"
                        className="w-full border-dashed border-2 border-gray-300 hover:border-green-400">
                        <Paperclip size={16} className="mr-2 text-green-600" />
                        Upload PDF / Photos
                      </Button>
                    </div>
                    <div className="relative">
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={handleFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Button type="button" variant="outline"
                        className="border-2 border-gray-300 hover:border-green-400 px-3">
                        <Camera size={18} className="text-green-600" />
                      </Button>
                    </div>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadedFiles.map((f, i) => (
                        <div key={i}
                          className="flex items-center justify-between text-xs bg-green-50 rounded px-3 py-1.5">
                          <span className="flex items-center gap-1.5 text-green-700 truncate">
                            <FileText size={12} />
                            {f.name}
                            {analyzingFiles.includes(f.name) && (
                              <span className="text-yellow-600 font-medium ml-1">— analyzing...</span>
                            )}
                          </span>
                          <button
                            onClick={() =>
                              setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="text-gray-400 hover:text-red-500 ml-2 shrink-0"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator className="my-6" />

              <AdvancedFilters
                onFiltersChange={setFilters}
                onSearch={handleSubmit}
                isLoading={scoreMutation.isPending}
              />

              <div className="flex justify-between mt-6">
                <Button variant="outline"
                  onClick={() => { setShowQuestionnaire(true); setCurrentQuestionIdx(0); }}>
                  <HelpCircle className="w-4 h-4 mr-2" /> AI Questions
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetForm}>Clear</Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      symptoms.length === 0 ||
                      scoreMutation.isPending ||
                      analyzingFiles.length > 0
                    }
                    className="min-w-32 bg-green-600 hover:bg-green-700"
                  >
                    <Search className="w-4 h-4 mr-2" /> Find Remedies
                  </Button>
                </div>
              </div>

              {analyzingFiles.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500" />
                  AI is reading your report... please wait before searching.
                </div>
              )}

              {scoreMutation.isError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  Something went wrong. Please try again.
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
