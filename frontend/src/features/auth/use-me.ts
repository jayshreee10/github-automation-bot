import { useEffect, useState } from 'react'
import { fetchMe } from './api'
import type { Me } from './schemas'

export function useMe() {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch(() => setError('Could not load your profile from the API.'))
  }, [])

  return { me, error }
}
