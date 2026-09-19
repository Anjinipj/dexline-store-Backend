const prisma = require('../src/lib/prisma');
const verificationService = require('../src/services/verificationService');
const { randomToken, sha256 } = require('../src/utils/tokens');
const { createTestUser, deleteTestUser } = require('./helpers');

async function createToken(user, overrides = {}) {
  const raw = randomToken(16);
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      email: overrides.email || user.email,
      tokenHash: sha256(raw),
      expiresAt: overrides.expiresAt || new Date(Date.now() + 60000),
    },
  });
  return raw;
}

describe('Email verification tokens', () => {
  afterAll(async () => prisma.$disconnect());

  test('rejects a token that does not exist', async () => {
    await expect(verificationService.confirmEmailToken('not-a-real-token')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('confirms a valid token and sets emailVerifiedAt', async () => {
    const user = await createTestUser();
    try {
      const raw = await createToken(user);
      const updated = await verificationService.confirmEmailToken(raw);
      expect(updated.emailVerifiedAt).toBeInstanceOf(Date);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('rejects reusing an already-consumed token', async () => {
    const user = await createTestUser();
    try {
      const raw = await createToken(user);
      await verificationService.confirmEmailToken(raw);
      await expect(verificationService.confirmEmailToken(raw)).rejects.toMatchObject({ statusCode: 400 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('rejects an expired token', async () => {
    const user = await createTestUser();
    try {
      const raw = await createToken(user, { expiresAt: new Date(Date.now() - 1000) });
      await expect(verificationService.confirmEmailToken(raw)).rejects.toMatchObject({ statusCode: 400 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('a token bound to a different (stale) email address is rejected', async () => {
    const user = await createTestUser();
    try {
      // Simulates a token issued for a pending email change that was later
      // superseded — it must not verify the account's CURRENT email.
      const raw = await createToken(user, { email: 'someone-else@example.com' });
      await expect(verificationService.confirmEmailToken(raw)).rejects.toMatchObject({ statusCode: 400 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('enforces the resend cooldown per account', async () => {
    const user = await createTestUser();
    try {
      await verificationService.sendEmailVerification(user);
      await expect(verificationService.sendEmailVerification(user)).rejects.toMatchObject({ statusCode: 429 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('account activates only once BOTH email and phone are verified', async () => {
    const user = await createTestUser();
    try {
      expect(user.status).toBe('pending_verification');

      const raw = await createToken(user);
      const afterEmail = await verificationService.confirmEmailToken(raw);
      expect(afterEmail.status).toBe('pending_verification');

      const { hmac } = require('../src/utils/tokens');
      const verificationConfig = require('../src/config/verification');
      await prisma.phoneVerification.create({
        data: {
          userId: user.id,
          phone: user.phone,
          provider: 'console',
          codeHash: hmac('998877', verificationConfig.otpHashSecret),
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      const afterPhone = await verificationService.confirmPhoneOtp(user, { code: '998877' });
      expect(afterPhone.status).toBe('active');
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
