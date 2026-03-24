import { useSearch } from "wouter";
import RemedyScorer from "../components/remedy-scorer";

export default function SymptomAnalysis() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const query = params.get("q") || "";
  const category = params.get("category") || "";

  return (
    <div className="min-h-screen bg-neutral-50">
      <RemedyScorer initialQuery={query} initialCategory={category} />
    </div>
  );
}
