// Slack Incoming Webhook failure; only the status is kept, the URL is a secret.
export class SlackApiError extends Error {
  constructor(readonly status: number) {
    super(`Slack webhook ${status}`);
    this.name = 'SlackApiError';
  }
}

// Slack treats &, < and > as control characters; escaping them stops payload text like <!channel> pinging anyone.
export function escapeSlack(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export async function postToSlack(url: string, message: object): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new SlackApiError(res.status);
}
