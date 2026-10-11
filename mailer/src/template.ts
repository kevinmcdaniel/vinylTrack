// template.ts - the one email the mailer can send (#62): a sign-in link.
// The caller supplies only the recipient and the (allowlisted) link.

export type RenderedEmail = { from: string; to: string; subject: string; text: string; html: string };

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function renderMagicLinkEmail({ from, to, url }: { from: string; to: string; url: string }): RenderedEmail {
  const subject = 'Sign in to vinylTrack';
  const text = [
    'Use this link to sign in to vinylTrack:',
    '',
    url,
    '',
    "It works once and expires soon. If you didn't ask to sign in, ignore this email.",
  ].join('\n');
  const href = escapeHtml(url);
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif">
<p>Use this link to sign in to vinylTrack:</p>
<p><a href="${href}">Sign in to vinylTrack</a></p>
<p style="color:#666;font-size:13px">It works once and expires soon. If you didn't ask to sign in, ignore this email.</p>
</body></html>`;
  return { from, to, subject, text, html };
}

// RFC 2822 multipart/alternative, base64url-encoded as Gmail's `raw` expects.
export function toGmailRaw(m: RenderedEmail): string {
  const boundary = `vt-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n');
  const mime = [
    `From: ${m.from}`,
    `To: ${m.to}`,
    `Subject: ${m.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(m.text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(m.html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64url');
}
