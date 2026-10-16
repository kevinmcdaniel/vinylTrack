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

const { createCopy, updateCopy, deleteCopy, createOwnerInline, createLocationInline } = await import('./actions');

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

afterEach(() => { apiPost.mockReset(); apiPatch.mockReset(); apiDelete.mockReset(); });

describe('createCopy', () => {
  // The BE 500s a date-only string, so the day goes out as midnight UTC.
  it('posts the copy with a full ISO date and a numeric price, then opens the album', async () => {
    apiPost.mockResolvedValue({ id: 'cp-1' });
    await expect(createCopy(form({
      albumId: 'a-1', locationId: 'l-1', ownerId: 'o-1', condition: 'VG+', dateAcquired: '2024-05-01', price: '24.99', notes: ' signed ',
    }))).rejects.toThrow(/^REDIRECT \/album\/a-1$/);
    expect(apiPost).toHaveBeenCalledWith('/copy', {
      albumId: 'a-1', locationId: 'l-1', ownerId: 'o-1', condition: 'VG+', dateAcquired: '2024-05-01T00:00:00.000Z', price: 24.99, notes: 'signed',
    });
  });

  it('leaves out blank optional fields and a bad price', async () => {
    apiPost.mockResolvedValue({ id: 'cp-2' });
    await expect(createCopy(form({ albumId: 'a-1', locationId: 'l-1', ownerId: 'o-1', price: 'cheap', dateAcquired: '' }))).rejects.toThrow('REDIRECT');
    expect(apiPost.mock.calls[0]![1]).toEqual({ albumId: 'a-1', locationId: 'l-1', ownerId: 'o-1' });
  });

  it.each([
    [406, 'invalid'],
    [403, 'forbidden'],
    [409, 'in-use'],
  ])('turns a %i into the new-copy form with ?error=%s', async (status, code) => {
    apiPost.mockRejectedValue(new ApiError(status, 'x'));
    await expect(createCopy(form({ albumId: 'a/1', locationId: '', ownerId: '' })))
      .rejects.toThrow(`REDIRECT /album/a%2F1/copy/new?error=${code}`);
  });
});

describe('updateCopy', () => {
  it('patches location and owner, nulling blank optional fields, then opens the album', async () => {
    apiPatch.mockResolvedValue({});
    await expect(updateCopy(form({ id: 'cp-1', albumId: 'a-1', locationId: 'l-2', ownerId: 'o-2', condition: '', dateAcquired: '', price: '', notes: '' })))
      .rejects.toThrow(/^REDIRECT \/album\/a-1$/);
    expect(apiPatch).toHaveBeenCalledWith('/copy/cp-1', {
      locationId: 'l-2', ownerId: 'o-2', condition: null, dateAcquired: null, price: null, notes: null,
    });
  });

  it('turns a 406 (location in another collection) into the edit form', async () => {
    apiPatch.mockRejectedValue(new ApiError(406, 'x'));
    await expect(updateCopy(form({ id: 'cp-1', albumId: 'a-1', locationId: 'l-x', ownerId: 'o-1' })))
      .rejects.toThrow('REDIRECT /copy/cp-1/edit?error=invalid');
  });
});

describe('deleteCopy', () => {
  it('deletes and goes back to the album', async () => {
    apiDelete.mockResolvedValue(null);
    await expect(deleteCopy(form({ id: 'cp-1', albumId: 'a-1' }))).rejects.toThrow(/^REDIRECT \/album\/a-1$/);
    expect(apiDelete).toHaveBeenCalledWith('/copy/cp-1');
  });

  it('turns a 404 into the edit form with ?error=not-found', async () => {
    apiDelete.mockRejectedValue(new ApiError(404, 'gone'));
    await expect(deleteCopy(form({ id: 'cp-1', albumId: 'a-1' }))).rejects.toThrow('REDIRECT /copy/cp-1/edit?error=not-found');
  });
});

// For PickOrAdd: answer, don't redirect, so the copy form keeps its state.
describe('createOwnerInline', () => {
  it('creates by name only and hands back the option', async () => {
    apiPost.mockResolvedValue({ id: 'o-9', name: 'Cousin Pat', userId: null });
    await expect(createOwnerInline(' Cousin Pat ')).resolves.toEqual({ item: { id: 'o-9', label: 'Cousin Pat' } });
    expect(apiPost).toHaveBeenCalledWith('/owner', { name: 'Cousin Pat' });
  });

  it('answers a refusal with its code', async () => {
    apiPost.mockRejectedValue(new ApiError(406, 'x'));
    await expect(createOwnerInline('')).resolves.toEqual({ error: 'invalid' });
  });
});

describe('createLocationInline', () => {
  it('creates a top-level location of the collection’s kind and hands back the option', async () => {
    apiPost.mockResolvedValue({ id: 'l-9', name: 'Garage' });
    await expect(createLocationInline('c1', 'digital', ' Garage ')).resolves.toEqual({ item: { id: 'l-9', label: 'Garage' } });
    expect(apiPost).toHaveBeenCalledWith('/location', { collectionId: 'c1', name: 'Garage', kind: 'digital' });
  });

  it('answers a refusal with its code', async () => {
    apiPost.mockRejectedValue(new ApiError(403, 'x'));
    await expect(createLocationInline('c1', 'physical', 'x')).resolves.toEqual({ error: 'forbidden' });
  });
});
