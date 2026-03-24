import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, TrendingUp, ArrowLeft, HelpCircle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { RemedyScore } from "@shared/schema";
import AdvancedFilters, { FilterState } from "./advanced-filters";
import RemedyCardEnhanced from "./remedy-card-enhanced";
import { saveSearchHistory } from "@/lib/supabase";

// Questionnaire per category to bottleneck symptoms
const CATEGORY_QUESTIONS: Record<string, Array<{ q: string; options: string[] }>> = {
  "Mind": [
    { q: "What is the primary emotional state?", options: ["Anxiety", "Depression", "Anger", "Fear", "Grief", "Restlessness"] },
    { q: "When is it worse?", options: ["Night", "Morning", "Alone", "Company", "After eating", "Before menses"] },
    { q: "Associated with?", options: ["Sleeplessness", "Palpitations", "Weeping", "Irritability", "Forgetfulness"] },
  ],
  "Head": [
    { q: "Type of headache?", options: ["Throbbing", "Pressing", "Burning", "Shooting", "Dull ache"] },
    { q: "Location?", options: ["Forehead", "Temples", "Back of head", "Top of head", "One side"] },
    { q: "What makes it worse?", options: ["Light", "Noise", "Movement", "Heat", "Cold", "Morning"] },
  ],
  "Fever": [
    { q: "Stage of fever?", options: ["Chill stage", "Heat stage", "Sweating stage", "All three stages"] },
    { q: "Time of fever?", options: ["Morning", "Afternoon", "Evening", "Night", "Irregular"] },
    { q: "Associated symptoms?", options: ["Thirst", "No thirst", "Chills", "Sweating", "Rash", "Body ache"] },
  ],
  "Stomach": [
    { q: "Main complaint?", options: ["Nausea", "Vomiting", "Acidity", "Bloating", "Pain", "Loss of appetite"] },
    { q: "Better or worse after eating?", options: ["Better after eating", "Worse after eating", "No change"] },
    { q: "Type of pain?", options: ["Burning", "Cramping", "Cutting", "Pressing", "No pain"] },
  ],
  "Respiration": [
    { q: "Type of cough?", options: ["Dry", "Wet/Productive", "Barking", "Spasmodic", "Night cough"] },
    { q: "Breathing difficulty?", options: ["Yes - worse lying", "Yes - worse exertion", "Yes - at night", "No difficulty"] },
    { q: "Associated with?", options: ["Wheezing", "Rattling", "Blood in sputum", "Hoarseness", "None"] },
  ],
}

const DEFAULT_QUESTIONS = [
  { q: "How severe is the complaint?", options: ["Mild", "Moderate", "Severe"] },
  { q: "When did it start?", options: ["Suddenly", "Gradually", "After exposure to cold", "After emotional stress", "After eating"] },
  { q: "What makes it better?", options: ["Rest", "Movement", "Heat", "Cold", "Pressure", "Open air"] },
]

interface RemedyScorerProps {
  initialQuery?: string;
  initialCategory?: string;
  category?: string;
}

export default function RemedyScorer({ initialQuery = "", initialCategory = "", category }: RemedyScorerProps) {
  const [, setLocation] = useLocation()
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState("");
  const [filters, setFilters] = useState<FilterState>({ age_group: "", gender: "", condition_type: "", potency: "" });
  const [showResults, setShowResults] = useState(false);

  // Questionnaire state
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);

  const activeCategory = initialCategory || category || "";
  const questions = CATEGORY_QUESTIONS[activeCategory] || DEFAULT_QUESTIONS;

  useEffect(() => {
    if (initialQuery) {
      const parts = initialQuery.split(",").map(s => s.trim()).filter(Boolean);
      if (parts.length > 0) {
        setSymptoms(parts);
        // Show questionnaire first to bottleneck
        setShowQuestionnaire(true);
      }
    } else if (activeCategory) {
      setShowQuestionnaire(true);
    }
  }, [initialQuery, initialCategory]);

  const scoreMutation = useMutation({
    mutationFn: async (data: { symptoms: string[]; filters: any }) => {
      const response = await fetch("/api/remedies/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to score remedies");
      return response.json();
    },
    onSuccess: async (data, variables) => {
      setShowResults(true);
      await saveSearchHistory(variables.symptoms, data);
    },
  });

  const handleAnswerQuestion = (answer: string) => {
    const currentQ = questions[currentQuestionIdx];
    const newAnswers = { ...questionAnswers, [currentQ.q]: answer };
    setQuestionAnswers(newAnswers);

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      // Done with questionnaire — submit
      setShowQuestionnaire(false);
      const allSymptoms = [
        ...symptoms,
        ...Object.entries(newAnswers).map(([q, a]) => `${a}`)
      ];
      setSymptoms(allSymptoms);
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ""));
      if (activeCategory) cleanFilters.symptom_location = activeCategory;
      scoreMutation.mutate({ symptoms: allSymptoms, filters: cleanFilters });
    }
  };

  const handleSkipQuestionnaire = () => {
    setShowQuestionnaire(false);
    if (symptoms.length > 0) {
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ""));
      if (activeCategory) cleanFilters.symptom_location = activeCategory;
      scoreMutation.mutate({ symptoms, filters: cleanFilters });
    }
  };

  const handleAddSymptom = () => {
    if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
      setSymptoms(prev => [...prev, currentSymptom.trim()]);
      setCurrentSymptom("");
    }
  };

  const handleRemoveSymptom = (symptom: string) => {
    setSymptoms(prev => prev.filter(s => s !== symptom));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleAddSymptom(); }
  };

  const handleSubmit = () => {
    if (symptoms.length === 0) return;
    const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ""));
    if (activeCategory) cleanFilters.symptom_location = activeCategory;
    scoreMutation.mutate({ symptoms, filters: cleanFilters });
  };

  const resetForm = () => {
    setSymptoms([]); setCurrentSymptom("");
    setFilters({ age_group: "", gender: "", condition_type: "", potency: "" });
    setShowResults(false); setShowQuestionnaire(false);
    setQuestionAnswers({}); setCurrentQuestionIdx(0);
    scoreMutation.reset();
  };

  // Header shown on every page
  const PageHeader = () => (
    <header className="bg-white border-b border-gray-100 shadow-sm mb-6">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-lg">🌿</span>
          </div>
          <span className="font-bold text-green-700 text-lg">HomeoWell</span>
        </button>
      </div>
    </header>
  );

  // ── QUESTIONNAIRE VIEW ──────────────────────────────────────
  if (showQuestionnaire) {
    const currentQ = questions[currentQuestionIdx];
    const progress = ((currentQuestionIdx) / questions.length) * 100;

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
                <span className="text-sm text-gray-400">
                  {currentQuestionIdx + 1} / {questions.length}
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {activeCategory && (
                <p className="text-xs text-gray-400 mt-2">Category: {activeCategory}</p>
              )}
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mb-5">{currentQ.q}</h3>

            <div className="grid grid-cols-2 gap-3">
              {currentQ.options.map(option => (
                <button
                  key={option}
                  onClick={() => handleAnswerQuestion(option)}
                  className="p-3 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 text-left text-sm font-medium text-gray-700 transition-all"
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="flex justify-between mt-6">
              {currentQuestionIdx > 0 && (
                <Button variant="outline" size="sm" onClick={() => setCurrentQuestionIdx(prev => prev - 1)}>
                  ← Back
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkipQuestionnaire}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                Skip questions →
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ── RESULTS VIEW ───────────────────────────────────────────
  if (showResults && scoreMutation.data) {
    return (
      <div>
        <PageHeader />
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">Remedy Recommendations</h2>
                <p className="text-neutral-600">
                  Found {scoreMutation.data.length} matching remedies
                  {activeCategory && ` in ${activeCategory}`}
                </p>
              </div>
              <Button variant="outline" onClick={resetForm} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> New Search
              </Button>
            </div>

            {/* Answered questions summary */}
            {Object.keys(questionAnswers).length > 0 && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle size={14} /> Symptoms refined by your answers:
                </p>
                <div className="flex flex-wrap gap-1">
                  {Object.values(questionAnswers).map((a, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              {scoreMutation.data.map((result: RemedyScore) => (
                <RemedyCardEnhanced
                  key={result.remedy.id}
                  remedy={result.remedy}
                  score={result.score}
                  confidence={result.confidence}
                  matchingSymptoms={result.matching_symptoms}
                  showFilters={true}
                />
              ))}
            </div>

            {scoreMutation.data.length === 0 && (
              <div className="text-center py-8">
                <p className="text-neutral-600 mb-4">No matching remedies found. Try different symptoms.</p>
                <Button onClick={resetForm}>Try Again</Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ── MAIN INPUT VIEW ────────────────────────────────────────
  return (
    <div>
      <PageHeader />
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Symptom Analysis</h2>
              <p className="text-neutral-600">
                {activeCategory
                  ? `Category: ${activeCategory} — Add more symptoms below`
                  : "Enter your symptoms for AI-powered remedy matching"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <TrendingUp className="w-4 h-4" />
              <span>AI-Powered</span>
            </div>
          </div>

          {scoreMutation.isPending && (
            <div className="flex items-center justify-center py-8 gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
              <span className="text-neutral-600">Analyzing symptoms...</span>
            </div>
          )}

          {!scoreMutation.isPending && (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="symptom-input">Add Symptoms</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="symptom-input"
                      value={currentSymptom}
                      onChange={(e) => setCurrentSymptom(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="e.g., throbbing headache, anxiety, restlessness..."
                      className="flex-1"
                      autoFocus
                    />
                    <Button onClick={handleAddSymptom} disabled={!currentSymptom.trim()}>Add</Button>
                  </div>
                </div>

                {symptoms.length > 0 && (
                  <div>
                    <Label>Current Symptoms ({symptoms.length})</Label>
                    <div className="flex flex-wrap gap-2 mt-2 p-3 bg-neutral-50 rounded-lg">
                      {symptoms.map((symptom) => (
                        <Badge
                          key={symptom}
                          variant="secondary"
                          className="cursor-pointer hover:bg-red-100"
                          onClick={() => handleRemoveSymptom(symptom)}
                        >
                          {symptom} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Separator className="my-6" />

              <AdvancedFilters
                onFiltersChange={setFilters}
                onSearch={handleSubmit}
                isLoading={scoreMutation.isPending}
              />

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setShowQuestionnaire(true)}>
                  <HelpCircle className="w-4 h-4 mr-2" /> Answer Questions
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={resetForm}>Clear</Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={symptoms.length === 0 || scoreMutation.isPending}
                    className="min-w-32 bg-green-600 hover:bg-green-700"
                  >
                    <Search className="w-4 h-4 mr-2" /> Find Remedies
                  </Button>
                </div>
              </div>

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
