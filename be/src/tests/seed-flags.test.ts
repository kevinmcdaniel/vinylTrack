import { describe, it, expect } from 'vitest';
import { prisma } from '../database.js';
import { seedUsers } from '../prisma/seedData.js';

// allowAutomation (#73, #11): the seed is the only thing that ever sets it,
// and only on the CI e2e user.
describe('allowAutomation', () => {
  it('is seeded true for the e2e user (kevin) and nobody else', () => {
    const flagged = Object.values(seedUsers).filter((u) => 'allowAutomation' in u && u.allowAutomation).map((u) => u.email);
    expect(flagged).toEqual(['kevin@example.com']);
  });

  it('defaults to false for a newly created user', async () => {
    const u = await prisma.user.create({ data: { email: '_TEST_flag@example.com' } });
    expect(u.allowAutomation).toBe(false);
  });
});
