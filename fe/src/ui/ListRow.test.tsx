import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListRow from './ListRow';

describe('ListRow', () => {
  // #137: a long name truncates; it never pushes the action onto a second line.
  it('truncates the main text and keeps the action from shrinking', () => {
    render(<ul><ListRow filterText="Basement" action={<a href="/x">Edit</a>} meta="digital">Basement</ListRow></ul>);
    const row = screen.getByRole('listitem');
    expect(row).toHaveAttribute('data-filter', 'basement');
    expect(screen.getByText('Basement')).toHaveClass('truncate', 'min-w-0', 'flex-1');
    expect(screen.getByText('digital')).toHaveClass('shrink-0');
    expect(screen.getByRole('link', { name: 'Edit' }).parentElement).toHaveClass('shrink-0');
  });
});
