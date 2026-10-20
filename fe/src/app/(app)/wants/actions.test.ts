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

const { createWant, updateWant, deleteWant } = await import('./actions');

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const one of [v].flat()) f.append(k, one);
  return f;
};

afterEach(() => { apiPost.mockReset(); apiPatch.mockReset(); apiDelete.mockReset(); });

describe('createWant', () => {
  it('wants an existing album, then shows the list for its collection', async () => {
    apiPost.mockResolvedValue({ id: 'w-1' });
    await expect(createWant(form({
      collectionId: 'c1', kind: 'album', albumId: 'kob', newTitle: '', priority: 'must-have', notes: ' mono ',
    }))).rejects.toThrow(/^REDIRECT \/wants\?collectionId=c1$/);
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('/want', { collectionId: 'c1', albumId: 'kob', priority: 'must-have', notes: 'mono' });
  });

  // Decision 2 on #8: a record nobody has ever owned becomes an album with no copies.
  it('creates a new album (with its artists) first when none is picked', async () => {
    apiPost.mockResolvedValueOnce({ id: 'new-album' }).mockResolvedValueOnce({ id: 'w-2' });
    await expect(createWant(form({
      collectionId: 'c1', kind: 'album', albumId: '', newTitle: ' Sketches of Spain ', artistIds: ['miles'], priority: 'nice-to-have', notes: '',
    }))).rejects.toThrow('REDIRECT /wants?collectionId=c1');
    expect(apiPost.mock.calls).toEqual([
      ['/album', { collectionId: 'c1', title: 'Sketches of Spain', artistIds: ['miles'] }],
      ['/want', { collectionId: 'c1', albumId: 'new-album', priority: 'nice-to-have' }],
    ]);
  });

  it('wants anything by an existing artist', async () => {
    apiPost.mockResolvedValue({ id: 'w-3' });
    await expect(createWant(form({
      collectionId: 'c1', kind: 'artist', artistId: 'trane', newArtist: '', albumId: 'kob', priority: 'nice-to-have',
    }))).rejects.toThrow('REDIRECT');
    // The hidden album half of the form is ignored.
    expect(apiPost).toHaveBeenCalledWith('/want', { collectionId: 'c1', artistId: 'trane', priority: 'nice-to-have' });
  });

  it('adds a new artist first when none is picked', async () => {
    apiPost.mockResolvedValueOnce({ id: 'new-artist' }).mockResolvedValueOnce({ id: 'w-4' });
    await expect(createWant(form({
      collectionId: 'c1', kind: 'artist', artistId: '', newArtist: ' Bill Evans ', priority: 'nice-to-have',
    }))).rejects.toThrow('REDIRECT');
    expect(apiPost.mock.calls).toEqual([
      ['/artist', { name: 'Bill Evans' }],
      ['/want', { collectionId: 'c1', artistId: 'new-artist', priority: 'nice-to-have' }],
    ]);
  });

  it.each([
    [{ kind: 'album', albumId: '', newTitle: '' }],
    [{ kind: 'artist', artistId: '', newArtist: '  ' }],
    [{ kind: 'something' }],
  ])('refuses %j without calling the BE', async (fields) => {
    await expect(createWant(form({ collectionId: 'c/1', priority: 'must-have', ...fields })))
      .rejects.toThrow('REDIRECT /wants/new?collectionId=c%2F1&error=invalid');
    expect(apiPost).not.toHaveBeenCalled();
  });

  // PR #118 review: a typed name must never be silently dropped for a picked one.
  it.each([
    [{ kind: 'album', albumId: 'kob', newTitle: 'Something Else' }],
    [{ kind: 'artist', artistId: 'trane', newArtist: 'Bill Evans' }],
  ])('refuses %j (picked and typed) without calling the BE', async (fields) => {
    await expect(createWant(form({ collectionId: 'c1', priority: 'must-have', ...fields })))
      .rejects.toThrow('REDIRECT /wants/new?collectionId=c1&error=both');
    expect(apiPost).not.toHaveBeenCalled();
  });

  // PR #118 review: a retry after a failed want must reuse what was just created.
  it('keeps a just-created album picked when the want itself is refused', async () => {
    apiPost.mockResolvedValueOnce({ id: 'new album' }).mockRejectedValueOnce(new ApiError(406, 'x'));
    await expect(createWant(form({ collectionId: 'c1', kind: 'album', newTitle: 'New', priority: 'must-have' })))
      .rejects.toThrow('REDIRECT /wants/new?collectionId=c1&albumId=new%20album&error=invalid');
  });

  it('keeps a just-created artist picked when the want itself is refused', async () => {
    apiPost.mockResolvedValueOnce({ id: 'ar-9' }).mockRejectedValueOnce(new ApiError(403, 'x'));
    await expect(createWant(form({ collectionId: 'c1', kind: 'artist', newArtist: 'Bill Evans', priority: 'must-have' })))
      .rejects.toThrow('REDIRECT /wants/new?collectionId=c1&artistId=ar-9&error=forbidden');
  });

  it.each([
    [406, 'invalid'],
    [403, 'forbidden'],
    [409, 'in-use'],
  ])('turns a %i into the form with ?error=%s', async (status, code) => {
    apiPost.mockRejectedValue(new ApiError(status, 'x'));
    await expect(createWant(form({ collectionId: 'c1', kind: 'album', albumId: 'kob', priority: 'must-have' })))
      .rejects.toThrow(`REDIRECT /wants/new?collectionId=c1&error=${code}`);
  });
});

describe('updateWant', () => {
  it('patches priority and notes (blank clears), then returns to the list it came from', async () => {
    apiPatch.mockResolvedValue({});
    await expect(updateWant(form({ id: 'w/1', priority: 'must-have', notes: '', back: '/wants?collectionId=c1' })))
      .rejects.toThrow(/^REDIRECT \/wants\?collectionId=c1$/);
    expect(apiPatch).toHaveBeenCalledWith('/want/w%2F1', { priority: 'must-have', notes: null });
  });

  // `back` is form data: only a want-list URL is honored, never an open redirect.
  it.each([['https://evil.example/'], ['//evil.example/wants'], ['/admin']])('ignores back=%s', async (back) => {
    apiPatch.mockResolvedValue({});
    await expect(updateWant(form({ id: 'w1', priority: 'must-have', back }))).rejects.toThrow(/^REDIRECT \/wants$/);
  });

  it('drops an earlier ?error= from back', async () => {
    apiPatch.mockResolvedValue({});
    await expect(updateWant(form({ id: 'w1', priority: 'must-have', back: '/wants?collectionId=c1&error=invalid' })))
      .rejects.toThrow(/^REDIRECT \/wants\?collectionId=c1$/);
  });

  it('turns a 406 into ?error=invalid on the list', async () => {
    apiPatch.mockRejectedValue(new ApiError(406, 'x'));
    await expect(updateWant(form({ id: 'w1', priority: 'urgent', back: '/wants' }))).rejects.toThrow('REDIRECT /wants?error=invalid');
  });
});

describe('deleteWant', () => {
  it('deletes and returns to the list', async () => {
    apiDelete.mockResolvedValue(null);
    await expect(deleteWant(form({ id: 'w1', back: '/wants?collectionId=c2' }))).rejects.toThrow(/^REDIRECT \/wants\?collectionId=c2$/);
    expect(apiDelete).toHaveBeenCalledWith('/want/w1');
  });

  it('a want that is already gone says so', async () => {
    apiDelete.mockRejectedValue(new ApiError(404, 'x'));
    await expect(deleteWant(form({ id: 'w1', back: '/wants?collectionId=c2' }))).rejects.toThrow('REDIRECT /wants?collectionId=c2&error=not-found');
  });
});
