import { useState } from "react"
import { useLocation } from "wouter"
import { signIn, signUp } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default function AuthPage() {
  const [, setLocation] = useLocation()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      if (isLogin) {
        await signIn(form.email, form.password)
      } else {
        if (!form.name.trim()) {
          setError("Name is required")
          setLoading(false)
          return
        }
        await signUp(form.email, form.password, form.name)
      }
      setLocation("/")
    } catch (err) {
      setError(err.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 shadow-lg">

        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl">🌿</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HomeoWell</h1>
          <p className="text-gray-500 text-sm mt-1">Homeopathic Remedy Finder</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => { setIsLogin(true); setError("") }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              isLogin ? "bg-white shadow text-green-700" : "text-gray-500"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setIsLogin(false); setError("") }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
              !isLogin ? "bg-white shadow text-green-700" : "text-gray-500"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Enter your name"
                value={form.name}
                onChange={handleChange}
                className="mt-1"
                required
              />
            </div>
          )}

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={handleChange}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              className="mt-1"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2"
            disabled={loading}
          >
            {loading ? "Please wait..." : isLogin ? "Login" : "Create Account"}
          </Button>
        </form>

        {/* Switch mode */}
        <p className="text-center text-sm text-gray-500 mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setIsLogin(!isLogin); setError("") }}
            className="text-green-600 font-medium hover:underline"
          >
            {isLogin ? "Sign Up" : "Login"}
          </button>
        </p>

        {/* Skip login */}
        <p className="text-center mt-3">
          <button
            onClick={() => setLocation("/")}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Continue without login →
          </button>
        </p>
      </Card>
    </div>
  )
}
