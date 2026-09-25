const { paylaterAccounts, paylaterTransactions, transactions, wallets } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { isPositiveNumber, required } = require('../utils/validate');
const { categorize } = require('../utils/categorize');

function getAccount(userId) {
  return paylaterAccounts.findOne((p) => p.userId === userId);
}

// POST /api/paylater/apply  -> ajukan/aktifkan fasilitas PayLater dengan limit tertentu
function apply(req, res) {
  const { requestedLimit } = req.body;
  let account = getAccount(req.user.id);

  if (account && account.status === 'active') {
    return fail(res, 'Anda sudah memiliki fasilitas PayLater aktif', 400);
  }

  const limit = isPositiveNumber(requestedLimit)
    ? Math.min(requestedLimit, 10000000) // batas atas simulasi: Rp10.000.000
    : Number(process.env.DEFAULT_PAYLATER_LIMIT || 2000000);

  account = account
    ? paylaterAccounts.updateById(account.id, { limit, used: 0, status: 'active' })
    : paylaterAccounts.insert({ userId: req.user.id, limit, used: 0, status: 'active' });

  return ok(res, account, 'Fasilitas PayLater berhasil diaktifkan', 201);
}

// GET /api/paylater
function getMyPaylater(req, res) {
  const account = getAccount(req.user.id);
  if (!account) return fail(res, 'Anda belum memiliki fasilitas PayLater', 404);

  const history = paylaterTransactions.find((t) => t.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return ok(res, { account, history }, 'Detail PayLater Anda');
}

// POST /api/paylater/transaction  -> gunakan PayLater untuk bayar merchant
function useForTransaction(req, res) {
  const { amount, merchantName, tenorMonths = 1 } = req.body;
  const errors = required(req.body, ['amount', 'merchantName']);
  if (!isPositiveNumber(amount)) errors.push('amount harus angka positif');
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  const account = getAccount(req.user.id);
  if (!account || account.status !== 'active') return fail(res, 'Fasilitas PayLater tidak aktif', 400);

  const available = account.limit - account.used;
  if (amount > available) {
    return fail(res, `Limit PayLater tidak mencukupi. Sisa limit: Rp${available.toLocaleString('id-ID')}`, 400);
  }

  paylaterAccounts.updateById(account.id, { used: account.used + amount });

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const paylaterTrx = paylaterTransactions.insert({
    userId: req.user.id,
    merchantName,
    amount,
    tenorMonths,
    outstanding: amount,
    status: 'unpaid',
    dueDate: dueDate.toISOString(),
  });

  transactions.insert({
    userId: req.user.id,
    type: 'paylater',
    amount,
    category: categorize(merchantName),
    description: `Beli sekarang bayar nanti di ${merchantName}`,
    counterparty: merchantName,
    status: 'success',
    channel: 'PAYLATER',
  });

  return ok(res, paylaterTrx, 'Transaksi PayLater berhasil dibuat', 201);
}

// POST /api/paylater/pay-bill  -> melunasi tagihan PayLater dari saldo wallet
function payBill(req, res) {
  const { paylaterTransactionId, amount } = req.body;
  const errors = required(req.body, ['paylaterTransactionId', 'amount']);
  if (!isPositiveNumber(amount)) errors.push('amount harus angka positif');
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  const bill = paylaterTransactions.findById(paylaterTransactionId);
  if (!bill || bill.userId !== req.user.id) return fail(res, 'Tagihan PayLater tidak ditemukan', 404);
  if (bill.status === 'paid') return fail(res, 'Tagihan ini sudah lunas', 400);
  if (amount > bill.outstanding) return fail(res, 'Nominal melebihi sisa tagihan', 400);

  const wallet = wallets.findOne((w) => w.userId === req.user.id);
  if (wallet.balance < amount) return fail(res, 'Saldo tidak mencukupi', 400);

  wallets.updateById(wallet.id, { balance: wallet.balance - amount });

  const newOutstanding = bill.outstanding - amount;
  const updatedBill = paylaterTransactions.updateById(bill.id, {
    outstanding: newOutstanding,
    status: newOutstanding <= 0 ? 'paid' : 'partial',
  });

  const account = getAccount(req.user.id);
  paylaterAccounts.updateById(account.id, { used: Math.max(0, account.used - amount) });

  transactions.insert({
    userId: req.user.id,
    type: 'transfer_out',
    amount,
    category: 'Transfer & Keuangan',
    description: `Pembayaran tagihan PayLater ${bill.merchantName}`,
    counterparty: 'PayLater',
    status: 'success',
    channel: 'PAYLATER_REPAYMENT',
  });

  return ok(res, updatedBill, 'Pembayaran tagihan PayLater berhasil');
}

module.exports = { apply, getMyPaylater, useForTransaction, payBill };
