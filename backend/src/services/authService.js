const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');

const SALT_ROUNDS = 10;

async function register({ name, email, password, phone }) {
  if (!name || !email || !password) {
    throw new HttpError(400, 'Name, email and password are required');
  }
  if (password.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters');
  }

  const normalizedEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { name, email: normalizedEmail, passwordHash, phone: phone || '' },
  });

  return user;
}

async function login({ email, password }) {
  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  return user;
}

async function updateProfile(userId, { name, phone, address }) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });

  const data = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = phone;
  if (address !== undefined) {
    data.addressLine1 = address.line1 ?? existing.addressLine1;
    data.addressLine2 = address.line2 ?? existing.addressLine2;
    data.addressCity = address.city ?? existing.addressCity;
    data.addressState = address.state ?? existing.addressState;
    data.addressPincode = address.pincode ?? existing.addressPincode;
  }

  return prisma.user.update({ where: { id: userId }, data });
}

module.exports = { register, login, updateProfile };
