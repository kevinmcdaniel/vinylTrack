import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CheckEmailPage from './page';

// Where Auth.js lands after a sign-in link is sent (#74).
describe('CheckEmailPage', () => {
  it('says to check email, how long the link lasts, and offers the way back', () => {
    render(<CheckEmailPage />);
    expect(screen.getByRole('heading')).toHaveTextContent(/check your email/i);
    expect(screen.getByText(/15 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/sign-in');
  });
});
