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

const { createLocation, updateLocation, deleteLocation } = await import('./actions');

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const back = '/collection/c1/locations';

afterEach(() => { apiPost.mockReset(); apiPatch.mockReset(); apiDelete.mockReset(); });

describe('createLocation', () => {
  it('creates a top-level location in this collection', async () => {
    apiPost.mockResolvedValue({ id: 'l-1' });
    await expect(createLocation(form({ collectionId: 'c1', name: ' Basement ', kind: 'physical', parentLocationId: '' })))
      .rejects.toThrow(`REDIRECT ${back}`);
    expect(apiPost).toHaveBeenCalledWith('/location', { collectionId: 'c1', name: 'Basement', kind: 'physical' });
  });

  it('nests it when a parent is picked', async () => {
    apiPost.mockResolvedValue({ id: 'l-2' });
    await expect(createLocation(form({ collectionId: 'c1', name: 'Shelf 3', kind: 'physical', parentLocationId: 'l-1' })))
      .rejects.toThrow('REDIRECT');
    expect(apiPost.mock.calls[0]![1]).toMatchObject({ parentLocationId: 'l-1' });
  });

  it.each([
    [406, 'invalid'],
    [403, 'forbidden'],
  ])('turns a %i into ?error=%s', async (status, code) => {
    apiPost.mockRejectedValue(new ApiError(status, 'x'));
    await expect(createLocation(form({ collectionId: 'c1', name: '', kind: 'physical' })))
      .rejects.toThrow(new RegExp(`^REDIRECT ${back}\\?error=${code}$`));
  });

  it('escapes the collection id in the redirect', async () => {
    apiPost.mockResolvedValue({ id: 'l-1' });
    await expect(createLocation(form({ collectionId: 'c1/../../admin', name: 'n', kind: 'physical' })))
      .rejects.toThrow('REDIRECT /collection/c1%2F..%2F..%2Fadmin/locations');
  });
});

describe('updateLocation', () => {
  it('patches name, kind and parent', async () => {
    apiPatch.mockResolvedValue({});
    await expect(updateLocation(form({ collectionId: 'c1', id: 'l-2', name: 'Shelf 4', kind: 'physical', parentLocationId: 'l-1' })))
      .rejects.toThrow(`REDIRECT ${back}`);
    expect(apiPatch).toHaveBeenCalledWith('/location/l-2', { name: 'Shelf 4', kind: 'physical', parentLocationId: 'l-1' });
  });

  // "No parent" has to clear it, or a location could never move back to the top.
  it('sends parentLocationId: null for "no parent"', async () => {
    apiPatch.mockResolvedValue({});
    await expect(updateLocation(form({ collectionId: 'c1', id: 'l-2', name: 'Shelf 4', kind: 'physical', parentLocationId: '' })))
      .rejects.toThrow('REDIRECT');
    expect(apiPatch.mock.calls[0]![1]).toEqual({ name: 'Shelf 4', kind: 'physical', parentLocationId: null });
  });
});

describe('deleteLocation', () => {
  it('deletes and goes back to the list', async () => {
    apiDelete.mockResolvedValue(null);
    await expect(deleteLocation(form({ collectionId: 'c1', id: 'l-2' }))).rejects.toThrow(new RegExp(`^REDIRECT ${back}$`));
    expect(apiDelete).toHaveBeenCalledWith('/location/l-2');
  });

  it('turns a 409 (copies or children inside) into ?error=in-use', async () => {
    apiDelete.mockRejectedValue(new ApiError(409, 'location is still referenced by a copy or child location.'));
    await expect(deleteLocation(form({ collectionId: 'c1', id: 'l-1' }))).rejects.toThrow(`REDIRECT ${back}?error=in-use`);
  });
});
