const { wallets, transactions, users } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { isPositiveNumber } = require('../utils/validate');
const { categorize } = require('../utils/categorize');

// POST /api/transactions/transfer
// Simulasi transfer real-time antarbank ala BI-FAST: dikenali lewat email/nomor akun tujuan
function transfer(req, res) {
  const { targetAccountOrEmail, amount, note } = req.body;
  if (!targetAccountOrEmail) return fail(res, "Field 'targetAccountOrEmail' wajib diisi", 422);
  if (!isPositiveNumber(amount)) return fail(res, 'Nominal transfer tidak valid', 422);

  const senderWallet = wallets.findOne((w) => w.userId === req.user.id);
  if (!senderWallet) return fail(res, 'Wallet pengirim tidak ditemukan', 404);
  if (senderWallet.balance < amount) return fail(res, 'Saldo tidak mencukupi', 400);

  const targetUser = users.findOne(
    (u) => u.email.toLowerCase() === targetAccountOrEmail.toLowerCase()
  );
  const targetWallet = targetUser
    ? wallets.findOne((w) => w.userId === targetUser.id)
    : wallets.findOne((w) => w.accountNumber === targetAccountOrEmail);

  if (!targetWallet) return fail(res, 'Rekening/akun tujuan tidak ditemukan', 404);
  if (targetWallet.userId === req.user.id) return fail(res, 'Tidak dapat transfer ke diri sendiri', 400);

  // Biaya BI-FAST simulasi: flat Rp2.500 (real: mengikuti ketentuan BI, umumnya <= Rp2.500)
  const fee = 2500;
  if (senderWallet.balance < amount + fee) {
    return fail(res, `Saldo tidak mencukupi (termasuk biaya transfer Rp${fee})`, 400);
  }

  wallets.updateById(senderWallet.id, { balance: senderWallet.balance - amount - fee });
  wallets.updateById(targetWallet.id, { balance: targetWallet.balance + amount });

  const category = categorize(note || 'transfer');

  const outTrx = transactions.insert({
    userId: req.user.id,
    type: 'transfer_out',
    amount,
    fee,
    category,
    description: note || `Transfer ke ${targetAccountOrEmail}`,
    counterparty: targetAccountOrEmail,
    status: 'success',
    channel: 'BI-FAST',
  });

  transactions.insert({
    userId: targetWallet.userId,
    type: 'transfer_in',
    amount,
    fee: 0,
    category: 'Transfer & Keuangan',
    description: note || `Transfer masuk dari ${req.user.email}`,
    counterparty: req.user.email,
    status: 'success',
    channel: 'BI-FAST',
  });

  return ok(res, { transaction: outTrx, newBalance: senderWallet.balance - amount - fee }, 'Transfer berhasil', 201);
}

// GET /api/transactions  (mutasi rekening, dengan filter opsional)
function listTransactions(req, res) {
  const { type, category, startDate, endDate } = req.query;
  let result = transactions.find((t) => t.userId === req.user.id);

  if (type) result = result.filter((t) => t.type === type);
  if (category) result = result.filter((t) => t.category === category);
  if (startDate) result = result.filter((t) => new Date(t.createdAt) >= new Date(startDate));
  if (endDate) result = result.filter((t) => new Date(t.createdAt) <= new Date(endDate));

  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return ok(res, result, 'Mutasi rekening');
}

// GET /api/transactions/report  (grafik ringkasan bulanan)
function monthlyReport(req, res) {
  const { month } = req.query; // format: YYYY-MM, default bulan berjalan
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const trxThisMonth = transactions.find(
    (t) => t.userId === req.user.id && t.createdAt.slice(0, 7) === targetMonth
  );

  const totalIn = trxThisMonth
    .filter((t) => ['topup', 'transfer_in'].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOut = trxThisMonth
    .filter((t) => ['transfer_out', 'qris_payment', 'va_payment', 'paylater', 'investment_buy', 'lending_fund'].includes(t.type))
    .reduce((sum, t) => sum + t.amount, 0);

  const byCategory = {};
  trxThisMonth.forEach((t) => {
    if (!['transfer_out', 'qris_payment', 'va_payment', 'paylater'].includes(t.type)) return;
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  });

  const chartData = Object.entries(byCategory).map(([category, amount]) => ({ category, amount }));

  return ok(res, {
    month: targetMonth,
    totalPemasukan: totalIn,
    totalPengeluaran: totalOut,
    saldoBersih: totalIn - totalOut,
    grafikPerKategori: chartData,
    jumlahTransaksi: trxThisMonth.length,
  }, 'Laporan finansial bulanan');
}

module.exports = { transfer, listTransactions, monthlyReport };
