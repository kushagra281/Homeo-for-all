// Run: tsx server/tests/security.test.ts
// Checks that profile routes need a signed-in user and that the expensive routes are rate limited.
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import profileRouter from "../routes/profile";
import remediesRouter from "../routes/remedies";

delete process.env.SUPABASE_URL; delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_KEY; delete process.env.SUPABASE_ANON_KEY; delete process.env.VITE_SUPABASE_ANON_KEY;

const app = express();
app.use(express.json());
app.use("/api/profile", profileRouter);
app.use("/api/remedies", remediesRouter);

const server = app.listen(0, async () => {
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    // 1. no token -> 401, for every profile route, even when a userId is supplied
    for (const [method, path] of [["GET", "/api/profile/me"], ["POST", "/api/profile/save"], ["GET", "/api/profile/history"]] as const) {
      const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify({ userId: "someone-else", profile: { name: "x" } }) : undefined });
      assert.equal(r.status, 401, `${method} ${path} must need a token`);
    }
    console.log("ok   profile routes reject requests without a token (a userId in the body is not enough)");

    // 2. token that cannot be verified -> never 200
    const r2 = await fetch(base + "/api/profile/me", { headers: { Authorization: "Bearer not-a-real-token" } });
    assert.ok(r2.status === 401 || r2.status === 503, `got ${r2.status}`);
    console.log("ok   an unverifiable token is rejected, not trusted");

    // 3. old "userId in the URL" routes are gone
    const r3 = await fetch(base + "/api/profile/00000000-0000-0000-0000-000000000000");
    assert.equal(r3.status, 401);
    console.log("ok   no route returns another user's profile by id");

    // 4. /score is limited to 30 per minute per client (empty body -> cheap 400s until the limit)
    const codes: number[] = [];
    for (let i = 0; i < 33; i++) {
      const r = await fetch(base + "/api/remedies/score", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      codes.push(r.status);
    }
    assert.equal(codes.filter((c) => c === 400).length, 30);
    assert.equal(codes.filter((c) => c === 429).length, 3);
    console.log("ok   /score: 30 requests allowed per minute, then 429");

    // 5. report analysis: 6 per minute
    const c2: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = await fetch(base + "/api/remedies/analyze-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      c2.push(r.status);
    }
    assert.equal(c2.filter((c) => c === 400).length, 6);
    assert.equal(c2.filter((c) => c === 429).length, 2);
    console.log("ok   /analyze-report: 6 requests per minute, then 429");

    console.log("\n5 checks passed (security)");
    server.close(); process.exit(0);
  } catch (e) {
    console.error("FAIL", e); server.close(); process.exit(1);
  }
});
