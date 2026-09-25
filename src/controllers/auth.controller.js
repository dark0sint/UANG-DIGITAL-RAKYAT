const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

const { users, wallets, securityLogs, paylaterAccounts } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { required, isEmail } = require('../utils/validate');

function signFullToken(user) {
  return jwt.sign({ sub: user.id, scope: 'full' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  });
}

function signTempToken(user) {
  return jwt.sign({ sub: user.id, scope: '2fa' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_TEMP_EXPIRES_IN || '5m',
  });
}

function sanitizeUser(user) {
  const { passwordHash, pinHash, totpSecret, biometricHash, ...safe } = user;
  return { ...safe, totpEnabled: !!user.totpEnabled, biometricEnabled: !!user.biometricEnabled };
}

function logSecurity(userId, action, req) {
  securityLogs.insert({
    userId,
    action,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
}

// POST /api/auth/register
function register(req, res) {
  const { name, email, password, pin, phone } = req.body;
  const errors = required(req.body, ['name', 'email', 'password', 'pin']);
  if (!isEmail(email || '')) errors.push("Field 'email' tidak valid");
  if (password && password.length < 8) errors.push('Password minimal 8 karakter');
  if (pin && !/^\d{6}$/.test(pin)) errors.push('PIN harus terdiri dari 6 digit angka');
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  if (users.findOne((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return fail(res, 'Email sudah terdaftar', 409);
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const pinHash = bcrypt.hashSync(pin, 10);

  const user = users.insert({
    name,
    email: email.toLowerCase(),
    phone: phone || null,
    passwordHash,
    pinHash,
    totpSecret: null,
    totpEnabled: false,
    biometricHash: null,
    biometricEnabled: false,
    isBlocked: false,
  });

  const wallet = wallets.insert({
    userId: user.id,
    accountNumber: `UDR${Date.now().toString().slice(-10)}`,
    balance: 0,
    currency: 'IDR',
  });

  paylaterAccounts.insert({
    userId: user.id,
    limit: Number(process.env.DEFAULT_PAYLATER_LIMIT || 2000000),
    used: 0,
    status: 'active',
  });

  logSecurity(user.id, 'REGISTER', req);

  return ok(res, { user: sanitizeUser(user), wallet }, 'Registrasi berhasil', 201);
}

// POST /api/auth/login
function login(req, res) {
  const { email, password } = req.body;
  const errors = required(req.body, ['email', 'password']);
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  const user = users.findOne((u) => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return fail(res, 'Email atau password salah', 401);
  }
  if (user.isBlocked) {
    return fail(res, 'Akun Anda sedang diblokir mandiri. Hubungi dukungan untuk membuka kembali.', 403);
  }

  if (user.totpEnabled) {
    const tempToken = signTempToken(user);
    logSecurity(user.id, 'LOGIN_STEP1_PASSWORD_OK', req);
    return ok(res, { requires2FA: true, tempToken }, 'Password benar, masukkan kode OTP aplikasi authenticator Anda');
  }

  const token = signFullToken(user);
  logSecurity(user.id, 'LOGIN_SUCCESS', req);
  return ok(res, { user: sanitizeUser(user), token }, 'Login berhasil');
}

// POST /api/auth/2fa/setup  (protected, full auth)
function setup2FA(req, res) {
  const user = req.user;
  const secret = speakeasy.generateSecret({
    name: `${process.env.APP_NAME || 'UangDigitalRakyat'} (${user.email})`,
  });

  users.updateById(user.id, { totpSecret: secret.base32, totpEnabled: false });

  qrcode.toDataURL(secret.otpauth_url, (err, qrDataUrl) => {
    if (err) return fail(res, 'Gagal membuat QR code 2FA', 500);
    return ok(res, {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeImage: qrDataUrl,
    }, 'Scan QR ini dengan Google Authenticator / Authy, lalu verifikasi dengan /api/auth/2fa/verify');
  });
}

// POST /api/auth/2fa/verify (protected, full auth) - mengaktifkan 2FA setelah setup
function verify2FA(req, res) {
  const user = req.user;
  const { token } = req.body;
  if (!token) return fail(res, "Field 'token' wajib diisi", 422);
  if (!user.totpSecret) return fail(res, 'Anda belum melakukan setup 2FA', 400);

  const verified = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token,
    window: 1,
  });

  if (!verified) return fail(res, 'Kode OTP tidak valid', 400);

  users.updateById(user.id, { totpEnabled: true });
  logSecurity(user.id, '2FA_ENABLED', req);
  return ok(res, null, 'Two-Factor Authentication berhasil diaktifkan');
}

// POST /api/auth/2fa/disable (protected, full auth)
function disable2FA(req, res) {
  users.updateById(req.user.id, { totpEnabled: false, totpSecret: null });
  logSecurity(req.user.id, '2FA_DISABLED', req);
  return ok(res, null, 'Two-Factor Authentication dinonaktifkan');
}

// POST /api/auth/2fa/login-verify (temp auth) - tahap 2 login
function loginVerify2FA(req, res) {
  const user = req.user;
  const { token } = req.body;
  if (!token) return fail(res, "Field 'token' wajib diisi", 422);

  const verified = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: 'base32',
    token,
    window: 1,
  });

  if (!verified) return fail(res, 'Kode OTP tidak valid', 400);

  const fullToken = signFullToken(user);
  logSecurity(user.id, 'LOGIN_SUCCESS_2FA', req);
  return ok(res, { user: sanitizeUser(user), token: fullToken }, 'Login berhasil');
}

// POST /api/auth/biometric/register (protected, full auth)
// Simulasi: client mengirim `biometricToken` unik dari perangkat (mis. hasil Face ID/Fingerprint SDK)
function registerBiometric(req, res) {
  const { biometricToken } = req.body;
  if (!biometricToken) return fail(res, "Field 'biometricToken' wajib diisi", 422);

  const biometricHash = bcrypt.hashSync(biometricToken, 10);
  users.updateById(req.user.id, { biometricHash, biometricEnabled: true });
  logSecurity(req.user.id, 'BIOMETRIC_REGISTERED', req);
  return ok(res, null, 'Biometrik (sidik jari/wajah) berhasil didaftarkan untuk akun ini');
}

// POST /api/auth/biometric/login
function loginBiometric(req, res) {
  const { email, biometricToken } = req.body;
  const errors = required(req.body, ['email', 'biometricToken']);
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  const user = users.findOne((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.biometricEnabled || !user.biometricHash) {
    return fail(res, 'Biometrik belum terdaftar untuk akun ini', 401);
  }
  if (user.isBlocked) {
    return fail(res, 'Akun Anda sedang diblokir mandiri.', 403);
  }
  if (!bcrypt.compareSync(biometricToken, user.biometricHash)) {
    return fail(res, 'Verifikasi biometrik gagal', 401);
  }

  const token = signFullToken(user);
  logSecurity(user.id, 'LOGIN_SUCCESS_BIOMETRIC', req);
  return ok(res, { user: sanitizeUser(user), token }, 'Login biometrik berhasil');
}

// GET /api/auth/me (protected)
function me(req, res) {
  return ok(res, sanitizeUser(req.user), 'Profil pengguna');
}

module.exports = {
  register,
  login,
  setup2FA,
  verify2FA,
  disable2FA,
  loginVerify2FA,
  registerBiometric,
  loginBiometric,
  me,
  sanitizeUser,
};
