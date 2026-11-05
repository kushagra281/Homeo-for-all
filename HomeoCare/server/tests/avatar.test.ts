import assert from "node:assert/strict";
import { AVATAR_MAX_CHARS, avatarInitial, parseAvatar } from "../../shared/avatar";

const t = (name: string, fn: () => void) => { fn(); console.log("ok  ", name); };
const url = (mime: string, bytes: number[], pad = 120) =>
  `data:image/${mime};base64,${Buffer.concat([Buffer.from(bytes), Buffer.alloc(pad, 7)]).toString("base64")}`;
const JPEG = url("jpeg", [0xff, 0xd8, 0xff, 0xe0]);
const PNG = url("png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = url("webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

t("a small JPEG, PNG or WebP picture is accepted as it is", () => {
  for (const u of [JPEG, PNG, WEBP]) assert.equal(parseAvatar(u), u);
});

t("anything else is refused", () => {
  for (const bad of [
    undefined, null, 5, {}, "", "hello",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",                    // not an image
    "data:image/svg+xml;base64," + Buffer.from("<svg onload=alert(1)>" + "x".repeat(80)).toString("base64"),   // svg can carry script
    "data:image/gif;base64," + Buffer.from("GIF89a" + "x".repeat(100)).toString("base64"),
    "https://example.com/me.jpg",                                                       // a link, not a picture
    "data:image/jpeg;base64,/9j/4AAQ",                                                  // far too short to be a picture
    JPEG + "!!",                                                                         // not base64
    JPEG.replace("image/jpeg", "image/png"),                                             // label does not match the bytes
    PNG.replace("image/png", "image/webp"),
    WEBP.replace("image/webp", "image/jpeg"),
    url("jpeg", [0x00, 0x01, 0x02, 0x03]),                                              // right label, wrong bytes
  ]) assert.equal(parseAvatar(bad), null, String(bad).slice(0, 40));
});

t("a picture over the size limit is refused", () => {
  const big = url("jpeg", [0xff, 0xd8, 0xff, 0xe0], AVATAR_MAX_CHARS);
  assert.ok(big.length > AVATAR_MAX_CHARS);
  assert.equal(parseAvatar(big), null);
  const ok = url("jpeg", [0xff, 0xd8, 0xff, 0xe0], 40_000);                            // about what a 256 px photo is
  assert.ok(ok.length < AVATAR_MAX_CHARS);
  assert.equal(parseAvatar(ok), ok);
});

t("the placeholder initial comes from the name, or the email", () => {
  assert.equal(avatarInitial("Lakshya Saxena"), "LS");
  assert.equal(avatarInitial("lakshya"), "L");
  assert.equal(avatarInitial("astrowizardteam@gmail.com"), "A");
  assert.equal(avatarInitial("  "), "?");
  assert.equal(avatarInitial(null), "?");
  assert.equal(avatarInitial("लक्ष्य शर्मा"), "लश");
});
