/**
 * Confirm the Dropbox credential works, without touching anything.
 * Reports which kind is in use, mints a token and lists a folder.
 */
import 'dotenv/config';
import { accessTokenFromRefresh, hasRefreshToken } from '../dropbox/oauth.js';
import { listSharedFolder } from '../dropbox/client.js';

async function main() {
  console.log('refresh token configured:', hasRefreshToken());
  if (hasRefreshToken()) {
    const t = await accessTokenFromRefresh();
    console.log('minted an access token, length', t.length);
  }
  const link = process.argv[2];
  if (link) {
    const files = await listSharedFolder(link);
    console.log('listed', files.length, 'files');
  }
}

main().catch((e) => { console.error('FAILED:', String(e).slice(0, 300)); process.exit(1); });
