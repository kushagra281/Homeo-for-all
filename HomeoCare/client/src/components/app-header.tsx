import { useEffect, useState, type ReactNode } from "react"
import { useLocation } from "wouter"
import { ArrowLeft, Menu } from "lucide-react"
import LanguageMenu from "@/components/language-menu"
import HeaderAvatar from "@/components/user-avatar"
import NavDrawer from "@/components/nav-drawer"
import { getCurrentUser } from "@/lib/supabase"

interface Props {
  /** Show the Back button (to the home page). */
  back?: boolean
  /** Extra controls placed before Translate (e.g. a badge). */
  right?: ReactNode
  /** Rendered under the bar inside the sticky header (e.g. tabs). */
  children?: ReactNode
  width?: string
}

/** The header every inner page shares: ☰ menu, leaf + name, Translate, profile photo, Back. */
export default function AppHeader({ back = true, right, children, width = "max-w-4xl" }: Props) {
  const [, setLocation] = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  useEffect(() => { getCurrentUser().then(setUser).catch(() => setUser(null)) }, [])

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
      <div className={`${width} mx-auto px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-1">
          <button onClick={() => setMenuOpen(true)} aria-label="Open menu" data-testid="menu-button"
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 transition">
            <Menu size={22} />
          </button>
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 hover:opacity-80 transition">
            <span className="text-2xl leading-none">🌿</span>
            <span className="font-bold text-green-700 text-lg">HomeoWell</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {right}
          <LanguageMenu />
          <HeaderAvatar user={user} />
          {back && (
            <button onClick={() => setLocation("/")} data-testid="back-button"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100">
              <ArrowLeft size={15} /> Back
            </button>
          )}
        </div>
      </div>
      {children}
      <NavDrawer open={menuOpen} onOpenChange={setMenuOpen} user={user} />
    </header>
  )
}
