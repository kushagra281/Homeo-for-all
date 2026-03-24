import { useSearch } from "wouter";
import Header from "@/components/header";
import RemedyScorer from "../components/remedy-scorer";

export default function SymptomAnalysis() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const query = params.get("q") || "";
  const category = params.get("category") || "";

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <RemedyScorer initialQuery={query} initialCategory={category} />
      </main>
    </div>
  );
}
