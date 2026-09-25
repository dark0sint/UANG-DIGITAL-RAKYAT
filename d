# Salin file ini menjadi .env lalu sesuaikan nilainya sebelum menjalankan server

PORT=3000
NODE_ENV=production

# Ganti dengan string acak yang panjang & rahasia di server produksi
JWT_SECRET=ganti_dengan_secret_acak_yang_sangat_panjang
JWT_EXPIRES_IN=2h
JWT_TEMP_EXPIRES_IN=5m

# Nama aplikasi (dipakai di label TOTP / Google Authenticator)
APP_NAME=UangDigitalRakyat

# Limit default PayLater untuk pengguna baru (dalam Rupiah)
DEFAULT_PAYLATER_LIMIT=2000000
