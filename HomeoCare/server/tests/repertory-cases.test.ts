// Run: npx tsx server/tests/repertory-cases.test.ts   (fake client, no database)
import assert from "node:assert/strict";
import { makeCaseStore, isMissingTable, cleanTitle, parseState } from "../../client/src/lib/repertoryCasesCore";

type Call = { table: string; ops: Array<[string, any[]]> };
const calls: Call[] = [];
let reply: { data?: any; error?: any } = { data: [] };
// A chainable stand-in for the supabase-js query builder: every call is recorded; awaiting or .single() gives `reply`.
const client = {
  from(table: string) {
    const c: Call = { table, ops: [] }; calls.push(c);
    const b: any = new Proxy({}, {
      get: (_t, op: string) => {
        if (op === "then") return (res: any) => res(reply);
        if (op === "single") return () => Promise.resolve(reply);
        return (...args: any[]) => { c.ops.push([op, args]); return b; };
      },
    });
    return b;
  },
};
const signedIn = async () => ({ id: "u1" });
const signedOut = async () => null;
const store = makeCaseStore(client, signedIn);
const ops = (i = calls.length - 1) => calls[i].ops.map(([o]) => o).join(",");

let n = 0;
const t = async (name: string, fn: () => Promise<void> | void) => { calls.length = 0; reply = { data: [] }; await fn(); n++; console.log("ok  ", name); };

await t("signed out: nothing is sent to the database", async () => {
  const s = makeCaseStore(client, signedOut);
  for (const r of [await s.list(), await s.save("x", {}), await s.remove("a"), await s.visits("a"), await s.addVisit("a", "n", {}), await s.removeVisit("a")]) {
    assert.equal(r.ok, false); assert.equal((r as any).reason, "signed-out");
  }
  assert.equal(calls.length, 0);
});

await t("list: newest first, capped", async () => {
  reply = { data: [{ id: "1" }] };
  const r = await store.list();
  assert.deepEqual(r, { ok: true, data: [{ id: "1" }] });
  assert.equal(calls[0].table, "repertory_cases"); assert.match(ops(), /select,order,limit/);
});

await t("save: insert when new, update by id when it exists; the title is tidied; an empty title is refused", async () => {
  reply = { data: { id: "9", title: "Ana K" } };
  await store.save("  Ana   K  ", { ids: [1] });
  assert.match(ops(0), /^insert,select$/); assert.deepEqual(calls[0].ops[0][1][0], { title: "Ana K", state: { ids: [1] } });
  await store.save("Ana K", { ids: [1, 2] }, "9");
  assert.match(ops(1), /^update,eq,select$/); assert.deepEqual(calls[1].ops[1], ["eq", ["id", "9"]]);
  assert.equal(calls[1].ops[0][1][0].state.ids.length, 2); assert.ok(calls[1].ops[0][1][0].updated_at);
  const empty = await store.save("   ", {});
  assert.equal(empty.ok, false); assert.equal(calls.length, 2);
  assert.equal(cleanTitle("x".repeat(500)).length, 120);
});

await t("visits: a follow-up stores the note (trimmed, 2000 max) and the case as it stands", async () => {
  reply = { data: { id: "v1" } };
  await store.addVisit("c1", "  Sulph. 200, better  ", { ids: [5] });
  assert.deepEqual(calls[0].ops[0][1][0], { case_id: "c1", note: "Sulph. 200, better", state: { ids: [5] } });
  await store.addVisit("c1", "x".repeat(5000), {});
  assert.equal(calls[1].ops[0][1][0].note.length, 2000);
  await store.visits("c1");
  assert.deepEqual(calls[2].ops[0], ["select", ["id, case_id, note, state, created_at"]]);
});

await t("errors: missing tables are told apart from limits and from anything else (no database text leaks)", async () => {
  reply = { error: { code: "PGRST205", message: "Could not find the table 'public.repertory_cases' in the schema cache" } };
  const a = await store.list(); assert.equal((a as any).reason, "not-set-up"); assert.ok(!JSON.stringify(a).includes("repertory_cases"));
  assert.ok(isMissingTable({ code: "42P01" })); assert.ok(!isMissingTable(null)); assert.ok(!isMissingTable({ code: "23505", message: "dup" }));
  reply = { error: { code: "P0001", message: "You can keep at most 200 cases. Delete an old one first." } };
  const b = await store.save("x", {}); assert.match((b as any).message, /at most 200/);
  reply = { error: { code: "XX000", message: "relation foo, password=hunter2 secret" } };
  const c = await store.save("x", {}); assert.equal((c as any).message, "Something went wrong. Please try again.");
});

await t("parseState: a stored case is checked before use", () => {
  const empty = { ids: [] as number[], method: "grades" };
  assert.deepEqual(parseState(null, empty), empty); assert.deepEqual(parseState({ ids: "x" }, empty), empty);
  assert.deepEqual(parseState({ ids: [1, "2", -3, 4.5, 6], method: "presence" }, empty), { ids: [1, 6], method: "presence" });
  assert.equal(parseState({ ids: Array.from({ length: 99 }, (_, i) => i + 1) }, empty).ids.length, 30);
});

console.log(`\n${n} checks passed`);
