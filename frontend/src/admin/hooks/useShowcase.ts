import type { Showcase } from '../types'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { useLocation, useParams } from 'react-router-dom'

import { getShowcaseByName } from '../api/adminApi'

export function useShowcase() {
  const location = useLocation()
  const { name } = useParams<{ name: string }>()
  const passedShowcase = location.state?.showcase as Showcase | undefined
  const [showcase, setShowcase] = useState<Showcase | null>(passedShowcase || null)
  const [isLoading, setIsLoading] = useState(!passedShowcase)
  const [error, setError] = useState<string | null>(null)
  const auth = useAuth()
  const accessToken = auth.user?.access_token
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const refetchRef = useRef(() => setRefreshTrigger((prev) => prev + 1))

  useEffect(() => {
    // Always fetch by name from URL if available (more reliable than state which is transient)
    if (name && accessToken) {
      const fetchShowcase = async () => {
        try {
          setIsLoading(true)
          const showcase = await getShowcaseByName(auth, name)
          setShowcase(showcase)
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch showcase')
          setShowcase(null)
        } finally {
          setIsLoading(false)
        }
      }

      void fetchShowcase()
      return
    }

    // Fallback: use passed showcase via state
    if (passedShowcase) {
      setShowcase(passedShowcase)
      setIsLoading(false)
      return
    }

    // No way to get showcase
    setIsLoading(false)
  }, [name, accessToken, passedShowcase, auth, refreshTrigger])

  return { showcase, isLoading, error, refetch: refetchRef.current }
}
