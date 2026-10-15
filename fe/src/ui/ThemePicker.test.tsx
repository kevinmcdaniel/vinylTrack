import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/app/theme/actions', () => ({ setThemeAction: vi.fn() }));

import ThemePicker from './ThemePicker';

describe('ThemePicker', () => {
  it('offers System plus every theme, System selected when nothing is chosen', () => {
    render(<ThemePicker current={null} />);
    const select = screen.getByRole('combobox', { name: 'Theme' });
    expect([...select.querySelectorAll('option')].map((o) => [o.value, o.textContent])).toEqual([
      ['system', 'System'], ['classic', 'Classic'], ['warm', 'Warm'], ['dark', 'Dark'],
    ]);
    expect(select).toHaveValue('system');
  });

  it('shows the saved choice', () => {
    render(<ThemePicker current="warm" />);
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('warm');
  });

  // React resets a form after its action; the saved choice must survive that.
  it('follows the saved choice when the server re-renders it', () => {
    const { rerender } = render(<ThemePicker current={null} />);
    rerender(<ThemePicker current="dark" />);
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('dark');
  });

  it('submits as soon as the choice changes', () => {
    render(<ThemePicker current={null} />);
    const select = screen.getByRole('combobox', { name: 'Theme' });
    const submit = vi.spyOn(select.closest('form')!, 'requestSubmit').mockImplementation(() => {});
    fireEvent.change(select, { target: { value: 'dark' } });
    expect(submit).toHaveBeenCalled();
  });
});
