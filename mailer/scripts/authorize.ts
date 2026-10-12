// authorize.ts - one-time Gmail consent for the mailer (#62), run by an admin
// while signed in to Google as the *sender* user (vinyltrack@<family-domain>).
//
//   GMAIL_CLIENT_ID=… GMAIL_CLIENT_SECRET=… npm run authorize -- --out ./gmail_refresh_token
//
// Opens a loopback redirect on 127.0.0.1 (the Desktop OAuth client flow), asks
// for the gmail.send scope only, and writes the refresh token to --out with
// mode 600. Copy that file to /Users/_vinyltrack/secrets/gmail_refresh_token
// on the server, then delete the local copy. Uses PKCE and a state check.
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { chmodSync, writeFileSync } from 'node:fs';

const SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const outIndex = process.argv.indexOf('--out');
const out = outIndex > -1 ? process.argv[outIndex + 1] : undefined;

if (!clientId || !clientSecret || !out) {
  console.error('usage: GMAIL_CLIENT_ID=… GMAIL_CLIENT_SECRET=… npm run authorize -- --out <file>');
  process.exit(2);
}

const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const state = randomBytes(16).toString('hex');

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const code = url.searchParams.get('code');
  const denied = url.searchParams.get('error');
  if (denied) {
    // Consent refused (e.g. access_denied): stop rather than wait forever.
    res.writeHead(400).end(`Authorization failed: ${denied}`);
    console.error(`Authorization failed: ${denied}`);
    process.exitCode = 1;
    server.close();
    return;
  }
  // A stray request (favicon, wrong state): ignore it and keep waiting.
  if (url.searchParams.get('state') !== state || !code) {
    res.writeHead(400).end('Authorization failed: bad state or no code');
    return;
  }
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, code_verifier: verifier,
        client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
      }).toString(),
    });
    const body = (await tokenRes.json()) as { refresh_token?: string; scope?: string; error?: string };
    if (!body.refresh_token) throw new Error(body.error ?? 'no refresh_token in the response');
    if (body.scope !== SCOPE) throw new Error(`unexpected scope granted: ${body.scope}`);
    writeFileSync(out, `${body.refresh_token}\n`, { mode: 0o600 });
    // mode only applies when the file is created; tighten an existing one too.
    chmodSync(out, 0o600);
    res.writeHead(200).end('Done. You can close this tab.');
    console.log(`Wrote the refresh token to ${out} (mode 600).`);
  } catch (error) {
    res.writeHead(500).end('Token exchange failed; see the terminal.');
    console.error('Token exchange failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});

let redirectUri = '';
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  redirectUri = `http://127.0.0.1:${port}`;
  const consent = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  consent.search = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE,
    access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256',
  }).toString();
  console.log('Open this URL while signed in as the sender user:\n');
  console.log(consent.toString());
});
