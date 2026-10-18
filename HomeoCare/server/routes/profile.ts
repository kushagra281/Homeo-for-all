// server/routes/profile.ts
// PROFILE + HISTORY ROUTES - every route needs a signed-in user; the user id comes from the
// verified access token, never from the request.

import { Router } from "express";
import {
  fetchProfile,
  upsertProfileRow,
  fetchSearchHistory,
} from "../utils/supabase";
import { requireUser } from "../utils/auth";

const router = Router();
router.use(requireUser);

// ── GET /api/profile/me ───────────────────────────────────────────
router.get("/me", async (req, res) => {
  try {
    res.json(await fetchProfile(req.userId!));
  } catch (error: any) {
    console.error("[Route] profile get:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// ── POST /api/profile/save ────────────────────────────────────────
// Body: { profile: {...} }   (a userId in the body is ignored)
router.post("/save", async (req, res) => {
  try {
    const { profile } = req.body || {};
    await upsertProfileRow(req.userId!, req.userEmail || "", profile || {});
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Route] profile save:", error);
    res.status(500).json({ message: error.message || "Failed to save profile" });
  }
});

// ── GET /api/profile/history ──────────────────────────────────────
router.get("/history", async (req, res) => {
  try {
    res.json(await fetchSearchHistory(req.userId!));
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

export default router;
