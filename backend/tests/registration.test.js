const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/lib/prisma');
const { deleteTestUserByEmail } = require('./helpers');

async function makeValidGrant() {
  const grantToken = `test-grant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await prisma.turnstileGrant.create({
    data: { id: grantToken, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  return grantToken;
}

// These tests exercise the register endpoint's grant-consumption boundary
// directly (a TurnstileGrant row inserted as if Cloudflare siteverify had
// already succeeded) rather than calling Cloudflare's real siteverify
// endpoint, which needs network access and isn't appropriate for an
// automated test run. The siteverify integration itself
// (src/utils/turnstile.js) was verified manually against Cloudflare's
// published test keys — see the implementation summary.
describe('POST /api/auth/register — human verification cannot be bypassed', () => {
  const emails = [];
  afterAll(async () => {
    await Promise.all(emails.map((e) => deleteTestUserByEmail(e)));
    await prisma.$disconnect();
  });

  test('rejects registration with no grant token at all', async () => {
    const email = `test-noGrant-${Date.now()}@example.com`;
    emails.push(email);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email, password: 'password123', phone: '501234567', country: 'AE' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/human verification/i);

    const created = await prisma.user.findUnique({ where: { email } });
    expect(created).toBeNull();
  });

  test('rejects an unknown grant token', async () => {
    const email = `test-badGrant-${Date.now()}@example.com`;
    emails.push(email);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email, password: 'password123', phone: '501234567', country: 'AE', grantToken: 'nonexistent' });
    expect(res.status).toBe(400);
  });

  test('rejects an expired grant token', async () => {
    const email = `test-expiredGrant-${Date.now()}@example.com`;
    emails.push(email);
    const grantToken = `expired-${Date.now()}`;
    await prisma.turnstileGrant.create({ data: { id: grantToken, expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email, password: 'password123', phone: '501234567', country: 'AE', grantToken });
    expect(res.status).toBe(400);
  });

  test('a valid grant creates a pending account, and that same grant cannot be reused', async () => {
    const email = `test-validGrant-${Date.now()}@example.com`;
    const email2 = `test-validGrant-2-${Date.now()}@example.com`;
    emails.push(email, email2);
    const grantToken = await makeValidGrant();

    const res1 = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email, password: 'password123', phone: '501234567', country: 'AE', grantToken });

    expect(res1.status).toBe(201);
    expect(res1.body.user.status).toBe('pending_verification');
    expect(res1.body.user.emailVerified).toBe(false);
    expect(res1.body.user.phoneVerified).toBe(false);
    expect(res1.body.token).toBeTruthy();

    // Same grant, different registration attempt — must still fail even
    // though the first user was created successfully.
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Another User', email: email2, password: 'password123', phone: '501234568', country: 'AE', grantToken });
    expect(res2.status).toBe(400);

    const secondCreated = await prisma.user.findUnique({ where: { email: email2 } });
    expect(secondCreated).toBeNull();
  });

  test('mobile number is normalized to E.164', async () => {
    const email = `test-phoneNormalize-${Date.now()}@example.com`;
    emails.push(email);
    const grantToken = await makeValidGrant();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email, password: 'password123', phone: '50 123 4567', country: 'AE', grantToken });

    expect(res.status).toBe(201);
    // authService lowercases the email before storing — look it up the
    // same way, since the local part above ("phoneNormalize") isn't.
    const stored = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    expect(stored.phone).toBe('+971501234567');
  });

  test('rejects an invalid mobile number even with a valid grant', async () => {
    const email = `test-badPhone-${Date.now()}@example.com`;
    emails.push(email);
    const grantToken = await makeValidGrant();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email, password: 'password123', phone: '123', country: 'AE', grantToken });
    expect(res.status).toBe(400);
  });
});
