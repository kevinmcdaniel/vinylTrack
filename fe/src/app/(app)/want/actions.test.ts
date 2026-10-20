// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError } from '@/lib/apiError';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));
const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({ apiPost: (...a: unknown[]) => apiPost(...a) }));

const { markFound } = await import('./actions');

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};
const found = { copy: { id: 'cp 1' }, album: { id: 'kob' } };

afterEach(() => apiPost.mockReset());

describe('markFound', () => {
  it('posts the copy fields and opens the album with the new copy flagged', async () => {
    apiPost.mockResolvedValue(found);
    await expect(markFound(form({
      id: 'w/1', locationId: 'l1', ownerId: 'o1', condition: ' VG+ ', notes: '', dateAcquired: '2024-05-01', price: '12.50',
    }))).rejects.toThrow(/^REDIRECT \/album\/kob\?found=cp%201$/);
    expect(apiPost).toHaveBeenCalledWith('/want/w%2F1/found', {
      locationId: 'l1', ownerId: 'o1', condition: 'VG+', dateAcquired: '2024-05-01T00:00:00.000Z', price: 12.5,
    });
  });

  // An artist want has no album yet: pick one by that artist, or name a new one.
  it('sends the picked album for an artist want', async () => {
    apiPost.mockResolvedValue(found);
    await expect(markFound(form({ id: 'w1', needsAlbum: '1', albumId: 'kob', newTitle: '', locationId: 'l1', ownerId: 'o1' })))
      .rejects.toThrow('REDIRECT');
    expect(apiPost.mock.calls[0]![1]).toEqual({ locationId: 'l1', ownerId: 'o1', albumId: 'kob' });
  });

  it('sends a new album (title, format, year) for an artist want', async () => {
    apiPost.mockResolvedValue(found);
    await expect(markFound(form({
      id: 'w1', needsAlbum: '1', albumId: '', newTitle: ' Giant Steps ', format: 'LP', year: '1960', locationId: 'l1', ownerId: 'o1',
    }))).rejects.toThrow('REDIRECT');
    expect(apiPost.mock.calls[0]![1]).toEqual({
      locationId: 'l1', ownerId: 'o1', album: { title: 'Giant Steps', format: 'LP', year: 1960 },
    });
  });

  it.each([
    [{ albumId: '', newTitle: '' }, 'invalid'],
    [{ albumId: 'kob', newTitle: 'Giant Steps' }, 'both'],
  ])('refuses an artist want with %j before calling the BE', async (fields, code) => {
    await expect(markFound(form({ id: 'w1', needsAlbum: '1', locationId: 'l1', ownerId: 'o1', ...fields })))
      .rejects.toThrow(`REDIRECT /want/w1/found?error=${code}`);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('ignores album fields on an album want', async () => {
    apiPost.mockResolvedValue(found);
    await expect(markFound(form({ id: 'w1', albumId: 'other', newTitle: 'x', locationId: 'l1', ownerId: 'o1' }))).rejects.toThrow('REDIRECT');
    expect(apiPost.mock.calls[0]![1]).toEqual({ locationId: 'l1', ownerId: 'o1' });
  });

  it.each([
    [406, 'invalid'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [409, 'in-use'],
  ])('turns a %i into the form with ?error=%s', async (status, code) => {
    apiPost.mockRejectedValue(new ApiError(status, 'x'));
    await expect(markFound(form({ id: 'w1', locationId: 'l1', ownerId: 'o1' }))).rejects.toThrow(`REDIRECT /want/w1/found?error=${code}`);
  });
});
