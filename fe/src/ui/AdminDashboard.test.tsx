import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';
import type { AdminHealth, AdminSummary } from '@/lib/types';

const summary = (over: Partial<AdminSummary> = {}): AdminSummary => ({ pendingUsers: 0, unlinkedOwners: 0, ...over });
const health = (over: Partial<AdminHealth> = {}): AdminHealth => ({
  be: { status: 'up', version: 'v0.4.0', uptimeSeconds: 120 },
  db: { status: 'up', latencyMs: 2 },
  mailer: { status: 'up', version: 'v0.4.0', mode: 'gmail' },
  ...over,
});
const section = (name: string) => within(screen.getByRole('region', { name }));

// Admin back office (#90): one page that answers "what do I need to do?".
describe('AdminDashboard', () => {
  it('says all clear when nothing is waiting', () => {
    render(<AdminDashboard summary={summary()} health={health()} feVersion="v0.4.0" />);
    expect(section('To do').getByText('All clear.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /request/i })).not.toBeInTheDocument();
  });

  it('counts pending requests, linking to them, and owners with no account', () => {
    render(<AdminDashboard summary={summary({ pendingUsers: 2, unlinkedOwners: 1 })} health={health()} feVersion="v0.4.0" />);
    expect(section('To do').getByRole('link', { name: '2 access requests' })).toHaveAttribute('href', '/admin/requests');
    expect(section('To do').getByText(/1 owner with no account/)).toBeInTheDocument();
    expect(screen.queryByText('All clear.')).not.toBeInTheDocument();
  });

  it('uses the singular for one request', () => {
    render(<AdminDashboard summary={summary({ pendingUsers: 1 })} health={health()} feVersion="v0.4.0" />);
    expect(screen.getByRole('link', { name: '1 access request' })).toBeInTheDocument();
  });

  it('shows each workload up, and one running version', () => {
    render(<AdminDashboard summary={summary()} health={health()} feVersion="v0.4.0" />);
    const workloads = section('Workloads');
    for (const name of ['fe', 'be', 'db', 'mailer']) {
      expect(within(workloads.getByRole('listitem', { name })).getByText('up')).toBeInTheDocument();
    }
    expect(section('Version').getByText('v0.4.0')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('flags a version mismatch (a half-finished deploy)', () => {
    render(<AdminDashboard summary={summary()} health={health({ be: { status: 'up', version: 'v0.3.2', uptimeSeconds: 1 } })} feVersion="v0.4.0" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/versions differ/i);
    expect(section('Version').getByText('v0.3.2')).toBeInTheDocument();
  });

  it('marks a down mailer and links the re-authorize runbook', () => {
    render(<AdminDashboard summary={summary()} health={health({ mailer: { status: 'down', detail: '503', version: 'v0.4.0', mode: 'gmail' } })} feVersion="v0.4.0" />);
    const mailer = within(screen.getByRole('listitem', { name: 'mailer' }));
    expect(mailer.getByText('down')).toBeInTheDocument();
    expect(mailer.getByText(/503/)).toBeInTheDocument();
    expect(mailer.getByRole('link', { name: /re-authorize/i })).toHaveAttribute('href', '/docs/hosting-maintenance');
  });

  it('shows an unconfigured mailer as such, not as down', () => {
    render(<AdminDashboard summary={summary()} health={health({ mailer: { status: 'not configured' } })} feVersion="v0.4.0" />);
    expect(within(screen.getByRole('listitem', { name: 'mailer' })).getByText('not configured')).toBeInTheDocument();
  });

  it('marks a down db', () => {
    render(<AdminDashboard summary={summary()} health={health({ db: { status: 'down', detail: 'TimeoutError' } })} feVersion="v0.4.0" />);
    const db = within(screen.getByRole('listitem', { name: 'db' }));
    expect(db.getByText('down')).toBeInTheDocument();
    expect(db.getByText(/TimeoutError/)).toBeInTheDocument();
  });

  it('shows the be as down when its health could not be read at all', () => {
    render(<AdminDashboard summary={summary()} health={null} feVersion="v0.4.0" />);
    expect(within(screen.getByRole('listitem', { name: 'be' })).getByText('down')).toBeInTheDocument();
    expect(within(screen.getByRole('listitem', { name: 'fe' })).getByText('up')).toBeInTheDocument();
  });

  it('says so when the action items could not be read', () => {
    render(<AdminDashboard summary={null} health={null} feVersion="v0.4.0" />);
    expect(section('To do').getByText(/couldn.t load/i)).toBeInTheDocument();
    expect(screen.queryByText('All clear.')).not.toBeInTheDocument();
  });

  it('links the runbooks', () => {
    render(<AdminDashboard summary={summary()} health={health()} feVersion="v0.4.0" />);
    const runbooks = section('Runbooks');
    expect(runbooks.getByRole('link', { name: /deploy/i })).toHaveAttribute('href', '/docs/hosting-deploy');
    expect(runbooks.getByRole('link', { name: /maintenance/i })).toHaveAttribute('href', '/docs/hosting-maintenance');
    expect(runbooks.getByRole('link', { name: /all docs/i })).toHaveAttribute('href', '/docs');
  });
});
