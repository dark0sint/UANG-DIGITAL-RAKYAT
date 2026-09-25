const { fail } = require('../utils/response');

function notFoundHandler(req, res) {
  return fail(res, `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan`, 404);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);
  return fail(res, 'Terjadi kesalahan pada server', 500, process.env.NODE_ENV === 'production' ? null : err.message);
}

module.exports = { notFoundHandler, errorHandler };
