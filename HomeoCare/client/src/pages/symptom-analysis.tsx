import Header from "@/components/header";
import RemedyScorer from "../components/remedy-scorer";

export default function SymptomAnalysis() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <RemedyScorer />
      </main>
    </div>
  );
}
