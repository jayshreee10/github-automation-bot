// "acme/api" → "api". The owner is shown elsewhere (installation card), so lists use the short name.
export function repoShortName(fullName: string): string {
  return fullName.split('/').at(-1) ?? fullName
}
