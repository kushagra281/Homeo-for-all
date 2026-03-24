import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, TrendingUp, ArrowLeft } from "lucide-react";
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

interface RemedyScorerProps {
  initialQuery?: string;
  initialCategory?: string;
  category?: string;
}

export default function RemedyScorer({ initialQuery = "", initialCategory = "", category }: RemedyScorerProps) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    age_group: "",
    gender: "",
    symptom_location: initialCategory || category || "",
    condition_type: "",
    potency: ""
  });
  const [showResults, setShowResults] = useState(false);

  // Auto-load from URL params on mount
  useEffect(() => {
    if (initialQuery) {
      // Split by comma if multiple symptoms passed
      const parts = initialQuery.split(",").map(s => s.trim()).filter(Boolean)
      if (parts.length > 0) {
        setSymptoms(parts)
        // Auto submit after setting symptoms
        setTimeout(() => {
          handleAutoSubmit(parts, initialCategory || category || "")
        }, 300)
      }
    } else if (initialCategory || category) {
      // Category selected from rubrics — set as filter and show form
      setFilters(prev => ({
        ...prev,
        symptom_location: initialCategory || category || ""
      }))
    }
  }, [initialQuery, initialCategory])

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
      // Save to history if user is logged in
      await saveSearchHistory(variables.symptoms, data);
    },
  });

  // Auto submit with given symptoms
  const handleAutoSubmit = (syms: string[], cat: string) => {
    if (syms.length === 0) return;
    const cleanFilters = cat ? { symptom_location: cat } : {};
    scoreMutation.mutate({ symptoms: syms, filters: cleanFilters });
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
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSymptom();
    }
  };

  const handleSubmit = () => {
    if (symptoms.length === 0) return;
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== "")
    );
    scoreMutation.mutate({ symptoms, filters: cleanFilters });
  };

  const resetForm = () => {
    setSymptoms([]);
    setCurrentSymptom("");
    setFilters({
      age_group: "",
      gender: "",
      symptom_location: "",
      condition_type: "",
      potency: ""
    });
    setShowResults(false);
    scoreMutation.reset();
  };

  if (showResults && scoreMutation.data) {
    return <ScoredResults results={scoreMutation.data} onBack={resetForm} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Symptom Analysis & Remedy Scoring</h2>
            <p className="text-neutral-600">
              {initialCategory || category
                ? `Category: ${initialCategory || category} — Add symptoms to find remedies`
                : "Enter your symptoms to get percentage-based remedy recommendations"}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <TrendingUp className="w-4 h-4" />
            <span>AI-Powered Matching</span>
          </div>
        </div>

        {/* Loading state when auto-submitting */}
        {scoreMutation.isPending && symptoms.length > 0 && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
            <span className="text-neutral-600">Analyzing symptoms...</span>
          </div>
        )}

        {/* Symptom Input */}
        {!scoreMutation.isPending && (
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
                  autoFocus={!initialQuery}
                />
                <Button onClick={handleAddSymptom} disabled={!currentSymptom.trim()}>
                  Add
                </Button>
              </div>
            </div>

            {/* Current Symptoms */}
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
        )}

        <Separator className="my-6" />

        {/* Advanced Filters */}
        {!scoreMutation.isPending && (
          <AdvancedFilters
            onFiltersChange={setFilters}
            onSearch={handleSubmit}
            isLoading={scoreMutation.isPending}
          />
        )}

        {!scoreMutation.isPending && (
          <div className="flex justify-end gap-3 mt-8">
            <Button variant="outline" onClick={resetForm}>
              Clear All
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={symptoms.length === 0 || scoreMutation.isPending}
              className="min-w-32 bg-green-600 hover:bg-green-700"
            >
              <Search className="w-4 h-4 mr-2" />
              Find Remedies
            </Button>
          </div>
        )}

        {/* Error */}
        {scoreMutation.isError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            Something went wrong. Please try again.
          </div>
        )}
      </Card>
    </div>
  );
}

function ScoredResults({ results, onBack }: { results: RemedyScore[]; onBack: () => void }) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Remedy Recommendations</h2>
            <p className="text-neutral-600">
              Found {results.length} matching remedies, sorted by compatibility score
            </p>
          </div>
          <Button variant="outline" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            New Search
          </Button>
        </div>

        <div className="space-y-4">
          {results.map((result) => (
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

        {results.length === 0 && (
          <div className="text-center py-8">
            <p className="text-neutral-600 mb-4">
              No matching remedies found. Try different symptoms or remove filters.
            </p>
            <Button onClick={onBack}>Try Again</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
