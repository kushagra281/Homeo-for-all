// server/routes/profile.ts
// PROFILE + HISTORY ROUTES - every route needs a signed-in user; the user id comes from the
// verified access token, never from the request.

import { Router } from "express";
import {
  fetchProfile,
  upsertProfileRow,
  fetchSearchHistory,
  fetchAvatar,
  saveAvatar,
  AvatarColumnMissing,
} from "../utils/supabase";
import { parseAvatar } from "../../shared/avatar";
import { requireUser } from "../utils/auth";

const router = Router();
router.use(requireUser);

// ── GET /api/profile/me ───────────────────────────────────────────
router.get("/me", async (req, res) => {
  try {
    res.json(await fetchProfile(req.userId!, req.accessToken));
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
    await upsertProfileRow(req.userId!, req.userEmail || "", profile || {}, req.accessToken);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Route] profile save:", error);
    res.status(500).json({ message: "Failed to save profile" });
  }
});

// ── Profile photo ─────────────────────────────────────────────────
// GET    /api/profile/avatar   -> { avatar: "data:image/jpeg;base64,..." | null }
// PUT    /api/profile/avatar   body { image: <small JPEG, PNG or WebP data URL> }
// DELETE /api/profile/avatar
router.get("/avatar", async (req, res) => {
  try {
    res.json({ avatar: await fetchAvatar(req.userId!, req.accessToken) });
  } catch (error: any) {
    console.error("[Route] avatar get:", error.message);
    res.status(500).json({ message: "Failed to fetch photo" });
  }
});

const storeAvatar = async (req: any, res: any, avatar: string | null) => {
  try {
    await saveAvatar(req.userId!, req.userEmail || "", avatar, req.accessToken);
    res.json({ success: true, avatar });
  } catch (error: any) {
    if (error instanceof AvatarColumnMissing) {
      return res.status(503).json({ code: "avatar_column_missing", message: "Photo storage is not set up yet" });
    }
    console.error("[Route] avatar save:", error.message);
    res.status(500).json({ message: "Failed to save photo" });
  }
};

router.put("/avatar", async (req, res) => {
  const avatar = parseAvatar(req.body?.image);
  if (!avatar) return res.status(400).json({ message: "Please choose a small JPEG, PNG or WebP photo" });
  await storeAvatar(req, res, avatar);
});

router.delete("/avatar", async (req, res) => { await storeAvatar(req, res, null); });

// ── GET /api/profile/history ──────────────────────────────────────
router.get("/history", async (req, res) => {
  try {
    res.json(await fetchSearchHistory(req.userId!, req.accessToken));
  } catch (error: any) {
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

export default router;
