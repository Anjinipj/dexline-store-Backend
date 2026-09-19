const { mapId, buildAddress } = require('./shared');

function toView(user) {
  if (!user) return user;
  return mapId({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: buildAddress(user, 'address'),
    role: user.role,
    status: user.status,
    // Booleans are what the UI needs; the raw timestamps stay the backend's
    // actual source of truth (see verificationService) and are included too
    // for transparency/debugging.
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    emailVerifiedAt: user.emailVerifiedAt,
    phoneVerifiedAt: user.phoneVerifiedAt,
    pendingEmail: user.pendingEmail || null,
    pendingPhone: user.pendingPhone || null,
  });
}

module.exports = { toView };
