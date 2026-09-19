const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const verificationService = require('../src/services/verificationService');
const generateToken = require('../src/utils/generateToken');
const { hmac } = require('../src/utils/tokens');
const verificationConfig = require('../src/config/verification');
const { createTestUser, deleteTestUser } = require('./helpers');

async function createOtpRow(user, code, overrides = {}) {
  return prisma.phoneVerification.create({
    data: {
      userId: user.id,
      phone: overrides.phone || user.phone,
      provider: 'console',
      codeHash: hmac(code, verificationConfig.otpHashSecret),
      maxAttempts: overrides.maxAttempts ?? 5,
      expiresAt: overrides.expiresAt || new Date(Date.now() + 5 * 60 * 1000),
    },
  });
}

describe('Phone OTP verification', () => {
  afterAll(async () => prisma.$disconnect());

  // Checked at the real interface boundary (the HTTP response), not the
  // internal service return value — the service's return value legitimately
  // carries the raw E.164 number for other backend code to use; what must
  // never happen is that raw number reaching the client.
  test('the /verification/phone/send response only ever exposes a masked number', async () => {
    const user = await createTestUser();
    try {
      const token = generateToken(user);
      const res = await request(app)
        .post('/api/verification/phone/send')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.maskedPhone).toMatch(/^\*+\d{4}$/);
      expect(JSON.stringify(res.body)).not.toContain(user.phone.slice(-8, -4));
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('an incorrect code is rejected and does not verify the phone', async () => {
    const user = await createTestUser();
    try {
      await createOtpRow(user, '654321');
      await expect(verificationService.confirmPhoneOtp(user, { code: '000000' })).rejects.toMatchObject({ statusCode: 400 });
      const fresh = await prisma.user.findUnique({ where: { id: user.id } });
      expect(fresh.phoneVerifiedAt).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('a correct code verifies the phone and sets phoneVerifiedAt', async () => {
    const user = await createTestUser();
    try {
      await createOtpRow(user, '654321');
      const updated = await verificationService.confirmPhoneOtp(user, { code: '654321' });
      expect(updated.phoneVerifiedAt).toBeInstanceOf(Date);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('a successful code cannot be reused (replay is rejected)', async () => {
    const user = await createTestUser();
    try {
      await createOtpRow(user, '111222');
      await verificationService.confirmPhoneOtp(user, { code: '111222' });
      await expect(verificationService.confirmPhoneOtp(user, { code: '111222' })).rejects.toMatchObject({ statusCode: 400 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('an expired code is rejected', async () => {
    const user = await createTestUser();
    try {
      await createOtpRow(user, '333444', { expiresAt: new Date(Date.now() - 1000) });
      await expect(verificationService.confirmPhoneOtp(user, { code: '333444' })).rejects.toMatchObject({ statusCode: 400 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('exceeding the max attempt count locks the challenge', async () => {
    const user = await createTestUser();
    try {
      await createOtpRow(user, '555666', { maxAttempts: 2 });
      await expect(verificationService.confirmPhoneOtp(user, { code: '000000' })).rejects.toMatchObject({ statusCode: 400 });
      await expect(verificationService.confirmPhoneOtp(user, { code: '000000' })).rejects.toMatchObject({ statusCode: 400 });
      // Third attempt hits the attempts>=maxAttempts guard specifically.
      await expect(verificationService.confirmPhoneOtp(user, { code: '555666' })).rejects.toMatchObject({ statusCode: 429 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('resend cooldown is enforced per account/number', async () => {
    const user = await createTestUser();
    try {
      await verificationService.sendPhoneOtp(user);
      await expect(verificationService.sendPhoneOtp(user)).rejects.toMatchObject({ statusCode: 429 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('daily send limit is enforced', async () => {
    const user = await createTestUser();
    try {
      // Seed maxSendsPerDay rows already "sent" today, each older than the
      // resend cooldown, so it's specifically the daily cap being tested
      // rather than the (much shorter) per-send cooldown.
      const max = verificationConfig.sms.maxSendsPerDay;
      for (let i = 0; i < max; i += 1) {
        await prisma.phoneVerification.create({
          data: {
            userId: user.id,
            phone: user.phone,
            provider: 'console',
            maxAttempts: 5,
            expiresAt: new Date(Date.now() + 60000),
            createdAt: new Date(Date.now() - (i + 1) * 70 * 1000),
          },
        });
      }
      await expect(verificationService.sendPhoneOtp(user)).rejects.toMatchObject({ statusCode: 429 });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
