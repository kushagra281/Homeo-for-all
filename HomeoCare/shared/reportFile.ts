// Small pure helpers for the PDF report, shared by the results page and the History lists.

const pad = (n: number) => String(n).padStart(2, "0");

// "homeocare-report-2026-11-05 Patient Name.pdf". The date is the person's local date (not UTC, which
// is still "yesterday" for a few hours after midnight in India). Characters a file name cannot hold
// are dropped; letters of any script are kept. With no name the file is just "homeocare-report-<date>.pdf".
export function reportFileName(patientName?: string | null, now: Date = new Date()): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const name = String(patientName ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  return `homeocare-report-${date}${name ? " " + name : ""}.pdf`;
}

// A saved history row keeps a few bookkeeping entries next to the real complaints
// ("category:...", "health history:...", "age ...", "gender: ..."). The report lists complaints only.
export function historySymptoms(symptoms: unknown): string[] {
  if (!Array.isArray(symptoms)) return [];
  return symptoms
    .filter((s): s is string => typeof s === "string")
    .filter((s) => !/^(category:|health history:|gender:|age\b)/i.test(s.trim()))
    .map((s) => s.trim())
    .filter(Boolean);
}
