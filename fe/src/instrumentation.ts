// Runs once when the Next.js server starts. Validating config here makes a
// missing or production-forbidden value fail the boot, not the first request (#65).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getConfig } = await import('./lib/config');
    getConfig();
  }
}
