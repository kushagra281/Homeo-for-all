// server/utils/auth.ts
// Who is calling? The profile and history routes used to trust a userId sent by the browser and
// then read/wrote with the service key, so anyone who knew (or guessed) a user's id could read or
// overwrite that person's health profile. Now the caller must send their Supabase access token
// and the id is taken from the verified token, never from the request body or URL.

import type { Request, Response, NextFunction } from "express";
import { mainDB } from "./supabase";

declare module "express-serve-static-core" {
  interface Request {
    userId?: string;
    userEmail?: string;
  }
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return res.status(401).json({ message: "Sign in required" });

  try {
    const { data, error } = await mainDB().auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ message: "Invalid or expired session" });
    req.userId = data.user.id;
    req.userEmail = data.user.email || "";
    next();
  } catch (e: any) {
    console.error("[Auth] could not verify token:", e?.message);
    res.status(503).json({ message: "Authentication service unavailable" });
  }
}
