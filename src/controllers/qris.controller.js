const qrcode = require('qrcode');
const { qris, wallets, transactions, users } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { isPositiveNumber } = require('../utils/validate');
const { categorize } = require('../utils/categorize');

// POST /api/qris/generate
// Merchant/pengguna membuat kode QRIS (statis tanpa nominal, atau dinamis dengan nominal)
function generate(req, res) {
  const { amount, merchantName } = req.body;
  if (amount !== undefined && !isPositiveNumber(amount)) {
    return fail(res, 'Nominal tidak valid', 422);
  }

  const code = `ID.CO.QRIS.WWW01${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

  const record = qris.insert({
    userId: req.user.id,
    code,
    amount: amount || null, // null = QR statis, nominal diisi oleh pembayar
    merchantName: merchantName || req.user.name,
    status: 'unpaid',
  });

  qrcode.toDataURL(code, (err, qrImage) => {
    if (err) return fail(res, 'Gagal membuat gambar QR', 500);
    return ok(res, { ...record, qrCodeImage: qrImage }, 'Kode QRIS berhasil dibuat', 201);
  });
}

// GET /api/qris/:code
function getByCode(req, res) {
  const record = qris.findOne((q) => q.code === req.params.code);
  if (!record) return fail(res, 'Kode QRIS tidak ditemukan', 404);
  return ok(res, record, 'Detail QRIS');
}

// POST /api/qris/pay
// Pengguna men-scan lalu membayar QRIS milik merchant/pengguna lain
function pay(req, res) {
  const { code, amount } = req.body;
  if (!code) return fail(res, "Field 'code' wajib diisi", 422);

  const record = qris.findOne((q) => q.code === code);
  if (!record) return fail(res, 'Kode QRIS tidak ditemukan', 404);
  if (record.status === 'paid') return fail(res, 'Kode QRIS ini sudah dibayar', 400);
  if (record.userId === req.user.id) return fail(res, 'Tidak dapat membayar QRIS milik sendiri', 400);

  const payAmount = record.amount || amount;
  if (!isPositiveNumber(payAmount)) return fail(res, 'Nominal pembayaran tidak valid', 422);

  const payerWallet = wallets.findOne((w) => w.userId === req.user.id);
  const merchantWallet = wallets.findOne((w) => w.userId === record.userId);
  if (!payerWallet || !merchantWallet) return fail(res, 'Wallet tidak ditemukan', 404);
  if (payerWallet.balance < payAmount) return fail(res, 'Saldo tidak mencukupi', 400);

  wallets.updateById(payerWallet.id, { balance: payerWallet.balance - payAmount });
  wallets.updateById(merchantWallet.id, { balance: merchantWallet.balance + payAmount });
  qris.updateById(record.id, { status: 'paid', paidAmount: payAmount, paidBy: req.user.id, paidAt: new Date().toISOString() });

  const category = categorize(record.merchantName);

  const trx = transactions.insert({
    userId: req.user.id,
    type: 'qris_payment',
    amount: payAmount,
    category,
    description: `Pembayaran QRIS ke ${record.merchantName}`,
    counterparty: record.merchantName,
    status: 'success',
    channel: 'QRIS',
  });

  const merchant = users.findById(record.userId);
  transactions.insert({
    userId: record.userId,
    type: 'transfer_in',
    amount: payAmount,
    category: 'Transfer & Keuangan',
    description: `Penerimaan QRIS dari ${req.user.name}`,
    counterparty: req.user.name,
    status: 'success',
    channel: 'QRIS',
  });

  return ok(res, { transaction: trx, merchant: merchant ? merchant.name : null }, 'Pembayaran QRIS berhasil');
}

module.exports = { generate, getByCode, pay };
