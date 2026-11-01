// Report photos picked with the paperclip on the home page. They are handed to the symptom page
// in memory (same browser tab); before this the home page threw the chosen file away and only
// changed the page, so attachments never reached the diagnosis.

export const MAX_REPORT_BYTES = 7 * 1024 * 1024;
const ALLOWED = /^image\/(jpeg|png|webp|gif)$/;

/** Returns a message if the file cannot be read, "" if it is fine. */
export function checkReportFile(file: File): string {
  if (!ALLOWED.test(file.type)) {
    return "only photos or screenshots (JPG, PNG, WebP, GIF) can be read - PDFs are not supported yet";
  }
  if (file.size > MAX_REPORT_BYTES) return "the file is larger than 7 MB";
  return "";
}

let pending: File[] = [];
export function setPendingReports(files: File[]) { pending = files; }
export function takePendingReports(): File[] { const f = pending; pending = []; return f; }
