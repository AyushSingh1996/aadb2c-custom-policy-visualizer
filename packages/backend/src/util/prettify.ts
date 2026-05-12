const PREFIX_RE = /^B2C_1A_/i;

export function prettifyId(id: string): string {
  const trimmed = id.trim();
  if (trimmed === '') return '';

  const withoutPrefix = trimmed.replace(PREFIX_RE, '');
  const pieces = withoutPrefix
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (pieces.length === 0) return '';

  return pieces
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
