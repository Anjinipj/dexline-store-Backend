const { PrismaClient } = require('@prisma/client');

// Singleton — required so nodemon hot-reloads don't spawn a new pool per reload
// and exhaust Postgres connections.
const prisma = global.__dexlinePrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__dexlinePrisma = prisma;
}

module.exports = prisma;
