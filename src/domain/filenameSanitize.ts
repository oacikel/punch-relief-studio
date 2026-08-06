/**
 * Sanitize a user-supplied or derived string into a safe, descriptive
 * export filename. Strips path separators and control characters, collapses
 * whitespace, enforces a length cap, and guarantees a non-empty result.
 */

export function sanitizeFilename(input: string, fallback = 'punch-relief-pattern'): string {
  let name = input
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[/\\:*?"<>|\x00-\x1f]/g, '-')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');

  if (name.length === 0) name = fallback;
  if (name.length > 120) name = name.slice(0, 120);
  return name;
}

export function withExtension(name: string, ext: string): string {
  const clean = ext.replace(/^\./, '');
  return `${sanitizeFilename(name)}.${clean}`;
}
