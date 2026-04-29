/**
 * Decode HTML entities in strings imported from external sources (Retreat Guru, etc.)
 * Handles: &amp; → &, &#39; → ', &quot; → ", &lt; → <, &gt; → >, &hellip; → …, &nbsp; → space
 */
export function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ');
}
