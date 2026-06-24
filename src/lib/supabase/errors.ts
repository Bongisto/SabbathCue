/** Prefer the server's error message; fall back to a friendly default. */
export function failureMessage(
  error: { message?: string } | null,
  fallback: string
): string {
  return error?.message?.trim() ? error.message : fallback
}

/** Whether a thrown/returned error looks like a transport/network failure. */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror")
  )
}
