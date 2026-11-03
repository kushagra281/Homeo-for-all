import { useState, useEffect, useRef, useMemo } from "react";
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
import { saveSearchHistory, getHealthProfile } from "@/lib/supabase";
import { checkReportFile, takePendingReports } from "@/lib/pendingReports";
import { detectRedFlags, type RedFlag } from "@shared/redFlags";
import LanguageMenu from "./language-menu";
import { psychologySummary } from "@/lib/psychology";
import { nextQuestion, plannedCount, answerPhrases, answerLines, psyAnswersOf, detectTopics, TOPIC_LABELS, type CaseState, type CaseQuestion } from "@/lib/caseTaking";
import { fetchNextQuestion, fetchExplanation, type AiExplanation } from "@/lib/aiCase";

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

// ── Red-flag banner: warning signs come before any remedy ─────────
function RedFlagBanner({ flags }: { flags: RedFlag[] }) {
  if (!flags.length) return null;
  const danger = flags.some((f) => f.level === "danger");
  return (
    <div
      role="alert"
      className={`rounded-lg border p-4 mb-4 ${danger ? "bg-red-50 border-red-300 text-red-800" : "bg-yellow-50 border-yellow-300 text-yellow-900"}`}
    >
      <p className="font-semibold flex items-center gap-2 mb-2">
        {danger ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
        {danger ? "Please see a doctor first" : "Please get this checked by a doctor"}
      </p>
      <ul className="space-y-1 text-sm list-disc pl-5">
        {flags.map((f) => <li key={f.code}>{f.message}</li>)}
      </ul>
      <p className="text-xs mt-2 opacity-80">
        This app only compares symptoms with materia medica text. It does not diagnose, and homeopathic analysis is not a substitute for medical evaluation.
      </p>
    </div>
  );
}

// ── Mental and physical matches side by side ──────────────────────
function MatchSplit({ result }: { result: any }) {
  const mental: string[] = result.mental_matches || [];
  const physical: string[] = result.physical_matches || (result.mental_matches ? [] : result.matching_symptoms || []);
  if (!mental.length && !physical.length) return null;
  return (
    <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div className="rounded-lg bg-purple-50 border border-purple-100 p-2">
        <p className="text-xs font-medium text-purple-800 mb-1">🧠 Mental symptoms matched</p>
        {mental.length ? (
          <div className="flex flex-wrap gap-1">
            {mental.map((m, i) => <Badge key={i} variant="outline" className="text-xs bg-white">{m}</Badge>)}
          </div>
        ) : <p className="text-xs text-purple-700/70">None of your mental symptoms matched this remedy.</p>}
      </div>
      <div className="rounded-lg bg-gray-50 border border-gray-100 p-2">
        <p className="text-xs font-medium text-gray-700 mb-1">🩺 Physical symptoms matched</p>
        {physical.length ? (
          <div className="flex flex-wrap gap-1">
            {physical.map((m, i) => <Badge key={i} variant="outline" className="text-xs bg-white">{m}</Badge>)}
          </div>
        ) : <p className="text-xs text-gray-500">None of your physical symptoms matched this remedy.</p>}
      </div>
    </div>
  );
}

// ── Confidence badge ──────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color =
    confidence >= 60 ? "bg-green-100 text-green-700 border-green-300" :
    confidence >= 35 ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                       "bg-gray-100 text-gray-500 border-gray-300";
  const label =
    confidence >= 60 ? "Broad match" :
    confidence >= 35 ? "Partial match" : "Narrow match";

  return (
    <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${color}`}>
      {label}
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

// Short text version of the saved health profile, shown (and editable) as "Patient history".
const HISTORY_FIELDS: [string, string][] = [
  ["diabetes", "diabetes"], ["blood_pressure", "blood pressure"], ["thyroid", "thyroid"],
  ["asthma", "asthma"], ["arthritis", "arthritis"], ["heart_disease", "heart disease"],
  ["kidney", "kidney disease"], ["gastritis", "gastritis"], ["migraine", "migraine"],
  ["cholesterol", "cholesterol"], ["allergy", "allergy"], ["depression_anxiety", "anxiety / depression"],
  ["skin_condition", "skin condition"], ["constipation", "constipation"], ["pcod", "PCOD"],
];
const NONE_VALUES = new Set(["", "none", "no", "nil", "normal", "n/a", "na", "-"]);
function summariseHistory(p: Record<string, any>): string {
  const parts: string[] = [];
  for (const [key, label] of HISTORY_FIELDS) {
    const v = typeof p[key] === "string" ? p[key].trim().toLowerCase() : "";
    if (!NONE_VALUES.has(v)) parts.push(label);
  }
  for (const key of ["chronic_conditions", "other_conditions", "injury_history"]) {
    const v = typeof p[key] === "string" ? p[key].trim() : "";
    if (!NONE_VALUES.has(v.toLowerCase())) parts.push(v);
  }
  return parts.join(", ");
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
  const [showResults, setShowResults] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [caseAnswers, setCaseAnswers] = useState<Record<string, string[]>>({});   // question id -> chosen answers
  const [answerOrder, setAnswerOrder] = useState<string[]>([]);                   // order answered, for Back
  const [picked, setPicked] = useState<string[]>([]);                             // selection on the open question
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [analyzingFiles, setAnalyzingFiles] = useState<string[]>([]);
  const [reportError, setReportError] = useState("");
  const [historyText, setHistoryText] = useState("");
  const [historySaveError, setHistorySaveError] = useState("");
  const [healthProfile, setHealthProfile] = useState<Record<string, any> | null>(null);
  // The AI writes the next question from the symptoms and answers. If it is unavailable (no key, slow,
  // bad reply) the built-in question bank takes over, so the interview never blocks.
  const [aiQ, setAiQ] = useState<CaseQuestion | null>(null);
  const [aiCustom, setAiCustom] = useState<Record<string, CaseQuestion>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOff, setAiOff] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const aiReq = useRef(0);
  const [aiExplain, setAiExplain] = useState<{ loading: boolean; data: AiExplanation | null }>({ loading: false, data: null });
  const activeCategory0 = initialCategory || category || "";
  const caseState: CaseState = useMemo(
    () => ({ symptoms, category: activeCategory0, answers: caseAnswers, custom: aiCustom }),
    [symptoms, activeCategory0, caseAnswers, aiCustom],
  );
  // "Question: answer" text from the interview, used for the red-flag scan and the result screen.
  const questionAnswers: Record<string, string> = useMemo(
    () => Object.fromEntries(answerLines(caseState).map((l) => [l.question, l.answer])),
    [caseState],
  );
  const redFlags = useMemo(
    () => detectRedFlags(
      [...symptoms.filter((x) => !x.startsWith("🔍")), ...Object.values(questionAnswers), historyText],
      healthProfile as any,
    ),
    [symptoms, questionAnswers, historyText, healthProfile],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const activeCategory = initialCategory || category || "";
  const avoidList = AVOID_RECOMMENDATIONS[activeCategory] || DEFAULT_AVOID;

  useEffect(() => {
    getHealthProfile()
      .then((p) => {
        if (!p) return;
        setHealthProfile(p);
        const summary = summariseHistory(p);
        if (summary) setHistoryText((prev) => (prev.trim() ? prev : summary));
      })
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
      healthHistory?: string;
    }) => {
      const response = await fetch("/api/remedies/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symptoms:      data.symptoms,
          filters:       data.filters,
          healthProfile: data.healthProfile,
          healthHistory: data.healthHistory,
        }),
      });
      if (!response.ok) throw new Error("Failed to score remedies");
      return response.json();
    },
    onSuccess: async (data, variables) => {
      setShowResults(true);
      setHistorySaveError("");
      try {
        const saved = await saveSearchHistory(variables.symptoms, data, variables.healthHistory);
        if (!saved?.ok && saved?.reason !== "not signed in") {
          setHistorySaveError("This consultation could not be saved to your history. Please try again later.");
        }
      } catch {
        setHistorySaveError("This consultation could not be saved to your history. Please try again later.");
      }
    },
  });

  const submitToAI = (syms: string[], answers: Record<string, string[]>) => {
    const allSymptoms = [
      ...syms.filter((s) => !s.startsWith("🔍")),   // "Analyzing..." placeholders are not symptoms
      ...answerPhrases({ symptoms: syms, category: activeCategory, answers, custom: aiCustom }),   // every interview answer
      ...(activeCategory ? [`category: ${activeCategory}`] : []),
    ].filter(Boolean);

    const cleanFilters: any = {};
    if (activeCategory) cleanFilters.symptom_location = activeCategory;

    scoreMutation.mutate({ symptoms: allSymptoms, filters: cleanFilters, healthProfile, healthHistory: historyText.trim() });
  };

  const useAi = !aiOff && !aiDone;
  const currentQ = useAi ? aiQ : nextQuestion(caseState);

  const finishInterview = (answers: Record<string, string[]>) => {
    aiReq.current += 1; setAiLoading(false);             // a late AI reply must not search a second time
    setShowQuestionnaire(false);
    setPicked([]);
    if (symptoms.length > 0 || Object.keys(answers).length > 0) submitToAI(symptoms, answers);
  };

  // Ask the AI for the next question whenever none is open.
  useEffect(() => {
    if (!showQuestionnaire || !useAi || aiQ || aiLoading) return;
    const real = symptoms.filter((x) => !x.startsWith("🔍"));
    const sent = real.length ? real : activeCategory ? [`${activeCategory} complaint`] : [];
    if (!sent.length) { setAiOff(true); return; }
    const id = `ai-${++aiReq.current}`;
    setAiLoading(true);
    fetchNextQuestion(sent, answerLines(caseState, true), id).then((r) => {
      if (id !== `ai-${aiReq.current}`) return;           // a newer request or a reset replaced this one
      setAiLoading(false);
      if (!r) { setAiOff(true); return; }
      if (r.done) { setAiDone(true); finishInterview(caseAnswers); return; }
      setAiCustom((c) => ({ ...c, [id]: r.question }));
      setAiQ(r.question);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showQuestionnaire, useAi, aiQ, aiLoading, answerOrder.length]);

  // Records the open question (empty list = skipped) and moves on, or searches when the case is complete.
  const commitAnswer = (labels: string[]) => {
    if (!currentQ) return;
    const answers = { ...caseAnswers, [currentQ.id]: labels };
    setCaseAnswers(answers);
    setAnswerOrder((prev) => [...prev, currentQ.id]);
    setPicked([]);
    if (useAi) { setAiQ(null); return; }                   // the effect above fetches the next one
    if (!nextQuestion({ symptoms, category: activeCategory, answers, custom: aiCustom })) finishInterview(answers);
  };

  const togglePick = (label: string) => {
    if (!currentQ) return;
    if (!currentQ.multi) { commitAnswer([label]); return; }
    const NONE = "None of these";
    setPicked((prev) => label === NONE ? (prev.includes(NONE) ? [] : [NONE]) :
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev.filter((x) => x !== NONE), label]);
  };

  const goBack = () => {
    const last = answerOrder[answerOrder.length - 1];
    if (!last) return;
    const { [last]: previous, ...rest } = caseAnswers;
    setCaseAnswers(rest);
    setAnswerOrder((prev) => prev.slice(0, -1));
    setPicked(previous || []);
    if (useAi) { aiReq.current += 1; setAiLoading(false); setAiQ(aiCustom[last] || null); }   // show the earlier AI question again
  };

  const handleSkipQuestionnaire = () => finishInterview(caseAnswers);

  // AI explanation of the ranking the engine already made (it cannot change the ranking).
  useEffect(() => {
    const data = scoreMutation.data as any[] | undefined;
    if (!showResults || !data?.length) return;
    const ranked = data.slice(0, 5).map((r: any) => ({
      name: String(r.remedy?.name || ""), score: Math.round(Number(r.score) || 0),
      mental: (r.mental_matches || []).slice(0, 6), physical: (r.physical_matches || r.matching_symptoms || []).slice(0, 6),
    })).filter((r) => r.name);
    const real = symptoms.filter((x) => !x.startsWith("🔍"));
    const lines = [
      ...answerLines(caseState),
    ];
    let cancelled = false;
    setAiExplain({ loading: true, data: null });
    fetchExplanation(real.length ? real : [activeCategory || "complaint"], lines, ranked)
      .then((d) => { if (!cancelled) setAiExplain({ loading: false, data: d }); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResults, scoreMutation.data]);

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

  // Reads report photos, extracts symptoms with the AI and adds them to the search.
  // Diagnoses/medicines found in the report go to the patient history instead of the symptom list.
  const analyzeFiles = async (files: File[]) => {
    for (const file of files) {
      const problem = checkReportFile(file);
      if (problem) { setReportError(`${file.name}: ${problem}.`); continue; }
      setReportError("");
      setUploadedFiles((prev) => [...prev, file]);
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

        const response = await fetch("/api/remedies/analyze-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
        });

        setSymptoms((prev) => prev.filter((s) => s !== placeholder));
        setAnalyzingFiles((prev) => prev.filter((n) => n !== file.name));

        if (response.ok) {
          const result = await response.json();
          const found: string[]  = (result.symptoms   || []).filter(Boolean);
          const conds: string[]  = (result.conditions || []).filter(Boolean);
          if (found.length) setSymptoms((prev) => [...prev, ...found.filter((x) => !prev.includes(x))]);
          if (conds.length) {
            setHistoryText((prev) => {
              const have = prev.toLowerCase();
              const add = conds.filter((c) => !have.includes(c.toLowerCase()));
              return add.length ? [prev.trim(), ...add].filter(Boolean).join(", ") : prev;
            });
          }
          if (!found.length && !conds.length) {
            setReportError(`No symptoms could be read from ${file.name}. Please type them instead.`);
          }
        } else {
          setReportError(`Could not read ${file.name}. Please type the symptoms instead.`);
        }
      } catch {
        setSymptoms((prev) => prev.filter((s) => s !== placeholder));
        setAnalyzingFiles((prev) => prev.filter((n) => n !== file.name));
        setReportError(`Could not read ${file.name}. Please type the symptoms instead.`);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length) await analyzeFiles(files);
  };

  // Files picked with the paperclip on the home page arrive here.
  useEffect(() => {
    const pending = takePendingReports();
    if (pending.length) analyzeFiles(pending);
  }, []);

  // "Apply & Search" starts the case-taking questions (mind and body); the search runs when they end.
  const handleSubmit = () => {
    if (symptoms.length === 0) return;
    setPicked([]);
    setShowQuestionnaire(true);
  };

  const resetForm = () => {
    setSymptoms([]); setCurrentSymptom(""); setUploadedFiles([]);
    setShowResults(false); setShowQuestionnaire(false);
    setCaseAnswers({}); setAnswerOrder([]); setPicked([]);
    aiReq.current += 1; setAiQ(null); setAiCustom({}); setAiLoading(false); setAiOff(false); setAiDone(false); setAiExplain({ loading: false, data: null });
    setAnalyzingFiles([]); setReportError(""); setHistorySaveError("");
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
        <div className="flex items-center gap-2">
          {activeCategory && (
            <Badge className="bg-green-100 text-green-700 border-green-300">{activeCategory}</Badge>
          )}
          <LanguageMenu />
        </div>
      </div>
    </header>
  );

  // ── QUESTIONNAIRE ─────────────────────────────────────────────
  if (showQuestionnaire) {
    if (useAi && !currentQ) {
      return (
        <div>
          <PageHeader />
          <div className="max-w-2xl mx-auto px-4">
            <Card className="p-6 text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" />
              <p className="text-gray-700">Thinking about your case…</p>
              <div className="flex justify-center gap-3">
                {answerOrder.length > 0 && (
                  <Button variant="outline" size="sm" onClick={goBack}>← Back</Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleSkipQuestionnaire} className="text-gray-500">Show results now →</Button>
              </div>
            </Card>
          </div>
        </div>
      );
    }
    if (!currentQ) {
      // every relevant question is already answered: nothing more to ask
      return (
        <div>
          <PageHeader />
          <div className="max-w-2xl mx-auto px-4">
            <Card className="p-6 text-center space-y-4">
              <p className="text-gray-700">
                {Object.keys(caseAnswers).length > 0
                  ? "All the questions for these symptoms are answered."
                  : "Add a symptom first so the questions can match it."}
              </p>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={() => setShowQuestionnaire(false)}>← Back to symptoms</Button>
                {Object.keys(caseAnswers).length > 0 && (
                  <Button className="bg-green-600 hover:bg-green-700" onClick={() => finishInterview(caseAnswers)}>Find remedies</Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      );
    }
    const answeredCount = answerOrder.length;
    const total = useAi ? 12 : Math.max(plannedCount(caseState), answeredCount + 1);
    const progress = Math.min(95, (answeredCount / total) * 100);
    const topics = detectTopics(symptoms.filter((x) => !x.startsWith("🔍")), activeCategory);
    return (
      <div>
        <PageHeader />
        <div className="max-w-2xl mx-auto px-4">
          <Card className="p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-green-700">
                  <HelpCircle size={20} />
                  <span className="font-semibold">Understanding your case</span>
                </div>
                <span className="text-sm text-gray-400">Question {answeredCount + 1}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {useAi && <Badge className="text-xs bg-green-100 text-green-700 border-green-300">AI-guided</Badge>}
                {topics.slice(0, 3).map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{TOPIC_LABELS[t] || t}</Badge>
                ))}
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-800 mb-1">{currentQ.text}</h3>
            <p className="text-xs text-gray-400 mb-5" data-testid="question-why">{currentQ.why}</p>
            {currentQ.multi && <p className="text-xs text-gray-500 mb-2">Choose all that apply, then press Next.</p>}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {currentQ.options.map((opt) => {
                const on = picked.includes(opt.label);
                return (
                  <button key={opt.label} onClick={() => togglePick(opt.label)} aria-pressed={on}
                    className={`p-3 rounded-xl border-2 text-left text-sm font-medium text-gray-700 transition-all ${on ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-green-500 hover:bg-green-50"}`}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {currentQ.multi && (
              <Button className="w-full mb-4 bg-green-600 hover:bg-green-700" disabled={picked.length === 0}
                onClick={() => commitAnswer(picked)}>Next →</Button>
            )}

            <div className="border-t pt-4 mt-2">
              <p className="text-xs text-gray-400 mb-2">Or add another symptom (the next questions will follow it):</p>
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

            <div className="flex items-center justify-between mt-4 gap-2">
              {answeredCount > 0 && (
                <Button variant="outline" size="sm" onClick={goBack}>← Back</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => commitAnswer([])} className="text-gray-400">
                Skip this question
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkipQuestionnaire} className="text-gray-500">
                Show results now →
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
    // Beyond the top three: keep any remedy that matches a mental symptom (second-place, fourth, fifth ...).
    const keynoteResults = scoreMutation.data.slice(3).filter((r: any) => r.keynote_matched);

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
                  {" "}— matched against materia medica text
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

            <RedFlagBanner flags={redFlags} />

            {historySaveError && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                {historySaveError}
              </div>
            )}
            {scoreMutation.data?.[0]?.history_considered?.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-800">
                <span className="font-medium">Patient history considered:</span>{" "}
                {scoreMutation.data[0].history_considered.join(", ")}
              </div>
            )}

            {psychologySummary(psyAnswersOf(caseState)).length > 0 && (
              <div className="mb-4 p-3 bg-purple-50 rounded-lg text-xs text-purple-900">
                <span className="font-medium">Mind and emotions considered:</span>{" "}
                {psychologySummary(psyAnswersOf(caseState)).map((x) => `${x.question} ${x.answer}`).join(" · ")}
              </div>
            )}

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

            {(aiExplain.loading || aiExplain.data) && (
              <div className="mb-4 p-4 rounded-lg border border-indigo-200 bg-indigo-50" data-testid="ai-explanation">
                <p className="text-sm font-semibold text-indigo-900 mb-2">🧠 Case analysis</p>
                {aiExplain.loading && <p className="text-xs text-indigo-700">Writing the analysis of your case…</p>}
                {aiExplain.data && (
                  <div className="space-y-2 text-sm text-indigo-950">
                    {aiExplain.data.overview && <p>{aiExplain.data.overview}</p>}
                    {aiExplain.data.remedies.map((r) => (
                      <p key={r.name}>
                        <span className="font-semibold notranslate" translate="no">{r.name}:</span> {r.why}
                        {r.against && <span className="text-indigo-800"> <em>Against:</em> {r.against}</span>}
                      </p>
                    ))}
                    {aiExplain.data.ask_next.length > 0 && (
                      <div>
                        <p className="font-medium">To tell the top remedies apart, ask:</p>
                        <ul className="list-disc pl-5">{aiExplain.data.ask_next.map((q) => <li key={q}>{q}</li>)}</ul>
                      </div>
                    )}
                    <p className="text-xs text-indigo-700 pt-1">
                      Written by AI from the matches below. The ranking itself comes only from the materia medica text, and this is not medical advice.
                    </p>
                  </div>
                )}
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
                        <h3 className="text-lg font-bold text-gray-900 notranslate" translate="no">{result.remedy?.name}</h3>
                        {result.remedy?.abbreviation && (
                          <span className="text-xs text-gray-400">({result.remedy.abbreviation})</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{result.remedy?.condition}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-2xl font-bold text-green-600">{result.score}%</div>
                      <div className="text-xs text-gray-400">relative match</div>
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

                  {result.history_matches?.length > 0 && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 mb-3">
                      <p className="text-xs text-blue-800">
                        <span className="font-semibold">🩺 Also fits the patient history:</span>{" "}
                        {result.history_matches.join(", ")}
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

                  {/* Mental and physical matches, shown separately */}
                  <MatchSplit result={result} />

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

            {/* Remedies below the top three that still match the mental symptoms */}
            {keynoteResults.length > 0 && (
              <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50/50 p-4">
                <h3 className="font-bold text-purple-900 mb-1">Also matches your mental symptoms</h3>
                <p className="text-xs text-purple-800/80 mb-3">
                  These scored lower overall, but they cover your mind and emotion symptoms, so they are not hidden.
                </p>
                <div className="space-y-3">
                  {keynoteResults.map((r: any, i: number) => (
                    <div key={i} className="bg-white border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-gray-900 notranslate" translate="no">{r.remedy?.name}</span>
                        <span className="text-sm text-gray-500">{r.score}% relative match</span>
                      </div>
                      <MatchSplit result={r} />
                    </div>
                  ))}
                </div>
              </div>
            )}

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

                {/* Patient history */}
                <div>
                  <Label>Patient history (optional)</Label>
                  <p className="text-xs text-gray-400 mb-2 mt-0.5">
                    Existing conditions, past illnesses or injuries. It is used to refine the ranking
                    of remedies that already match the symptoms, and is saved with this consultation.
                  </p>
                  <textarea
                    value={historyText}
                    onChange={(e) => setHistoryText(e.target.value)}
                    maxLength={600}
                    rows={2}
                    placeholder="e.g. diabetes, hypothyroid, knee injury in 2022"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                {/* File upload */}
                <div>
                  <Label>Clinical Reports (Optional)</Label>
                  <p className="text-xs text-gray-400 mb-2 mt-0.5">
                    Upload a photo or screenshot of the report (JPG, PNG, WebP) — AI will read the symptoms and add them to the search
                  </p>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.gif,image/*"
                        multiple
                        onChange={handleFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Button type="button" variant="outline"
                        className="w-full border-dashed border-2 border-gray-300 hover:border-green-400">
                        <Paperclip size={16} className="mr-2 text-green-600" />
                        Upload Photos
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

              <RedFlagBanner flags={redFlags} />

              {Number(healthProfile?.age) > 0 && Number(healthProfile?.age) < 14 && (
                <div className="mt-3 text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3">
                  ⚠️ This profile is for a child. Please consult a qualified paediatrician or homeopath before giving any remedy.
                </div>
              )}

              <Separator className="my-6" />

              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={scoreMutation.isPending || symptoms.length === 0 || analyzingFiles.length > 0}
                  className="bg-green-600 hover:bg-green-700 text-sm"
                >
                  {scoreMutation.isPending
                    ? <span className="flex items-center gap-2"><span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" /> Searching...</span>
                    : <span className="flex items-center gap-2"><Search size={14} /> Apply & Search</span>}
                </Button>
              </div>

              {analyzingFiles.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-500" />
                  AI is reading your report... please wait before searching.
                </div>
              )}

              {reportError && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                  {reportError}
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
