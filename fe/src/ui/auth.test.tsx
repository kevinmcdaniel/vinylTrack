import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Turnstile from './Turnstile';
import SignInForms from './SignInForms';
import PendingView from './PendingView';
import RequestsList from './RequestsList';
import NewCollectionForm from './NewCollectionForm';

// Sign-in and access screens (#73). Server actions arrive as props.
const action = vi.fn(async () => {});

describe('Turnstile', () => {
  const renderMock = vi.fn();
  beforeEach(() => { (window as unknown as { turnstile: unknown }).turnstile = { render: renderMock, remove: vi.fn() }; });
  afterEach(() => { delete (window as unknown as { turnstile?: unknown }).turnstile; renderMock.mockClear(); });

  it('renders the widget with the site key and action, putting the token in a turnstileToken field', () => {
    render(<Turnstile siteKey="site-key-1" action="sign-in" />);
    expect(renderMock).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      sitekey: 'site-key-1', action: 'sign-in', 'response-field-name': 'turnstileToken',
    }));
  });
});

describe('SignInForms', () => {
  it('offers Google when configured, each form with its own bot check', () => {
    const { container } = render(<SignInForms siteKey="k" google dev={false} googleAction={action} devAction={action} />);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-turnstile]')).toHaveLength(1);
  });

  it('offers the dev sign-in (development/test) with a seeded email prefilled', () => {
    render(<SignInForms siteKey="k" google={false} dev googleAction={action} devAction={action} />);
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toHaveValue('kevin@example.com');
    expect(screen.getByRole('button', { name: /dev sign-in/i })).toBeInTheDocument();
  });

  it('explains a refused sign-in without leaking why', () => {
    render(<SignInForms siteKey="k" google dev={false} error="AccessDenied" googleAction={action} devAction={action} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t sign you in/i);
  });
});

describe('PendingView', () => {
  const user = { id: 'u-1', email: 'a@example.com', name: 'A', avatar: null, isAdmin: false };

  it('says a pending request is waiting, with no way to re-request', () => {
    render(<PendingView user={{ ...user, status: 'pending' }} siteKey="k" requestAccessAction={action} signOutAction={action} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/waiting for approval/i);
    expect(screen.queryByRole('button', { name: /ask again/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('lets a denied user ask again, behind a bot check', () => {
    const { container } = render(<PendingView user={{ ...user, status: 'denied' }} siteKey="k" requestAccessAction={action} signOutAction={action} />);
    expect(screen.getByRole('heading')).toHaveTextContent(/declined/i);
    expect(screen.getByRole('button', { name: /ask again/i })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-turnstile]')).toHaveLength(1);
  });
});

describe('RequestsList', () => {
  const pending = [
    { id: 'u-1', email: 'ruth@example.com', name: 'Ruth', avatar: null, status: 'pending' as const, isAdmin: false, createdAt: '2026-10-01T00:00:00Z' },
    { id: 'u-2', email: 'sam@example.com', name: null, avatar: null, status: 'pending' as const, isAdmin: false, createdAt: '2026-10-02T00:00:00Z' },
  ];
  const owners = [{ id: 'o-1', name: 'Grandma Ruth' }];

  it('shows an empty state when nobody is waiting', () => {
    render(<RequestsList users={[]} owners={owners} approveAction={action} denyAction={action} />);
    expect(screen.getByText(/no one is waiting/i)).toBeInTheDocument();
  });

  it('gives each request approve and deny, with an optional owner to link', () => {
    render(<RequestsList users={pending} owners={owners} approveAction={action} denyAction={action} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const ruth = within(rows[0]!);
    expect(ruth.getByText('ruth@example.com')).toBeInTheDocument();
    expect(ruth.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(ruth.getByRole('button', { name: /deny/i })).toBeInTheDocument();
    const select = ruth.getByLabelText(/link to owner/i);
    expect(within(select).getByRole('option', { name: 'Grandma Ruth' })).toBeInTheDocument();
    expect(within(select).getByRole('option', { name: /don.t link/i })).toBeInTheDocument();
    expect(rows[0]!.querySelector('input[name="userId"]')).toHaveValue('u-1');
  });
});

describe('NewCollectionForm', () => {
  it('asks for a name and a physical/digital kind', () => {
    render(<NewCollectionForm action={action} />);
    expect(screen.getByLabelText(/name/i)).toBeRequired();
    expect(screen.getByRole('radio', { name: /physical/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /digital/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument();
  });

  it('shows the error from a failed attempt', () => {
    render(<NewCollectionForm action={action} error="name is required." />);
    expect(screen.getByRole('alert')).toHaveTextContent('name is required.');
  });
});
