'use client'

import { useCallback, useEffect, useState } from 'react'
import { getLoginUrl } from '@/lib/auth/google-oauth'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleSignIn = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Generate state and nonce
      const state = btoa(crypto.getRandomValues(new Uint8Array(32)).toString())
      const nonce = btoa(crypto.getRandomValues(new Uint8Array(32)).toString())

      // Store in cookies (client-side)
      document.cookie = `oauth_state=${state}; path=/; max-age=600`
      document.cookie = `oauth_nonce=${nonce}; path=/; max-age=600`

      // Also store in sessionStorage for validation
      sessionStorage.setItem('oauth_state', state)
      sessionStorage.setItem('oauth_nonce', nonce)

      // Get login URL and redirect
      const loginUrl = getLoginUrl(state, nonce)
      window.location.href = loginUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate login')
      setLoading(false)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Property Guide Builder
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to launch your property management dashboard
          </p>
        </div>

        <div className="mt-8 space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>
        </div>
      </div>
    </div>
  )
}
