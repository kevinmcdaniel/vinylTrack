// seedData.ts - the users seed.ts creates, as plain data so their invariants
// can be tested without a seeded database (CI's BE job doesn't seed).

export const seedUsers = {
  // Owner, and deliberately NOT an admin: this is what most family members are,
  // so it's the identity that actually exercises the access rules in policy.ts
  // rather than the admin bypass. Also the CI e2e user: the only seeded user
  // automation mode may act for (#73).
  kevin: { email: 'kevin@example.com', name: 'Kevin', status: 'active', allowAutomation: true },
  alex: { email: 'alex@example.com', name: 'Alex', status: 'active' },
  // Active, but owns nothing and is shared nothing — the "outsider" identity the
  // Bruno collection (#34) needs to exercise the 403/404 access paths.
  jamie: { email: 'jamie@example.com', name: 'Jamie', status: 'active' },
  // Admin, owning nothing of their own — the bypass path in policy.ts, kept as a
  // separate identity so "owner" and "admin" can't be silently conflated (#34).
  admin: { email: 'admin@example.com', name: 'Admin', status: 'active', isAdmin: true },
} as const;
