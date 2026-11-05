import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import AppHeader from "@/components/app-header"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { MedicalTerm } from "@shared/schema"

/** Search-only dictionary of homeopathic terms. */
export default function DictionaryPage() {
  const [q, setQ] = useState("")
  const { data: terms = [], isLoading, isError } = useQuery<MedicalTerm[]>({ queryKey: ["/api/medical-terms"], retry: false })

  const needle = q.trim().toLowerCase()
  const hits = needle
    ? terms
        .filter(t =>
          t.term.toLowerCase().includes(needle) ||
          t.definition.toLowerCase().includes(needle) ||
          t.synonyms.some(s => s.toLowerCase().includes(needle)) ||
          Object.values(t.translations || {}).some(v => String(v).toLowerCase().includes(needle)))
        .sort((a, b) => a.term.localeCompare(b.term))
    : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <AppHeader />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
          <Input value={q} onChange={e => setQ(e.target.value)} autoFocus data-testid="dictionary-search"
            placeholder="Search a homeopathic term" className="pl-10 py-5 border-2 border-green-200 focus:border-green-500" />
        </div>

        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
        {isError && <p className="text-sm text-red-500">The dictionary could not be loaded. Please try again.</p>}
        {!needle && !isLoading && !isError && <p className="text-sm text-gray-400">Type a word to look it up.</p>}
        {needle && hits.length === 0 && !isLoading && <p className="text-sm text-gray-500">No term matches “{q.trim()}”.</p>}

        {hits.map(t => (
          <Card key={t.id} className="p-4" data-testid="dictionary-hit">
            <h2 className="font-semibold text-gray-900">{t.term}</h2>
            <p className="text-sm text-gray-600 mt-1">{t.definition}</p>
            {t.synonyms.length > 0 && <p className="text-xs text-gray-400 mt-2">Also: {t.synonyms.join(", ")}</p>}
          </Card>
        ))}
      </main>
    </div>
  )
}
