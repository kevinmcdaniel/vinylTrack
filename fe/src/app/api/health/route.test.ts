import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from './route';

// The FE's own liveness check for compose healthchecks (#60). It must not
// call the BE or need an identity: before #11, every data page 401s in prod.
describe('GET /api/health (FE)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reports ok and the running version', async () => {
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('BE_URL', 'http://vinyl.be');
    vi.stubEnv('BE_PORT_INT', '3000');
    vi.stubEnv('VINYLTRACK_VERSION', 'v1.2.3');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: 'ok', version: 'v1.2.3' } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
