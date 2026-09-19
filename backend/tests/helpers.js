const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

// Tests run against the real dev database (no separate test-DB/CI
// infrastructure exists in this project yet) — every helper here creates
// clearly-tagged rows and every test file cleans up what it created.
async function createTestUser(overrides = {}) {
  const email = overrides.email || `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const phone = overrides.phone || `+9715${Math.floor(10000000 + Math.random() * 89999999)}`;
  return prisma.user.create({
    data: {
      name: overrides.name || 'Test User',
      email,
      passwordHash: await bcrypt.hash(overrides.password || 'password123', 4),
      phone,
      status: overrides.status || 'pending_verification',
    },
  });
}

async function deleteTestUser(userId) {
  if (!userId) return;
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  await prisma.phoneVerification.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

async function deleteTestUserByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) await deleteTestUser(user.id);
}

module.exports = { createTestUser, deleteTestUser, deleteTestUserByEmail };
