/**
 * Extract a Google Drive folder ID from anything the user might paste:
 * the address-bar URL while browsing a folder, a share link, or a
 * bare ID. All Drive folder links carry the ID the same way, so one
 * parser covers both "navigate and copy URL" and "share link".
 */
export function parseDriveFolderId(input: string): string | null {
  const s = input.trim();

  // https://drive.google.com/drive/folders/<ID>            (address bar)
  // https://drive.google.com/drive/u/0/folders/<ID>
  // .../folders/<ID>?usp=sharing | ?usp=share_link         (share link)
  let m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];

  // https://drive.google.com/open?id=<ID>  or  ?id=<ID>
  m = s.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];

  // a bare ID pasted on its own
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return s;

  return null;
}
