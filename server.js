require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.warn('[PERINGATAN] JWT_SECRET belum diatur di .env — gunakan nilai rahasia yang kuat sebelum production!');
}

app.listen(PORT, () => {
  console.log('==============================================');
  console.log('   UANG DIGITAL RAKYAT - API Keuangan Digital');
  console.log('==============================================');
  console.log(`  Server berjalan di port ${PORT}`);
  console.log(`  Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Cek status: http://localhost:${PORT}/api/health`);
  console.log('==============================================');
});
