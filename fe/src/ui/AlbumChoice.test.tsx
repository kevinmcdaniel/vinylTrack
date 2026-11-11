import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlbumChoice from './AlbumChoice';

const artists = [{ id: 'ar-1', name: 'Miles Davis' }, { id: 'ar-2', name: 'Bill Evans' }];
const kindOfBlue = { id: 'a-1', title: 'Kind of Blue', year: 1959, artists: ['Miles Davis'] };

const renderIt = (props: Partial<Parameters<typeof AlbumChoice>[0]> = {}) => {
  const searchAlbums = vi.fn(async () => [kindOfBlue]);
  const findMatches = vi.fn(async () => [] as (typeof kindOfBlue & { copyCount: number })[]);
  render(
    <form>
      <AlbumChoice
        collectionName="Vinyl"
        artists={artists}
        createArtist={vi.fn()}
        searchAlbums={searchAlbums}
        findMatches={findMatches}
        {...props}
      />
    </form>,
  );
  return { searchAlbums, findMatches, ...props };
};
const mode = (name: 'Existing album' | 'New album') => screen.getByRole('radio', { name });

// #123: add a copy with an album already in the collection, or a new one.
describe('AlbumChoice', () => {
  it('starts on Existing album, or on New when asked', () => {
    const { unmount } = render(<form><AlbumChoice collectionName="Vinyl" artists={artists} createArtist={vi.fn()} searchAlbums={vi.fn()} findMatches={vi.fn()} /></form>);
    expect(mode('Existing album')).toBeChecked();
    expect(mode('Existing album')).toHaveAttribute('name', 'albumMode');
    unmount();
    renderIt({ mode: 'new' });
    expect(mode('New album')).toBeChecked();
  });

  // Without JS the search is a GET to this page: its fields belong to a form
  // outside the POST form (form="album-search"), so they never post with it.
  it('searches without JS through the album-search form', () => {
    renderIt({ query: 'kind' });
    expect(screen.getByRole('searchbox', { name: 'Find an album' })).toHaveAttribute('form', 'album-search');
    expect(screen.getByRole('searchbox', { name: 'Find an album' })).toHaveAttribute('name', 'q');
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('form', 'album-search');
  });

  it('lists the server’s results as albumId choices', () => {
    renderIt({ query: 'kind', results: [kindOfBlue] });
    const pick = screen.getByRole('radio', { name: /Kind of Blue/ });
    expect(pick).toHaveAttribute('name', 'albumId');
    expect(pick).toHaveAttribute('value', 'a-1');
    expect(pick.closest('label')).toHaveTextContent('Kind of Blue · Miles Davis · 1959');
  });

  it('says when a search finds nothing', () => {
    renderIt({ query: 'zzz', results: [] });
    expect(screen.getByText(/No album in Vinyl matches/)).toBeInTheDocument();
  });

  it('searches as you type', async () => {
    const { searchAlbums } = renderIt();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find an album' }), 'kind');
    await waitFor(() => expect(searchAlbums).toHaveBeenLastCalledWith('kind'));
    expect(await screen.findByRole('radio', { name: /Kind of Blue/ })).toBeInTheDocument();
  });

  it('warns about a look-alike while you fill in a new album, and switches to it on request', async () => {
    const findMatches = vi.fn(async () => [{ ...kindOfBlue, copyCount: 2 }]);
    renderIt({ mode: 'new', findMatches });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Miles Davis' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'Kind of blue');
    await waitFor(() => expect(findMatches).toHaveBeenLastCalledWith('Kind of blue', ['ar-1']));
    const warning = await screen.findByRole('status');
    expect(warning).toHaveTextContent('Already in Vinyl: Kind of Blue · Miles Davis · 1959 (2 copies)');

    await userEvent.click(within(warning).getByRole('button', { name: 'Use it instead' }));
    expect(mode('Existing album')).toBeChecked();
    expect(screen.getByRole('radio', { name: /Kind of Blue/ })).toBeChecked();
  });

  it('names an album with no copies as one with no copies yet', async () => {
    const findMatches = vi.fn(async () => [{ ...kindOfBlue, copyCount: 0 }]);
    renderIt({ mode: 'new', findMatches });
    await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'Kind');
    expect(await screen.findByRole('status')).toHaveTextContent('(no copies yet)');
  });

  // The two halves post different names, so the action can read only one.
  it('keeps the album’s notes apart from the copy’s', () => {
    renderIt({ mode: 'new' });
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveAttribute('name', 'albumTitle');
    expect(screen.getByRole('textbox', { name: 'Album notes' })).toHaveAttribute('name', 'albumNotes');
  });
});
