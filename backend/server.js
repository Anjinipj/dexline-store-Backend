require('dotenv').config();

const app = require('./src/app');
const prisma = require('./src/lib/prisma');

const PORT = process.env.PORT || 5000;

prisma
  .$connect()
  .then(() => {
    console.log('PostgreSQL connected via Prisma');
    app.listen(PORT, () => {
      console.log(`Dexline Store API running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  });
