// The profile photo is a small picture kept as a data URL in the user's own profile row (private under RLS).
// The browser shrinks it before sending; the server checks it again here, because the request can come from anywhere.

/** The most characters a photo may have. A 256 px JPEG is about 20 to 40 thousand. */
export const AVATAR_MAX_CHARS = 80_000;

const SHAPE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

// First bytes of each format, so a different file cannot pass as a picture just by its label.
function looksLike(kind: string, b64: string): boolean {
  let head: string;
  try { head = atob(b64.slice(0, 16)); } catch { return false; }
  const byte = (i: number) => head.charCodeAt(i);
  if (kind === "jpeg") return byte(0) === 0xff && byte(1) === 0xd8 && byte(2) === 0xff;
  if (kind === "png") return byte(0) === 0x89 && head.slice(1, 4) === "PNG";
  return head.slice(0, 4) === "RIFF" && head.slice(8, 12) === "WEBP";   // webp
}

/** The data URL if it is a small, real JPEG, PNG or WebP picture, otherwise null. */
export function parseAvatar(input: unknown): string | null {
  if (typeof input !== "string" || input.length > AVATAR_MAX_CHARS) return null;
  const m = SHAPE.exec(input);
  if (!m) return null;
  const b64 = m[2];
  if (b64.length < 64 || b64.length % 4 !== 0) return null;
  return looksLike(m[1], b64) ? input : null;
}

/** One or two letters for the round placeholder shown when there is no photo. */
export function avatarInitial(nameOrEmail?: string | null): string {
  const s = String(nameOrEmail ?? "").trim().split("@")[0].trim();      // an email: only the part before the @
  if (!s) return "?";
  const words = s.split(/[\s._@-]+/).filter(Boolean);
  const first = Array.from(words[0] || "")[0] || "?";
  const second = words.length > 1 ? Array.from(words[1])[0] || "" : "";
  return (first + second).toUpperCase();
}
