import { apiFetch, apiSend, query } from '@/lib/api'
import { type FailureList, failureListSchema } from './schemas'

export function fetchFailures(repositoryId: string | null, signal?: AbortSignal): Promise<FailureList> {
  return apiFetch(`/failures${query({ repositoryId })}`, failureListSchema, { signal })
}

// 202 queued, 409 already pending or running, 404 not the caller's.
export function retryJob(jobId: string): Promise<void> {
  return apiSend(`/jobs/${encodeURIComponent(jobId)}/retry`, { method: 'POST' })
}
