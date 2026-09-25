const { budgets, transactions } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { isPositiveNumber, required } = require('../utils/validate');

// POST /api/budget
function setBudget(req, res) {
  const { category, monthlyLimit, month } = req.body;
  const errors = required(req.body, ['category', 'monthlyLimit']);
  if (!isPositiveNumber(monthlyLimit)) errors.push('monthlyLimit harus angka positif');
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const existing = budgets.findOne(
    (b) => b.userId === req.user.id && b.category === category && b.month === targetMonth
  );

  const record = existing
    ? budgets.updateById(existing.id, { monthlyLimit })
    : budgets.insert({ userId: req.user.id, category, monthlyLimit, month: targetMonth });

  return ok(res, record, 'Anggaran berhasil disimpan', existing ? 200 : 201);
}

// GET /api/budget
function listBudget(req, res) {
  const { month } = req.query;
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const list = budgets.find((b) => b.userId === req.user.id && b.month === targetMonth);
  return ok(res, list, 'Daftar anggaran');
}

// GET /api/budget/status  -> realisasi vs limit per kategori
function budgetStatus(req, res) {
  const { month } = req.query;
  const targetMonth = month || new Date().toISOString().slice(0, 7);

  const budgetList = budgets.find((b) => b.userId === req.user.id && b.month === targetMonth);
  const spendingTypes = ['transfer_out', 'qris_payment', 'va_payment', 'paylater'];
  const trx = transactions.find(
    (t) => t.userId === req.user.id && t.createdAt.slice(0, 7) === targetMonth && spendingTypes.includes(t.type)
  );

  const status = budgetList.map((b) => {
    const spent = trx.filter((t) => t.category === b.category).reduce((sum, t) => sum + t.amount, 0);
    return {
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      spent,
      remaining: b.monthlyLimit - spent,
      percentageUsed: Math.round((spent / b.monthlyLimit) * 100),
      isExceeded: spent > b.monthlyLimit,
    };
  });

  return ok(res, { month: targetMonth, status }, 'Status realisasi anggaran');
}

module.exports = { setBudget, listBudget, budgetStatus };
