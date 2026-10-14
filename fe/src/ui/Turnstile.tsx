'use client';

import { useEffect, useRef } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string | undefined;
  remove: (widgetId: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptLoading: Promise<void> | undefined;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Turnstile script failed to load'));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

/**
 * Cloudflare Turnstile widget (#73). It only produces a token: the widget puts
 * it in a hidden `turnstileToken` field of the surrounding form, and the BE
 * decides whether it passed. Rendered explicitly so it works after client-side
 * navigation, not just on a full page load. With `onToken`, the token (or ''
 * once it expires or errors) also goes to the caller, for a widget that sits
 * outside the form(s) it serves. Changing `resetKey` replaces the widget,
 * which fetches a fresh token: for a caller whose token was spent while it
 * stayed mounted.
 */
export default function Turnstile({ siteKey, action, onToken, resetKey }: {
  siteKey: string;
  action: 'sign-in' | 'request-access';
  onToken?: (token: string) => void;
  resetKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Latest callback without re-rendering the widget when its identity changes.
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; });

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    const mount = () => {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetId = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        action,
        'response-field-name': 'turnstileToken',
        callback: (token: string) => onTokenRef.current?.(token),
        'expired-callback': () => onTokenRef.current?.(''),
        'error-callback': () => onTokenRef.current?.(''),
      });
    };
    // Already loaded (any page after the first): render straight away.
    if (window.turnstile) mount();
    else loadScript().then(mount).catch(() => { /* the BE refuses the form without a token */ });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action, resetKey]);

  return <div ref={ref} data-turnstile className="min-h-[65px]" />;
}
