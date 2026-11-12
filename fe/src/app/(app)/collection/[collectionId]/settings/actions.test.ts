// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError } from '@/lib/apiError';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();
vi.mock('@/lib/api', () => ({
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiPatch: (...a: unknown[]) => apiPatch(...a),
  apiDelete: (...a: unknown[]) => apiDelete(...a),
}));

const { renameCollection, shareCollection, unshareCollection } = await import('./actions');

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

afterEach(() => { apiPost.mockReset(); apiPatch.mockReset(); apiDelete.mockReset(); });

// #125: a collection's settings, back to the same page with what happened.
describe('renameCollection', () => {
  it('patches name and notes, a blank note clearing it', async () => {
    apiPatch.mockResolvedValue({});
    await expect(renameCollection(form({ id: 'c/1', name: ' Dad’s vinyl ', notes: '  ' })))
      .rejects.toThrow(/^REDIRECT \/collection\/c%2F1\/settings\?saved=rename$/);
    expect(apiPatch).toHaveBeenCalledWith('/collection/c%2F1', { name: 'Dad’s vinyl', notes: null });
  });

  it.each([[406, 'invalid'], [403, 'forbidden'], [404, 'not-found']])('sends a %i back as ?error=rename-%s', async (status, code) => {
    apiPatch.mockRejectedValue(new ApiError(status, 'x'));
    await expect(renameCollection(form({ id: 'c1', name: 'x' }))).rejects.toThrow(`REDIRECT /collection/c1/settings?error=rename-${code}`);
  });
});

describe('shareCollection', () => {
  it('shares with the picked user', async () => {
    apiPost.mockResolvedValue([]);
    await expect(shareCollection(form({ id: 'c1', userId: 'u-2' }))).rejects.toThrow(/^REDIRECT \/collection\/c1\/settings\?saved=share$/);
    expect(apiPost).toHaveBeenCalledWith('/collection/c1/share', { userId: 'u-2' });
  });

  it('asks nothing when no one was picked', async () => {
    await expect(shareCollection(form({ id: 'c1', userId: '' }))).rejects.toThrow('REDIRECT /collection/c1/settings?error=share-invalid');
    expect(apiPost).not.toHaveBeenCalled();
  });

  it.each([[406, 'invalid'], [409, 'in-use'], [403, 'forbidden']])('sends a %i back as ?error=share-%s', async (status, code) => {
    apiPost.mockRejectedValue(new ApiError(status, 'x'));
    await expect(shareCollection(form({ id: 'c1', userId: 'u-2' }))).rejects.toThrow(`REDIRECT /collection/c1/settings?error=share-${code}`);
  });
});

describe('unshareCollection', () => {
  it('stops sharing with that user', async () => {
    apiDelete.mockResolvedValue(null);
    await expect(unshareCollection(form({ id: 'c1', userId: 'u/2' }))).rejects.toThrow(/^REDIRECT \/collection\/c1\/settings\?saved=unshare$/);
    expect(apiDelete).toHaveBeenCalledWith('/collection/c1/share/u%2F2');
  });

  it('sends a 404 back as ?error=unshare-not-found', async () => {
    apiDelete.mockRejectedValue(new ApiError(404, 'x'));
    await expect(unshareCollection(form({ id: 'c1', userId: 'u-2' }))).rejects.toThrow('REDIRECT /collection/c1/settings?error=unshare-not-found');
  });
});
