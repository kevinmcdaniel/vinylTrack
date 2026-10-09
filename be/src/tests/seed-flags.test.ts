import { describe, it, expect } from 'vitest';
import { prisma } from '../database.js';

// allowAutomation (#73, #11): the seed is the only thing that ever sets it,
// and only on the CI e2e user. Asserts against the seeded dev/CI database.
describe('seeded allowAutomation', () => {
  it('is true for the e2e user and false for every other seeded user', async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: '@example.com', not: { startsWith: '_TEST_' } } },
      select: { email: true, allowAutomation: true },
    });
    expect(users.length).toBeGreaterThan(1);
    for (const u of users) {
      expect({ email: u.email, allowAutomation: u.allowAutomation })
        .toEqual({ email: u.email, allowAutomation: u.email === 'kevin@example.com' });
    }
  });

  it('defaults to false for a newly created user', async () => {
    const u = await prisma.user.create({ data: { email: '_TEST_flag@example.com' } });
    expect(u.allowAutomation).toBe(false);
  });
});
