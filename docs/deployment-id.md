# Instalasi server dan operasional

[English guide](deployment-en.md) · [README](../README.md)

Panduan ini menyiapkan deployment; tidak menyatakan server atau cluster Anda sudah dipasang. Pengiriman default tetap memakai penyedia uji. Adapter vendor nyata dan callback belum selesai. Notifikasi Web Push bersifat opsional dan default nonaktif.

## 1. Persiapan

Siapkan Linux dengan Docker Engine/Compose v2, domain, sertifikat HTTPS, reverse proxy, disk persisten dan backup. Untuk build serta pilot awal, sediakan sekitar 4 CPU/8 GB RAM, lalu ukur beban nyata; angka ini bukan sertifikasi kapasitas. PostgreSQL 18 dan Redis 8 diperlukan. OrbStack bisa digunakan untuk pengujian di macOS. Kubernetes/k9s bersifat pilihan; k9s hanya alat untuk melihat/mengelola cluster.

```sh
git clone https://github.com/RaditteAnggoro/one-ums-portal.git
cd one-ums-portal
cp .env.server.example .env.server
cp .env.bootstrap.example .env.bootstrap
chmod 600 .env.server .env.bootstrap
openssl rand -base64 32
```

Gunakan autentikasi GitHub biasa; jangan menaruh token pada URL clone. Edit `.env.server`:

- `POSTGRES_PASSWORD`: kata sandi unik; URL-encode karakter khusus saat dimasukkan dalam `DATABASE_URL`.
- `DATABASE_URL`: mengarah ke service `postgres`; `REDIS_URL=redis://redis:6379`.
- `APP_ORIGIN=https://domain-anda.example`, `COOKIE_SECURE=true`.
- `APP_ENCRYPTION_KEY`: hasil 32-byte base64 dari perintah tadi; simpan permanen di lokasi aman dan ikutkan dalam backup rahasia.
- `RUN_WORKER_IN_API=false`, `WEB_BIND=127.0.0.1`, `PUSH_ENABLED=false`.

Compose dapat mengembangkan `${POSTGRES_PASSWORD}` pada contoh URL. Loader `.env` proses Node biasa tidak melakukannya; pemasangan native harus menggunakan URL lengkap. Jangan menimpa kunci enkripsi setelah menyimpan kredensial karena data lama menjadi tidak terbaca. Isi `.env.bootstrap` dengan email/nama/kata sandi operator awal, minimal 12 karakter, melalui password manager. Jangan memakai akun demo di server.

## 2. Build, migrasi dan operator pertama

```sh
docker build -t one-ums-portal:0.1.0 .
docker compose --env-file .env.server -f compose.server.yaml up -d postgres redis
docker compose --env-file .env.server -f compose.server.yaml run --rm migrate
docker compose --env-file .env.server -f compose.server.yaml --profile tools run --rm bootstrap
```

Migrasi menerapkan file SQL berurutan di dalam transaksi, mencatat versi berhasil dan mengunci migrator bersamaan. Versi yang sudah diterapkan dilewati. Jangan mengedit migrasi yang telah berjalan. `db:setup` khusus data contoh dan ditolak dalam mode production.

Bootstrap membuat admin platform pertama beserta perusahaan awal, atau mempromosikan akun aktif yang sudah ada setelah kata sandinya cocok. Proses ditolak jika admin platform sudah ada. Hapus file rahasia bootstrap setelah selesai; ini bukan fitur pemulihan kata sandi.

## 3. Jalankan dan pasang HTTPS

```sh
docker compose --env-file .env.server -f compose.server.yaml up -d api worker web
docker compose --env-file .env.server -f compose.server.yaml ps
docker compose --env-file .env.server -f compose.server.yaml logs --tail 100 api worker web
curl -f http://127.0.0.1:3000/api/health
```

Sesuaikan domain dan lokasi sertifikat pada `deploy/examples/nginx.conf`, validasi konfigurasi proxy, lalu muat ulang proxy. Port PostgreSQL, Redis dan API tidak perlu dibuka ke publik. Login production memerlukan HTTPS karena cookie secure. Browser mengakses `/api`; frontend meneruskan ke `API_ORIGIN=http://api:4100` pada runtime, sehingga tidak memakai alamat workstation yang tertanam saat build. `UI_ENVIRONMENT_LABEL` kosong secara default.

Untuk mencatat IP klien di audit melalui reverse proxy tepercaya, atur `TRUST_PROXY_HOPS=1` hanya jika API internal dan frontend melalui proxy tersebut. Pastikan proxy menimpa atau menambahkan IP klien sebenarnya dengan benar; jangan mempercayai header yang dikirim browser secara bebas. Verifikasi rantai proxy/ingress sebelum mengandalkan atribusi IP klien.

Login sebagai operator bootstrap. Menu **Perusahaan → Perusahaan baru** membuat pemilik perusahaan, tim awal, lima peran, dua tingkat persetujuan, pusat biaya dan anggaran nol. Login sebagai pemilik perusahaan tersebut untuk menambahkan pengguna, pemberi persetujuan yang berbeda dari pembuat, anggaran, penyedia, template dan data. Admin platform tidak otomatis dapat mengakses operasi perusahaan lain. Ganti kata sandi awal melalui profil. Menu **Panduan pengguna** menjelaskan setiap menu dan use case sesuai izin.

## 4. Notifikasi push opsional

Diperlukan browser yang mendukung Push API, koneksi aman, izin pengguna dan koneksi ke layanan push browser. Dukungan perangkat/aplikasi web terpasang bervariasi; uji perangkat sasaran. OS dapat menunda notifikasi. Mengaktifkan push membuat koneksi keluar ke infrastruktur push browser.

Pada checkout operator yang aman dengan Node 24/pnpm:

```sh
pnpm install --frozen-lockfile
pnpm push:keys
```

Kunci ditulis sekali ke `.data/secrets/webpush.env` dengan izin pemilik saja, tanpa mencetak kunci. Salin nilainya ke rahasia server, ganti `VAPID_SUBJECT` dengan kontak operator, aktifkan `PUSH_ENABLED=true`, lalu buat ulang API/worker. Pertahankan pasangan kunci tersebut. Host yang diizinkan default adalah FCM, Mozilla dan Apple; tambahkan `PUSH_ALLOWED_HOSTS` hanya setelah memverifikasi host HTTPS resmi browser Anda.

Pengguna membuka **Notifikasi perangkat → Aktifkan pada perangkat ini**, memilih kategori dan meminta uji secara sadar. Tidak ada permintaan izin otomatis. `ACCEPTED` berarti layanan push menerima permintaan; `DISPLAYED` berasal dari konfirmasi browser, bukan bukti dibaca manusia. Hasil tidak pasti tidak dikirim ulang otomatis. Logout/pergantian akun menonaktifkan perangkat terdaftar. Sebelum menampilkan isi, browser memeriksa kembali sesi dan izin. Push ini untuk notifikasi operasional tim; kanal kampanye push pelanggan belum tersedia.

## 5. Upgrade, backup dan pemulihan

1. Backup database serta kunci enkripsi/VAPID. Uji pemulihan ke database terpisah.
2. Hentikan penulis data sebelum upgrade skema: `docker compose --env-file .env.server -f compose.server.yaml stop web api worker`.
3. Build image dengan tag versi baru, ubah `UMS_IMAGE`, jalankan `run --rm migrate` dengan environment yang benar.
4. Jalankan kembali layanan; periksa health/log, login, persetujuan dan kampanye uji.
5. Jika migrasi gagal, pertahankan penulis dalam keadaan berhenti dan periksa versi gagal. Tidak ada migrasi turun otomatis. Gunakan perbaikan maju yang ditinjau atau backup terkoordinasi; jangan menurunkan aplikasi secara buta setelah skema berubah.

Contoh backup (lokasi tujuan di luar repository):

```sh
docker compose --env-file .env.server -f compose.server.yaml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /secure-backup/ums.dump
```

Pulihkan dump ke **database kosong terpisah** memakai `pg_restore --exit-on-error` sebagai pemilik database. Verifikasi data, persetujuan dan ledger sebelum merencanakan pemulihan production. Lindungi volume Redis AOF juga. PostgreSQL outbox menjadi sumber kebenaran, tetapi eksekusi terputus/tidak pasti tetap memerlukan keputusan operator. Jangan menjalankan `down -v` pada lingkungan nyata. Terapkan backup terenkripsi, retensi dan salinan di luar server.

Pantau health, heartbeat `worker_sessions`, umur/jumlah antrean, error/UNKNOWN, disk DB/Redis dan kegagalan push. Health HTTP saja tidak membuktikan worker berjalan. Jadwal yang terlewat tidak dijalankan sebagai backlog; harus dijadwalkan ulang secara eksplisit. Uji pemulihan dan pembatasan laju sebelum menambah replika.

## 6. Pilihan Kubernetes

Contoh tidak memasang database/Redis persisten, registry, ingress controller atau sertifikat. Siapkan terlebih dahulu; gunakan koneksi privat, TLS DB dan autentikasi/TLS Redis sesuai lingkungan. Batasi jaringan dan akses rahasia. Ganti image pada semua manifest dengan tag yang dapat diambil node. Image OrbStack dengan `IfNotPresent` mungkin tersedia pada cluster terintegrasinya; jangan menganggap perilaku itu sama di server remote.

```sh
kubectl apply -f deploy/k8s/namespace.yaml
# Ubah APP_ORIGIN pada configmap sebelum menerapkan.
kubectl apply -f deploy/k8s/configmap.yaml
cp deploy/examples/secrets.env.example /secure-path/ums-secrets.env
chmod 600 /secure-path/ums-secrets.env
# Ganti SEMUA placeholder pada file tersebut.
kubectl -n ums create secret generic ums-secrets --from-env-file=/secure-path/ums-secrets.env
kubectl apply -f deploy/k8s/migrate-job.yaml
kubectl -n ums wait --for=condition=complete job/ums-migrate-001 --timeout=180s
kubectl -n ums logs job/ums-migrate-001
```

Untuk instalasi pertama, buat secret sementara `ums-bootstrap` dari `.env.bootstrap`, jalankan `deploy/examples/bootstrap-job.yaml`, tunggu selesai dan periksa log, lalu hapus job/secret tersebut. Pada setiap rilis gunakan nama Job migrasi/image baru; Job yang selesai tidak otomatis berjalan lagi.

Sesudah migrasi/bootstrap berhasil:

```sh
kubectl apply -f deploy/k8s/api.yaml
kubectl apply -f deploy/k8s/worker.yaml
kubectl apply -f deploy/k8s/web.yaml
kubectl -n ums rollout status deployment/ums-api
kubectl -n ums rollout status deployment/ums-web
# Ubah host, TLS secret dan ingress class terlebih dahulu.
kubectl apply -f deploy/examples/ingress.yaml
k9s -n ums
```

Secret Kubernetes bukan enkripsi hanya karena base64. Terapkan enkripsi cluster/RBAC dan pengelolaan rahasia. Contoh satu replika bukan jaminan ketersediaan tinggi. Jangan menerapkan seluruh direktori sekaligus sebelum Job migrasi selesai.

## 7. Pilihan tanpa container

Siapkan Node 24+, pnpm sesuai `package.json`, PostgreSQL/Redis persisten dan environment lengkap. Jalankan `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm db:migrate`, `pnpm db:bootstrap`. Jalankan `pnpm start:api`, `pnpm start:worker`, `pnpm start:web` sebagai layanan terpisah di bawah process supervisor/TLS proxy. Gunakan `NODE_ENV=production`, `API_ORIGIN` di proses web dan `RUN_WORKER_IN_API=false` di API. Watcher development tidak digunakan sebagai layanan production.
