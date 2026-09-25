const { wallets, transactions } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { isPositiveNumber } = require('../utils/validate');

function getWalletByUser(userId) {
  return wallets.findOne((w) => w.userId === userId);
}

// GET /api/wallet
function getWallet(req, res) {
  const wallet = getWalletByUser(req.user.id);
  if (!wallet) return fail(res, 'Wallet tidak ditemukan', 404);
  return ok(res, wallet, 'Detail wallet');
}

// POST /api/wallet/topup
// Simulasi top up (mis. dari kartu debit/transfer bank eksternal)
function topup(req, res) {
  const { amount, source } = req.body;
  if (!isPositiveNumber(amount)) return fail(res, 'Nominal top up tidak valid', 422);

  const wallet = getWalletByUser(req.user.id);
  if (!wallet) return fail(res, 'Wallet tidak ditemukan', 404);

  const updated = wallets.updateById(wallet.id, { balance: wallet.balance + amount });

  const trx = transactions.insert({
    userId: req.user.id,
    type: 'topup',
    amount,
    category: 'Transfer & Keuangan',
    description: `Top up saldo dari ${source || 'sumber eksternal'}`,
    counterparty: source || 'Eksternal',
    status: 'success',
  });

  return ok(res, { wallet: updated, transaction: trx }, 'Top up berhasil', 201);
}

module.exports = { getWallet, topup, getWalletByUser };
