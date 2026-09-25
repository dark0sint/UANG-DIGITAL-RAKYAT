const { virtualAccounts, wallets, transactions, users } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { isPositiveNumber } = require('../utils/validate');

const BANK_CODES = { BCA: '014', MANDIRI: '008', BNI: '009', BRI: '002', PERMATA: '013' };

// POST /api/va
// Membuat nomor Virtual Account untuk menerima pembayaran tagihan otomatis
function createVA(req, res) {
  const { bankCode = 'BCA', label } = req.body;
  const code = BANK_CODES[bankCode.toUpperCase()];
  if (!code) return fail(res, `Kode bank tidak dikenali. Pilihan: ${Object.keys(BANK_CODES).join(', ')}`, 422);

  const vaNumber = `${code}${Date.now().toString().slice(-12)}`;

  const record = virtualAccounts.insert({
    userId: req.user.id,
    vaNumber,
    bankCode: bankCode.toUpperCase(),
    label: label || 'Virtual Account Pribadi',
    status: 'active',
  });

  return ok(res, record, 'Virtual Account berhasil dibuat', 201);
}

// GET /api/va
function listVA(req, res) {
  const list = virtualAccounts.find((v) => v.userId === req.user.id);
  return ok(res, list, 'Daftar Virtual Account Anda');
}

// POST /api/va/:vaNumber/pay
// Simulasi pembayaran tagihan masuk ke VA (mis. dari payment gateway / bank lain)
function payToVA(req, res) {
  const { vaNumber } = req.params;
  const { amount, payerName } = req.body;
  if (!isPositiveNumber(amount)) return fail(res, 'Nominal tidak valid', 422);

  const va = virtualAccounts.findOne((v) => v.vaNumber === vaNumber);
  if (!va) return fail(res, 'Nomor Virtual Account tidak ditemukan', 404);
  if (va.status !== 'active') return fail(res, 'Virtual Account tidak aktif', 400);

  const wallet = wallets.findOne((w) => w.userId === va.userId);
  if (!wallet) return fail(res, 'Wallet pemilik VA tidak ditemukan', 404);

  wallets.updateById(wallet.id, { balance: wallet.balance + amount });

  const trx = transactions.insert({
    userId: va.userId,
    type: 'va_payment',
    amount,
    category: 'Transfer & Keuangan',
    description: `Pembayaran masuk via VA ${va.bankCode} ${va.vaNumber}${payerName ? ` dari ${payerName}` : ''}`,
    counterparty: payerName || 'Pembayar Eksternal',
    status: 'success',
    channel: 'VIRTUAL_ACCOUNT',
  });

  return ok(res, trx, 'Pembayaran ke Virtual Account berhasil diterima', 201);
}

module.exports = { createVA, listVA, payToVA };
