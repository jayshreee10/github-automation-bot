import { Hash, Info } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api'
import { sendSlackTest } from './api'
import type { SlackSettings, SlackSettingsInput } from './schemas'
import { isDirty, maskedWebhook, type SlackFormValues, toForm, toInput, webhookError } from './slack-form'

interface Props {
  data: SlackSettings | null
  error: string | null
  onSave: (input: SlackSettingsInput) => Promise<SlackSettings>
}

// Walkthrough: creating a Slack app and copying its Incoming Webhook URL.
const WEBHOOK_HELP_URL = 'https://www.youtube.com/watch?v=LOS_rRlCr7U'

const detail = (err: unknown) => (err instanceof ApiError && err.detail ? err.detail : null)

// Where rule notifications go. No webhook, no Slack. A saved webhook is never sent back; only its last 4 characters.
export function SlackCard({ data, error, onSave }: Props) {
  return (
    <section id="slack" className="panel settings-card" aria-labelledby="slack-title">
      <div className="settings-card-head">
        <span className="settings-icon">
          <Hash />
        </span>
        <div className="panel-head-text">
          <h2 id="slack-title" className="section-title">
            Slack notifications
          </h2>
          <span className="settings-note">Rule notifications go to this Incoming Webhook.</span>
        </div>
        {data && (
          <span className="settings-head-badge">
            <StatusBadge tone={data.connected ? 'success' : 'warn'}>{data.connected ? 'Connected' : 'Not connected'}</StatusBadge>
          </span>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
      {!data && !error && <Skeleton className="settings-skeleton" />}
      {/* Keyed on the save time so a save resets the form to what the server stored. */}
      {data && <SlackForm key={data.updatedAt ?? 'new'} saved={data} onSave={onSave} />}
    </section>
  )
}

function SlackForm({ saved, onSave }: { saved: SlackSettings; onSave: Props['onSave'] }) {
  const [values, setValues] = useState<SlackFormValues>(() => toForm(saved))
  const [replacing, setReplacing] = useState(!saved.connected)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'test' | 'remove' | null>(null)
  const set = <K extends keyof SlackFormValues>(key: K, value: SlackFormValues[K]) => setValues((prev) => ({ ...prev, [key]: value }))

  function checkUrl(): boolean {
    const message = webhookError(values.webhookUrl)
    setUrlError(message)
    return message === null
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!checkUrl()) return
    if (!saved.connected && !values.webhookUrl.trim()) {
      setUrlError('Add your Slack Incoming Webhook URL')
      return
    }
    setBusy('save')
    try {
      await onSave(toInput(values, saved))
      toast.success('Slack settings saved')
    } catch (err) {
      const message = detail(err)
      toast.error(message ? `Not saved: ${message}` : 'Could not save Slack settings')
      setBusy(null)
    }
  }

  async function test() {
    if (!checkUrl()) return
    setBusy('test')
    try {
      await sendSlackTest(values.webhookUrl.trim() || undefined)
      toast.success('Test message sent. Check your Slack channel.')
    } catch (err) {
      toast.error(detail(err) ?? 'Slack did not accept the test message')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('remove')
    try {
      await onSave({ webhookUrl: null })
      toast.success('Webhook removed. Slack notifications are off.')
    } catch {
      toast.error('Could not remove the webhook')
      setBusy(null)
    }
  }

  const hasTarget = saved.connected || values.webhookUrl.trim() !== ''

  return (
    <form className="settings-form" onSubmit={save} noValidate>
      <div className="editor-field">
        <span className="settings-label-row">
          <label className="field-label" htmlFor="slack-url">
            Incoming webhook URL
          </label>
          <a
            className="settings-info-link"
            href={WEBHOOK_HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="How to get a Slack webhook URL (video)"
            title="How to get a Slack webhook URL (video)"
          >
            <Info />
          </a>
        </span>
        {replacing ? (
          <div className="settings-row">
            <Input
              id="slack-url"
              className="mono"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={values.webhookUrl}
              placeholder="https://hooks.slack.com/services/…"
              onChange={(e) => set('webhookUrl', e.target.value)}
              aria-invalid={Boolean(urlError) || undefined}
            />
            {saved.connected && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  set('webhookUrl', '')
                  setUrlError(null)
                  setReplacing(false)
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        ) : (
          <div className="settings-row">
            <Input id="slack-url" className="mono" value={maskedWebhook(saved.webhookLast4)} readOnly aria-readonly />
            <Button type="button" variant="outline" onClick={() => setReplacing(true)}>
              Replace
            </Button>
            <Button type="button" variant="ghost" className="danger-text" onClick={remove} disabled={busy !== null}>
              Remove
            </Button>
          </div>
        )}
        {urlError && <p className="error-text">{urlError}</p>}
        <span className="settings-hint">{urlHint(saved)}</span>
      </div>

      <div className="settings-grid">
        <div className="editor-field">
          <label className="field-label" htmlFor="slack-channel">
            Channel label
          </label>
          <Input
            id="slack-channel"
            value={values.channelLabel}
            maxLength={80}
            placeholder="#eng-alerts"
            onChange={(e) => set('channelLabel', e.target.value)}
          />
          <span className="settings-hint">For your reference; the webhook itself decides the channel.</span>
        </div>
        <div className="editor-field">
          <span className="field-label" id="slack-link-label">
            Include event link
          </span>
          <div className="settings-switch-box">
            <span className="settings-note">Link each message title to GitHub</span>
            <Switch checked={values.includeLink} onCheckedChange={(on) => set('includeLink', on)} aria-labelledby="slack-link-label" />
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <Button type="button" variant="outline" onClick={test} disabled={busy !== null || !hasTarget}>
          {busy === 'test' ? 'Sending…' : 'Send test message'}
        </Button>
        <Button type="submit" disabled={busy !== null || !isDirty(values, saved)}>
          {busy === 'save' ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

function urlHint(saved: SlackSettings): string {
  if (saved.connected) return `Stored encrypted on the server. Only the last 4 characters are ever shown: ••••${saved.webhookLast4 ?? ''}`
  return 'Required for Slack: until you add one, Slack actions in rules fail. Stored encrypted.'
}
