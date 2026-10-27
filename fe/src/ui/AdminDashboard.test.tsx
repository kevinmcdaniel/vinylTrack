import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';
import type { AdminHealth, AdminSummary } from '@/lib/types';

const summary = (over: Partial<AdminSummary> = {}): AdminSummary => ({ pendingUsers: 0, unlinkedOwners: 0, ...over });
const health = (over: Partial<AdminHealth> = {}): AdminHealth => ({
  be: { status: 'up', version: 'v0.4.0', uptimeSeconds: 3600 },
  db: { status: 'up', latencyMs: 2 },
  mailer: { status: 'up', version: 'v0.4.0', mode: 'gmail' },
  ...over,
});
const renderIt = (props: Partial<Parameters<typeof AdminDashboard>[0]> = {}) =>
  render(<AdminDashboard summary={summary()} health={health()} feVersion="v0.4.0" {...props} />);
const section = (name: string) => screen.getByRole('region', { name });

// Admin back office (#90): what needs doing, what's running, where the runbooks are.
describe('AdminDashboard', () => {
  it('says all clear when nothing is waiting', () => {
    renderIt();
    expect(within(section('Action items')).getByText('All clear.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /request/i })).not.toBeInTheDocument();
  });

  it('counts waiting requests, linking to them, with owners they could be linked to', () => {
    renderIt({ summary: summary({ pendingUsers: 2, unlinkedOwners: 1 }) });
    const items = section('Action items');
    expect(within(items).getByRole('link', { name: '2 access requests waiting' })).toHaveAttribute('href', '/admin/requests');
    expect(within(items).getByText(/1 owner with no linked account/)).toBeInTheDocument();
    expect(within(items).queryByText('All clear.')).not.toBeInTheDocument();
  });

  // An owner with no account is normal (#53: a grandparent, a kid), and only
  // actionable while someone is waiting to be approved and linked.
  it('is all clear with unlinked owners but no requests', () => {
    renderIt({ summary: summary({ unlinkedOwners: 3 }) });
    const items = section('Action items');
    expect(within(items).getByText('All clear.')).toBeInTheDocument();
    expect(within(items).queryByText(/no linked account/)).not.toBeInTheDocument();
  });

  // #124: approved accounts drop off /admin/requests, so they need a home.
  it('links every account, whatever is waiting', () => {
    renderIt();
    expect(within(section('Accounts')).getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
  });

  it('uses the singular for one request', () => {
    renderIt({ summary: summary({ pendingUsers: 1 }) });
    expect(screen.getByRole('link', { name: '1 access request waiting' })).toBeInTheDocument();
  });

  it('lists every workload up, with its version', () => {
    renderIt();
    const rows = within(section('Workloads')).getAllByRole('listitem');
    expect(rows.map((r) => within(r).getByRole('heading').textContent)).toEqual(['fe', 'be', 'db', 'mailer']);
    for (const r of rows) expect(within(r).getByText('up')).toBeInTheDocument();
    expect(within(rows[3]!).getByText(/v0\.4\.0 · gmail/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // A revoked Gmail grant blocks every release (#62): say where the fix is.
  it('marks a down mailer and links the re-authorize runbook', () => {
    renderIt({ health: health({ mailer: { status: 'down', detail: 'unhealthy', version: 'v0.4.0', mode: 'gmail' } }) });
    const mailer = within(section('Workloads')).getAllByRole('listitem')[3]!;
    expect(within(mailer).getByText('down')).toBeInTheDocument();
    expect(within(mailer).getByText(/unhealthy/)).toBeInTheDocument();
    expect(within(mailer).getByRole('link', { name: /re-authorize/i })).toHaveAttribute('href', '/docs/hosting-maintenance');
  });

  it('marks a down db with its detail', () => {
    renderIt({ health: health({ db: { status: 'down', detail: 'TimeoutError' } }) });
    const db = within(section('Workloads')).getAllByRole('listitem')[2]!;
    expect(within(db).getByText('down')).toBeInTheDocument();
    expect(within(db).getByText('TimeoutError')).toBeInTheDocument();
  });

  it('shows a mailer that is not configured without calling it down', () => {
    renderIt({ health: health({ mailer: { status: 'not configured' } }) });
    const mailer = within(section('Workloads')).getAllByRole('listitem')[3]!;
    expect(within(mailer).getByText('not configured')).toBeInTheDocument();
    expect(within(mailer).queryByRole('link')).not.toBeInTheDocument();
  });

  it('says so when health could not be checked at all', () => {
    renderIt({ health: null });
    expect(within(section('Workloads')).getByText(/couldn.t check/i)).toBeInTheDocument();
  });

  // Half-finished deploy: one service on the new tag, another on the old.
  it('flags versions that differ', () => {
    renderIt({ feVersion: 'v0.5.0' });
    expect(screen.getByRole('alert')).toHaveTextContent(/versions differ/i);
  });

  it('links the runbooks into the admin docs', () => {
    renderIt();
    const runbooks = section('Runbooks');
    expect(within(runbooks).getByRole('link', { name: /deploy/i })).toHaveAttribute('href', '/docs/hosting-deploy');
    expect(within(runbooks).getByRole('link', { name: /maintenance/i })).toHaveAttribute('href', '/docs/hosting-maintenance');
    expect(within(runbooks).getByRole('link', { name: /all docs/i })).toHaveAttribute('href', '/docs');
  });
});
