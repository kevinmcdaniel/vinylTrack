import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PickOrAdd from './PickOrAdd';

const options = [{ id: 'o-1', label: 'Kevin' }, { id: 'o-2', label: 'Grandma Ruth' }];

describe('PickOrAdd', () => {
  it('is a real required select posting under its name, starting on the default', () => {
    render(<PickOrAdd name="ownerId" label="Owner" options={options} defaultValue="o-2" addLabel="Add an owner" create={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: 'Owner' });
    expect(select).toHaveAttribute('name', 'ownerId');
    expect(select).toBeRequired();
    expect(select).toHaveValue('o-2');
  });

  it('adds a new option inline and selects it', async () => {
    const create = vi.fn(async (name: string) => ({ item: { id: 'o-9', label: name } }));
    render(<PickOrAdd name="ownerId" label="Owner" options={options} addLabel="Add an owner" create={create} />);
    await userEvent.click(screen.getByText('Add an owner'));
    await userEvent.type(screen.getByRole('textbox', { name: 'New owner name' }), 'Cousin Pat');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(create).toHaveBeenCalledWith('Cousin Pat');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Owner' })).toHaveValue('o-9'));
  });

  it('says so when adding fails, and keeps the old choice', async () => {
    const create = vi.fn(async () => ({ error: 'forbidden' as const }));
    render(<PickOrAdd name="ownerId" label="Owner" options={options} defaultValue="o-1" addLabel="Add an owner" create={create} />);
    await userEvent.click(screen.getByText('Add an owner'));
    await userEvent.type(screen.getByRole('textbox', { name: 'New owner name' }), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/couldn.t add/i);
    expect(screen.getByRole('combobox', { name: 'Owner' })).toHaveValue('o-1');
  });
});
