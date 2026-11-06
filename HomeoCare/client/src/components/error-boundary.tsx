import { Component, type ErrorInfo, type ReactNode } from "react"

/**
 * Catches a page that fails while drawing itself. Without it React removes the whole page and the person is
 * left on a blank white screen with no way out (it happened when an AI reply held an object where text was expected).
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[App] a page failed to draw:", error, info.componentStack) }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-green-50 px-4" data-testid="error-screen">
        <div className="w-full max-w-md bg-white border border-green-100 rounded-2xl shadow-sm p-6 text-center">
          <div className="text-4xl mb-3">🌿</div>
          <h1 className="text-xl font-bold text-gray-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600">
            This page could not be shown. Your saved profile and history are safe. Please go back to the home page and try again.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <a href="/" className="inline-flex items-center justify-center rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2">
              Go to home
            </a>
            <button onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 hover:bg-gray-50">
              Reload this page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
