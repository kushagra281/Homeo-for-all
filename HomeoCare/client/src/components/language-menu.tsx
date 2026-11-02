import { useEffect, useState } from "react";
import { Globe, Check } from "lucide-react";
import { LANGUAGES, currentLanguage, onLanguageChange, setLanguage } from "@/lib/translate";

/** Language picker used in every page header. Shows the active language and keeps the page in place. */
export default function LanguageMenu() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(currentLanguage());
  useEffect(() => onLanguageChange(setLang), []);

  const choose = (code: string) => {
    setOpen(false);
    setLang(code);
    setLanguage(code);
  };
  const active = LANGUAGES.find((l) => l.code === lang);

  return (
    <div className="relative notranslate" translate="no">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:text-green-700 hover:border-green-300 transition"
        title="Translate page" aria-haspopup="menu" aria-expanded={open}
      >
        <Globe size={14} className="text-green-600" />
        <span className="hidden sm:inline">{lang === "en" ? "Translate" : active?.label}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-36 overflow-hidden">
            {LANGUAGES.map((l) => (
              <button
                key={l.code} role="menuitem" onClick={() => choose(l.code)}
                className={`w-full flex items-center justify-between gap-3 text-left px-3 py-2 text-sm hover:bg-green-50 hover:text-green-700 transition ${l.code === lang ? "text-green-700 font-semibold" : "text-gray-700"}`}
              >
                {l.label}
                {l.code === lang && <Check size={14} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
