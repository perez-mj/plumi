// src/lib/markdownExcerpt.ts

/**
 * Extract a short plain-text preview from Markdown for list views.
 * Strips fenced code, inline code, images, link syntax, and common
 * Markdown punctuation. Safe to run on every list fetch.
 */
export function markdownExcerpt(source: string | null | undefined, max = 140): string {
  if (!source) return '';
  const plain = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > max ? plain.slice(0, max).trimEnd() + '…' : plain;
}