const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { ensureSeedProducts } = require('./controllers/investment.controller');

const authRoutes = require('./routes/auth.routes');
const walletRoutes = require('./routes/wallet.routes');
const transactionRoutes = require('./routes/transaction.routes');
const qrisRoutes = require('./routes/qris.routes');
const vaRoutes = require('./routes/va.routes');
const budgetRoutes = require('./routes/budget.routes');
const paylaterRoutes = require('./routes/paylater.routes');
const lendingRoutes = require('./routes/lending.routes');
const investmentRoutes = require('./routes/investment.routes');
const securityRoutes = require('./routes/security.routes');

const app = express();

// Seed data produk investasi default saat startup
ensureSeedProducts();

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiter global untuk mencegah brute-force / abuse
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak permintaan, coba lagi beberapa saat lagi.' },
});
app.use('/api/', globalLimiter);

// Rate limiter lebih ketat khusus endpoint autentikasi
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Terlalu banyak percobaan login/registrasi, coba lagi nanti.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/biometric/login', authLimiter);

app.get('/', (req, res) => {
  res.json({
    app: 'UANG DIGITAL RAKYAT',
    description: 'API Fitur Keuangan Digital: Pembayaran, Anggaran, Pembiayaan, Investasi, dan Keamanan',
    status: 'running',
    docs: '/api/health',
  });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API sehat dan berjalan normal', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/qris', qrisRoutes);
app.use('/api/va', vaRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/paylater', paylaterRoutes);
app.use('/api/lending', lendingRoutes);
app.use('/api/investment', investmentRoutes);
app.use('/api/security', securityRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
