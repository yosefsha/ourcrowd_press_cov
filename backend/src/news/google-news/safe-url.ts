/**
 * Returns `value` as a normalised absolute URL when it is a well-formed
 * `http:` or `https:` URL, and null for anything else — `javascript:`,
 * `data:`, relative paths, garbage. Feed-supplied URLs end up as links in the
 * dashboard, so only web URLs are ever kept.
 */
export function toHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }
  if (url.hostname === '' || url.username !== '' || url.password !== '') {
    return null;
  }
  return url.href;
}
