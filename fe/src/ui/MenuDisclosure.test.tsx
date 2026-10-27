import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

const pathname = vi.hoisted(() => ({ current: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

import MenuDisclosure from './MenuDisclosure';

const renderIt = () => render(
  <div>
    <MenuDisclosure summary="Kevin" label="Account menu"><button type="button">Help</button></MenuDisclosure>
    <p>outside</p>
  </div>,
);
const details = () => screen.getByText('Kevin').closest('details')!;
const open = () => { details().open = true; };

// The header lives in the layout, which survives client navigation: an open
// menu would stay open over the next page without these (#124).
describe('MenuDisclosure', () => {
  it('starts closed', () => {
    renderIt();
    expect(details().open).toBe(false);
  });

  // A tap before hydration opens the native <details>; mounting must not undo it.
  it('stays open when opened before it mounted', () => {
    pathname.current = '/';
    const ui = <MenuDisclosure summary="Kevin" label="Account menu"><button type="button">Help</button></MenuDisclosure>;
    const host = document.createElement('div');
    host.innerHTML = renderToString(ui);
    host.querySelector('details')!.open = true;
    document.body.appendChild(host);
    render(ui, { container: host, hydrate: true });
    expect(host.querySelector('details')!.open).toBe(true);
    host.remove();
  });

  it('closes when the page changes', () => {
    const { rerender } = renderIt();
    open();
    pathname.current = '/help';
    rerender(
      <div>
        <MenuDisclosure summary="Kevin" label="Account menu"><button type="button">Help</button></MenuDisclosure>
        <p>outside</p>
      </div>,
    );
    expect(details().open).toBe(false);
  });

  it('closes on a tap outside, not inside', () => {
    renderIt();
    open();
    fireEvent.pointerDown(screen.getByText('Help'));
    expect(details().open).toBe(true);
    fireEvent.pointerDown(screen.getByText('outside'));
    expect(details().open).toBe(false);
  });

  it('closes on Escape', () => {
    renderIt();
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(details().open).toBe(false);
  });
});
