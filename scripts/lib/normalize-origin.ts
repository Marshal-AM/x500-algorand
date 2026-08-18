/** Normalize to absolute origin URL (scheme + host) for indexer hostname matching. */
export function normalizeOriginUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `http://${trimmed}`;
  const url = new URL(withScheme);
  return `${url.protocol}//${url.host}`.replace(/\/$/, "");
}
