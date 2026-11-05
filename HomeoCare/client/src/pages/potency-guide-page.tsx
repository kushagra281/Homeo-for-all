import AppHeader from "@/components/app-header"
import PotencyGuide from "../components/potency-guide"

export default function PotencyGuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <AppHeader />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <PotencyGuide />
      </main>
    </div>
  )
}
