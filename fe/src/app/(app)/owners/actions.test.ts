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

const { createOwner, renameOwner, deleteOwner } = await import('./actions');

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

afterEach(() => { apiPost.mockReset(); apiPatch.mockReset(); apiDelete.mockReset(); });

describe('createOwner', () => {
  it('posts the trimmed name and goes back to the list', async () => {
    apiPost.mockResolvedValue({ id: 'o-1' });
    await expect(createOwner(form({ name: '  Grandma Ruth ' }))).rejects.toThrow(/^REDIRECT \/owners$/);
    expect(apiPost).toHaveBeenCalledWith('/owner', { name: 'Grandma Ruth' });
  });

  // Linking to an account is the admin's call (#102 task 0); this form never asks.
  it('never sends a userId, even if the form carries one', async () => {
    apiPost.mockResolvedValue({ id: 'o-1' });
    await expect(createOwner(form({ name: 'Ruth', userId: 'u-9' }))).rejects.toThrow('REDIRECT /owners');
    expect(apiPost.mock.calls[0]![1]).not.toHaveProperty('userId');
  });

  it('turns a 406 into ?error=invalid, never the BE message', async () => {
    apiPost.mockRejectedValue(new ApiError(406, '<b>name</b> is required.'));
    await expect(createOwner(form({ name: '' }))).rejects.toThrow(/^REDIRECT \/owners\?error=invalid$/);
  });

  it('lets an unexpected failure through to the error page', async () => {
    const boom = new ApiError(500, 'boom');
    apiPost.mockRejectedValue(boom);
    await expect(createOwner(form({ name: 'Ruth' }))).rejects.toBe(boom);
  });
});

describe('renameOwner', () => {
  it('patches only the name', async () => {
    apiPatch.mockResolvedValue({ id: 'o-1' });
    await expect(renameOwner(form({ id: 'o-1', name: 'Ruth M.', userId: 'u-9' }))).rejects.toThrow(/^REDIRECT \/owners$/);
    expect(apiPatch).toHaveBeenCalledWith('/owner/o-1', { name: 'Ruth M.' });
  });

  it('escapes the id into the path', async () => {
    apiPatch.mockResolvedValue({});
    await expect(renameOwner(form({ id: '../user/x', name: 'n' }))).rejects.toThrow('REDIRECT');
    expect(apiPatch.mock.calls[0]![0]).toBe('/owner/..%2Fuser%2Fx');
  });

  it('turns a 404 into ?error=not-found', async () => {
    apiPatch.mockRejectedValue(new ApiError(404, 'gone'));
    await expect(renameOwner(form({ id: 'o-x', name: 'n' }))).rejects.toThrow(/^REDIRECT \/owners\?error=not-found$/);
  });
});

describe('deleteOwner', () => {
  it('deletes and goes back to the list', async () => {
    apiDelete.mockResolvedValue(null);
    await expect(deleteOwner(form({ id: 'o-1' }))).rejects.toThrow(/^REDIRECT \/owners$/);
    expect(apiDelete).toHaveBeenCalledWith('/owner/o-1');
  });

  it.each([
    [409, 'in-use'],
    [403, 'forbidden'],
  ])('turns a %i into ?error=%s', async (status, code) => {
    apiDelete.mockRejectedValue(new ApiError(status, 'x'));
    await expect(deleteOwner(form({ id: 'o-1' }))).rejects.toThrow(`REDIRECT /owners?error=${code}`);
  });
});
