// server/routes/profile.ts
// PROFILE + HISTORY ROUTES

import { Router } from "express";
import {
  fetchProfile,
  upsertProfileRow,
  fetchSearchHistory,
  insertSearchHistory,
} from "../utils/supabase";

const router = Router();

// ── GET /api/profile/:userId ──────────────────────────────────────
router.get("/:userId", async (req, res) => {
  try {
    const data = await fetchProfile(req.params.userId);
    res.json(data);
  } catch (error: any) {
    console.error("[Route] profile get:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// ── POST /api/profile/save ────────────────────────────────────────
router.post("/save", async (req, res) => {
  try {
    const { userId, email, profile } = req.body;
    if (!userId) return res.status(400).json({ message: "userId required" });
    await upsertProfileRow(userId, email || "", profile || {});
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Route] profile save:", error);
    res.status(500).json({ message: error.message || "Failed to save profile" });
  }
});

// ── GET /api/history/:userId ──────────────────────────────────────
router.get("/history/:userId", async (req, res) => {
  try {
    const data = await fetchSearchHistory(req.params.userId);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

export default router;
