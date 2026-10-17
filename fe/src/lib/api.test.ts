// @vitest-environment node
// Server-only code: run in Node, not jsdom (jose rejects jsdom's cross-realm Uint8Array).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeJwt, jwtVerify } from 'jose';
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from './api';
import { stubAppEnv, TEST_INTERNAL_SECRET } from '@/tests/env';

// The session DAL (#73): apiGet only ever runs for an active, signed-in user.
vi.mock('./session', () => ({ requireActiveUser: vi.fn(async () => ({ id: 'user-1', status: 'active', isAdmin: false })) }));

const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);

describe('apiGet', () => {
  beforeEach(() => {
    stubAppEnv();
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

  it('sends a signed bearer token for the signed-in user, and no dev header', async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, _init?: RequestInit) => json({ data: [], status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiGet('/album');
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('x-user-email');
    const token = headers.Authorization!.replace(/^Bearer /, '');
    await jwtVerify(token, new TextEncoder().encode(TEST_INTERNAL_SECRET), { audience: 'vinyltrack-be', issuer: 'vinyltrack-fe' });
    expect(decodeJwt(token).sub).toBe('user-1');
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

describe('apiPost', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('posts JSON with the signed token and returns data', async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, _init?: RequestInit) => json({ data: { id: 'c-1' }, status: 201 }, 201));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiPost('/collection', { name: 'Vinyl', kind: 'physical' })).resolves.toEqual({ id: 'c-1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://vinyl.be:3000/api/collection');
    expect(init!.method).toBe('POST');
    expect(JSON.parse(init!.body as string)).toEqual({ name: 'Vinyl', kind: 'physical' });
    const headers = init!.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(decodeJwt(headers.Authorization!.replace(/^Bearer /, '')).sub).toBe('user-1');
  });

  it('throws an ApiError carrying the status and the BE message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ data: {}, message: 'name is required.', status: 406 }, 406)));
    await expect(apiPost('/collection', {})).rejects.toMatchObject({ status: 406, message: 'name is required.' });
  });
});

// Writes for #102: same envelope, token and ApiError handling as apiPost.
describe('apiPatch', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('sends PATCH with a JSON body and the signed token, and returns data', async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, _init?: RequestInit) => json({ data: { id: 'o-1', name: 'Ruth' }, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiPatch('/owner/o-1', { name: 'Ruth' })).resolves.toEqual({ id: 'o-1', name: 'Ruth' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://vinyl.be:3000/api/owner/o-1');
    expect(init!.method).toBe('PATCH');
    expect(JSON.parse(init!.body as string)).toEqual({ name: 'Ruth' });
    const headers = init!.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(decodeJwt(headers.Authorization!.replace(/^Bearer /, '')).sub).toBe('user-1');
  });

  it('throws an ApiError carrying the status and the BE message', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ data: {}, message: 'That user already has an owner.', status: 409 }, 409)));
    await expect(apiPatch('/owner/o-1', { userId: 'u' })).rejects.toMatchObject({ status: 409, message: 'That user already has an owner.' });
  });
});

describe('apiDelete', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('sends DELETE with the signed token and no body, and returns the null payload', async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, _init?: RequestInit) => json({ message: 'Owner deleted', data: null, status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiDelete('/owner/o-1')).resolves.toBeNull();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://vinyl.be:3000/api/owner/o-1');
    expect(init!.method).toBe('DELETE');
    expect(init!.body).toBeUndefined();
    const headers = init!.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('content-type');
    expect(decodeJwt(headers.Authorization!.replace(/^Bearer /, '')).sub).toBe('user-1');
  });

  it('throws an ApiError on a 409, so the action can show "still in use"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ data: {}, message: 'owner is still referenced by a copy.', status: 409 }, 409)));
    await expect(apiDelete('/owner/o-1')).rejects.toMatchObject({ status: 409 });
  });
});
