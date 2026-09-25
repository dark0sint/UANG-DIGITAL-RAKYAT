/**
 * Kategorisasi otomatis sederhana berbasis kata kunci pada nama merchant/deskripsi.
 * Ini menyerupai fitur "kategorisasi otomatis" pada aplikasi mobile banking/e-wallet.
 */
const RULES = [
  { category: 'Makanan & Minuman', keywords: ['restoran', 'resto', 'makan', 'food', 'cafe', 'kopi', 'warung', 'gofood', 'grabfood'] },
  { category: 'Transportasi', keywords: ['grab', 'gojek', 'taxi', 'ojek', 'bensin', 'spbu', 'parkir', 'tol', 'kereta', 'pesawat', 'tiket'] },
  { category: 'Tagihan & Utilitas', keywords: ['listrik', 'pln', 'pdam', 'wifi', 'indihome', 'pulsa', 'paket data', 'bpjs', 'internet'] },
  { category: 'Belanja', keywords: ['shopee', 'tokopedia', 'mall', 'supermarket', 'minimarket', 'indomaret', 'alfamart', 'lazada'] },
  { category: 'Hiburan', keywords: ['netflix', 'spotify', 'bioskop', 'game', 'disney', 'youtube'] },
  { category: 'Kesehatan', keywords: ['apotek', 'rumah sakit', 'klinik', 'dokter', 'obat'] },
  { category: 'Pendidikan', keywords: ['sekolah', 'kuliah', 'kursus', 'spp', 'les'] },
  { category: 'Transfer & Keuangan', keywords: ['transfer', 'top up', 'topup', 'tabungan', 'investasi', 'pinjaman', 'cicilan'] },
];

function categorize(text = '') {
  const t = (text || '').toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => t.includes(kw))) {
      return rule.category;
    }
  }
  return 'Lainnya';
}

module.exports = { categorize };
