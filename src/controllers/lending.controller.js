const { loans, wallets, transactions } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { isPositiveNumber, required } = require('../utils/validate');

// POST /api/lending/offer  -> pemberi dana menawarkan pendanaan (lender)
function createOffer(req, res) {
  const { amount, interestRate, tenorMonths } = req.body;
  const errors = required(req.body, ['amount', 'interestRate', 'tenorMonths']);
  if (!isPositiveNumber(amount)) errors.push('amount harus angka positif');
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  const wallet = wallets.findOne((w) => w.userId === req.user.id);
  if (wallet.balance < amount) return fail(res, 'Saldo tidak mencukupi untuk membuat penawaran dana', 400);

  const loan = loans.insert({
    type: 'offer', // dana tersedia dari lender, menunggu peminjam
    lenderId: req.user.id,
    borrowerId: null,
    amount,
    interestRate,
    tenorMonths,
    outstanding: amount,
    status: 'open',
  });

  return ok(res, loan, 'Penawaran pendanaan P2P berhasil dibuat', 201);
}

// POST /api/lending/request  -> peminjam mengajukan permintaan pinjaman
function createRequest(req, res) {
  const { amount, interestRate, tenorMonths } = req.body;
  const errors = required(req.body, ['amount', 'interestRate', 'tenorMonths']);
  if (!isPositiveNumber(amount)) errors.push('amount harus angka positif');
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  const loan = loans.insert({
    type: 'request',
    lenderId: null,
    borrowerId: req.user.id,
    amount,
    interestRate,
    tenorMonths,
    outstanding: amount,
    status: 'open',
  });

  return ok(res, loan, 'Permintaan pinjaman P2P berhasil diajukan', 201);
}

// GET /api/lending  -> daftar semua penawaran & permintaan yang masih terbuka + milik sendiri
function list(req, res) {
  const { status } = req.query;
  let result = loans.all();
  if (status) result = result.filter((l) => l.status === status);
  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return ok(res, result, 'Daftar marketplace P2P Lending');
}

// POST /api/lending/:id/fund  -> lender mendanai sebuah permintaan (request) yang terbuka
function fund(req, res) {
  const loan = loans.findById(req.params.id);
  if (!loan) return fail(res, 'Penawaran/permintaan tidak ditemukan', 404);
  if (loan.type !== 'request') return fail(res, 'Hanya permintaan pinjaman yang bisa didanai', 400);
  if (loan.status !== 'open') return fail(res, 'Permintaan ini sudah tidak terbuka', 400);
  if (loan.borrowerId === req.user.id) return fail(res, 'Tidak dapat mendanai permintaan sendiri', 400);

  const lenderWallet = wallets.findOne((w) => w.userId === req.user.id);
  const borrowerWallet = wallets.findOne((w) => w.userId === loan.borrowerId);
  if (lenderWallet.balance < loan.amount) return fail(res, 'Saldo tidak mencukupi untuk mendanai', 400);

  wallets.updateById(lenderWallet.id, { balance: lenderWallet.balance - loan.amount });
  wallets.updateById(borrowerWallet.id, { balance: borrowerWallet.balance + loan.amount });

  const updated = loans.updateById(loan.id, {
    lenderId: req.user.id,
    status: 'funded',
    fundedAt: new Date().toISOString(),
  });

  transactions.insert({
    userId: req.user.id,
    type: 'lending_fund',
    amount: loan.amount,
    category: 'Transfer & Keuangan',
    description: 'Pendanaan P2P Lending',
    counterparty: loan.borrowerId,
    status: 'success',
    channel: 'P2P_LENDING',
  });

  transactions.insert({
    userId: loan.borrowerId,
    type: 'transfer_in',
    amount: loan.amount,
    category: 'Transfer & Keuangan',
    description: 'Dana pinjaman P2P diterima',
    counterparty: req.user.id,
    status: 'success',
    channel: 'P2P_LENDING',
  });

  return ok(res, updated, 'Pendanaan berhasil, dana telah dikirim ke peminjam');
}

// POST /api/lending/:id/accept  -> peminjam menerima sebuah penawaran dana (offer) dari lender
function acceptOffer(req, res) {
  const loan = loans.findById(req.params.id);
  if (!loan) return fail(res, 'Penawaran tidak ditemukan', 404);
  if (loan.type !== 'offer') return fail(res, 'Hanya penawaran dana yang bisa diterima dengan cara ini', 400);
  if (loan.status !== 'open') return fail(res, 'Penawaran ini sudah tidak terbuka', 400);
  if (loan.lenderId === req.user.id) return fail(res, 'Tidak dapat menerima penawaran sendiri', 400);

  const lenderWallet = wallets.findOne((w) => w.userId === loan.lenderId);
  const borrowerWallet = wallets.findOne((w) => w.userId === req.user.id);
  if (lenderWallet.balance < loan.amount) return fail(res, 'Saldo pemberi dana tidak lagi mencukupi', 400);

  wallets.updateById(lenderWallet.id, { balance: lenderWallet.balance - loan.amount });
  wallets.updateById(borrowerWallet.id, { balance: borrowerWallet.balance + loan.amount });

  const updated = loans.updateById(loan.id, {
    borrowerId: req.user.id,
    status: 'funded',
    fundedAt: new Date().toISOString(),
  });

  transactions.insert({
    userId: loan.lenderId,
    type: 'lending_fund',
    amount: loan.amount,
    category: 'Transfer & Keuangan',
    description: 'Pendanaan P2P Lending (penawaran diterima)',
    counterparty: req.user.id,
    status: 'success',
    channel: 'P2P_LENDING',
  });

  transactions.insert({
    userId: req.user.id,
    type: 'transfer_in',
    amount: loan.amount,
    category: 'Transfer & Keuangan',
    description: 'Dana pinjaman P2P diterima',
    counterparty: loan.lenderId,
    status: 'success',
    channel: 'P2P_LENDING',
  });

  return ok(res, updated, 'Penawaran dana berhasil diterima, dana telah cair ke wallet Anda');
}

// POST /api/lending/:id/repay  -> peminjam membayar cicilan/pelunasan
function repay(req, res) {
  const { amount } = req.body;
  if (!isPositiveNumber(amount)) return fail(res, 'Nominal pembayaran tidak valid', 422);

  const loan = loans.findById(req.params.id);
  if (!loan) return fail(res, 'Pinjaman tidak ditemukan', 404);
  if (loan.borrowerId !== req.user.id) return fail(res, 'Anda bukan peminjam pada pinjaman ini', 403);
  if (loan.status !== 'funded') return fail(res, 'Pinjaman ini belum aktif/sudah lunas', 400);

  const borrowerWallet = wallets.findOne((w) => w.userId === req.user.id);
  const lenderWallet = wallets.findOne((w) => w.userId === loan.lenderId);
  if (borrowerWallet.balance < amount) return fail(res, 'Saldo tidak mencukupi', 400);
  if (amount > loan.outstanding) return fail(res, 'Nominal melebihi sisa pinjaman', 400);

  wallets.updateById(borrowerWallet.id, { balance: borrowerWallet.balance - amount });
  wallets.updateById(lenderWallet.id, { balance: lenderWallet.balance + amount });

  const newOutstanding = loan.outstanding - amount;
  const updated = loans.updateById(loan.id, {
    outstanding: newOutstanding,
    status: newOutstanding <= 0 ? 'settled' : 'funded',
  });

  transactions.insert({
    userId: req.user.id,
    type: 'transfer_out',
    amount,
    category: 'Transfer & Keuangan',
    description: 'Pembayaran cicilan/pelunasan P2P Lending',
    counterparty: loan.lenderId,
    status: 'success',
    channel: 'P2P_LENDING_REPAYMENT',
  });

  return ok(res, updated, 'Pembayaran pinjaman berhasil');
}

module.exports = { createOffer, createRequest, list, fund, acceptOffer, repay };
