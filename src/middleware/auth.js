const jwt = require('jsonwebtoken');
const { fail } = require('../utils/response');
const { users } = require('../config/db');

/**
 * Memverifikasi token akses penuh (scope: full).
 * Menolak akses jika akun sedang diblokir mandiri (kecuali endpoint unblock).
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 'Token akses tidak ditemukan', 401);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.scope !== 'full') {
      return fail(res, 'Token tidak valid untuk akses ini', 401);
    }
    const user = users.findById(payload.sub);
    if (!user) return fail(res, 'Pengguna tidak ditemukan', 401);
    if (user.isBlocked && req.path !== '/unblock') {
      return fail(res, 'Akun Anda sedang diblokir mandiri. Hubungi dukungan untuk membuka kembali.', 403);
    }
    req.user = user;
    next();
  } catch (err) {
    return fail(res, 'Token tidak valid atau sudah kedaluwarsa', 401);
  }
}

/**
 * Memverifikasi token sementara (scope: 2fa) yang dipakai khusus
 * pada tahap kedua login (verifikasi kode OTP TOTP).
 */
function requireTempAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 'Token sementara tidak ditemukan', 401);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.scope !== '2fa') {
      return fail(res, 'Token tidak valid untuk tahap ini', 401);
    }
    const user = users.findById(payload.sub);
    if (!user) return fail(res, 'Pengguna tidak ditemukan', 401);
    req.user = user;
    next();
  } catch (err) {
    return fail(res, 'Token sementara tidak valid atau sudah kedaluwarsa', 401);
  }
}

module.exports = { requireAuth, requireTempAuth };
