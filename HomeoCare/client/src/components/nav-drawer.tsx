import { useLocation } from "wouter"
import { BookOpen, Clock, FolderOpen, Gauge, Home as HomeIcon, Library, LogIn, LogOut, Pill, User, Users } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { signOut } from "@/lib/supabase"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: any
  /** The home page resets its own in-page state; other pages just navigate. */
  onHome?: () => void
  onHistory?: () => void
}

/** The ☰ drawer: every secondary page of the app, the same on every screen. */
export default function NavDrawer({ open, onOpenChange, user, onHome, onHistory }: Props) {
  const [, setLocation] = useLocation()
  const go = (fn: () => void) => { onOpenChange(false); fn() }
  const items: { label: string; icon: any; run: () => void; testId: string; needsUser?: boolean }[] = [
    { label: "Home",             icon: HomeIcon,   testId: "menu-home",       run: onHome || (() => setLocation("/")) },
    { label: "Repertory",        icon: BookOpen,   testId: "menu-repertory",  run: () => setLocation("/repertory") },
    { label: "Search by remedy", icon: Pill,       testId: "menu-by-remedy",  run: () => setLocation("/repertory?tab=remedy") },
    { label: "My cases",         icon: FolderOpen, testId: "menu-cases",      run: () => setLocation("/repertory?tab=case") },
    { label: "History",          icon: Clock,      testId: "menu-history",    run: onHistory || (() => setLocation("/?view=history")), needsUser: true },
    { label: "Profile",          icon: User,       testId: "menu-profile",    run: () => setLocation("/profile"), needsUser: true },
    { label: "Dictionary",       icon: Library,    testId: "menu-dictionary", run: () => setLocation("/dictionary") },
    { label: "Potency guide",    icon: Gauge,      testId: "menu-potency",    run: () => setLocation("/potency-guide") },
    { label: "Community",        icon: Users,      testId: "menu-community",  run: () => setLocation("/community") },
  ]
  const logout = async () => { await signOut(); setLocation("/auth") }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 flex flex-col" data-testid="menu-drawer">
        <SheetHeader className="px-5 py-4 border-b border-gray-100 text-left">
          <SheetTitle className="flex items-center gap-2 text-green-700">
            <span className="text-xl">🌿</span> HomeoWell
          </SheetTitle>
          {user && <p className="text-xs text-gray-400 truncate">{user.user_metadata?.name || user.email}</p>}
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto py-2">
          {items.filter(i => !i.needsUser || user).map(({ label, icon: Icon, run, testId }) => (
            <button key={label} data-testid={testId} onClick={() => go(run)}
              className="w-full flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 transition text-left">
              <Icon size={18} className="text-green-600" /> {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-gray-100 py-2">
          {user ? (
            <button data-testid="menu-signout" onClick={() => go(logout)}
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
  )
}
