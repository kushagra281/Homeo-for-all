import type { ReactNode } from "react"
import AppHeader from "@/components/app-header"

/** Where people can write to about their data. Leave empty to hide the line until an address is chosen. */
const CONTACT_EMAIL = ""
const UPDATED = "5 November 2026"

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader width="max-w-3xl" />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8 space-y-5 text-sm leading-relaxed text-gray-700">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-xs text-gray-400 mt-1">Last updated {UPDATED}</p>
          </div>
          {children}
        </article>
      </main>
    </div>
  )
}

const H = ({ children }: { children: ReactNode }) => <h2 className="text-base font-semibold text-gray-900 pt-1">{children}</h2>

function Contact() {
  return CONTACT_EMAIL
    ? <p>Questions, or want your account and data deleted? Write to <a className="text-green-700 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    : null
}

export function PrivacyPage() {
  return (
    <Page title="Privacy Policy">
      <p>HomeoWell helps you look up homeopathic remedies for the symptoms you describe. This page says in plain words what we keep and who else sees it.</p>

      <H>What we store</H>
      <ul className="list-disc pl-5 space-y-1">
        <li><b>Your account:</b> name and email. Your password is handled by our sign-in provider and we never see it.</li>
        <li><b>Your health profile</b> (age, gender, height, weight, conditions and similar), only if you fill it in on the Profile page.</li>
        <li><b>Your search history:</b> the symptoms and health notes you searched with, and the top results. Only you can see it. You can delete any entry from History.</li>
      </ul>
      <p>Without an account you can still search; nothing from that search is saved to a profile.</p>

      <H>Who else sees what</H>
      <ul className="list-disc pl-5 space-y-1">
        <li><b>Supabase</b> stores our database and handles sign-in.</li>
        <li><b>Render</b> runs the app's server.</li>
        <li><b>Groq (AI)</b> reads the symptom text you type, your answers to the follow-up questions, and any medical report image you upload, to suggest questions and explain results. Your name, email and saved health profile are not sent to it.</li>
        <li><b>Google Translate</b> translates the page when you pick a language, so Google sees the text of the page you are viewing.</li>
      </ul>
      <p>We do not sell your data and we do not show ads.</p>

      <H>Your choices</H>
      <ul className="list-disc pl-5 space-y-1">
        <li>Edit or clear your health profile on the Profile page.</li>
        <li>Delete history entries one by one from History.</li>
        <li>Sign out at any time from the menu. Your sign-in is kept in this browser until you do.</li>
      </ul>
      <Contact />

      <H>Children</H>
      <p>The app is meant for adults. A parent or guardian should use it for a child.</p>

      <H>Changes</H>
      <p>If this page changes, the date at the top changes too.</p>
    </Page>
  )
}

export function TermsPage() {
  return (
    <Page title="Terms of Use">
      <p>By using HomeoWell you agree to these terms.</p>

      <H>Not medical advice</H>
      <p>HomeoWell gives general information about homeopathic remedies. It is not a diagnosis and not a prescription, and it does not replace a doctor. The potency and dose shown are general guidance only; a qualified homeopath should confirm the remedy and potency for you.</p>
      <p><b>See a doctor first</b> for a baby or young child, in pregnancy, for any serious or sudden symptom (chest pain, trouble breathing, heavy bleeding, high fever that will not settle, confusion, severe pain), or if you are already on treatment for a serious condition. In an emergency, call your local emergency number. Do not stop or delay prescribed treatment because of anything shown here.</p>

      <H>Your account</H>
      <p>Keep your password to yourself. You are responsible for what happens under your account. Give accurate details, because the results depend on what you enter.</p>

      <H>Using the app</H>
      <p>Use it for your own information. Do not misuse it, try to break it, or copy it in bulk.</p>

      <H>No guarantees</H>
      <p>Results come from a database and software that can be wrong or incomplete, and the app may be down or change without notice. To the extent the law allows, we are not liable for decisions you take based on the app.</p>

      <H>Privacy</H>
      <p>How we handle your data is explained in the <a className="text-green-700 underline" href="/privacy">Privacy Policy</a>.</p>
      <Contact />
    </Page>
  )
}
