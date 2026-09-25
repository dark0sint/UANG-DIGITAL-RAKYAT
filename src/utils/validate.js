/**
 * Validator ringan tanpa dependensi eksternal.
 * Mengembalikan array pesan error (kosong berarti valid).
 */
function required(body, fields) {
  const errors = [];
  fields.forEach((f) => {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      errors.push(`Field '${f}' wajib diisi`);
    }
  });
  return errors;
}

function isEmail(str = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function isPositiveNumber(n) {
  return typeof n === 'number' && !Number.isNaN(n) && n > 0;
}

module.exports = { required, isEmail, isPositiveNumber };
