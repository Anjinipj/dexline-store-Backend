const prisma = require('../lib/prisma');
const HttpError = require('../errors/HttpError');

async function listAllAdmin() {
  return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
}

async function getById(id) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) {
    throw new HttpError(404, 'Coupon not found');
  }
  return coupon;
}

function assertValueBounds(type, value, minOrderAmount) {
  if (value < 0) {
    throw new HttpError(400, 'Value cannot be negative');
  }
  if (type === 'PERCENTAGE' && value > 100) {
    throw new HttpError(400, 'A percentage coupon cannot exceed 100');
  }
  if (minOrderAmount !== undefined && minOrderAmount !== null && minOrderAmount < 0) {
    throw new HttpError(400, 'Minimum order amount cannot be negative');
  }
}

async function create({ code, type, value, isActive, expiresAt, minOrderAmount }) {
  if (!code || !type || value === undefined) {
    throw new HttpError(400, 'Code, type and value are required');
  }
  if (!['PERCENTAGE', 'FIXED'].includes(type)) {
    throw new HttpError(400, 'Type must be PERCENTAGE or FIXED');
  }
  assertValueBounds(type, Number(value), minOrderAmount === undefined ? undefined : Number(minOrderAmount));

  return prisma.coupon.create({
    data: {
      code: code.toUpperCase().trim(),
      type,
      value,
      isActive: isActive ?? true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      minOrderAmount: minOrderAmount ?? null,
    },
  });
}

async function update(id, body) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Coupon not found');
  }

  const data = {};
  if (body.code !== undefined) data.code = body.code.toUpperCase().trim();
  if (body.type !== undefined) {
    if (!['PERCENTAGE', 'FIXED'].includes(body.type)) {
      throw new HttpError(400, 'Type must be PERCENTAGE or FIXED');
    }
    data.type = body.type;
  }
  if (body.value !== undefined) data.value = body.value;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.minOrderAmount !== undefined) data.minOrderAmount = body.minOrderAmount || null;

  const effectiveType = data.type ?? existing.type;
  const effectiveValue = data.value !== undefined ? Number(data.value) : Number(existing.value);
  const effectiveMin =
    data.minOrderAmount !== undefined
      ? data.minOrderAmount === null
        ? null
        : Number(data.minOrderAmount)
      : existing.minOrderAmount === null
        ? null
        : Number(existing.minOrderAmount);
  assertValueBounds(effectiveType, effectiveValue, effectiveMin === null ? undefined : effectiveMin);

  return prisma.coupon.update({ where: { id }, data });
}

async function remove(id) {
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, 'Coupon not found');
  }
  await prisma.coupon.delete({ where: { id } });
}

// The single source of truth for coupon validation — used both by the
// checkout-preview endpoint and by orderService.createOrder inside its own
// transaction (txClient lets it run against either the default client or an
// active $transaction client). Returns the coupon plus the computed discount;
// never trusts a client-supplied discount amount.
async function findValidCoupon(code, subtotal, txClient = prisma) {
  if (!code) {
    throw new HttpError(400, 'Coupon code is required');
  }

  const coupon = await txClient.coupon.findUnique({ where: { code: code.toUpperCase().trim() } });
  if (!coupon) {
    throw new HttpError(404, 'Invalid coupon code');
  }
  if (!coupon.isActive) {
    throw new HttpError(400, 'This coupon is no longer active');
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new HttpError(400, 'This coupon has expired');
  }
  const minOrderAmount = coupon.minOrderAmount === null ? null : Number(coupon.minOrderAmount);
  if (minOrderAmount !== null && subtotal < minOrderAmount) {
    throw new HttpError(400, `Minimum order amount of ₹${minOrderAmount} not met`);
  }

  const value = Number(coupon.value);
  const discountAmount =
    coupon.type === 'PERCENTAGE' ? Math.round(subtotal * (value / 100) * 100) / 100 : Math.min(value, subtotal);

  return { coupon, discountAmount };
}

module.exports = { listAllAdmin, getById, create, update, remove, findValidCoupon };
