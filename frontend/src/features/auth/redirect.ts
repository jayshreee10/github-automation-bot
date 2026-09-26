// Only same-origin paths are allowed after sign-in; blocks open redirects like //evil.com or https://…
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
}
