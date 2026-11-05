// Profile photo: shrink it in the browser, then keep it through the server (patients.avatar_url).

import { supabase } from "@/lib/supabase"
import { AVATAR_MAX_CHARS } from "@shared/avatar"

const SIZE = 256          // pixels, square
const TARGET_CHARS = 60_000

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token || ""}` }
}

/** The signed-in user's photo as a data URL, or null. A failure just means no photo is shown. */
export async function fetchAvatar(): Promise<string | null> {
  try {
    const res = await fetch("/api/profile/avatar", { headers: await authHeader() })
    if (!res.ok) return null
    return (await res.json())?.avatar || null
  } catch { return null }
}

async function send(method: "PUT" | "DELETE", image?: string): Promise<void> {
  let res: Response
  try {
    res = await fetch("/api/profile/avatar", {
      method,
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: method === "PUT" ? JSON.stringify({ image }) : undefined,
    })
  } catch {
    throw new Error("Could not reach the server. Your photo was NOT saved.")
  }
  if (res.ok) return
  const err = await res.json().catch(() => ({} as any))
  if (res.status === 401) throw new Error("Your session has expired. Please sign in again.")
  if (res.status === 503 && err.code === "avatar_column_missing") throw new Error("Photo storage is not set up yet. Please try again later.")
  if (res.status === 400) throw new Error(err.message || "Please choose a small JPEG, PNG or WebP photo")
  throw new Error("Your photo could not be saved. Please try again.")
}

export const saveAvatar = (image: string) => send("PUT", image)
export const removeAvatar = () => send("DELETE")

function loadImage(file: File): Promise<{ img: CanvasImageSource; w: number; h: number; done: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) })
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This file could not be read as a picture")) }
    img.src = url
  })
}

/** A chosen picture file -> a square 256 px JPEG data URL, centred and cropped. */
export async function shrinkPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose a picture (JPEG, PNG or WebP)")
  const { img, w, h, done } = await loadImage(file)
  try {
    if (!w || !h) throw new Error("This file could not be read as a picture")
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = SIZE
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("This browser cannot resize pictures")
    const side = Math.min(w, h)
    ctx.fillStyle = "#ffffff"                       // a transparent PNG gets a white background, not black
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, SIZE, SIZE)
    for (let q = 0.85; q >= 0.4; q -= 0.15) {
      const out = canvas.toDataURL("image/jpeg", q)
      if (out.length <= TARGET_CHARS) return out
    }
    const last = canvas.toDataURL("image/jpeg", 0.35)
    if (last.length <= AVATAR_MAX_CHARS) return last
    throw new Error("This picture is too detailed. Please choose another one.")
  } finally { done() }
}
