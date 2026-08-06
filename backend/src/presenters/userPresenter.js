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
  });
}

module.exports = { toView };
