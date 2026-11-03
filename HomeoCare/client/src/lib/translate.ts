// PAGE TRANSLATION (Google Translate widget, one copy for the whole app)
//
// Why this file exists: the script used to be loaded twice (index.html and the home page), the page
// was reloaded on every language change (typed symptoms were lost), the widget only worked from the
// home page, and Google's DOM changes could crash React.
//
// Here the widget is created once at start-up. Choosing a language changes the hidden Google select
// in place, so nothing reloads. If the select is not ready yet, the cookie is set and the page reloads
// as a fallback.

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "bn", label: "বাংলা" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "ur", label: "اردو" },
] as const;

const CODES = LANGUAGES.map((l) => l.code);
const EVENT = "homeowell:lang";

/** Language in the googtrans cookie ("/en/hi" -> "hi"); English when none is set. */
export function currentLanguage(): string {
  try {
    const m = /(?:^|;\s*)googtrans=\/[a-z-]+\/([a-zA-Z-]+)/.exec(document.cookie);
    const code = m?.[1];
    return code && (CODES as readonly string[]).includes(code) ? code : "en";
  } catch { return "en"; }
}

function writeCookie(code: string) {
  const host = window.location.hostname;
  const expire = "expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  if (code === "en") {
    document.cookie = `googtrans=; ${expire}`;
    document.cookie = `googtrans=; ${expire}; domain=${host}`;
    document.cookie = `googtrans=; ${expire}; domain=.${host}`;
  } else {
    document.cookie = `googtrans=/en/${code}; path=/`;
    document.cookie = `googtrans=/en/${code}; path=/; domain=${host}`;
    document.cookie = `googtrans=/en/${code}; path=/; domain=.${host}`;
  }
}

// Google wraps text in <font> elements. When React then removes or inserts a node whose parent
// was changed, it throws and the whole page goes blank. These two guards are the usual fix.
function guardReact() {
  if ((window as any).__gtGuard) return;
  (window as any).__gtGuard = true;
  const rm = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return rm.call(this, child) as T;
  };
  const ins = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return node;
    return ins.call(this, node, ref) as T;
  };
}

function addStyle() {
  if (document.getElementById("gt-style")) return;
  const style = document.createElement("style");
  style.id = "gt-style";
  style.textContent = `
    #google_translate_element, .goog-te-banner-frame, .goog-te-balloon-frame, #goog-gt-tt,
    iframe.skiptranslate, body > .skiptranslate { display: none !important; }
    body { top: 0 !important; position: static !important; }
    .goog-text-highlight { background: none !important; box-shadow: none !important; }
    font { background: transparent !important; box-shadow: none !important; }
  `;
  document.head.appendChild(style);
}

let started = false;
/** Call once at start-up. Creates the hidden widget and loads Google's script. */
export function initTranslate() {
  if (started || typeof document === "undefined") return;
  started = true;
  guardReact();
  addStyle();
  if (!document.getElementById("google_translate_element")) {
    const host = document.createElement("div");
    host.id = "google_translate_element";
    document.body.appendChild(host);
  }
  (window as any).googleTranslateElementInit = () => {
    try {
      new (window as any).google.translate.TranslateElement(
        { pageLanguage: "en", includedLanguages: CODES.join(","), autoDisplay: false },
        "google_translate_element",
      );
    } catch { /* offline or blocked: the menu falls back to the cookie */ }
  };
  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  script.onerror = () => { /* blocked network: translation simply stays off */ };
  document.head.appendChild(script);
}

function combo(): HTMLSelectElement | null {
  return document.querySelector<HTMLSelectElement>("select.goog-te-combo");
}

let restoreTimer: number | undefined;

/** Switch language without reloading. Returns false when it had to reload the page instead. */
export function setLanguage(code: string): boolean {
  if (!(CODES as readonly string[]).includes(code)) return true;
  writeCookie(code);
  window.clearTimeout(restoreTimer);   // a newer choice cancels a pending "back to English" check
  // Google cannot reliably undo a translation in place (the text stays in the other language).
  // The cookie is already cleared, so a reload brings the original English page back.
  if (code === "en") {
    if (currentLanguage() === "en" || !document.cookie.includes("googtrans")) {
      window.location.reload();
      return false;
    }
  }
  const select = combo();
  if (select) {
    // Google's empty "Select language" option does not undo a translation; the page language
    // ("en") is tried first.
    select.value = code;
    select.dispatchEvent(new Event("change"));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: code }));
    if (code === "en") {
      // Google does not always restore the original text. If the page is still marked as translated
      // a moment later, reload once: the googtrans cookie is already cleared, so it comes back in English.
      restoreTimer = window.setTimeout(() => {
        const root = document.documentElement.classList;
        const stillTranslated = root.contains("translated-ltr") || root.contains("translated-rtl");
        if (stillTranslated && currentLanguage() === "en") window.location.reload();
      }, 800);
    }
    return true;
  }
  window.location.reload();
  return false;
}

export function onLanguageChange(fn: (code: string) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}
