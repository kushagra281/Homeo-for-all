// Download helpers for the PDF report. jsPDF is loaded only when a button is pressed,
// so it does not slow down the first page load.
import { getCurrentUser, getHealthProfile } from "@/lib/supabase";
import { reportFileName, historySymptoms } from "@shared/reportFile";

type Patient = Record<string, any> | null;

// The saved profile, with the name filled in from the sign-up name when the profile has none.
export async function patientFor(profile?: Patient): Promise<Patient> {
  let p: Patient = profile ?? null;
  if (!p) {
    try { p = await getHealthProfile(); } catch { p = null; }
  }
  if (!p?.name) {
    try {
      const u = await getCurrentUser();
      const n = u?.user_metadata?.name;
      if (n) p = { ...(p || {}), name: n };
    } catch { /* the report simply has no name line */ }
  }
  return p;
}

// A shorter report for an entry in History: what History saves is the complaints, the top three
// remedies with their match %, and a few matched symptoms. Case-taking answers, dosage and
// better/worse are not saved there, so they are not in this report.
export async function downloadHistoryReport(row: any): Promise<void> {
  const [{ buildReport }, patient] = await Promise.all([import("@/lib/report"), patientFor()]);
  const results = Array.isArray(row?.results) ? row.results : [];
  const note = row?.health_history && typeof row.health_history === "object" ? row.health_history.text : row?.health_history;
  const doc = buildReport({
    symptoms: historySymptoms(row?.symptoms),
    answers: [],
    redFlags: [],
    profile: patient as any,
    analysis: null,
    consultedOn: row?.created_at ? new Date(row.created_at).toLocaleDateString("en-GB") : undefined,
    healthNote: typeof note === "string" ? note : undefined,
    results: results.slice(0, 3).map((r: any) => ({
      name: String(r?.remedy?.name || ""),
      score: typeof r?.score === "number" ? Math.round(r.score) : null,
      matches: (Array.isArray(r?.matching_symptoms) ? r.matching_symptoms : []).filter((m: unknown) => typeof m === "string"),
      better: [], worse: [], warnings: [],
    })).filter((r: { name: string }) => r.name),
  });
  doc.save(reportFileName((patient as any)?.name));
}
