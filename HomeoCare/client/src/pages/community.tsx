import AppHeader from "@/components/app-header"
import { CommunityChat } from "../components/community-chat"

export default function Community() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      <AppHeader />
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Community Chat</h1>
          <p className="text-sm text-gray-500 mt-1">Share experiences with other homeopathy learners.</p>
        </div>
        <CommunityChat />
        <p className="mt-6 text-center text-xs text-gray-400">
          Please be respectful. Discussions here are for information only; consult a qualified homeopath for medical advice.
        </p>
      </main>
    </div>
  )
}
