// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError } from '@/lib/apiError';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();
const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiPatch: (...a: unknown[]) => apiPatch(...a),
  apiDelete: (...a: unknown[]) => apiDelete(...a),
}));

const { createCopy, updateCopy, deleteCopy, createOwnerInline, createLocationInline, addCopy, searchAlbums, findAlbumMatches } = await import('./actions');

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

afterEach(() => { apiPost.mockReset(); apiPatch.mockReset(); apiDelete.mockReset(); apiGet.mockReset(); });

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

// #123: add a copy from the collection page, with an existing album or a new one.
describe('addCopy', () => {
  const copyFields = { collectionId: 'c-1', locationId: 'l-1', ownerId: 'o-1', notes: ' first press ' };

  it('posts an existing album by id and lands on it with the added notice', async () => {
    apiPost.mockResolvedValue({ id: 'cp-9', albumId: 'a-1' });
    await expect(addCopy(form({ ...copyFields, albumMode: 'existing', albumId: 'a-1', albumTitle: 'ignored' })))
      .rejects.toThrow(/^REDIRECT \/album\/a-1\?added=cp-9$/);
    expect(apiPost).toHaveBeenCalledWith('/copy', { albumId: 'a-1', locationId: 'l-1', ownerId: 'o-1', notes: 'first press' });
  });

  it('posts a new album with its own fields, reading only the new half', async () => {
    apiPost.mockResolvedValue({ id: 'cp-10', albumId: 'a-new' });
    const f = form({ ...copyFields, albumMode: 'new', albumId: 'a-1', albumTitle: ' Blue ', format: 'LP', year: '1971', genre: '', albumNotes: 'gatefold' });
    f.append('artistIds', 'ar-1');
    f.append('artistIds', 'ar-2');
    await expect(addCopy(f)).rejects.toThrow(/^REDIRECT \/album\/a-new\?added=cp-10$/);
    expect(apiPost).toHaveBeenCalledWith('/copy', {
      album: { collectionId: 'c-1', title: 'Blue', format: 'LP', year: 1971, notes: 'gatefold', artistIds: ['ar-1', 'ar-2'] },
      locationId: 'l-1', ownerId: 'o-1', notes: 'first press',
    });
  });

  it.each([
    ['existing with no album picked', { albumMode: 'existing' }, 'pick-album', ''],
    ['new with no title', { albumMode: 'new', albumTitle: '  ' }, 'title', '&mode=new'],
  ])('sends %s back with a fixed code and no request', async (_case, fields, code, mode) => {
    await expect(addCopy(form({ ...copyFields, collectionId: 'c/1', ...fields })))
      .rejects.toThrow(`REDIRECT /collection/c%2F1/copy/new?error=${code}${mode}`);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it.each([[406, 'invalid'], [403, 'forbidden'], [409, 'in-use']])('turns a %i into ?error=%s, keeping the mode', async (status, code) => {
    apiPost.mockRejectedValue(new ApiError(status, 'x'));
    await expect(addCopy(form({ ...copyFields, albumMode: 'new', albumTitle: 'Blue' })))
      .rejects.toThrow(`REDIRECT /collection/c-1/copy/new?error=${code}&mode=new`);
  });
});

describe('searchAlbums', () => {
  it('asks for this collection\'s albums by title, up to 20, as picker rows', async () => {
    apiGet.mockResolvedValue(Array.from({ length: 25 }, (_, i) => ({ id: `a-${i}`, title: `T${i}`, year: 1970, artists: [{ id: 'ar', name: 'Miles' }] })));
    const rows = await searchAlbums('c-1', ' kind ');
    expect(apiGet).toHaveBeenCalledWith('/album', { collectionId: 'c-1', q: 'kind' });
    expect(rows).toHaveLength(20);
    expect(rows[0]).toEqual({ id: 'a-0', title: 'T0', year: 1970, artists: ['Miles'] });
  });

  it('asks nothing for a blank query, and answers [] when the BE refuses', async () => {
    expect(await searchAlbums('c-1', '  ')).toEqual([]);
    expect(apiGet).not.toHaveBeenCalled();
    apiGet.mockRejectedValue(new ApiError(500, 'down'));
    expect(await searchAlbums('c-1', 'kind')).toEqual([]);
  });
});

describe('findAlbumMatches', () => {
  it('asks the BE for look-alikes with the artists joined', async () => {
    apiGet.mockResolvedValue([{ id: 'a-1', title: 'Blue', year: null, artists: [{ id: 'ar-1', name: 'Joni' }], copyCount: 2 }]);
    const rows = await findAlbumMatches('c-1', ' Blue ', ['ar-1', 'ar-2']);
    expect(apiGet).toHaveBeenCalledWith('/album/matches', { collectionId: 'c-1', title: 'Blue', artistIds: 'ar-1,ar-2' });
    expect(rows).toEqual([{ id: 'a-1', title: 'Blue', year: null, artists: ['Joni'], copyCount: 2 }]);
  });

  it('warns about nothing for a blank title or a BE refusal', async () => {
    expect(await findAlbumMatches('c-1', '', [])).toEqual([]);
    apiGet.mockRejectedValue(new ApiError(500, 'down'));
    expect(await findAlbumMatches('c-1', 'Blue', [])).toEqual([]);
  });
});
