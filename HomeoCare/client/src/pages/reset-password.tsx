import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { supabase, updatePassword } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

/** Opened from the link in the reset email. The link signs the person in for recovery only. */
export default function ResetPasswordPage() {
  const [, setLocation] = useLocation()
  const [ready, setReady] = useState<boolean | null>(null)   // null = still checking the link
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    const { data } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (alive && (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session))) setReady(true)
    })
    // The client reads the link on load; if no session shows up shortly, the link is bad or old.
    const check = setTimeout(async () => {
      const { data: s } = await supabase.auth.getSession()
      if (alive) setReady(prev => prev ?? !!s?.session)
    }, 1500)
    return () => { alive = false; clearTimeout(check); data?.subscription?.unsubscribe?.() }
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < 6) { setError("Use at least 6 characters."); return }
    if (password !== confirm) { setError("The two passwords do not match."); return }
    setLoading(true)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(() => setLocation("/"), 1800)
    } catch (err: any) {
      setError(err?.message || "Could not change the password. Please request a new link.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-xl">
        <div className="text-center mb-6">
          <span className="block text-5xl leading-none mx-auto mb-3">🌿</span>
          <h1 className="text-xl font-bold text-gray-900">Set a new password</h1>
        </div>

        {ready === null && (
          <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-green-600" /></div>
        )}

        {ready === false && (
          <div data-testid="reset-invalid" className="text-center space-y-4">
            <p className="text-sm text-gray-600">This reset link is not valid any more. Links work once and expire after a while.</p>
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => setLocation("/auth")}>Request a new link</Button>
          </div>
        )}

        {ready && !done && (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" placeholder="Min. 6 characters"
                value={password} onChange={e => { setPassword(e.target.value); setError("") }} className="mt-1" required minLength={6} />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password"
                value={confirm} onChange={e => { setConfirm(e.target.value); setError("") }} className="mt-1" required minLength={6} />
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>}
            <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-5" disabled={loading}>
              {loading ? "Please wait..." : "Save new password"}
            </Button>
          </form>
        )}

        {done && (
          <div data-testid="reset-done" className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg text-center">
            Password changed. Taking you to the app...
          </div>
        )}
      </Card>
    </div>
  )
}
