import { useState, useEffect } from "react"
import { useLocation } from "wouter"
import { signIn, signUp, requestPasswordReset } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default function AuthPage() {
  const [, setLocation] = useLocation()
  const [showSplash, setShowSplash] = useState(true)
  const [splashFadeOut, setSplashFadeOut] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [forgot, setForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", password: "" })

  useEffect(() => {
    // Show splash for 2.2s then fade out
    const timer1 = setTimeout(() => setSplashFadeOut(true), 2200)
    const timer2 = setTimeout(() => setShowSplash(false), 2800)
    return () => { clearTimeout(timer1); clearTimeout(timer2) }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError("")
    try {
      if (forgot) {
        await requestPasswordReset(form.email.trim())
        setResetSent(true)
        return
      }
      if (isLogin) {
        await signIn(form.email, form.password)
      } else {
        if (!form.name.trim()) { setError("Name is required"); setLoading(false); return }
        await signUp(form.email, form.password, form.name)
      }
      setLocation("/")
    } catch (err: any) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  // ── SPLASH SCREEN ─────────────────────────────────────────
  if (showSplash) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-green-700 to-emerald-900 flex flex-col items-center justify-center"
        style={{
          transition: "opacity 0.6s ease",
          opacity: splashFadeOut ? 0 : 1,
        }}
      >
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(30px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse-ring {
            0%   { transform: scale(1);    opacity: 0.8; }
            50%  { transform: scale(1.08); opacity: 0.4; }
            100% { transform: scale(1);    opacity: 0.8; }
          }
          .splash-logo   { animation: fadeInUp 0.8s ease 0.2s both; }
          .splash-name   { animation: fadeInUp 0.8s ease 0.6s both; }
          .splash-tagline{ animation: fadeInUp 0.8s ease 1s both; }
          .pulse-ring    { animation: pulse-ring 2s ease infinite; }
        `}</style>

        <div className="splash-logo relative mb-6">
          <div className="pulse-ring absolute inset-0 rounded-full bg-white/20 scale-110" />
          <div className="w-28 h-28 bg-white/15 rounded-full flex items-center justify-center border-2 border-white/30 backdrop-blur-sm relative z-10">
            <span className="text-6xl">🌿</span>
          </div>
        </div>

        <h1 className="splash-name text-5xl font-bold text-white tracking-wide mb-3"
          style={{ fontFamily: "'Georgia', serif", letterSpacing: "0.05em" }}>
          HomeoWell
        </h1>

        <p className="splash-tagline text-green-200 text-lg tracking-widest uppercase"
          style={{ letterSpacing: "0.25em", fontSize: "0.85rem" }}>
          Natural Healing · AI Powered
        </p>

        {/* Loading dots */}
        <div className="splash-tagline flex gap-1.5 mt-10">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-2 h-2 bg-white/50 rounded-full"
              style={{ animation: `pulse-ring 1.2s ease ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    )
  }

  // ── LOGIN / SIGNUP FORM ────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4"
      style={{ animation: "fadeInUp 0.5s ease both" }}
    >
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Card className="w-full max-w-md p-8 shadow-xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="block text-6xl leading-none mx-auto mb-4">🌿</span>
          <h1 className="text-2xl font-bold text-gray-900">HomeoWell</h1>
          <p className="text-gray-400 text-sm mt-1">Homeopathic Remedy Finder</p>
        </div>

        {/* Tab Toggle */}
        {!forgot && <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => { setIsLogin(true); setError("") }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${isLogin ? "bg-white shadow text-green-700" : "text-gray-500"}`}
          >Login</button>
          <button
            onClick={() => { setIsLogin(false); setError("") }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${!isLogin ? "bg-white shadow text-green-700" : "text-gray-500"}`}
          >Sign Up</button>
        </div>}
        {forgot && (
          <div className="mb-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900">Reset your password</h2>
            <p className="text-sm text-gray-500 mt-1">Enter your email and we will send you a link to set a new password.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && !forgot && (
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" placeholder="Enter your name"
                value={form.name} onChange={handleChange} className="mt-1" required />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="Enter your email"
              value={form.email} onChange={handleChange} className="mt-1" required />
          </div>
          {!forgot && (
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="Min. 6 characters"
                value={form.password} onChange={handleChange} className="mt-1" required minLength={6} />
              {isLogin && (
                <button type="button" data-testid="forgot-password" onClick={() => { setForgot(true); setError(""); setResetSent(false) }}
                  className="mt-2 text-sm text-green-600 hover:underline">Forgot password?</button>
              )}
            </div>
          )}

          {resetSent && (
            <div data-testid="reset-sent" className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
              If an account exists for this email, a reset link is on its way. Check your inbox and spam folder.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-5" disabled={loading}>
            {loading ? "Please wait..." : forgot ? "Send reset link" : isLogin ? "Login" : "Create Account"}
          </Button>
          {forgot && (
            <button type="button" onClick={() => { setForgot(false); setResetSent(false); setError("") }}
              className="w-full text-center text-sm text-green-600 hover:underline">Back to login</button>
          )}
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline">Terms</a> and{" "}
          <a href="/privacy" className="underline">Privacy Policy</a>.
        </p>

        {!forgot && <p className="text-center text-sm text-gray-500 mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => { setIsLogin(!isLogin); setError("") }}
            className="text-green-600 font-medium hover:underline">
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>}
      </Card>
    </div>
  )
}
