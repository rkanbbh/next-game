# Next Game — pembayaran asli

Struktur ini sudah memakai backend dan endpoint Midtrans Snap, bukan tombol alert/demo.

## Yang perlu disiapkan
- Akun merchant/payment gateway yang sah dan sudah bisa menerima pembayaran.
- MIDTRANS_SERVER_KEY disimpan sebagai Environment Variable di server.
- MIDTRANS_IS_PRODUCTION=true hanya setelah akun produksi aktif.
- URL notifikasi Midtrans diarahkan ke:
  https://DOMAIN-KAMU/api/midtrans-notification

## Penting
Pembayaran yang berhasil baru boleh dianggap lunas setelah notifikasi diverifikasi.
Pengiriman diamond/coin otomatis masih membutuhkan API supplier game yang sah.
Jangan pernah menaruh Server Key di frontend/GitHub.
