const { investmentProducts, investmentHoldings, wallets, transactions } = require('../config/db');
const { ok, fail } = require('../utils/response');
const { isPositiveNumber, required } = require('../utils/validate');

// Seed produk investasi default jika belum ada (jalan otomatis saat server start)
function ensureSeedProducts() {
  if (investmentProducts.all().length > 0) return;
  const defaults = [
    { code: 'RDPU01', name: 'Reksa Dana Pasar Uang', type: 'reksadana', pricePerUnit: 1000, riskLevel: 'Rendah' },
    { code: 'RDS01', name: 'Reksa Dana Saham Nusantara', type: 'reksadana', pricePerUnit: 1500, riskLevel: 'Tinggi' },
    { code: 'BBCA', name: 'Saham PT Bank Central Asia Tbk', type: 'saham', pricePerUnit: 9500, riskLevel: 'Tinggi' },
    { code: 'TLKM', name: 'Saham PT Telkom Indonesia Tbk', type: 'saham', pricePerUnit: 3200, riskLevel: 'Sedang' },
    { code: 'EMAS01', name: 'Emas Digital 24 Karat', type: 'emas', pricePerUnit: 1150000, riskLevel: 'Rendah' },
  ];
  defaults.forEach((p) => investmentProducts.insert(p));
}

// GET /api/investment/products
function listProducts(req, res) {
  return ok(res, investmentProducts.all(), 'Daftar produk investasi mikro');
}

// POST /api/investment/buy
function buy(req, res) {
  const { productCode, amount } = req.body;
  const errors = required(req.body, ['productCode', 'amount']);
  if (!isPositiveNumber(amount)) errors.push('amount harus angka positif');
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  const product = investmentProducts.findOne((p) => p.code === productCode);
  if (!product) return fail(res, 'Produk investasi tidak ditemukan', 404);

  const wallet = wallets.findOne((w) => w.userId === req.user.id);
  if (wallet.balance < amount) return fail(res, 'Saldo tidak mencukupi', 400);

  const units = Number((amount / product.pricePerUnit).toFixed(6));

  wallets.updateById(wallet.id, { balance: wallet.balance - amount });

  let holding = investmentHoldings.findOne(
    (h) => h.userId === req.user.id && h.productCode === productCode
  );
  if (holding) {
    holding = investmentHoldings.updateById(holding.id, {
      units: holding.units + units,
      totalInvested: holding.totalInvested + amount,
    });
  } else {
    holding = investmentHoldings.insert({
      userId: req.user.id,
      productCode,
      productName: product.name,
      units,
      totalInvested: amount,
    });
  }

  transactions.insert({
    userId: req.user.id,
    type: 'investment_buy',
    amount,
    category: 'Transfer & Keuangan',
    description: `Pembelian investasi ${product.name}`,
    counterparty: product.name,
    status: 'success',
    channel: 'INVESTMENT',
  });

  return ok(res, holding, 'Pembelian instrumen investasi berhasil', 201);
}

// POST /api/investment/sell
function sell(req, res) {
  const { productCode, units } = req.body;
  const errors = required(req.body, ['productCode', 'units']);
  if (!isPositiveNumber(units)) errors.push('units harus angka positif');
  if (errors.length) return fail(res, 'Validasi gagal', 422, errors);

  const product = investmentProducts.findOne((p) => p.code === productCode);
  if (!product) return fail(res, 'Produk investasi tidak ditemukan', 404);

  const holding = investmentHoldings.findOne(
    (h) => h.userId === req.user.id && h.productCode === productCode
  );
  if (!holding || holding.units < units) return fail(res, 'Jumlah unit tidak mencukupi', 400);

  const proceeds = Number((units * product.pricePerUnit).toFixed(2));
  const remainingUnits = Number((holding.units - units).toFixed(6));

  investmentHoldings.updateById(holding.id, {
    units: remainingUnits,
    totalInvested: Math.max(0, holding.totalInvested - proceeds),
  });

  const wallet = wallets.findOne((w) => w.userId === req.user.id);
  wallets.updateById(wallet.id, { balance: wallet.balance + proceeds });

  transactions.insert({
    userId: req.user.id,
    type: 'transfer_in',
    amount: proceeds,
    category: 'Transfer & Keuangan',
    description: `Penjualan investasi ${product.name}`,
    counterparty: product.name,
    status: 'success',
    channel: 'INVESTMENT',
  });

  return ok(res, { proceeds, remainingUnits }, 'Penjualan instrumen investasi berhasil');
}

// GET /api/investment/portfolio
function portfolio(req, res) {
  const holdings = investmentHoldings.find((h) => h.userId === req.user.id && h.units > 0);

  const enriched = holdings.map((h) => {
    const product = investmentProducts.findOne((p) => p.code === h.productCode);
    const currentValue = product ? Number((h.units * product.pricePerUnit).toFixed(2)) : 0;
    return {
      ...h,
      currentPricePerUnit: product ? product.pricePerUnit : null,
      currentValue,
      gainLoss: currentValue - h.totalInvested,
    };
  });

  const totalValue = enriched.reduce((sum, h) => sum + h.currentValue, 0);
  const totalInvested = enriched.reduce((sum, h) => sum + h.totalInvested, 0);

  return ok(res, {
    holdings: enriched,
    totalValue,
    totalInvested,
    totalGainLoss: totalValue - totalInvested,
  }, 'Portofolio investasi Anda');
}

module.exports = { listProducts, buy, sell, portfolio, ensureSeedProducts };
