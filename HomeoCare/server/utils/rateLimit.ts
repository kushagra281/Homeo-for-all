// server/utils/rateLimit.ts
// Tiny in-memory limiter (per IP, per route group). /score and /analyze-report call the database
// and a paid AI model and were open to anyone; this stops one client from hammering them.
// In-memory is enough for a single server process; use a shared store if you ever scale out.

import type { Request, Response, NextFunction } from "express";

export function rateLimit(opts: { windowMs: number; max: number; name: string }) {
  const hits = new Map<string, { count: number; reset: number }>();

  // forget old entries so the map cannot grow forever
  setInterval(() => {
    const now = Date.now();
    hits.forEach((v, k) => { if (v.reset <= now) hits.delete(k); });
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let h = hits.get(key);
    if (!h || h.reset <= now) { h = { count: 0, reset: now + opts.windowMs }; hits.set(key, h); }
    h.count++;
    res.setHeader("X-RateLimit-Limit", String(opts.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, opts.max - h.count)));
    if (h.count > opts.max) {
      res.setHeader("Retry-After", String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ message: `Too many requests (${opts.name}). Please wait a moment and try again.` });
    }
    next();
  };
}
