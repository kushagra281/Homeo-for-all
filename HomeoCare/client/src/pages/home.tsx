import LanguageMenu from "@/components/language-menu"
import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import {
  Search, LogOut, User, Clock, ChevronRight,
  Paperclip, ArrowLeft, X, Trash2, Globe,
  Heart, Calendar, Mail, Edit3, Check, BookOpen,
  Menu, LogIn, Home as HomeIcon, Pill, FolderOpen, Library, Compass, Gauge, Users
} from "lucide-react"
import { getCurrentUser, signOut, getSearchHistory, deleteHistoryItem, getHealthProfile, saveHealthProfile } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { checkReportFile, setPendingReports } from "@/lib/pendingReports"

const RUBRIC_CATEGORIES = [
  { name: "Mind",               icon: "🧠", desc: "Mental & Emotional" },
  { name: "Head",               icon: "👤", desc: "Headache, Vertigo" },
  { name: "Eye",                icon: "👁️", desc: "Vision, Pain" },
  { name: "Ear",                icon: "👂", desc: "Hearing, Tinnitus" },
  { name: "Nose",               icon: "👃", desc: "Cold, Sinusitis" },
  { name: "Face",               icon: "😬", desc: "Facial Pain" },
  { name: "Mouth",              icon: "👄", desc: "Ulcers, Dryness" },
  { name: "Tongue",             icon: "👅", desc: "Coating, Pain" },
  { name: "Taste",              icon: "🫧", desc: "Bitter, Metallic" },
  { name: "Gums",               icon: "🦷", desc: "Swelling, Bleeding" },
  { name: "Teeth",              icon: "🦷", desc: "Toothache, Decay" },
  { name: "Throat",             icon: "🗣️", desc: "Pain, Infection" },
  { name: "Stomach",            icon: "🍽️", desc: "Digestion, Nausea" },
  { name: "Abdomen",            icon: "🫃", desc: "Pain, Bloating" },
  { name: "Urinary System",     icon: "🚻", desc: "Infection, Burning" },
  { name: "Male Genitalia",     icon: "🧬", desc: "Male Complaints" },
  { name: "Female Genitalia",   icon: "🧬", desc: "Female Complaints" },
  { name: "Heart",              icon: "❤️", desc: "Palpitations, Pain" },
  { name: "Hands, Legs & Back", icon: "🦴", desc: "Joints, Spine" },
  { name: "Respiration",        icon: "🫁", desc: "Breathing, Cough" },
  { name: "Skin",               icon: "🧴", desc: "Rashes, Eruptions" },
  { name: "Fever",              icon: "🌡️", desc: "Temperature, Chills" },
  { name: "Nervous System",     icon: "⚡", desc: "Nerves, Neurological" },
  { name: "Others",             icon: "🔵", desc: "General, Misc" },
]

function getCommonSymptoms(category: string): string[] {
  const map: Record<string, string[]> = {
    "Mind": ["Anxiety", "Depression", "Anger", "Fear", "Grief", "Sleeplessness"],
    "Head": ["Throbbing headache", "One-sided headache", "Vertigo", "Migraine"],
    "Fever": ["High fever", "Fever with chills", "Fever with sweating", "Low-grade fever"],
    "Stomach": ["Nausea", "Acidity", "Bloating", "Loss of appetite", "Vomiting"],
    "Respiration": ["Dry cough", "Wet cough", "Breathlessness", "Wheezing"],
    "Skin": ["Itching", "Rash", "Eczema", "Dry skin", "Hives"],
    "Hands, Legs & Back": ["Joint pain", "Back pain", "Stiffness", "Swollen joints"],
    "Urinary System": ["Burning urination", "Frequent urination", "UTI"],
    "Heart": ["Palpitations", "Chest pain", "High BP"],
    "Eye": ["Redness", "Itching eyes", "Watering", "Eye pain"],
    "Ear": ["Earache", "Ringing in ear", "Ear discharge"],
    "Nose": ["Blocked nose", "Running nose", "Sneezing"],
    "Throat": ["Sore throat", "Difficulty swallowing", "Hoarseness"],
    "Female Genitalia": ["Irregular menses", "Painful periods", "White discharge"],
    "Nervous System": ["Numbness", "Tingling", "Weakness", "Trembling"],
  }
  return map[category] || ["Pain", "Swelling", "Discharge", "Weakness", "Fever"]
}

type View = "home" | "history" | "category"

export default function Home() {
  const [, setLocation]    = useLocation()
  const [user, setUser]    = useState<any>(null)
  const [query, setQuery]  = useState("")
  const [view, setView]    = useState<View>("home")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [categoryQuery, setCategoryQuery]       = useState("")

  // History state
  const [history, setHistory]               = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const [reportError, setReportError]   = useState("")

  useEffect(() => {
    getCurrentUser().then(u => {
      if (!u) { setLocation("/auth"); return }
      setUser(u)
    })
  }, [])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try { setHistory(await getSearchHistory() || []) }
    catch { setHistory([]) }
    finally { setHistoryLoading(false) }
  }

  const handleShowHistory = () => {
    setView("history")
    loadHistory()
  }

  // ── FIX 2: Profile button navigates to /profile page ──
  const handleShowProfile = () => {
    setLocation("/profile")
  }

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteHistoryItem(id)
    setHistory(p => p.filter(h => h.id !== id))
  }

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    setLocation(`/symptom-analysis?q=${encodeURIComponent(query.trim())}`)
  }

  const handleCategorySearch = (cat: string, q?: string) => {
    const p = new URLSearchParams()
    p.set("category", cat)
    if (q?.trim()) p.set("q", q.trim())
    setLocation(`/symptom-analysis?${p.toString()}`)
  }

  // The chosen files are kept in memory and read on the symptom page, which extracts the
  // symptoms and adds them to the search. (They used to be discarded here.)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (!files.length) return
    const problem = files.map(f => ({ f, msg: checkReportFile(f) })).find(x => x.msg)
    if (problem) { setReportError(`${problem.f.name}: ${problem.msg}.`); return }
    setReportError("")
    setPendingReports(files)
    setLocation("/symptom-analysis?report=1")
  }

  const handleLogout = async () => { await signOut(); setLocation("/auth") }

  const formatSymptoms = (h: any) =>
    (Array.isArray(h.symptoms) ? h.symptoms : [])
      .filter((s: string) => !s.includes(":")).slice(0, 3).join(", ") || "Consultation"

  const formatTopRemedy = (h: any) => {
    const r = Array.isArray(h.results) ? h.results : []
    return r[0]?.remedy?.name ? `→ ${r[0].remedy.name}` : ""
  }

  const formatHealthHistory = (h: any) => {
    if (!h.health_history) return null
    return typeof h.health_history === "object" ? h.health_history.text : h.health_history
  }

  // ── MENU (☰) ─────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false)
  const go = (fn: () => void) => { setMenuOpen(false); fn() }
  const menuItems: { label: string; icon: any; run: () => void; testId: string; needsUser?: boolean }[] = [
    { label: "Home",          icon: HomeIcon,    testId: "menu-home",       run: () => { setView("home"); setQuery(""); setSelectedCategory(null) } },
    { label: "Repertory",     icon: BookOpen,    testId: "menu-repertory",  run: () => setLocation("/repertory") },
    { label: "Search by remedy", icon: Pill,     testId: "menu-by-remedy",  run: () => setLocation("/repertory?tab=remedy") },
    { label: "My cases",      icon: FolderOpen,  testId: "menu-cases",      run: () => setLocation("/repertory?tab=case") },
    { label: "History",       icon: Clock,       testId: "menu-history",    run: handleShowHistory, needsUser: true },
    { label: "Profile",       icon: User,        testId: "menu-profile",    run: handleShowProfile, needsUser: true },
    { label: "Dictionary",    icon: Library,     testId: "menu-dictionary", run: () => setLocation("/dictionary") },
    { label: "Modalities",    icon: Compass,     testId: "menu-modalities", run: () => setLocation("/modalities") },
    { label: "Potency guide", icon: Gauge,       testId: "menu-potency",    run: () => setLocation("/potency-guide") },
    { label: "Community",     icon: Users,       testId: "menu-community",  run: () => setLocation("/community") },
  ]

  // ── HEADER ───────────────────────────────────────────────────
  const Header = ({ showBack = false }: { showBack?: boolean }) => (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" data-testid="menu-button"
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 transition">
            <Menu size={22} />
          </button>
          <button
            onClick={() => { setView("home"); setQuery(""); setSelectedCategory(null) }}
            className="flex items-center gap-2 hover:opacity-80 transition"
          >
            <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-xl">🌿</span>
            </div>
            <span className="font-bold text-green-700 text-lg">HomeoWell</span>
          </button>
        </div>

        {showBack ? (
          <button onClick={() => setView("home")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={15} /> Back
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <LanguageMenu />
            {!user && (
              <button onClick={() => setLocation("/auth")} data-testid="sign-in"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition">
                <LogIn size={14} /> Sign in
              </button>
            )}
          </div>
        )}
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col" data-testid="menu-drawer">
          <SheetHeader className="px-5 py-4 border-b border-gray-100 text-left">
            <SheetTitle className="flex items-center gap-2 text-green-700">
              <span className="text-xl">🌿</span> HomeoWell
            </SheetTitle>
            {user && <p className="text-xs text-gray-400 truncate">{user.user_metadata?.name || user.email}</p>}
          </SheetHeader>
          <nav className="flex-1 overflow-y-auto py-2">
            {menuItems.filter(i => !i.needsUser || user).map(({ label, icon: Icon, run, testId }) => (
              <button key={label} data-testid={testId} onClick={() => go(run)}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition text-left">
                <Icon size={18} className="text-green-600" /> {label}
              </button>
            ))}
          </nav>
          <div className="border-t border-gray-100 py-2">
            {user ? (
              <button data-testid="menu-signout" onClick={() => go(handleLogout)}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition text-left">
                <LogOut size={18} /> Sign out
              </button>
            ) : (
              <button data-testid="menu-signin" onClick={() => go(() => setLocation("/auth"))}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-600 hover:bg-green-50 hover:text-green-700 transition text-left">
                <LogIn size={18} /> Sign in
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )

  // ── CATEGORY VIEW ────────────────────────────────────────────
  if (selectedCategory) {
    const cat = RUBRIC_CATEGORIES.find(c => c.name === selectedCategory)!
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <Header showBack />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">{cat.icon}</div>
            <h1 className="text-2xl font-bold text-gray-900">{cat.name}</h1>
            <p className="text-gray-400 text-sm mt-1">{cat.desc}</p>
          </div>
          <Card className="p-6">
            <h2 className="font-semibold text-gray-800 mb-4">
              Search in <span className="text-green-700">{cat.name}</span>
            </h2>
            <form onSubmit={e => { e.preventDefault(); handleCategorySearch(selectedCategory, categoryQuery) }}>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                  <Input value={categoryQuery} onChange={e => setCategoryQuery(e.target.value)}
                    placeholder="" className="pl-10 py-5 border-2 border-green-200 focus:border-green-500" autoFocus />
                </div>
                <Button type="submit" className="bg-green-600 hover:bg-green-700 px-5">Search</Button>
              </div>
            </form>
            <p className="text-xs text-gray-400 mb-2">Common symptoms:</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {getCommonSymptoms(cat.name).map(s => (
                <button key={s} onClick={() => handleCategorySearch(selectedCategory, s)}
                  className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded-full hover:bg-green-100 transition">
                  {s}
                </button>
              ))}
            </div>
            <Button onClick={() => handleCategorySearch(selectedCategory)} variant="outline"
              className="w-full border-green-300 text-green-700 hover:bg-green-50">
              Browse all {cat.name} remedies with AI questions →
            </Button>
          </Card>
        </main>
      </div>
    )
  }

  // ── HISTORY VIEW ─────────────────────────────────────────────
  if (view === "history") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <Header showBack />
        <main className="max-w-2xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-green-600" /> Consultation History
            {history.length > 0 && <span className="text-sm text-gray-400 font-normal">({history.length} saved)</span>}
          </h2>

          {historyLoading ? (
            <div className="flex items-center justify-center py-16 gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600" />
              <span className="text-gray-400">Loading...</span>
            </div>
          ) : history.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock size={40} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">No history yet.</p>
              <p className="text-xs text-gray-300 mt-1">Searches save automatically after each consultation.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <Card key={h.id || i} className="p-4 hover:border-green-200 transition cursor-pointer group"
                  onClick={() => {
                    const syms = (Array.isArray(h.symptoms) ? h.symptoms : [])
                      .filter((s: string) => !s.includes(":")).slice(0, 3).join(", ")
                    if (syms) setLocation(`/symptom-analysis?q=${encodeURIComponent(syms)}`)
                  }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{formatSymptoms(h)}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {formatTopRemedy(h) && (
                          <span className="text-sm text-green-600 font-medium">{formatTopRemedy(h)}</span>
                        )}
                        {formatHealthHistory(h) && (
                          <span className="text-xs text-blue-500 flex items-center gap-0.5">
                            <Heart size={10} /> {String(formatHealthHistory(h)).slice(0, 25)}...
                          </span>
                        )}
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Calendar size={10} />
                          {h.created_at ? new Date(h.created_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                          }) : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-green-500" />
                      <button
                        onClick={e => handleDeleteHistory(h.id, e)}
                        className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── MAIN HOME ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <Header />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Your Homeopathic Remedy</h1>
          <p className="text-gray-500">Enter symptoms or select a category below</p>
        </div>

        {/* Search */}
        <div className="mb-8">
          <form onSubmit={handleSearch}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={19} />
                <Input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder=""
                  className="pl-12 pr-4 py-6 text-base rounded-xl border-2 border-green-200 focus:border-green-500 shadow-sm" />
              </div>
              <div className="relative">
                <input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,image/*" multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" />
                <Button type="button" variant="outline"
                  className="h-full px-3 rounded-xl border-2 border-green-200 hover:border-green-400 flex flex-col items-center justify-center gap-0.5">
                  <Paperclip size={17} className="text-green-600" />
                  <span className="text-xs text-green-600 leading-none">Clinical</span>
                </Button>
              </div>
              <Button type="submit"
                className="bg-green-600 hover:bg-green-700 text-white px-6 rounded-xl font-medium">
                Search
              </Button>
            </div>
          </form>
          {reportError && (
            <p className="mt-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              {reportError}
            </p>
          )}
        </div>

        {/* Categories */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {RUBRIC_CATEGORIES.map(cat => (
              <button key={cat.name} onClick={() => setSelectedCategory(cat.name)}
                className="bg-white border-2 border-gray-100 rounded-xl p-3 text-left hover:border-green-400 hover:shadow-md transition-all group">
                <div className="text-2xl mb-1">{cat.icon}</div>
                <div className="font-medium text-sm text-gray-800 group-hover:text-green-700">{cat.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{cat.desc}</div>
                <div className="text-xs text-green-500 mt-1 opacity-0 group-hover:opacity-100 transition">Tap →</div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          ⚠️ For educational purposes only. Always consult a qualified homeopath.
        </p>
      </main>
    </div>
  )
}
