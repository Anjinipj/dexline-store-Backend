const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const authService = require('../src/services/authService');
const generateToken = require('../src/utils/generateToken');
const { hmac } = require('../src/utils/tokens');
const verificationConfig = require('../src/config/verification');
const { createTestUser, deleteTestUser } = require('./helpers');

describe('Changing an already-verified email/phone', () => {
  afterAll(async () => prisma.$disconnect());

  test('requires the current password and rejects a wrong/missing one — but only once the phone is actually verified', async () => {
    const user = await createTestUser(); // phoneVerifiedAt is null — nothing to protect yet
    try {
      // Unverified phone: no password required, since there's no prior
      // verification to protect.
      const firstChange = await authService.updateProfile(user.id, { phone: '501111111', country: 'AE' });
      expect(firstChange.phone).toBe('+971501111111');
      expect(firstChange.pendingPhone).toBeNull();

      // Now verify that number, so the next change IS gated.
      await prisma.phoneVerification.create({
        data: {
          userId: user.id,
          phone: firstChange.phone,
          provider: 'console',
          codeHash: hmac('445566', verificationConfig.otpHashSecret),
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      const verificationService = require('../src/services/verificationService');
      await verificationService.confirmPhoneOtp(firstChange, { code: '445566' });

      await expect(authService.updateProfile(user.id, { phone: '501111112', country: 'AE' })).rejects.toMatchObject({
        statusCode: 401,
      });
      await expect(
        authService.updateProfile(user.id, { phone: '501111112', country: 'AE', currentPassword: 'wrong' })
      ).rejects.toMatchObject({ statusCode: 401 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('moves a changed, previously-verified phone to pendingPhone without marking the new number verified, and keeps the old number live', async () => {
    const user = await createTestUser();
    try {
      await prisma.phoneVerification.create({
        data: {
          userId: user.id,
          phone: user.phone,
          provider: 'console',
          codeHash: hmac('222333', verificationConfig.otpHashSecret),
          maxAttempts: 5,
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      const verificationService = require('../src/services/verificationService');
      await verificationService.confirmPhoneOtp(user, { code: '222333' });

      const updated = await authService.updateProfile(user.id, {
        phone: '501111111',
        country: 'AE',
        currentPassword: 'password123',
      });

      expect(updated.pendingPhone).toBe('+971501111111');
      expect(updated.phone).toBe(user.phone); // old, still-verified number untouched
      expect(updated.phoneVerifiedAt).not.toBeNull(); // old verification preserved
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('an unverified phone can be corrected directly, no password required', async () => {
    const user = await createTestUser(); // phoneVerifiedAt is null by default
    try {
      const updated = await authService.updateProfile(user.id, { phone: '502222222', country: 'AE' });
      expect(updated.phone).toBe('+971502222222');
      expect(updated.pendingPhone).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describe('Legacy accounts (pre-existing users with no verification timestamps)', () => {
  let legacyUser;

  beforeAll(async () => {
    legacyUser = await createTestUser({ status: 'active' });
  });
  afterAll(async () => {
    await deleteTestUser(legacyUser.id);
    await prisma.$disconnect();
  });

  test('keeps full access to existing authenticated endpoints', async () => {
    expect(legacyUser.emailVerifiedAt).toBeNull();
    expect(legacyUser.phoneVerifiedAt).toBeNull();

    const token = generateToken(legacyUser);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('active');
    expect(res.body.user.emailVerified).toBe(false);
    expect(res.body.user.phoneVerified).toBe(false);
  });
});

describe('Missing provider configuration fails clearly and safely', () => {
  test('Turnstile grant creation refuses to fake success when TURNSTILE_SECRET_KEY is unset', async () => {
    const verificationService = require('../src/services/verificationService');
    const original = process.env.TURNSTILE_SECRET_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    try {
      await expect(verificationService.createTurnstileGrant({ token: 'anything' })).rejects.toMatchObject({
        statusCode: 503,
      });
    } finally {
      process.env.TURNSTILE_SECRET_KEY = original;
    }
  });

  test('SMS sending refuses the dev console fallback in production and fails clearly instead of faking delivery', async () => {
    const smsProvider = require('../src/services/smsProvider');
    const originalEnv = process.env.NODE_ENV;
    const originalSid = process.env.TWILIO_ACCOUNT_SID;
    process.env.NODE_ENV = 'production';
    delete process.env.TWILIO_ACCOUNT_SID;
    try {
      await expect(smsProvider.sendOtp('+971501234567')).rejects.toMatchObject({ code: 'SMS_NOT_CONFIGURED' });
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.TWILIO_ACCOUNT_SID = originalSid;
    }
  });
});
