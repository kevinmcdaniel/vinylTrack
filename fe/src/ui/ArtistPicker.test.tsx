import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArtistPicker from './ArtistPicker';

const artists = [
  { id: 'ar-1', name: 'Miles Davis' },
  { id: 'ar-2', name: 'John Coltrane' },
  { id: 'ar-3', name: 'Bill Evans' },
];

describe('ArtistPicker', () => {
  it('posts every checked artist as artistIds, starting from the album’s own', () => {
    render(<ArtistPicker artists={artists} selected={['ar-2']} createArtist={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'John Coltrane' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Miles Davis' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Miles Davis' })).toHaveAttribute('name', 'artistIds');
  });

  it('narrows the list as you type, keeping checked artists in view', async () => {
    render(<ArtistPicker artists={artists} selected={['ar-2']} createArtist={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find an artist' }), 'mil');
    expect(screen.getByRole('checkbox', { name: 'Miles Davis' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Bill Evans' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'John Coltrane' })).toBeChecked();
  });

  it('adds an artist that isn’t there yet and checks it', async () => {
    const createArtist = vi.fn(async (name: string) => ({ artist: { id: 'ar-9', name } }));
    render(<ArtistPicker artists={artists} selected={[]} createArtist={createArtist} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find an artist' }), 'Wes Montgomery');
    await userEvent.click(screen.getByRole('button', { name: 'Add “Wes Montgomery”' }));
    expect(createArtist).toHaveBeenCalledWith('Wes Montgomery');
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Wes Montgomery' })).toBeChecked());
  });

  it('offers no add button for a name already in the list', async () => {
    render(<ArtistPicker artists={artists} selected={[]} createArtist={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find an artist' }), 'bill evans');
    expect(screen.queryByRole('button', { name: /^Add / })).toBeNull();
  });

  it('says so when adding fails', async () => {
    const createArtist = vi.fn(async () => ({ error: 'forbidden' as const }));
    render(<ArtistPicker artists={artists} selected={[]} createArtist={createArtist} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find an artist' }), 'Nobody');
    await userEvent.click(screen.getByRole('button', { name: 'Add “Nobody”' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/couldn.t add that artist/i);
  });

  // PR #112 review: Enter in the search box used to submit the whole album
  // form half-filled (and on edit, replace the artist list). A phone's "Go" key is Enter.
  // Nor does Enter add: half-typed filter text would become a junk artist.
  it('never submits the form or adds an artist on Enter', async () => {
    const submit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const createArtist = vi.fn(async (name: string) => ({ artist: { id: 'ar-9', name } }));
    render(<form onSubmit={submit}><ArtistPicker artists={artists} selected={[]} createArtist={createArtist} /><button type="submit">Save</button></form>);
    const box = screen.getByRole('searchbox', { name: 'Find an artist' });
    await userEvent.type(box, 'miles{Enter}');
    expect(submit).not.toHaveBeenCalled();
    expect(createArtist).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add \u201cmiles\u201d' })).toBeInTheDocument();
  });
});
