const bcrypt = require('bcryptjs');
const { users, securityLogs } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { required } = require('../utils/validate');

function log(userId, action, req) {
  securityLogs.insert({
    userId,
    action,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
}

// POST /api/security/block
// Fitur "Blokir Mandiri": mematikan akses akun sendiri, misalnya saat dicurigai terjadi penipuan
// atau perangkat/kartu hilang. Verifikasi menggunakan PIN untuk mencegah blokir tidak sengaja.
function blockSelf(req, res) {
  const { pin, reason } = req.body;
  const errors = required(req.body, ['pin']);
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  if (!bcrypt.compareSync(pin, req.user.pinHash)) {
    return fail(res, 'PIN salah', 401);
  }

  users.updateById(req.user.id, { isBlocked: true, blockedReason: reason || 'Diblokir oleh pengguna', blockedAt: new Date().toISOString() });
  log(req.user.id, `SELF_BLOCK: ${reason || 'tanpa alasan'}`, req);

  return ok(res, null, 'Akun Anda berhasil diblokir. Semua transaksi dihentikan sementara demi keamanan.');
}

// POST /api/security/unblock
// Simulasi pembukaan blokir mandiri: memerlukan password + PIN sebagai verifikasi tambahan
function unblockSelf(req, res) {
  const { password, pin } = req.body;
  const errors = required(req.body, ['password', 'pin']);
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  if (!bcrypt.compareSync(password, req.user.passwordHash) || !bcrypt.compareSync(pin, req.user.pinHash)) {
    return fail(res, 'Verifikasi gagal, periksa kembali password dan PIN Anda', 401);
  }

  users.updateById(req.user.id, { isBlocked: false, blockedReason: null, blockedAt: null });
  log(req.user.id, 'SELF_UNBLOCK', req);

  return ok(res, null, 'Akun Anda berhasil dibuka kembali');
}

// POST /api/security/change-pin
function changePin(req, res) {
  const { oldPin, newPin } = req.body;
  const errors = required(req.body, ['oldPin', 'newPin']);
  if (newPin && !/^\d{6}$/.test(newPin)) errors.push('PIN baru harus terdiri dari 6 digit angka');
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  if (!bcrypt.compareSync(oldPin, req.user.pinHash)) {
    return fail(res, 'PIN lama salah', 401);
  }

  users.updateById(req.user.id, { pinHash: bcrypt.hashSync(newPin, 10) });
  log(req.user.id, 'PIN_CHANGED', req);

  return ok(res, null, 'PIN berhasil diubah');
}

// GET /api/security/logs
function getLogs(req, res) {
  const logs = securityLogs
    .find((l) => l.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return ok(res, logs, 'Riwayat aktivitas keamanan akun');
}

module.exports = { blockSelf, unblockSelf, changePin, getLogs };
