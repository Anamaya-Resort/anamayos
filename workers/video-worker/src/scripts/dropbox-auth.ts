/**
 * One-time Dropbox authorisation, producing a refresh token.
 *
 *   npx tsx src/scripts/dropbox-auth.ts <app-key>            # step 1: print the link
 *   npx tsx src/scripts/dropbox-auth.ts <app-key> <code>     # step 2: redeem it
 *
 * The verifier is written beside the env file between the two steps,
 * because PKCE requires the same one that generated the challenge.
 */
import 'dotenv/config';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { makeVerifier, authorizeUrl, exchangeCode } from '../dropbox/oauth.js';

const STATE = join(homedir(), '.anamaya-dropbox-verifier');
const ENVFILE = join(homedir(), '.anamaya-dropbox.env');

async function main() {
  const appKey = process.argv[2];
  const code = process.argv[3];
  if (!appKey) throw new Error('usage: dropbox-auth.ts <app-key> [code]');

  if (!code) {
    const verifier = makeVerifier();
    writeFileSync(STATE, verifier, { mode: 0o600 });
    console.log('\nOpen this link, click Continue then Allow, and copy the code it shows:\n');
    console.log(authorizeUrl(appKey, verifier));
    console.log('\nThen run this again with the code as the last argument.\n');
    return;
  }

  if (!existsSync(STATE)) throw new Error('no verifier on file - run step 1 first');
  const verifier = readFileSync(STATE, 'utf8').trim();
  const { refreshToken } = await exchangeCode({ appKey, verifier, code });

  writeFileSync(
    ENVFILE,
    `DROPBOX_APP_KEY=${appKey}\nDROPBOX_REFRESH_TOKEN=${refreshToken}\n`,
    { mode: 0o600 },
  );
  console.log(`\nDone. Saved to ${ENVFILE}`);
  console.log('This refresh token does not expire.\n');
  console.log('Add BOTH of these to Railway (video-worker -> Variables):');
  console.log(`  DROPBOX_APP_KEY       = ${appKey}`);
  console.log('  DROPBOX_REFRESH_TOKEN = (in the file above)');
  console.log('\nAnd remove DROPBOX_ACCESS_TOKEN - it is the one that keeps expiring.');
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
