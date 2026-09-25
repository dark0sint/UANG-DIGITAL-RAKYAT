/**
 * Lapisan penyimpanan data sederhana berbasis file JSON.
 * Dipilih (bukan SQLite/Postgres) supaya aplikasi ini "siap running di server manapun"
 * tanpa perlu kompilasi modul native atau instalasi database terpisah.
 *
 * Untuk skala produksi sungguhan, ganti implementasi Collection ini dengan
 * driver database sesungguhnya (PostgreSQL/MySQL/MongoDB) — seluruh controller
 * hanya bergantung pada method: all(), find(), findOne(), findById(), insert(),
 * updateById(), removeById() — sehingga penggantian storage tidak mengubah logic bisnis.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

class Collection {
  constructor(name) {
    this.name = name;
    this.file = path.join(DATA_DIR, `${name}.json`);
    this._load();
  }

  _load() {
    if (fs.existsSync(this.file)) {
      try {
        const raw = fs.readFileSync(this.file, 'utf-8');
        this.items = raw ? JSON.parse(raw) : [];
      } catch (err) {
        console.error(`Gagal membaca ${this.file}, memulai dengan data kosong.`, err.message);
        this.items = [];
      }
    } else {
      this.items = [];
      this._save();
    }
  }

  _save() {
    fs.writeFileSync(this.file, JSON.stringify(this.items, null, 2), 'utf-8');
  }

  all() {
    return [...this.items];
  }

  find(predicate) {
    return this.items.filter(predicate);
  }

  findOne(predicate) {
    return this.items.find(predicate) || null;
  }

  findById(id) {
    return this.items.find((item) => item.id === id) || null;
  }

  insert(data) {
    const record = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };
    this.items.push(record);
    this._save();
    return record;
  }

  updateById(id, patch) {
    const idx = this.items.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    this.items[idx] = {
      ...this.items[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this._save();
    return this.items[idx];
  }

  removeById(id) {
    const idx = this.items.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    this._save();
    return true;
  }
}

// Koleksi (setara "tabel") yang dipakai seluruh aplikasi
const collections = {
  users: new Collection('users'),
  wallets: new Collection('wallets'),
  transactions: new Collection('transactions'),
  qris: new Collection('qris'),
  virtualAccounts: new Collection('virtual_accounts'),
  budgets: new Collection('budgets'),
  paylaterAccounts: new Collection('paylater_accounts'),
  paylaterTransactions: new Collection('paylater_transactions'),
  loans: new Collection('loans'),
  investmentProducts: new Collection('investment_products'),
  investmentHoldings: new Collection('investment_holdings'),
  securityLogs: new Collection('security_logs'),
};

module.exports = collections;
