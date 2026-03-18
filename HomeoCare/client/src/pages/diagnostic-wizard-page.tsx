import { useState } from "react";
import { useParams, useLocation } from "wouter";
import Header from "@/components/header";
import DiagnosticWizard from "../components/diagnostic-wizard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { RemedyScore } from "@shared/schema";

export default function DiagnosticWizardPage() {
  const { bodySystem } = useParams();
  const [, setLocation] = useLocation();
  const [results, setResults] = useState<RemedyScore[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleComplete = (remedyResults: RemedyScore[]) => {
    setResults(remedyResults);
    setShowResults(true);
  };

  const handleClose = () => {
    setLocation("/");
  };

  if (!bodySystem) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <Header />
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <p className="text-lg text-neutral-600">Invalid body system selected.</p>
          <Button onClick={() => setLocation("/")} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Button
          variant="ghost"
          onClick={handleClose}
          className="flex items-center space-x-2 text-neutral-600 hover:text-neutral-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to home</span>
        </Button>

        {!showResults ? (
          <DiagnosticWizard
            bodySystem={bodySystem}
            onComplete={handleComplete}
            onClose={handleClose}
          />
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Diagnostic Results</h2>
              <p className="text-neutral-600">
                Found {results.length} recommended remedies for {bodySystem}
              </p>
            </div>
            
            <div className="grid gap-6">
              {results.map((result) => (
                <div
                  key={result.remedy.id}
                  className="bg-white rounded-lg p-6 shadow-sm border"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">{result.remedy.name}</h3>
                      <p className="text-neutral-600">{result.remedy.condition}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{result.score}%</div>
                      <div className="text-sm text-neutral-500">match</div>
                    </div>
                  </div>
                  
                  <p className="text-neutral-700 mb-4">{result.remedy.description}</p>
                  
                  <div className="border-t pt-4">
                    <div className="text-sm">
                      <strong>Dosage:</strong> {result.remedy.dosage}
                    </div>
                    <div className="text-sm mt-2">
                      <strong>Matching symptoms:</strong> {result.matching_symptoms.join(", ")}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center">
              <Button onClick={() => setShowResults(false)} className="mr-4">
                Start New Analysis
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Back to Home
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
