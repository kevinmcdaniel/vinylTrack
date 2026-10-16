import { describe, it, expect } from 'vitest';
import { parentChoices } from './locations';
import type { Location } from './types';

const loc = (id: string, name: string, parent?: Location): Location => ({
  id, name, kind: 'physical', collectionId: 'c1',
  parentLocationId: parent?.id ?? null, parent: parent ? { id: parent.id, name: parent.name } : null,
});

const basement = loc('b', 'Basement');
const shelf = loc('s', 'Shelf 3', basement);
const bin = loc('x', 'Bin', shelf);
const attic = loc('a', 'Attic');
const all = [shelf, attic, bin, basement];

describe('parentChoices', () => {
  it('offers every location for a new one, sorted by name', () => {
    expect(parentChoices(all).map((l) => l.name)).toEqual(['Attic', 'Basement', 'Bin', 'Shelf 3']);
  });

  // A location can't sit inside itself or anything inside it, or the
  // parent chain loops (the BE doesn't check, #102).
  it('leaves out the location itself and everything inside it', () => {
    expect(parentChoices(all, 'b').map((l) => l.name)).toEqual(['Attic']);
    expect(parentChoices(all, 's').map((l) => l.name)).toEqual(['Attic', 'Basement']);
  });
});
