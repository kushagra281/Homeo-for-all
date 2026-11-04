// Repertory page: browse the graded repertory (chapter > rubric tree), choose rubrics for a case,
// and see the remedy x rubric grid with totals. The numbers come from /api/repertory/repertorize.
import { useEffect, useMemo, useState } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, Plus, Search, Trash2, X } from "lucide-react"
import { apiRequest } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"

// ── Types (same shapes as server/utils/repertoryStore.ts and services/repertorize.ts) ──
interface Node { id: number; parent_id: number | null; chapter: string; rubric_text: string; full_path: string; depth: number; n_remedies: number; child_count: number }
interface Source { slug: string; title: string; author: string; year: number | null; licence: string; attribution: string; note: string; rubric_count: number; link_count: number }
interface PeekRemedy { abbrev: string; name: string; grade: number }
interface GridRow { abbrev: string; name: string; total: number; covered: number; grades: number[] }
interface Grid {
  rubrics: Array<{ id: number; full_path: string; n_remedies: number; weight: number }>
  rows: GridRow[]; total_remedies: number; method: Method; min_grade: number
}
type Method = "grades" | "presence" | "emphasis"
type SortBy = "total" | "coverage"

const MAX_RUBRICS = 30
const STORE = "homeowell:repertory-case:v1"

interface SavedCase { ids: number[]; weights: Record<number, number>; exclude: string[]; method: Method; minGrade: number; coverAll: boolean; sortBy: SortBy }
const EMPTY: SavedCase = { ids: [], weights: {}, exclude: [], method: "grades", minGrade: 1, coverAll: false, sortBy: "total" }

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
  const [tab, setTab] = useState<"browse" | "case">("browse")
  const [saved, setSaved] = useState<SavedCase>(loadCase)
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
    minGrade: saved.minGrade, coverAll: saved.coverAll, sortBy: saved.sortBy, limit: 60,
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
          {(["browse", "case"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}`}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                tab === t ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t === "browse" ? "Browse" : `My case (${saved.ids.length})`}
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

        {/* ── CASE ───────────────────────────────────────────── */}
        {tab === "case" && !unavailable && (
          <CaseView saved={saved} patch={patch} grid={grid} toggleId={id => patch({ ids: saved.ids.filter(i => i !== id) })}
            onBrowse={() => setTab("browse")} />
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
  if (saved.ids.length === 0) {
    return (
      <Card className="p-5 text-center">
        <p className="text-gray-600 mb-3">Your case is empty. Add rubrics from the Browse tab.</p>
        <Button onClick={onBrowse} className="bg-green-600 hover:bg-green-700 text-white">Browse the repertory</Button>
      </Card>
    )
  }
  const data = grid.data
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
              Tap a remedy to leave it out.
            </div>
            <div className="overflow-x-auto">
              <table className="text-sm min-w-full">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="sticky left-0 bg-white text-left font-medium px-3 py-2">Remedy</th>
                    <th className="px-2 py-2 font-medium">Total</th>
                    <th className="px-2 py-2 font-medium">Covers</th>
                    {data.rubrics.map((_, i) => <th key={i} className="px-2 py-2 font-medium">{i + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => (
                    <tr key={row.abbrev} className="border-b border-gray-50" data-testid={`row-${row.abbrev}`}>
                      <th className="sticky left-0 bg-white text-left font-normal px-3 py-1.5 whitespace-nowrap">
                        <button onClick={() => patch({ exclude: [...saved.exclude, row.abbrev] })} className="hover:text-red-600 text-left" title={`Leave out ${row.name}`}>
                          <span className="font-semibold text-gray-800">{row.abbrev.replace(/\.$/, "")}</span>
                          <span className="text-xs text-gray-400 ml-1.5 hidden sm:inline">{row.name}</span>
                        </button>
                      </th>
                      <td className="px-2 py-1.5 text-center font-semibold text-gray-800">{row.total}</td>
                      <td className="px-2 py-1.5 text-center text-gray-600">{row.covered}/{data.rubrics.length}</td>
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
            </p>
          </>
        )}
      </Card>
    </>
  )
}
