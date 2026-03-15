import Header from "@/components/header";
import PotencyGuide from "../components/potency-guide";

export default function PotencyGuidePage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <PotencyGuide />
      </main>
    </div>
  );
}
