import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiGet, ApiError } from './api';

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

describe('apiGet', () => {
  beforeEach(() => {
    vi.stubEnv('BE_URL', 'http://vinyl.be');
    vi.stubEnv('BE_PORT_INT', '3000');
    vi.stubEnv('AUTH_BOOTSTRAP_OWNER_EMAIL', 'kevin@example.com');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('unwraps the response envelope and returns data', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ message: 'ok', data: [{ id: '1' }], status: 200 })));
    await expect(apiGet('/collection')).resolves.toEqual([{ id: '1' }]);
  });

  it('builds the url from BE_URL and BE_PORT_INT', async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, _init?: RequestInit) => json({ data: [], status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiGet('/album');
    expect(fetchMock.mock.calls[0]![0]).toBe('http://vinyl.be:3000/api/album');
  });

  it('appends only the search params that have a value', async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, _init?: RequestInit) => json({ data: [], status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiGet('/album', { collectionId: 'c1', q: 'blue', genre: undefined, format: '' });
    const url = new URL(fetchMock.mock.calls[0]![0] as string);
    expect(url.searchParams.get('collectionId')).toBe('c1');
    expect(url.searchParams.get('q')).toBe('blue');
    expect(url.searchParams.has('genre')).toBe(false);
    expect(url.searchParams.has('format')).toBe(false);
  });

  it('forwards the dev identity header', async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, _init?: RequestInit) => json({ data: [], status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiGet('/album');
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['x-user-email']).toBe('kevin@example.com');
  });

  it('throws an ApiError carrying the status on a failed response', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ data: null, message: 'nope', status: 404 }, 404)));
    await expect(apiGet('/album/x')).rejects.toMatchObject({ status: 404 });
  });

  it('throws an ApiError, not a TypeError, on a 2xx with an unparseable body', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error('not json')) } as unknown as Response),
    ));
    // Pages catch ApiError; a bare TypeError would escape them as a 500.
    await expect(apiGet('/album')).rejects.toBeInstanceOf(ApiError);
  });

  it('throws an ApiError on a 2xx whose body has no data envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ unexpected: true })));
    await expect(apiGet('/album')).rejects.toBeInstanceOf(ApiError);
  });

  it('still returns a legitimately null data payload', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ message: 'deleted', data: null, status: 200 })));
    await expect(apiGet('/album/x')).resolves.toBeNull();
  });

  it('exposes notFound on a 404 so pages can call Next notFound()', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ data: null, message: 'nope', status: 404 }, 404)));
    const err = await apiGet('/album/x').catch((e) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).notFound).toBe(true);
  });
});
