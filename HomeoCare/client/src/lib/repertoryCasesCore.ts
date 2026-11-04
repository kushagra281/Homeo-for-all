// Saved repertory cases (a practitioner's chosen rubrics + options) and their follow-up visits.
// The Supabase client is passed in, so this file has no browser-only imports and can be tested.
// Rows are protected by row level security (docs/sql/2026-11-repertory-cases.sql): a user only sees their own.

export interface CaseRow { id: string; title: string; state: any; created_at: string; updated_at: string }
export interface VisitRow { id: string; case_id: string; note: string; state: any; created_at: string }

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "signed-out" | "not-set-up" | "error"; message: string }

type Client = { from: (table: string) => any }
type GetUser = () => Promise<{ id: string } | null>

const CASE_COLS = "id, title, state, created_at, updated_at"
const VISIT_COLS = "id, case_id, note, state, created_at"

/** Is this error "the tables are not there yet"? (They are created by a one-off SQL script.) */
export function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === "42P01" || err.code === "PGRST205" || err.code === "PGRST200" ||
    /does not exist|schema cache|Could not find the table/i.test(err.message || "")
}

const fail = (err: { code?: string; message?: string }): Result<never> =>
  isMissingTable(err)
    ? { ok: false, reason: "not-set-up", message: "Saving cases is not set up yet." }
    // limit messages from the database ("at most 200 cases") are written for people; anything else is generic
    : { ok: false, reason: "error", message: /at most|not yours/i.test(err.message || "") ? String(err.message) : "Something went wrong. Please try again." }

export const cleanTitle = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 120)

export function makeCaseStore(client: Client, getUser: GetUser) {
  const needUser = async () => getUser().catch(() => null)

  return {
    async list(): Promise<Result<CaseRow[]>> {
      if (!(await needUser())) return { ok: false, reason: "signed-out", message: "Please sign in to save cases." }
      const { data, error } = await client.from("repertory_cases").select(CASE_COLS).order("updated_at", { ascending: false }).limit(200)
      return error ? fail(error) : { ok: true, data: data || [] }
    },

    /** Creates a case, or updates it when an id is given. */
    async save(title: string, state: unknown, id?: string): Promise<Result<CaseRow>> {
      if (!(await needUser())) return { ok: false, reason: "signed-out", message: "Please sign in to save cases." }
      const name = cleanTitle(title)
      if (!name) return { ok: false, reason: "error", message: "Give the case a short title." }
      const q = id
        ? client.from("repertory_cases").update({ title: name, state, updated_at: new Date().toISOString() }).eq("id", id)
        : client.from("repertory_cases").insert({ title: name, state })
      const { data, error } = await q.select(CASE_COLS).single()
      return error ? fail(error) : { ok: true, data }
    },

    async remove(id: string): Promise<Result<true>> {
      if (!(await needUser())) return { ok: false, reason: "signed-out", message: "Please sign in." }
      const { error } = await client.from("repertory_cases").delete().eq("id", id)
      return error ? fail(error) : { ok: true, data: true }
    },

    async visits(caseId: string): Promise<Result<VisitRow[]>> {
      if (!(await needUser())) return { ok: false, reason: "signed-out", message: "Please sign in." }
      const { data, error } = await client.from("repertory_case_visits").select(VISIT_COLS)
        .eq("case_id", caseId).order("created_at", { ascending: false }).limit(100)
      return error ? fail(error) : { ok: true, data: data || [] }
    },

    /** A follow-up: a note plus the case exactly as it stands now. */
    async addVisit(caseId: string, note: string, state: unknown): Promise<Result<VisitRow>> {
      if (!(await needUser())) return { ok: false, reason: "signed-out", message: "Please sign in." }
      const { data, error } = await client.from("repertory_case_visits")
        .insert({ case_id: caseId, note: note.trim().slice(0, 2000), state }).select(VISIT_COLS).single()
      return error ? fail(error) : { ok: true, data }
    },

    async removeVisit(id: string): Promise<Result<true>> {
      if (!(await needUser())) return { ok: false, reason: "signed-out", message: "Please sign in." }
      const { error } = await client.from("repertory_case_visits").delete().eq("id", id)
      return error ? fail(error) : { ok: true, data: true }
    },
  }
}

/** A stored case state, checked before it is trusted (it came from the database, not from our code). */
export function parseState<T extends { ids: number[] }>(raw: any, empty: T): T {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.ids)) return empty
  return { ...empty, ...raw, ids: raw.ids.filter((n: unknown) => Number.isSafeInteger(n) && (n as number) > 0).slice(0, 30) }
}
