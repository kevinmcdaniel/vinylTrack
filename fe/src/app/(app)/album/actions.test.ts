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

const { createAlbum, updateAlbum, deleteAlbum, createArtist } = await import('./actions');

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const one of [v].flat()) f.append(k, one);
  return f;
};

afterEach(() => { apiPost.mockReset(); apiPatch.mockReset(); apiDelete.mockReset(); });

describe('createAlbum', () => {
  it('posts trimmed fields, a numeric year and every picked artist, then opens the album', async () => {
    apiPost.mockResolvedValue({ id: 'a-1' });
    await expect(createAlbum(form({
      collectionId: 'c1', title: ' Kind of Blue ', format: 'LP', year: '1959', genre: ' Jazz ', notes: '', artistIds: ['ar-1', 'ar-2'],
    }))).rejects.toThrow(/^REDIRECT \/album\/a-1$/);
    expect(apiPost).toHaveBeenCalledWith('/album', {
      collectionId: 'c1', title: 'Kind of Blue', format: 'LP', year: 1959, genre: 'Jazz', artistIds: ['ar-1', 'ar-2'],
    });
  });

  it('leaves out blank optional fields and a year that is not a number', async () => {
    apiPost.mockResolvedValue({ id: 'a-2' });
    await expect(createAlbum(form({ collectionId: 'c1', title: 'Untitled', year: 'soon' }))).rejects.toThrow('REDIRECT');
    expect(apiPost.mock.calls[0]![1]).toEqual({ collectionId: 'c1', title: 'Untitled', artistIds: [] });
  });

  it.each([
    [406, 'invalid'],
    [403, 'forbidden'],
    [409, 'in-use'],
  ])('turns a %i into the new-album form with ?error=%s', async (status, code) => {
    apiPost.mockRejectedValue(new ApiError(status, 'x'));
    await expect(createAlbum(form({ collectionId: 'c/1', title: '' })))
      .rejects.toThrow(`REDIRECT /collection/c%2F1/album/new?error=${code}`);
  });
});

describe('updateAlbum', () => {
  // Blank means "clear it": null, not omitted, or an edit could never remove a value.
  it('patches every field, nulling blanks, and replaces the artist list', async () => {
    apiPatch.mockResolvedValue({});
    await expect(updateAlbum(form({ id: 'a-1', title: 'Kind of Blue', format: '', year: '', genre: 'Jazz', notes: '' })))
      .rejects.toThrow(/^REDIRECT \/album\/a-1$/);
    expect(apiPatch).toHaveBeenCalledWith('/album/a-1', {
      title: 'Kind of Blue', format: null, year: null, genre: 'Jazz', notes: null, artistIds: [],
    });
  });

  it('turns a 404 into the edit form with ?error=not-found', async () => {
    apiPatch.mockRejectedValue(new ApiError(404, 'gone'));
    await expect(updateAlbum(form({ id: 'a-x', title: 't' }))).rejects.toThrow('REDIRECT /album/a-x/edit?error=not-found');
  });
});

describe('deleteAlbum', () => {
  it('deletes and goes back to the collection', async () => {
    apiDelete.mockResolvedValue(null);
    await expect(deleteAlbum(form({ id: 'a-1', collectionId: 'c1' }))).rejects.toThrow(/^REDIRECT \/collection\/c1$/);
    expect(apiDelete).toHaveBeenCalledWith('/album/a-1');
  });

  it('stays on the edit form with ?error=in-use while copies or wants remain', async () => {
    apiDelete.mockRejectedValue(new ApiError(409, 'Album is still referenced by 1 copy.'));
    await expect(deleteAlbum(form({ id: 'a-1', collectionId: 'c1' }))).rejects.toThrow('REDIRECT /album/a-1/edit?error=in-use');
  });
});

// Called from ArtistPicker, so it answers instead of redirecting.
describe('createArtist', () => {
  it('creates the artist and hands it back', async () => {
    apiPost.mockResolvedValue({ id: 'ar-9', name: 'Bill Evans', sortName: null, notes: null });
    await expect(createArtist(' Bill Evans ')).resolves.toEqual({ artist: { id: 'ar-9', name: 'Bill Evans' } });
    expect(apiPost).toHaveBeenCalledWith('/artist', { name: 'Bill Evans' });
  });

  it('answers a refusal with its code, never the BE message', async () => {
    apiPost.mockRejectedValue(new ApiError(406, '<b>name</b> is required.'));
    await expect(createArtist('')).resolves.toEqual({ error: 'invalid' });
  });
});
