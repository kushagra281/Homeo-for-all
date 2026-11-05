// Repertory page: browse the graded repertory (chapter > rubric tree), choose rubrics for a case,
// and see the remedy x rubric grid with totals. The numbers come from /api/repertory/repertorize.
import { Fragment, useEffect, useMemo, useState } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, Plus, Search, Trash2, X } from "lucide-react"
import { apiRequest } from "@/lib/queryClient"
import { supabase, getCurrentUser } from "@/lib/supabase"
import { makeCaseStore, parseState, type CaseRow, type VisitRow } from "@/lib/repertoryCasesCore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

// ── Types (same shapes as server/utils/repertoryStore.ts and services/repertorize.ts) ──
interface Node { id: number; parent_id: number | null; chapter: string; rubric_text: string; full_path: string; depth: number; n_remedies: number; child_count: number }
interface Source { slug: string; title: string; author: string; year: number | null; licence: string; attribution: string; note: string; rubric_count: number; link_count: number }
interface PeekRemedy { abbrev: string; name: string; grade: number }
type Theme = "mental" | "general" | "particular"
interface GridRow { abbrev: string; name: string; total: number; covered: number; themes: Record<Theme, number>; grades: number[] }
interface Compare { methods: Method[]; rows: Array<{ abbrev: string; name: string; covered: number; scores: Record<Method, number>; ranks: Record<Method, number>; best_rank: number }> }
interface RemedyHit extends Node { grades: Record<string, number> }
interface RemedyOpt { abbrev: string; name: string }
type RelKind = "complementary" | "follows" | "antidotes" | "incompatible" | "compare"
interface RelItem { token: string; abbrev?: string; name?: string }
interface Profile { abbrev: string; name: string; common_name: string; source: string; sections: Array<{ heading: string; content: string }>; relationships?: Partial<Record<RelKind, RelItem[]>> }
const REL_LABEL: Record<RelKind, string> = { complementary: "Complementary", follows: "Follows well", antidotes: "Antidotes", incompatible: "Incompatible", compare: "Compare" }
interface Grid {
  rubrics: Array<{ id: number; full_path: string; n_remedies: number; weight: number; theme: Theme }>
  rows: GridRow[]; total_remedies: number; method: Method; min_grade: number
}
type Method = "grades" | "presence" | "emphasis"
type SortBy = "total" | "coverage"

const MAX_RUBRICS = 30
const caseStore = makeCaseStore(supabase, getCurrentUser)
const STORE = "homeowell:repertory-case:v1"

interface SavedCase { ids: number[]; weights: Record<number, number>; exclude: string[]; method: Method; minGrade: number; coverAll: boolean; coverTheme: Theme | ""; sortBy: SortBy }
const EMPTY: SavedCase = { ids: [], weights: {}, exclude: [], method: "grades", minGrade: 1, coverAll: false, coverTheme: "", sortBy: "total" }

function loadCase(): SavedCase {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || "null")
    if (raw && Array.isArray(raw.ids)) {
      return { ...EMPTY, ...raw, ids: raw.ids.filter((n: unknown) => Number.isSafeInteger(n)).slice(0, MAX_RUBRICS) }
    }
  } catch { /* private window or damaged data: start empty */ }
  return EMPTY
}

// Printed repertories show grade 3 in bold, grade 2 in italics and grade 1 plain. The same here.
const gradeCell = (g: number) =>
  g === 3 ? "bg-green-700 text-white font-bold"
  : g === 2 ? "bg-green-400 text-green-950 italic font-semibold"
  : g === 1 ? "bg-green-100 text-green-900"
  : "text-gray-300"

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value)
  useEffect(() => { const h = setTimeout(() => setV(value), ms); return () => clearTimeout(h) }, [value, ms])
  return v
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">{children}</p>
}

// ── One rubric line in the tree or in search results ──────────────
function RubricLine({ node, inCase, full, onToggle }: { node: Node; inCase: boolean; full?: boolean; onToggle: () => void }) {
  const [peek, setPeek] = useState(false)
  const { data } = useQuery<{ remedies: PeekRemedy[] }>({ queryKey: ["/api/repertory/rubric", node.id], enabled: peek, retry: false })
  return (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-sm text-gray-800 break-words">{full ? node.full_path : node.rubric_text}</span>
        </div>
        <button
          onClick={() => setPeek(p => !p)}
          className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-gray-100 hover:bg-green-50 text-gray-600"
          aria-expanded={peek} aria-label={`${node.n_remedies} remedies in this rubric`} data-testid={`peek-${node.id}`}>
          {node.n_remedies}
        </button>
        <button
          onClick={onToggle}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border transition ${
            inCase ? "bg-green-600 border-green-600 text-white" : "border-gray-200 text-gray-500 hover:bg-green-50 hover:text-green-700"}`}
          aria-label={inCase ? "Remove from case" : "Add to case"} data-testid={`add-${node.id}`}>
          {inCase ? <Check size={15} /> : <Plus size={15} />}
        </button>
      </div>
      {peek && (
        <div className="flex flex-wrap gap-1 mt-1 mb-1 pl-1" data-testid={`remedies-${node.id}`}>
          {!data && <span className="text-xs text-gray-400">Loading…</span>}
          {data?.remedies.map(r => (
            <span key={r.abbrev} title={r.name}
              className={`text-xs px-1.5 py-0.5 rounded ${gradeCell(r.grade)}`}>{r.abbrev.replace(/\.$/, "")}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── A branch of the tree; children are fetched only when it is opened ──
function TreeNode({ node, caseIds, onToggle, depth = 0 }: { node: Node; caseIds: number[]; onToggle: (n: Node) => void; depth?: number }) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, isError } = useQuery<Node[]>({ queryKey: ["/api/repertory/children", node.id], enabled: open, retry: false })
  return (
    <div className={depth ? "ml-3 pl-2 border-l border-gray-100" : ""}>
      <div className="flex items-start gap-1">
        {node.child_count > 0 ? (
          <button onClick={() => setOpen(o => !o)} className="mt-1.5 text-gray-400 hover:text-gray-700 shrink-0"
            aria-label={open ? "Close" : "Open"} aria-expanded={open} data-testid={`open-${node.id}`}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : <span className="w-4 shrink-0" />}
        <div className="flex-1 min-w-0">
          <RubricLine node={node} inCase={caseIds.includes(node.id)} onToggle={() => onToggle(node)} />
        </div>
      </div>
      {open && (
        <div>
          {isLoading && <p className="text-xs text-gray-400 ml-6">Loading…</p>}
          {isError && <p className="text-xs text-red-500 ml-6">Could not load this branch.</p>}
          {data?.map(c => <TreeNode key={c.id} node={c} caseIds={caseIds} onToggle={onToggle} depth={depth + 1} />)}
        </div>
      )}
    </div>
  )
}

// ── The page ──────────────────────────────────────────────────────
export default function RepertoryPage() {
  const [, setLocation] = useLocation()
  const [tab, setTab] = useState<"browse" | "remedy" | "case">("browse")
  const [saved, setSaved] = useState<SavedCase>(loadCase)
  const [current, setCurrent] = useState<{ id: string; title: string } | null>(null)   // the saved case being worked on
  const [chapter, setChapter] = useState<Node | null>(null)
  const [text, setText] = useState("")
  const q = useDebounced(text.trim())

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(saved)) } catch { /* storage unavailable */ } }, [saved])
  const patch = (p: Partial<SavedCase>) => setSaved(s => ({ ...s, ...p }))

  const sources = useQuery<Source[]>({ queryKey: ["/api/repertory/sources"], retry: false })
  const chapters = useQuery<Node[]>({ queryKey: ["/api/repertory/chapters"], retry: false })
  const search = useQuery<Node[]>({
    queryKey: ["/api/repertory/search?q=" + encodeURIComponent(q)], enabled: q.length >= 2, retry: false,
  })

  const payload = useMemo(() => ({
    rubricIds: saved.ids, weights: saved.weights, exclude: saved.exclude, method: saved.method,
    minGrade: saved.minGrade, coverAll: saved.coverAll, coverTheme: saved.coverTheme || undefined, sortBy: saved.sortBy, limit: 60,
  }), [saved])
  const grid = useQuery<Grid>({
    queryKey: ["repertorize", JSON.stringify(payload)],
    queryFn: async () => (await apiRequest("POST", "/api/repertory/repertorize", payload)).json(),
    enabled: saved.ids.length > 0, retry: false, placeholderData: keepPreviousData,
  })

  const toggle = (n: Node) => setSaved(s => {
    if (s.ids.includes(n.id)) return { ...s, ids: s.ids.filter(i => i !== n.id) }
    if (s.ids.length >= MAX_RUBRICS) return s
    return { ...s, ids: [...s.ids, n.id] }
  })
  const unavailable = chapters.isError || (sources.isSuccess && sources.data.length === 0)
  const credit = sources.data?.[0]
  const full = saved.ids.length >= MAX_RUBRICS

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="text-green-700" size={20} />
            <span className="font-bold text-green-700 text-lg">Repertory</span>
          </div>
          <button onClick={() => setLocation("/")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={15} /> Back
          </button>
        </div>
        <div className="max-w-5xl mx-auto px-4 flex gap-1">
          {(["browse", "remedy", "case"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === t ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t === "browse" ? "Browse" : t === "remedy" ? "By remedy" : `My case (${saved.ids.length})`}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {unavailable && !chapters.isLoading && (
          <Card className="p-5">
            <h2 className="font-semibold text-gray-800 mb-1">The graded repertory is not loaded yet</h2>
            <p className="text-sm text-gray-600">
              This page needs the repertory tables in the database. The site owner can load them from the scraper
              repository (Actions → “Import repertory”).
            </p>
          </Card>
        )}

        {/* ── BROWSE ─────────────────────────────────────────── */}
        {tab === "browse" && !unavailable && (
          <>
            <Card className="p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input value={text} onChange={e => setText(e.target.value)} className="pl-9"
                  placeholder="Search rubrics, e.g. anxiety night, thirstless, burning" data-testid="rubric-search" />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Use the repertory’s own words. A rubric with only a few remedies narrows a case more than one with hundreds.
                Tap the number to see its remedies, <Plus className="inline" size={11} /> to add it to your case.
              </p>
            </Card>

            {q.length >= 2 ? (
              <Card className="p-3" data-testid="search-results">
                {search.isLoading && <p className="text-sm text-gray-400">Searching…</p>}
                {search.isError && <Notice>Search failed. Please try again.</Notice>}
                {search.data && search.data.length === 0 && <Notice>No rubric contains all of those words.</Notice>}
                {search.data?.map(n => (
                  <div key={n.id} className="border-b border-gray-50 last:border-0">
                    <RubricLine node={n} full inCase={saved.ids.includes(n.id)} onToggle={() => toggle(n)} />
                  </div>
                ))}
                {search.data && search.data.length >= 60 && <p className="text-xs text-gray-400 mt-2">Showing the first 60. Add a word to narrow it.</p>}
              </Card>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5" data-testid="chapters">
                  {chapters.isLoading && <span className="text-sm text-gray-400">Loading chapters…</span>}
                  {chapters.data?.map(c => (
                    <button key={c.id} onClick={() => setChapter(chapter?.id === c.id ? null : c)} data-testid={`chapter-${c.id}`}
                      className={`text-sm px-3 py-1.5 rounded-full border transition ${
                        chapter?.id === c.id ? "bg-green-600 border-green-600 text-white" : "bg-white border-gray-200 text-gray-700 hover:bg-green-50"}`}>
                      {c.rubric_text}
                    </button>
                  ))}
                </div>
                {chapter && (
                  <Card className="p-3" data-testid="tree">
                    <h2 className="font-semibold text-gray-800 mb-1">{chapter.rubric_text}</h2>
                    <ChapterBody chapter={chapter} caseIds={saved.ids} onToggle={toggle} />
                  </Card>
                )}
                {!chapter && chapters.data && <Notice>Choose a chapter, or search for words above.</Notice>}
              </>
            )}
            {full && <Notice>A case holds at most {MAX_RUBRICS} rubrics. Remove one to add another.</Notice>}
          </>
        )}

        {/* ── BY REMEDY ──────────────────────────────────────── */}
        {tab === "remedy" && !unavailable && (
          <RemedyTab caseIds={saved.ids} onToggle={toggle} full={full} />
        )}

        {/* ── CASE ───────────────────────────────────────────── */}
        {tab === "case" && !unavailable && (
          <CaseView saved={saved} patch={patch} grid={grid} toggleId={id => patch({ ids: saved.ids.filter(i => i !== id) })}
            onBrowse={() => setTab("browse")} />
        )}
        {tab === "case" && !unavailable && (
          <CaseVault saved={saved} current={current} setCurrent={setCurrent}
            onOpen={(row) => { setSaved(parseState(row.state, EMPTY)); setCurrent({ id: row.id, title: row.title }) }}
            onRestore={(state) => setSaved(parseState(state, EMPTY))} onSignIn={() => setLocation("/auth")} />
        )}

        <footer className="text-xs text-gray-400 space-y-1 pt-2">
          {credit && <p data-testid="credit">{credit.attribution}{credit.note ? ` ${credit.note}` : ""}</p>}
          <p>A study and reference tool. The repertory narrows the choice; the materia medica and a qualified homeopath decide. Not medical advice.</p>
        </footer>
      </main>
    </div>
  )
}

function ChapterBody({ chapter, caseIds, onToggle }: { chapter: Node; caseIds: number[]; onToggle: (n: Node) => void }) {
  const { data, isLoading, isError } = useQuery<Node[]>({ queryKey: ["/api/repertory/children", chapter.id], retry: false })
  return (
    <div>
      {isLoading && <p className="text-sm text-gray-400">Loading…</p>}
      {isError && <Notice>Could not load this chapter.</Notice>}
      {data?.map(n => <TreeNode key={n.id} node={n} caseIds={caseIds} onToggle={onToggle} />)}
    </div>
  )
}

// ── The case: chosen rubrics, options and the grid ────────────────
function CaseView({ saved, patch, grid, toggleId, onBrowse }: {
  saved: SavedCase; patch: (p: Partial<SavedCase>) => void
  grid: ReturnType<typeof useQuery<Grid>>; toggleId: (id: number) => void; onBrowse: () => void
}) {
  const data = grid.data
  const [sheet, setSheet] = useState<string | null>(null)
  const [showCompare, setShowCompare] = useState(false)
  const compareBody = { rubricIds: saved.ids, weights: saved.weights, exclude: saved.exclude, minGrade: saved.minGrade, coverAll: saved.coverAll, coverTheme: saved.coverTheme || undefined }
  const compare = useQuery<Compare>({
    queryKey: ["repertory-compare", JSON.stringify(compareBody)],
    queryFn: async () => (await apiRequest("POST", "/api/repertory/compare", compareBody)).json(),
    enabled: showCompare && saved.ids.length > 0, retry: false, placeholderData: keepPreviousData,
  })
  const themesPresent = new Set(data?.rubrics.map(r => r.theme) || [])
  if (saved.ids.length === 0) {
    return (
      <Card className="p-5 text-center">
        <p className="text-gray-600 mb-3">Your case is empty. Add rubrics from the Browse tab.</p>
        <Button onClick={onBrowse} className="bg-green-600 hover:bg-green-700 text-white">Browse the repertory</Button>
      </Card>
    )
  }
  const rubricOf = (id: number) => data?.rubrics.find(r => r.id === id)
  const select = "border border-gray-200 rounded-lg text-sm px-2 py-1.5 bg-white"

  return (
    <>
      <Card className="p-3" data-testid="case-rubrics">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800">Chosen rubrics</h2>
          <button onClick={() => patch({ ids: [], weights: {}, exclude: [] })}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"><Trash2 size={13} /> Clear</button>
        </div>
        <ol className="space-y-1.5">
          {saved.ids.map((id, i) => {
            const r = rubricOf(id)
            const w = saved.weights[id] || 1
            return (
              <li key={id} className="flex items-start gap-2 text-sm" data-testid={`case-rubric-${id}`}>
                <span className="w-6 h-6 shrink-0 rounded-full bg-green-100 text-green-800 text-xs flex items-center justify-center font-semibold">{i + 1}</span>
                <span className="flex-1 min-w-0 break-words text-gray-800">
                  {r ? r.full_path : "…"} {r && <span className="text-xs text-gray-400">({r.n_remedies})</span>}
                </span>
                <span className="shrink-0 flex rounded-lg overflow-hidden border border-gray-200" role="group" aria-label="Importance">
                  {[1, 2, 3].map(x => (
                    <button key={x} onClick={() => patch({ weights: { ...saved.weights, [id]: x } })} aria-pressed={w === x}
                      title={x === 1 ? "Normal" : x === 2 ? "Important" : "Key symptom"}
                      className={`px-2 py-1 text-xs ${w === x ? "bg-green-600 text-white" : "bg-white text-gray-500 hover:bg-green-50"}`}>×{x}</button>
                  ))}
                </span>
                <button onClick={() => toggleId(id)} className="shrink-0 text-gray-400 hover:text-red-500 p-1" aria-label="Remove rubric"><X size={15} /></button>
              </li>
            )
          })}
        </ol>
      </Card>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">Scoring
            <select className={select} value={saved.method} onChange={e => patch({ method: e.target.value as Method })} data-testid="method">
              <option value="grades">Grades (1·2·3)</option>
              <option value="presence">Presence (1·1·1)</option>
              <option value="emphasis">Emphasis (1·4·9)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">Lowest grade
            <select className={select} value={saved.minGrade} onChange={e => patch({ minGrade: Number(e.target.value) })} data-testid="mingrade">
              <option value={1}>1 and up</option><option value={2}>2 and up</option><option value={3}>3 only</option>
            </select>
          </label>
          <label className="flex items-center gap-2">Order
            <select className={select} value={saved.sortBy} onChange={e => patch({ sortBy: e.target.value as SortBy })} data-testid="sortby">
              <option value="total">Total score</option><option value="coverage">Rubrics covered</option>
            </select>
          </label>
          {themesPresent.size > 0 && (
            <label className="flex items-center gap-2">Must be in all
              <select className={select} value={saved.coverTheme} onChange={e => patch({ coverTheme: e.target.value as Theme | "" })} data-testid="covertheme">
                <option value="">— nothing —</option>
                {themesPresent.has("mental") && <option value="mental">Mind rubrics</option>}
                {themesPresent.has("general") && <option value="general">General rubrics</option>}
                {themesPresent.has("particular") && <option value="particular">Particular rubrics</option>}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={saved.coverAll} onChange={e => patch({ coverAll: e.target.checked })} data-testid="coverall" />
            Only remedies in every rubric
          </label>
        </div>
        {saved.exclude.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-3 text-xs">
            <span className="text-gray-500">Left out (tap to bring back):</span>
            {saved.exclude.map(a => (
              <button key={a} onClick={() => patch({ exclude: saved.exclude.filter(x => x !== a) })}
                className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 line-through hover:bg-green-50">{a.replace(/\.$/, "")}</button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden" data-testid="grid">
        {grid.isError && <div className="p-3"><Notice>The grid could not be calculated. Please try again.</Notice></div>}
        {!data && grid.isLoading && <p className="p-3 text-sm text-gray-400">Calculating…</p>}
        {data && data.rows.length === 0 && (
          <div className="p-3"><Notice>No remedy passes these filters. Relax “Lowest grade” or “Only remedies in every rubric”.</Notice></div>
        )}
        {data && data.rows.length > 0 && (
          <>
            <div className="px-3 pt-3 pb-1 text-xs text-gray-500">
              {data.rows.length < data.total_remedies ? `Top ${data.rows.length} of ${data.total_remedies} remedies` : `${data.total_remedies} remedies`}.
              Tap a remedy to read about it or leave it out.
            </div>
            <div className="overflow-x-auto">
              <table className="text-sm min-w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="sticky left-0 bg-white text-left font-medium px-3 py-2">Remedy</th>
                    <th className="px-2 py-2 font-medium">Total</th>
                    <th className="px-2 py-2 font-medium">Covers</th>
                    {themesPresent.size > 1 && (["mental", "general", "particular"] as Theme[]).map(t => (
                      <th key={t} className="px-2 py-2 font-medium" title={THEME_LABEL[t]}>{THEME_LABEL[t][0]}</th>))}
                    {data.rubrics.map((_, i) => <th key={i} className="px-2 py-2 font-medium">{i + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => (
                    <tr key={row.abbrev} className="border-b border-gray-50" data-testid={`row-${row.abbrev}`}>
                      <th className="sticky left-0 bg-white text-left font-normal px-3 py-1.5 whitespace-nowrap">
                        <button onClick={() => setSheet(row.abbrev)} className="hover:text-green-700 text-left" title={`About ${row.name}`} data-testid={`remedy-${row.abbrev}`}>
                          <span className="font-semibold text-gray-800">{row.abbrev.replace(/\.$/, "")}</span>
                          <span className="text-xs text-gray-400 ml-1.5 hidden sm:inline">{row.name}</span>
                        </button>
                      </th>
                      <td className="px-2 py-1.5 text-center font-semibold text-gray-800">{row.total}</td>
                      <td className="px-2 py-1.5 text-center text-gray-600">{row.covered}/{data.rubrics.length}</td>
                      {themesPresent.size > 1 && (["mental", "general", "particular"] as Theme[]).map(t => (
                        <td key={t} className="px-2 py-1.5 text-center text-gray-500">{row.themes[t] || "·"}</td>))}
                      {row.grades.map((g, i) => (
                        <td key={i} className="px-0.5 py-1">
                          <div className={`w-7 h-7 mx-auto rounded flex items-center justify-center text-xs ${gradeCell(g)}`}>{g || "·"}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-3 py-2 text-xs text-gray-400">
              Grade 3 = strongest (bold), 2 = medium (italic), 1 = weakest. Numbers at the top match the chosen rubrics above.
              {themesPresent.size > 1 && " M, G, P = score from Mind, General and Particular rubrics."}
            </p>
          </>
        )}
      </Card>

      {data && data.rows.length > 0 && (
        <Card className="p-3" data-testid="bars">
          <h2 className="font-semibold text-gray-800 mb-2">Top remedies</h2>
          <div className="space-y-1.5">
            {data.rows.slice(0, 10).map(r => (
              <div key={r.abbrev} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 text-gray-700 truncate">{r.abbrev.replace(/\.$/, "")}</span>
                <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${Math.max(3, (r.total / (data.rows[0].total || 1)) * 100)}%` }} />
                </div>
                <span className="w-8 text-right text-gray-600">{r.total}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-3" data-testid="compare">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Compare methods</h2>
          <Button size="sm" variant="outline" onClick={() => setShowCompare(v => !v)} data-testid="compare-toggle">{showCompare ? "Hide" : "Show"}</Button>
        </div>
        {showCompare && (
          <div className="mt-2 overflow-x-auto">
            {compare.isLoading && <p className="text-sm text-gray-400">Calculating…</p>}
            {compare.isError && <Notice>Could not compare. Please try again.</Notice>}
            {compare.data && (
              <>
                <p className="text-xs text-gray-500 mb-1">The same rubrics under each way of counting. A remedy that stays near the top in all three is the safer choice. “#” is its rank.</p>
                <table className="text-sm min-w-full">
                  <thead><tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left font-medium px-2 py-1.5">Remedy</th>
                    {(["grades", "presence", "emphasis"] as Method[]).map(m => <th key={m} colSpan={2} className="font-medium px-2 py-1.5">{m === "grades" ? "Grades" : m === "presence" ? "Presence" : "Emphasis"}</th>)}
                  </tr></thead>
                  <tbody>
                    {compare.data.rows.map(r => (
                      <tr key={r.abbrev} className="border-b border-gray-50">
                        <th className="text-left font-normal px-2 py-1 whitespace-nowrap"><span className="font-semibold text-gray-800">{r.abbrev.replace(/\.$/, "")}</span></th>
                        {(["grades", "presence", "emphasis"] as Method[]).map(m => (
                          <Fragment key={m}>
                            <td className="px-2 py-1 text-center text-gray-800">{r.scores[m] || "·"}</td>
                            <td className={`px-2 py-1 text-center text-xs ${r.ranks[m] === 1 ? "text-green-700 font-bold" : "text-gray-400"}`}>{r.ranks[m] ? `#${r.ranks[m]}` : ""}</td>
                          </Fragment>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}
      </Card>

      {sheet && (
        <RemedySheet abbrev={sheet} excluded={saved.exclude.includes(sheet)} onClose={() => setSheet(null)}
          inGrid={new Set(data?.rows.map(r => r.abbrev))} onOpen={setSheet}
          onExclude={() => { patch({ exclude: saved.exclude.includes(sheet) ? saved.exclude : [...saved.exclude, sheet] }); setSheet(null) }} />
      )}
    </>
  )
}

const THEME_LABEL: Record<Theme, string> = { mental: "Mind", general: "General", particular: "Particular" }

// ── A remedy: its materia medica text, and the choice to leave it out ──
function RemedySheet({ abbrev, excluded, inGrid, onOpen, onClose, onExclude }: { abbrev: string; excluded: boolean; inGrid: Set<string>; onOpen: (a: string) => void; onClose: () => void; onExclude: () => void }) {
  const { data, isLoading, error } = useQuery<Profile>({ queryKey: ["/api/repertory/remedy", encodeURIComponent(abbrev)], retry: false })
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="fixed inset-0 z-30 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose} data-testid="remedy-sheet">
      <div className="bg-white w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-bold text-gray-900">{data?.name || abbrev.replace(/\.$/, "")}</h2>
            {data?.common_name && <p className="text-xs text-gray-500">{data.common_name}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {isLoading && <p className="text-sm text-gray-400 mt-3">Loading…</p>}
        {error && <p className="text-sm text-gray-500 mt-3">We have no materia medica text for this remedy yet.</p>}
        {data?.relationships && Object.keys(data.relationships).length > 0 && (
          <div className="mt-3 space-y-1.5" data-testid="relations">
            {(Object.keys(REL_LABEL) as RelKind[]).filter(k => data.relationships?.[k]?.length).map(k => (
              <div key={k} className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-gray-500 w-24 shrink-0">{REL_LABEL[k]}</span>
                {data.relationships![k]!.map(it => it.abbrev
                  ? <button key={it.token} onClick={() => onOpen(it.abbrev!)} title={it.name}
                      className={`text-xs px-2 py-0.5 rounded-full border ${inGrid.has(it.abbrev) ? "border-green-400 bg-green-50 text-green-800" : "border-gray-200 text-gray-700"} hover:bg-green-100`}>
                      {it.abbrev.replace(/\.$/, "")}</button>
                  : <span key={it.token} className="text-xs px-2 py-0.5 rounded-full bg-gray-50 text-gray-400">{it.token}</span>)}
              </div>
            ))}
            <p className="text-[11px] text-gray-400">Green = also in your grid. Read the full “Relationship” text below.</p>
          </div>
        )}
        {data && (
          <div className="mt-3 divide-y divide-gray-100">
            {data.sections.map(sec => (
              <div key={sec.heading} className="py-1.5">
                <button onClick={() => setOpen(open === sec.heading ? null : sec.heading)} className="w-full flex items-center justify-between text-left text-sm font-medium text-gray-800">
                  {sec.heading} {open === sec.heading ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                {open === sec.heading && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{sec.content}</p>}
              </div>
            ))}
            {data.source && <p className="text-xs text-gray-400 pt-2">Source: {data.source}</p>}
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onExclude} disabled={excluded}>{excluded ? "Left out" : "Leave out of this case"}</Button>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

// ── Which rubrics hold these remedies (and not those) ─────────────
function RemedyTab({ caseIds, onToggle, full }: { caseIds: number[]; onToggle: (n: Node) => void; full: boolean }) {
  const [include, setInclude] = useState<RemedyOpt[]>([])
  const [exclude, setExclude] = useState<RemedyOpt[]>([])
  const [minGrade, setMinGrade] = useState(1)
  const [mode, setMode] = useState<"include" | "exclude">("include")
  const [text, setText] = useState("")
  const q = text.trim().toLowerCase()
  const remedies = useQuery<RemedyOpt[]>({ queryKey: ["/api/repertory/remedies"], retry: false, staleTime: 3600_000 })
  const matches = useMemo(() => q.length < 2 ? [] :
    (remedies.data || []).filter(r => (r.name.toLowerCase().includes(q) || r.abbrev.toLowerCase().startsWith(q))
      && !include.some(x => x.abbrev === r.abbrev) && !exclude.some(x => x.abbrev === r.abbrev))
      // names that start with the typed text first ("sulph" -> Sulphur before Antimonium sulphuratum)
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) || a.name.length - b.name.length)
      .slice(0, 8), [q, remedies.data, include, exclude])
  const body = { include: include.map(r => r.abbrev), exclude: exclude.map(r => r.abbrev), minGrade, limit: 100 }
  const hits = useQuery<{ rubrics: RemedyHit[] }>({
    queryKey: ["repertory-by-remedy", JSON.stringify(body)],
    queryFn: async () => (await apiRequest("POST", "/api/repertory/by-remedy", body)).json(),
    enabled: include.length > 0, retry: false, placeholderData: keepPreviousData,
  })
  const pick = (r: RemedyOpt) => {
    if (mode === "include" && include.length < 5) setInclude(v => [...v, r])
    if (mode === "exclude" && exclude.length < 50) setExclude(v => [...v, r])
    setText("")
  }
  const chip = (r: RemedyOpt, drop: () => void, cls: string) => (
    <button key={r.abbrev} onClick={drop} className={`text-sm px-2.5 py-1 rounded-full border flex items-center gap-1 ${cls}`} title="Tap to remove">
      {r.name} <X size={12} />
    </button>
  )
  return (
    <>
      <Card className="p-3 space-y-2">
        <div className="flex gap-1.5 text-xs">
          {(["include", "exclude"] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} data-testid={`mode-${m}`}
              className={`px-3 py-1 rounded-full border ${mode === m ? "bg-green-600 border-green-600 text-white" : "border-gray-200 text-gray-600"}`}>
              {m === "include" ? "Must have (up to 5)" : "Must not have"}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <Input value={text} onChange={e => setText(e.target.value)} className="pl-9" placeholder="Type a remedy, e.g. sulphur" data-testid="remedy-search" />
        </div>
        {matches.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-testid="remedy-matches">
            {matches.map(r => <button key={r.abbrev} onClick={() => pick(r)} className="text-sm px-2.5 py-1 rounded-full bg-gray-100 hover:bg-green-50">{r.name}</button>)}
          </div>
        )}
        {(include.length > 0 || exclude.length > 0) && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {include.map(r => chip(r, () => setInclude(v => v.filter(x => x.abbrev !== r.abbrev)), "bg-green-50 border-green-300 text-green-800"))}
            {exclude.map(r => chip(r, () => setExclude(v => v.filter(x => x.abbrev !== r.abbrev)), "bg-red-50 border-red-200 text-red-700 line-through"))}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">Lowest grade
          <select className="border border-gray-200 rounded-lg text-sm px-2 py-1.5 bg-white" value={minGrade} onChange={e => setMinGrade(Number(e.target.value))}>
            <option value={1}>1 and up</option><option value={2}>2 and up</option><option value={3}>3 only</option>
          </select>
        </label>
        <p className="text-xs text-gray-400">Shows the rubrics that contain every “must have” remedy and none of the others, smallest rubric first.</p>
      </Card>
      {include.length === 0 && <Notice>Choose at least one remedy.</Notice>}
      {hits.isError && <Notice>Could not search. Please try again.</Notice>}
      {hits.data && hits.data.rubrics.length === 0 && <Notice>No rubric has all of those remedies. Try a lower grade or fewer remedies.</Notice>}
      {hits.data && hits.data.rubrics.length > 0 && (
        <Card className="p-3" data-testid="remedy-results">
          {hits.data.rubrics.map(n => (
            <div key={n.id} className="border-b border-gray-50 last:border-0">
              <RubricLine node={n} full inCase={caseIds.includes(n.id)} onToggle={() => onToggle(n)} />
              <div className="flex gap-1 pb-1 pl-1">
                {include.map(r => <span key={r.abbrev} className={`text-xs px-1.5 py-0.5 rounded ${gradeCell(n.grades[r.abbrev] || 0)}`}>{r.abbrev.replace(/\.$/, "")} {n.grades[r.abbrev]}</span>)}
              </div>
            </div>
          ))}
          {hits.data.rubrics.length >= 100 && <p className="text-xs text-gray-400 mt-2">Showing the 100 smallest rubrics.</p>}
        </Card>
      )}
      {full && <Notice>A case holds at most {MAX_RUBRICS} rubrics. Remove one to add another.</Notice>}
    </>
  )
}

// ── Saved cases and follow-up visits (needs a signed-in user) ─────
const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

function CaseVault({ saved, current, setCurrent, onOpen, onRestore, onSignIn }: {
  saved: SavedCase; current: { id: string; title: string } | null; setCurrent: (c: { id: string; title: string } | null) => void
  onOpen: (row: CaseRow) => void; onRestore: (state: unknown) => void; onSignIn: () => void
}) {
  const [rows, setRows] = useState<CaseRow[] | null>(null)
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [status, setStatus] = useState<"loading" | "ok" | "signed-out" | "not-set-up">("loading")
  const [msg, setMsg] = useState("")
  const [title, setTitle] = useState(current?.title || "")
  const [note, setNote] = useState("")
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    const r = await caseStore.list()
    if (r.ok) { setRows(r.data); setStatus("ok") } else setStatus(r.reason === "error" ? "ok" : r.reason)
    if (!r.ok && r.reason === "error") setMsg(r.message)
  }
  useEffect(() => { refresh() }, [])
  useEffect(() => { setTitle(current?.title || "") }, [current?.id])
  useEffect(() => {
    if (!current) { setVisits([]); return }
    caseStore.visits(current.id).then(r => setVisits(r.ok ? r.data : []))
  }, [current?.id])

  const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(""); try { await fn() } finally { setBusy(false) } }

  const save = (asNew: boolean) => run(async () => {
    const r = await caseStore.save(title, saved, asNew ? undefined : current?.id)
    if (!r.ok) return setMsg(r.message)
    setCurrent({ id: r.data.id, title: r.data.title }); setMsg(asNew || !current ? "Saved." : "Updated."); refresh()
  })
  const remove = (id: string) => run(async () => {
    const r = await caseStore.remove(id)
    if (!r.ok) return setMsg(r.message)
    if (current?.id === id) setCurrent(null)
    setConfirm(null); refresh()
  })
  const addVisit = () => run(async () => {
    if (!current) return
    const r = await caseStore.addVisit(current.id, note, saved)
    if (!r.ok) return setMsg(r.message)
    setVisits(v => [r.data, ...v]); setNote(""); setMsg("Follow-up saved with the case as it is now.")
  })
  const dropVisit = (id: string) => run(async () => {
    const r = await caseStore.removeVisit(id)
    if (r.ok) setVisits(v => v.filter(x => x.id !== id)); else setMsg(r.message)
  })

  if (status === "loading") return null
  if (status === "signed-out") return (
    <Card className="p-3 flex items-center justify-between gap-2" data-testid="vault-signin">
      <p className="text-sm text-gray-600">Sign in to save cases and keep follow-up notes.</p>
      <Button size="sm" onClick={onSignIn}>Sign in</Button>
    </Card>
  )
  if (status === "not-set-up") return (
    <Card className="p-3"><Notice>Saving cases is not switched on yet. The site owner needs to run one setup script in the database.</Notice></Card>
  )
  return (
    <Card className="p-3 space-y-3" data-testid="vault">
      <h2 className="font-semibold text-gray-800">Saved cases</h2>
      <div className="flex gap-2">
        <Input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Short title, e.g. initials + date" data-testid="case-title" />
        <Button size="sm" disabled={busy || !title.trim() || saved.ids.length === 0} onClick={() => save(false)} data-testid="case-save">{current ? "Update" : "Save"}</Button>
        {current && <Button size="sm" variant="outline" disabled={busy || !title.trim()} onClick={() => save(true)}>Save as new</Button>}
      </div>
      <p className="text-xs text-gray-400">Use initials or a code, not a full name. Your cases are visible only to you.</p>
      {msg && <p className="text-sm text-green-700" role="status">{msg}</p>}

      {rows && rows.length === 0 && <p className="text-sm text-gray-400">No saved cases yet.</p>}
      <div className="divide-y divide-gray-100">
        {rows?.map(r => (
          <div key={r.id} className={`py-1.5 flex items-center gap-2 ${current?.id === r.id ? "bg-green-50 -mx-2 px-2 rounded" : ""}`}>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">{r.title}</p>
              <p className="text-xs text-gray-400">{Array.isArray(r.state?.ids) ? r.state.ids.length : 0} rubrics · {dateOf(r.updated_at)}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => onOpen(r)} data-testid={`case-open-${r.id}`}>Open</Button>
            {confirm === r.id
              ? <Button size="sm" variant="destructive" disabled={busy} onClick={() => remove(r.id)}>Delete?</Button>
              : <button onClick={() => setConfirm(r.id)} className="text-gray-400 hover:text-red-500 p-1" aria-label="Delete case"><Trash2 size={15} /></button>}
          </div>
        ))}
      </div>

      {current && (
        <div className="border-t border-gray-100 pt-3 space-y-2" data-testid="visits">
          <h3 className="font-medium text-gray-800 text-sm">Follow-ups for “{current.title}”</h3>
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={2000} rows={2} data-testid="visit-note"
            className="w-full border border-gray-200 rounded-lg text-sm p-2" placeholder="Remedy given, response, plan…" />
          <Button size="sm" disabled={busy || (!note.trim() && saved.ids.length === 0)} onClick={addVisit} data-testid="visit-add">
            Add follow-up (keeps the case as it is now)
          </Button>
          {visits.map(v => (
            <div key={v.id} className="text-sm border border-gray-100 rounded-lg p-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{dateOf(v.created_at)} · {Array.isArray(v.state?.ids) ? v.state.ids.length : 0} rubrics</span>
                <span className="flex gap-2">
                  <button className="text-green-700 hover:underline" onClick={() => onRestore(v.state)}>Load this version</button>
                  <button className="hover:text-red-500" onClick={() => dropVisit(v.id)} aria-label="Delete follow-up"><X size={13} /></button>
                </span>
              </div>
              {v.note && <p className="text-gray-700 mt-1 whitespace-pre-line">{v.note}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
