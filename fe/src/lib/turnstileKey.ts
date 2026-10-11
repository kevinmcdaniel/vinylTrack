import 'server-only';
import { getConfig } from './config';

/**
 * Which Turnstile site key to render (#11). A request carrying the configured
 * x-automation-key (development/test only, e2e) gets Cloudflare's test site
 * key; everyone else gets the regular one. The BE re-checks the key and the
 * user's allowAutomation flag, so this only picks the widget.
 */
export function turnstileSiteKey(requestHeaders: Headers): string {
  const config = getConfig();
  const header = requestHeaders.get('x-automation-key');
  if (config.automation && header !== null && header === config.automation.key) return config.automation.testSiteKey;
  return config.turnstile.siteKey;
}
