import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocViewer from './DocViewer';

const md = [
  '[Index](README.md)',
  '[Page](getting-started.md#sign-in)',
  '[Issues](https://github.com/x/y)',
  '[Root](/collection/new)',
  '[Here](#top)',
].join(' ');

const href = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

// One viewer serves /docs (admin) and /help (users, #90): a relative .md link
// stays inside whichever set it was written in.
describe('DocViewer', () => {
  it.each([['/docs'], ['/help']])('resolves relative .md links under %s', (basePath) => {
    render(<DocViewer content={md} basePath={basePath} />);
    expect(href('Index')).toBe(basePath);
    expect(href('Page')).toBe(`${basePath}/getting-started#sign-in`);
  });

  it('leaves absolute, root and anchor links alone', () => {
    render(<DocViewer content={md} basePath="/help" />);
    expect(href('Issues')).toBe('https://github.com/x/y');
    expect(href('Root')).toBe('/collection/new');
    expect(href('Here')).toBe('#top');
  });
});
