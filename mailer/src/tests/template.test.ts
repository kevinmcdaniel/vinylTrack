import { describe, it, expect } from 'vitest';
import { renderMagicLinkEmail, toGmailRaw } from '../template.js';

// The one email the mailer can send (#62): fixed subject and body.
const url = 'https://vinyl.example.org/api/auth/callback/email?token=abc&email=a%40example.com';

describe('renderMagicLinkEmail', () => {
  it('has a fixed subject and puts the link in both text and html', () => {
    const m = renderMagicLinkEmail({ from: 'vinyltrack@example.org', to: 'a@example.com', url });
    expect(m.subject).toBe('Sign in to vinylTrack');
    expect(m.text).toContain(url);
    expect(m.html).toContain('href="https://vinyl.example.org/api/auth/callback/email?token=abc&amp;email=a%40example.com"');
  });

  it('escapes the link in html', () => {
    const m = renderMagicLinkEmail({ from: 'f@example.org', to: 'a@example.com', url: 'https://vinyl.example.org/x?a="><script>' });
    expect(m.html).not.toContain('<script>');
  });
});

describe('toGmailRaw', () => {
  it('builds a base64url multipart/alternative message with From, To and Subject', () => {
    const m = renderMagicLinkEmail({ from: 'vinyltrack@example.org', to: 'a@example.com', url });
    const raw = toGmailRaw(m);
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    const mime = Buffer.from(raw, 'base64url').toString('utf8');
    expect(mime).toMatch(/^From: vinyltrack@example\.org\r\n/m);
    expect(mime).toMatch(/^To: a@example\.com\r\n/m);
    expect(mime).toMatch(/^Subject: Sign in to vinylTrack\r\n/m);
    expect(mime).toMatch(/Content-Type: multipart\/alternative; boundary=/);
    expect(mime).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(mime).toContain('Content-Type: text/html; charset=UTF-8');
  });
});
