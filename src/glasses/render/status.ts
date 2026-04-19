/**
 * Renders a full-screen status message (splash, loading, error, no-token).
 * Returns the string content for a single TextContainer.
 */
export function renderStatusText(title: string, body: string): string {
  return `${title}\n\n${body}`
}
