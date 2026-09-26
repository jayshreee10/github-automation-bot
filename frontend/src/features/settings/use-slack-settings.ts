import { useCallback, useEffect, useState } from 'react'
import { fetchSlackSettings, saveSlackSettings } from './api'
import type { SlackSettings, SlackSettingsInput } from './schemas'

// Loads once per visit; save replaces the local copy with the server's answer.
export function useSlackSettings() {
  const [data, setData] = useState<SlackSettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchSlackSettings(controller.signal)
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setError('Could not load Slack settings.')
      })
    return () => controller.abort()
  }, [])

  const save = useCallback(async (input: SlackSettingsInput) => {
    const saved = await saveSlackSettings(input)
    setData(saved)
    return saved
  }, [])

  return { data, error, save }
}
