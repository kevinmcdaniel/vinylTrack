import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('offers Google when configured', () => {
    render(<SignInForms siteKey="k" google dev={false} googleAction={action} devAction={action} emailAction={action} />);
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();
  });

  it('shows one bot check for the whole page, whichever forms are offered', () => {
    const renderMock = vi.fn();
    (window as unknown as { turnstile: unknown }).turnstile = { render: renderMock, remove: vi.fn() };
    const { container } = render(<SignInForms siteKey="k" google dev googleAction={action} devAction={action} emailAction={action} />);
    expect(container.querySelectorAll('[data-turnstile]')).toHaveLength(1);
    expect(renderMock.mock.calls.map((c) => (c[1] as { action: string }).action)).toEqual(['sign-in']);
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it('puts the one token in every form, and clears it when it expires', () => {
    const renderMock = vi.fn();
    (window as unknown as { turnstile: unknown }).turnstile = { render: renderMock, remove: vi.fn() };
    const { container } = render(<SignInForms siteKey="k" google dev googleAction={action} devAction={action} emailAction={action} />);
    const tokens = () => [...container.querySelectorAll('form')].map((f) => new FormData(f).get('turnstileToken'));
    expect(tokens()).toEqual(['', '', '']);
    const options = renderMock.mock.calls[0]![1] as { callback: (t: string) => void; 'expired-callback': () => void };
    act(() => options.callback('tok-1'));
    expect(tokens()).toEqual(['tok-1', 'tok-1', 'tok-1']);
    act(() => options['expired-callback']());
    expect(tokens()).toEqual(['', '', '']);
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it('offers the dev sign-in (development/test) with a seeded email prefilled', () => {
    render(<SignInForms siteKey="k" google={false} dev googleAction={action} devAction={action} emailAction={action} />);
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toHaveValue('kevin@example.com');
    expect(screen.getByRole('button', { name: /dev sign-in/i })).toBeInTheDocument();
  });

  it('keeps every submit button disabled until the bot check gives a token', () => {
    const renderMock = vi.fn();
    (window as unknown as { turnstile: unknown }).turnstile = { render: renderMock, remove: vi.fn() };
    render(<SignInForms siteKey="k" google dev googleAction={action} devAction={action} emailAction={action} />);
    const buttons = () => screen.getAllByRole('button');
    expect(buttons()).toHaveLength(3);
    buttons().forEach((b) => expect(b).toBeDisabled());
    act(() => (renderMock.mock.calls[0]![1] as { callback: (t: string) => void }).callback('tok-1'));
    buttons().forEach((b) => expect(b).toBeEnabled());
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it('spends the token on submit: sends it, then clears it and asks the widget for a new one', async () => {
    // A failed send redirects back to /sign-in?error=…, which re-renders this
    // component without remounting it; a kept token would already be spent.
    const renderMock = vi.fn(() => 'w');
    (window as unknown as { turnstile: unknown }).turnstile = { render: renderMock, remove: vi.fn() };
    const emailAction = vi.fn(async (_fd: FormData) => {});
    const { container } = render(<SignInForms siteKey="k" google={false} dev={false} googleAction={action} devAction={action} emailAction={emailAction} />);
    act(() => ((renderMock.mock.calls[0] as unknown[])[1] as { callback: (t: string) => void }).callback('tok-1'));
    await userEvent.type(screen.getByLabelText(/email address/i), 'a@example.com');
    await userEvent.click(screen.getByRole('button', { name: /email me a sign-in link/i }));
    await waitFor(() => expect(emailAction).toHaveBeenCalledTimes(1));
    expect(emailAction.mock.calls[0]![0].get('turnstileToken')).toBe('tok-1');
    expect(new FormData(container.querySelector('form')!).get('turnstileToken')).toBe('');
    expect(renderMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: /email me a sign-in link/i })).toBeDisabled();
    delete (window as unknown as { turnstile?: unknown }).turnstile;
  });

  it('always offers a sign-in link by email', () => {
    render(<SignInForms siteKey="k" google={false} dev={false} googleAction={action} devAction={action} emailAction={action} />);
    expect(screen.getByLabelText(/email address/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /email me a sign-in link/i })).toBeInTheDocument();
  });

  it.each([
    ['email-rate-limited', /too many sign-in emails/i],
    ['email-failed', /couldn.t send/i],
    ['Verification', /expired or was already used/i],
    ['email-refused', /couldn.t sign you in/i],
    ['constructor', /couldn.t sign you in/i],
  ])('maps ?error=%s to fixed text', (error, text) => {
    render(<SignInForms siteKey="k" google dev={false} error={error} googleAction={action} devAction={action} emailAction={action} />);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
  });

  it('explains a refused sign-in without leaking why', () => {
    render(<SignInForms siteKey="k" google dev={false} error="AccessDenied" googleAction={action} devAction={action} emailAction={action} />);
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

  it('says when asking again failed, in fixed text', () => {
    render(<PendingView user={{ ...user, status: 'denied' }} siteKey="k" error="anything at all" requestAccessAction={action} signOutAction={action} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t send your request/i);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/anything at all/);
  });

  it('shows no alert without an error', () => {
    render(<PendingView user={{ ...user, status: 'denied' }} siteKey="k" requestAccessAction={action} signOutAction={action} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

  it.each([
    ['conflict', /already linked/i],
    ['gone', /no longer/i],
    ['<script>', /couldn.t update/i],
    ['constructor', /couldn.t update/i],
  ])('maps ?error=%s to fixed text', (error, text) => {
    render(<RequestsList users={pending} owners={owners} error={error} approveAction={action} denyAction={action} />);
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('alert')).not.toHaveTextContent('<script>');
  });

  it('shows the error even once the list is empty', () => {
    render(<RequestsList users={[]} owners={owners} error="gone" approveAction={action} denyAction={action} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no longer/i);
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

  it('shows fixed text for a failed attempt', () => {
    render(<NewCollectionForm action={action} error="invalid" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/check the name and kind/i);
  });

  // ?error= is user-controlled: a crafted link must not put its text in the alert.
  it('never echoes the error param', () => {
    render(<NewCollectionForm action={action} error="Your account is locked, call 555-0100" />);
    expect(screen.getByRole('alert')).not.toHaveTextContent(/555-0100/);
    expect(screen.getByRole('alert')).toHaveTextContent(/couldn.t create/i);
  });
});
