import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { queryClient } from "@/lib/queryClient";
import type { DiagnosticQuestion, RemedyScore } from "@shared/schema";
import { AGE_GROUPS, GENDERS, SYMPTOM_TYPES } from "@shared/schema";

interface DiagnosticWizardProps {
  bodySystem: string;
  onComplete: (results: RemedyScore[]) => void;
  onClose: () => void;
}

interface Answer {
  questionId: string;
  value: string | string[] | number;
}

export default function DiagnosticWizard({ bodySystem, onComplete, onClose }: DiagnosticWizardProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    age_group: "",
    gender: "",
    symptom_type: "",
    potency: ""
  });

  const { data: questions, isLoading } = useQuery<DiagnosticQuestion[]>({
    queryKey: ["/api/questions", bodySystem],
  });

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
    onSuccess: (data) => {
      onComplete(data);
    },
  });

  const currentQuestion = questions?.[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === (questions?.length || 0) - 1;
  const progress = questions ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  const handleAnswer = (value: string | string[] | number) => {
    const newAnswer: Answer = {
      questionId: currentQuestion?.id || "",
      value,
    };

    setAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== currentQuestion?.id);
      return [...filtered, newAnswer];
    });

    // Add to symptoms list based on answer
    if (typeof value === "string" && value !== "") {
      setSelectedSymptoms(prev => [...new Set([...prev, value])]);
    } else if (Array.isArray(value)) {
      setSelectedSymptoms(prev => [...new Set([...prev, ...value])]);
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // Submit for scoring
      scoreMutation.mutate({
        symptoms: selectedSymptoms,
        filters: Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ""))
      });
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const getCurrentAnswer = () => {
    return answers.find(a => a.questionId === currentQuestion?.id)?.value;
  };

  const isAnswered = () => {
    const answer = getCurrentAnswer();
    return answer !== undefined && answer !== "" && (!Array.isArray(answer) || answer.length > 0);
  };

  if (isLoading) {
    return (
      <Card className="p-8 max-w-2xl mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading diagnostic questions...</p>
        </div>
      </Card>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <Card className="p-8 max-w-2xl mx-auto">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Questions Available</h3>
          <p className="text-neutral-600 mb-4">
            Diagnostic questions for {bodySystem} are not yet available.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress Bar */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Question {currentQuestionIndex + 1} of {questions.length}</span>
          <span className="text-sm text-neutral-600">{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="w-full" />
      </Card>

      {/* Filters Section */}
      {currentQuestionIndex === 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Personal Information (Optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="age-group">Age Group</Label>
              <Select value={filters.age_group} onValueChange={(value) => setFilters(prev => ({ ...prev, age_group: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select age group" />
                </SelectTrigger>
                <SelectContent>
                  {AGE_GROUPS.map(age => (
                    <SelectItem key={age} value={age}>{age.charAt(0).toUpperCase() + age.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Select value={filters.gender} onValueChange={(value) => setFilters(prev => ({ ...prev, gender: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.filter(g => g !== "any").map(gender => (
                    <SelectItem key={gender} value={gender}>{gender.charAt(0).toUpperCase() + gender.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {/* Question Card */}
      <Card className="p-8">
        <h2 className="text-xl font-semibold mb-6">{currentQuestion?.question}</h2>

        {currentQuestion?.type === "single" && (
          <RadioGroup value={getCurrentAnswer() as string} onValueChange={handleAnswer}>
            <div className="space-y-3">
              {currentQuestion.options?.map((option) => (
                <div key={option} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={option} />
                  <Label htmlFor={option} className="flex-1 cursor-pointer">{option}</Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )}

        {currentQuestion?.type === "multiple" && (
          <div className="space-y-3">
            {currentQuestion.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={option}
                  checked={(getCurrentAnswer() as string[] || []).includes(option)}
                  onCheckedChange={(checked) => {
                    const current = getCurrentAnswer() as string[] || [];
                    const newValue = checked
                      ? [...current, option]
                      : current.filter(v => v !== option);
                    handleAnswer(newValue);
                  }}
                />
                <Label htmlFor={option} className="flex-1 cursor-pointer">{option}</Label>
              </div>
            ))}
          </div>
        )}

        {currentQuestion?.type === "scale" && (
          <div className="space-y-4">
            <Slider
              value={[getCurrentAnswer() as number || 5]}
              onValueChange={(value) => handleAnswer(value[0])}
              max={10}
              min={1}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-neutral-500">
              <span>1 (Mild)</span>
              <span className="font-medium">Current: {getCurrentAnswer() || 5}</span>
              <span>10 (Severe)</span>
            </div>
          </div>
        )}
      </Card>

      {/* Selected Symptoms Summary */}
      {selectedSymptoms.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-3">Selected Symptoms ({selectedSymptoms.length})</h4>
          <div className="flex flex-wrap gap-2">
            {selectedSymptoms.map((symptom) => (
              <Badge key={symptom} variant="secondary" className="text-xs">
                {symptom}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleNext}
            disabled={!isAnswered() || scoreMutation.isPending}
          >
            {scoreMutation.isPending ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Analyzing...
              </div>
            ) : isLastQuestion ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Get Remedies
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
