const { Prisma } = require('@prisma/client');

function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = err.meta?.target?.[0] || 'field';
      return res.status(409).json({ message: `${field} already exists` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Not found' });
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ message: 'This action violates a related record constraint' });
    }
  }

  if (err.name === 'MulterError' || /^Only .* images are allowed$/.test(err.message || '')) {
    return res.status(400).json({ message: err.message });
  }

  const status = err.statusCode || 500;
  res.status(status).json({ message: err.message || 'Server error' });
}

module.exports = { notFound, errorHandler };
