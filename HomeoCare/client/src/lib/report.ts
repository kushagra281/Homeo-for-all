// PDF REPORT: a plain, printable summary of one search (built in the browser, nothing is sent anywhere).
// The built-in PDF font covers Latin text only, so characters outside it are replaced with "?".
import { jsPDF } from "jspdf";

export interface ReportInput {
  symptoms: string[];
  answers: Array<{ question: string; answer: string }>;
  redFlags: Array<{ level: string; message: string }>;
  profile?: { name?: string; age?: number | string; gender?: string; chronic_conditions?: string } | null;
  analysis?: { overview: string; remedies: Array<{ name: string; why: string; against: string }>; ask_next: string[] } | null;
  consultedOn?: string;   // a report made from History says when the consultation happened
  healthNote?: string;    // free-text health history saved with that consultation
  results: Array<{
    name: string; score: number | null; dosage?: string; why?: string;
    matches: string[]; better: string[]; worse: string[]; warnings: string[];
  }>;
}

const latin = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E -ÿ]/g, "?").replace(/\s+/g, " ").trim();

export function buildReport(input: ReportInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 48, maxW = W - M * 2;
  let y = M;

  const need = (h: number) => { if (y + h > H - M) { doc.addPage(); y = M; } };
  const text = (s: string, size = 10, bold = false, color: [number, number, number] = [30, 30, 30], indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(size).setTextColor(...color);
    for (const line of doc.splitTextToSize(latin(s), maxW - indent) as string[]) {
      need(size + 4); doc.text(line, M + indent, y); y += size + 4;
    }
  };
  const heading = (s: string) => { y += 6; need(30); text(s, 12, true, [22, 101, 52]); doc.setDrawColor(200).line(M, y - 8, W - M, y - 8); y += 8; };

  const p = input.profile;
  // The built-in font cannot draw letters of other scripts (e.g. Devanagari); they would print as "????".
  // So only the Latin part of the name is printed ("आयुष K" -> "K"), and nothing if none is left.
  // The file name still carries the whole name.
  const patientName = String(p?.name ?? "").replace(/[^\x20-\x7E -ÿ]/g, "").replace(/\s+/g, " ").trim();

  text("HomeoCare - Case Report", 18, true, [22, 101, 52]);
  if (patientName) text(`Patient: ${patientName}`, 13, true);
  if (input.consultedOn) text(`Consultation on ${input.consultedOn}`, 9, false, [110, 110, 110]);
  text(`Prepared on ${new Date().toLocaleDateString("en-GB")}`, 9, false, [110, 110, 110]);

  if (p && (p.age || p.gender || p.chronic_conditions)) {
    heading("Patient details");
    const who = [p.age ? `${p.age} yrs` : "", p.gender].filter(Boolean).join(", ");
    if (who) text(who);
    if (p.chronic_conditions) text(`Known conditions: ${p.chronic_conditions}`);
  }

  heading("Complaints");
  input.symptoms.forEach((s) => text(`- ${s}`));

  if (input.healthNote) {
    heading("Health history noted");
    text(input.healthNote, 9, false, [60, 60, 60]);
  }

  if (input.answers.length) {
    heading("Case-taking answers");
    input.answers.forEach((a) => text(`${a.question}  ${a.answer}`, 9, false, [60, 60, 60]));
  }

  if (input.redFlags.length) {
    heading("Warning signs - see a doctor");
    input.redFlags.forEach((f) => text(`${f.level.toUpperCase()}: ${f.message}`, 10, true, [185, 28, 28]));
  }

  if (input.analysis && (input.analysis.overview || input.analysis.remedies.length)) {
    heading("Case analysis");
    if (input.analysis.overview) text(input.analysis.overview);
    input.analysis.remedies.forEach((r) => {
      text(`${r.name}: ${r.why}`, 10);
      if (r.against) text(`Against: ${r.against}`, 9, false, [110, 110, 110], 12);
    });
    if (input.analysis.ask_next.length) { text("Questions that would separate the top remedies:", 9, true); input.analysis.ask_next.forEach((q) => text(`- ${q}`, 9)); }
  }

  heading("Top remedies");
  input.results.forEach((r, i) => {
    need(60);
    text(`#${i + 1}  ${r.name}${r.score == null ? "" : `   (${r.score}% relative match)`}`, 12, true);
    if (r.why) text(r.why, 9, false, [60, 60, 60], 12);
    if (r.matches.length) text(`Matched: ${r.matches.slice(0, 8).join("; ")}`, 9, false, [60, 60, 60], 12);
    if (r.better.length) text(`Better: ${r.better.join("; ")}`, 9, false, [60, 60, 60], 12);
    if (r.worse.length) text(`Worse: ${r.worse.join("; ")}`, 9, false, [60, 60, 60], 12);
    if (r.dosage) text(`Dosage: ${r.dosage}`, 9, false, [30, 64, 175], 12);
    r.warnings.forEach((w) => text(`Caution: ${w}`, 9, false, [185, 28, 28], 12));
    y += 6;
  });

  // Disclaimer + page numbers on every page
  need(50);
  y += 6;
  text("This report matches symptoms with materia medica text. It is not a diagnosis and not a substitute for a qualified doctor or homeopath. Seek medical help for any warning sign above.", 8, false, [110, 110, 110]);
  const pages = doc.getNumberOfPages();
  for (let n = 1; n <= pages; n++) {
    doc.setPage(n).setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
    doc.text(`Page ${n} of ${pages}`, W - M, H - 24, { align: "right" });
  }
  return doc;
}
