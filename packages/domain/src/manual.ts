export type GuideText = {
  title: string;
  summary: string;
  steps: string[];
  note: string;
};
export type GuideArticle = {
  id: string;
  menu: string;
  permission?: string;
  platform?: boolean;
  idText: GuideText;
  enText: GuideText;
};
export const guideArticles: GuideArticle[] = [
  {
    id: "start",
    menu: "dashboard",
    idText: {
      title: "Mulai: kirim kampanye pertama",
      summary: "Alur dari data penerima sampai hasil yang dapat ditelusuri.",
      steps: [
        "Pastikan admin sudah menyiapkan pengguna, penyedia, dan anggaran untuk pusat biaya Anda.",
        "Buka Sumber data untuk mengunggah CSV/XLSX atau menerima data melalui API. Periksa sampel dan nama kolom.",
        "Buat Template pesan dan tulis variabel seperti {{customer_name}} atau {{reference}}.",
        "Buat Kampanye, pilih sumber dan kanal, petakan variabel, lalu periksa pratinjau, jadwal, dan batas biaya.",
        "Ajukan persetujuan. Pengguna yang memenuhi setiap tingkat memeriksa dan menyetujui pengajuan.",
        "Pantau hasil di Penelusuran pesan. Investigasi gagal dan hasil belum terkonfirmasi sebelum melakukan tindakan.",
      ],
      note: "Pembuat tidak dapat menyetujui pengajuannya sendiri. Penyedia uji menghasilkan data uji; pengiriman vendor mengikuti integrasi yang benar-benar aktif.",
    },
    enText: {
      title: "Start: your first campaign",
      summary: "Follow recipients from source data to traceable outcomes.",
      steps: [
        "Ask your administrator to configure users, providers, and the cost-centre budget.",
        "Open Data sources to upload CSV/XLSX or receive API data. Check samples and column names.",
        "Create a Message template with variables such as {{customer_name}} or {{reference}}.",
        "Create a Campaign, select sources and channels, map variables, and review previews, schedule, and spending limit.",
        "Submit for approval. Eligible users review and approve every configured stage.",
        "Monitor Message Explorer. Investigate failures and uncertain outcomes before taking action.",
      ],
      note: "Creators cannot approve their own submissions. Test providers produce test data; external delivery depends on an actually active integration.",
    },
  },
  {
    id: "dashboard",
    menu: "dashboard",
    idText: {
      title: "Ringkasan dan dashboard pribadi",
      summary: "Lihat performa dan masalah yang perlu ditindaklanjuti.",
      steps: [
        "Pilih kanal dan periode. Jumlah pesan menghitung pesan logis, bukan jumlah percobaan.",
        "Klik Gagal final untuk membuka daftar pesan dengan filter terkait. Klik hasil belum terkonfirmasi untuk investigasi.",
        "Gunakan Atur tampilan untuk memilih widget, mengubah urutan, dan mengatur lebarnya.",
        "Gunakan tombol muat ulang untuk memperoleh agregat terbaru; waktu pengamatan terlihat di atas metrik.",
      ],
      note: "Tingkat delivery adalah pesan terkonfirmasi dibagi seluruh permintaan pada periode terpilih, termasuk yang sedang diproses. Data yang tidak tersedia ditandai jelas.",
    },
    enText: {
      title: "Overview and personal dashboard",
      summary: "See performance and issues that need attention.",
      steps: [
        "Choose a channel and period. Totals count logical messages, not attempts.",
        "Click Final failed to open filtered messages. Open unconfirmed outcomes to investigate.",
        "Use Customize view to choose widgets, reorder them, and set their widths.",
        "Refresh aggregates when needed; the observation timestamp appears above the metrics.",
      ],
      note: "Delivery rate is confirmed deliveries divided by all requests in the period, including processing requests. Unavailable measures are identified clearly.",
    },
  },
  {
    id: "messages",
    menu: "messages",
    permission: "campaigns:read",
    idText: {
      title: "Menelusuri pesan dan riwayat",
      summary: "Temukan satu pesan tanpa kehilangan konteks daftar.",
      steps: [
        "Cari ID pesan, ID penyedia, ID eksekusi, atau ID kampanye secara lengkap.",
        "Gabungkan filter status, kanal, periode, vendor, dan tim yang diizinkan. Gunakan Berikutnya untuk halaman selanjutnya.",
        "Klik ID pesan untuk membuka panel detail. Ringkasan, linimasa, percobaan, dan payload dipisahkan dalam tab.",
        "Salin ID untuk koordinasi. Tutup panel untuk kembali ke filter dan halaman yang sama.",
      ],
      note: "Penerima disamarkan. Payload memerlukan izin tersendiri dan aksesnya diaudit; peran penonton tidak mendapat isi pesan.",
    },
    enText: {
      title: "Investigate messages and history",
      summary: "Find a message without losing the list context.",
      steps: [
        "Search a complete message, provider, run, or campaign ID.",
        "Combine status, channel, period, provider, and authorized-team filters. Use Next to page through results.",
        "Open a message ID for the detail drawer. Summary, timeline, attempts, and payload have separate tabs.",
        "Copy the ID to coordinate investigation. Close the drawer to return to the same filters and page.",
      ],
      note: "Recipients are masked. Payload needs additional permission and is audited; viewers do not receive message content.",
    },
  },
  {
    id: "deliveries",
    menu: "deliveries",
    permission: "campaigns:read",
    idText: {
      title: "Antrean dan hasil tidak pasti",
      summary:
        "Bedakan pesan yang menunggu dengan pesan yang mungkin sudah diterima penyedia.",
      steps: [
        "Buka Antrean pengiriman untuk melihat status antrean awal.",
        "Ubah filter menjadi Belum terkonfirmasi bila hasil penyedia tidak pasti.",
        "Periksa linimasa dan percobaan sebelum meminta pemeriksaan oleh pengguna berwenang.",
        "Gunakan kontrol kampanye untuk jeda atau pembatalan; pesan yang sudah diterima penyedia tidak dapat ditarik kembali.",
      ],
      note: "Tidak ada tombol retry yang pura-pura berhasil. Pesan dengan hasil tidak pasti tidak dikirim ulang otomatis.",
    },
    enText: {
      title: "Queue and uncertain outcomes",
      summary:
        "Distinguish waiting messages from messages a provider may already have accepted.",
      steps: [
        "Open Delivery queue for queued messages.",
        "Filter Unconfirmed to investigate uncertain provider results.",
        "Review timelines and attempts before asking an authorized operator to reconcile.",
        "Use campaign pause/cancel controls; a provider-accepted message cannot be recalled.",
      ],
      note: "There is no fake-success retry button. Uncertain messages are never automatically resent.",
    },
  },
  {
    id: "channels",
    menu: "channels",
    permission: "campaigns:read",
    idText: {
      title: "Pemantauan kanal",
      summary: "Periksa observasi setiap kanal dan arahkan investigasi.",
      steps: [
        "Bandingkan volume, kegagalan, sisa antrean, dan latensi delivery p95 pada jendela pengamatan.",
        "Klik Lihat pesan atau Investigasi gagal pada kanal terkait.",
        "Bila belum ada data, periksa konfigurasi penyedia dan buat pengujian melalui alur kampanye yang disetujui.",
      ],
      note: "Tidak adanya kegagalan bukan bukti vendor sehat. Metrik penyedia uji tidak membuktikan SLA vendor nyata.",
    },
    enText: {
      title: "Channel monitoring",
      summary: "Review observed channel activity and direct investigation.",
      steps: [
        "Compare volume, failures, queue backlog, and delivery p95 in the observation window.",
        "Open View messages or Investigate failures for the relevant channel.",
        "When observations are missing, check provider configuration and use an approved test campaign.",
      ],
      note: "No observed failures does not prove provider health. Test-provider measurements do not establish an external vendor SLA.",
    },
  },
  {
    id: "campaigns",
    menu: "campaigns",
    permission: "campaigns:read",
    idText: {
      title: "Kampanye, jadwal, dan perubahan",
      summary: "Atur sekali kirim atau seri berulang dengan persetujuan.",
      steps: [
        "Pilih Buat kampanye, tentukan penerima, template, penyedia, dan pusat biaya.",
        "Pilih segera, satu kali terjadwal, atau berulang. Perhatikan zona waktu kampanye.",
        "Periksa batas biaya per eksekusi dan kirim pengajuan. Seri berulang disetujui sekali untuk definisinya.",
        "Bila dikembalikan, buka Revisi kampanye, perbaiki, dan ajukan kembali. Riwayat lama tetap tersimpan.",
        "Untuk jadwal terlewat, pilih penjadwalan ulang secara eksplisit. Untuk gangguan eksekusi, pengguna berwenang mengambil keputusan pemulihan.",
      ],
      note: "Perubahan material membutuhkan persetujuan baru. Jadwal yang terlewat saat layanan berhenti tidak dikirim sebagai backlog.",
    },
    enText: {
      title: "Campaigns, schedules, and changes",
      summary:
        "Configure immediate, scheduled, or recurring sends with approval.",
      steps: [
        "Choose Create campaign and set recipients, templates, provider, and cost centre.",
        "Choose immediate, one-time, or recurring delivery. Check the campaign timezone.",
        "Review the per-run spending limit and submit. A recurring definition is approved once.",
        "If returned, use Revise campaign, correct it, and resubmit. Previous history remains intact.",
        "Explicitly reschedule missed occurrences. Authorized users decide how to recover interrupted runs.",
      ],
      note: "Material changes require new approval. Schedules missed during downtime are not replayed as backlog.",
    },
  },
  {
    id: "approvals",
    menu: "approvals",
    permission: "campaigns:approve",
    idText: {
      title: "Meninjau dan memberi persetujuan",
      summary:
        "Putuskan berdasarkan versi yang benar-benar telah Anda periksa.",
      steps: [
        "Buka Persetujuan dan pilih pengajuan yang sesuai tingkat serta peran Anda.",
        "Periksa isi, sampel penerima, jadwal, batas biaya, dan alasan pengecualian bila ada.",
        "Setujui, tolak, atau kembalikan untuk revisi. Catatan wajib untuk penolakan dan pengembalian.",
        "Jika versi atau tingkat berubah saat detail terbuka, tutup lalu buka kembali sebelum memutuskan.",
      ],
      note: "Pembuat dan perevisi tidak boleh menyetujui pengajuan sendiri. Persetujuan tingkat akhir baru memulai pemeriksaan anggaran dan pengiriman.",
    },
    enText: {
      title: "Review and approve",
      summary: "Decide on the exact version you inspected.",
      steps: [
        "Open Approvals and choose an eligible request for your stage and role.",
        "Review content, recipient samples, schedule, spending ceiling, and any exception reasons.",
        "Approve, reject, or return for revision. Rejection and return require notes.",
        "If the version or stage changes while open, close and reopen details before deciding.",
      ],
      note: "Creators and revisers cannot approve their own requests. Final approval starts budget and dispatch preflight checks.",
    },
  },
  {
    id: "templates",
    menu: "templates",
    permission: "templates:write",
    idText: {
      title: "Template dan variabel",
      summary: "Personalisasi isi tanpa mengubah pesan yang sudah disetujui.",
      steps: [
        "Pilih Template baru dan kanal pengiriman.",
        "Tulis variabel dengan format {{nama_kolom}} dan petakan dari sumber data saat membuat kampanye.",
        "Periksa pratinjau untuk memastikan variabel wajib terisi.",
        "Ubah melalui versi baru; versi yang dipakai pengajuan sebelumnya tetap tersimpan.",
      ],
      note: "Template WhatsApp uji bukan persetujuan template vendor. Persetujuan vendor harus diverifikasi sebelum pengiriman nyata.",
    },
    enText: {
      title: "Templates and variables",
      summary: "Personalize content without changing approved messages.",
      steps: [
        "Choose New template and a delivery channel.",
        "Write variables as {{column_name}} and map them from campaign source data.",
        "Check previews to ensure required values are populated.",
        "Create a new version to change content; previous submissions retain their version.",
      ],
      note: "A test WhatsApp template is not vendor approval. Verify provider approval before real delivery.",
    },
  },
  {
    id: "sources",
    menu: "sources",
    permission: "sources:write",
    idText: {
      title: "Sumber data dan integrasi API",
      summary: "Impor penerima dengan identitas sumber dan versi yang jelas.",
      steps: [
        "Unggah CSV/XLSX/JSON yang berisi nilai, bukan formula. Kolom email atau phone menentukan tujuan pada kanal terkait.",
        "Periksa sampel dan kesesuaian kolom sebelum membuat kampanye.",
        "Untuk aplikasi pengirim data, buat koneksi incoming dan simpan kunci API yang hanya ditampilkan sekali.",
        "Gunakan UUID idempotensi yang sama hanya untuk mengulang data yang sama. Cabut kunci yang tidak dipakai.",
        "Untuk REST, minta admin mengatur rahasia pada server, kemudian gunakan Ambil data.",
      ],
      note: "API sumber tidak melewati persetujuan kampanye. Refresh terjadwal, pagination lanjutan, dan sumber dinamis per seri belum tersedia.",
    },
    enText: {
      title: "Data sources and APIs",
      summary: "Import recipients with clear source identity and versions.",
      steps: [
        "Upload value-only CSV/XLSX/JSON. Email or phone columns provide destinations for the relevant channels.",
        "Check samples and mappings before creating a campaign.",
        "For incoming data, create a connection and store the API key shown once.",
        "Reuse an idempotency UUID only for retries of identical data. Revoke unused keys.",
        "For REST, ask an administrator to configure the server secret, then Retrieve data.",
      ],
      note: "Source APIs never bypass campaign approval. Scheduled refresh, advanced pagination, and dynamic recurring sources are not available yet.",
    },
  },
  {
    id: "usage",
    menu: "usage",
    permission: "budgets:read",
    idText: {
      title: "Penggunaan dan biaya vendor",
      summary: "Pisahkan estimasi, ledger internal, dan tagihan eksternal.",
      steps: [
        "Pilih periode biaya dan tinjau pengelompokan vendor, kanal, serta tim.",
        "Bandingkan estimasi snapshot tarif dengan biaya yang sudah dibukukan.",
        "Buka Alokasi biaya untuk memeriksa anggaran dan transaksi ledger.",
      ],
      note: "Biaya vendor dan invoice yang belum terhubung ditampilkan sebagai tidak tersedia, bukan nol. Jumlah pesan belum tentu sama dengan satuan tagihan.",
    },
    enText: {
      title: "Provider usage and costs",
      summary:
        "Keep estimates, internal ledger, and external billing distinct.",
      steps: [
        "Select a period and review provider, channel, and team groups.",
        "Compare snapshot estimates with recorded spending.",
        "Open Cost allocation for budgets and ledger movements.",
      ],
      note: "Unconnected provider reports and invoices are unavailable, not zero. Message count does not necessarily equal billable units.",
    },
  },
  {
    id: "budgets",
    menu: "budgets",
    permission: "budgets:read",
    idText: {
      title: "Alokasi anggaran dan topup internal",
      summary: "Siapkan dana per pusat biaya dan periode.",
      steps: [
        "Buat periode satu, tiga, enam, atau dua belas bulan tanpa tanggal bertumpang tindih.",
        "Periksa alokasi, cadangan, biaya terpakai, dan ketersediaan.",
        "Pengguna dengan izin anggaran dapat menambah alokasi dengan alasan yang dicatat.",
        "Buka riwayat ledger atau unduh CSV. Kampanye tertahan harus menjalani pemeriksaan ulang setelah dana ditambah.",
      ],
      note: "Topup ini adalah penyesuaian anggaran internal, bukan pembayaran melalui gateway. Jadwal yang sudah lewat tetap membutuhkan keputusan penjadwalan ulang.",
    },
    enText: {
      title: "Budget allocation and internal topups",
      summary: "Fund cost centres for explicit periods.",
      steps: [
        "Create non-overlapping one-, three-, six-, or twelve-month periods.",
        "Review allocation, reservations, spending, and availability.",
        "Authorized finance users can add allocation with an audited reason.",
        "Inspect ledger history or download CSV. Held campaigns must pass preflight again after funding.",
      ],
      note: "Topup means internal budget adjustment, not gateway payment. Expired schedules still require an explicit rescheduling decision.",
    },
  },
  {
    id: "reconciliation",
    menu: "reconciliation",
    permission: "budgets:read",
    idText: {
      title: "Rekonsiliasi hasil dan keterbatasan invoice",
      summary:
        "Periksa hasil tidak pasti sebelum menyelesaikan cadangan biaya.",
      steps: [
        "Buka Rekonsiliasi untuk daftar hasil belum terkonfirmasi.",
        "Periksa detail, linimasa, dan bukti hasil sebelum menentukan tindakan.",
        "Pada penyedia uji, pengguna berwenang dapat mengonfirmasi hasil dengan alasan dan pemeriksaan dampak anggaran.",
      ],
      note: "Pencocokan invoice vendor, selisih kontrak, dan persetujuan batch belum diimplementasikan. Aplikasi tidak mengklaim cocok hanya karena total sama.",
    },
    enText: {
      title: "Outcome reconciliation and invoice boundaries",
      summary: "Investigate uncertainty before settling reservations.",
      steps: [
        "Open Reconciliation for unconfirmed outcomes.",
        "Inspect details, timeline, and evidence before choosing an action.",
        "For a test provider, an authorized user can confirm the outcome with a reason and budget-impact check.",
      ],
      note: "Vendor invoice matching, contractual variances, and batch approval are not implemented. Equal totals never imply matched records.",
    },
  },
  {
    id: "providers",
    menu: "providers",
    permission: "admin:write",
    idText: {
      title: "Penyedia, akun, dan tarif",
      summary:
        "Konfigurasikan penyedia tanpa menyamakan validasi dengan integrasi aktif.",
      steps: [
        "Buat definisi penyedia dan kanal yang didukung.",
        "Validasi mapping lalu publikasikan definisi versi tetap.",
        "Buat akun perusahaan, masukkan kredensial dan identitas pengirim, lalu tambahkan tarif bertanggal efektif.",
        "Nonaktifkan akun bila perlu menghentikan pengiriman berikutnya; pesan lama tetap memakai snapshot versinya.",
      ],
      note: "Validasi mapping tidak menghubungi vendor. Generic HTTP belum memiliki transport aktif. Web Push perangkat diaktifkan oleh operator server, bukan akun HTTP generik.",
    },
    enText: {
      title: "Providers, accounts, and rates",
      summary:
        "Configure providers without confusing validation with active integration.",
      steps: [
        "Create a provider definition and supported channels.",
        "Validate mappings and publish the immutable definition version.",
        "Create a company account, enter credentials and sender identity, then effective-dated rates.",
        "Disable accounts to hold future dispatches; older messages retain their pinned version.",
      ],
      note: "Mapping validation does not contact a provider. Generic HTTP transport is not active. Device Web Push is configured by the server operator, not a generic HTTP account.",
    },
  },
  {
    id: "companies",
    menu: "companies",
    platform: true,
    idText: {
      title: "Onboarding perusahaan baru",
      summary: "Admin platform membuat ruang kerja yang terisolasi.",
      steps: [
        "Masuk sebagai admin platform dan buka Perusahaan.",
        "Masukkan nama, zona waktu, tim awal, pusat biaya, dan bahasa awal.",
        "Isi identitas admin perusahaan pertama serta kata sandi awal yang kuat.",
        "Setelah dibuat, sampaikan kredensial melalui kanal aman. Admin baru melengkapi pengguna, anggaran, penyedia, template, dan data.",
      ],
      note: "Admin perusahaan biasa tidak dapat membuat perusahaan lain atau melihat datanya. Perusahaan baru dimulai dengan anggaran nol dan tetap membutuhkan pemberi persetujuan yang berbeda dari pembuat.",
    },
    enText: {
      title: "Onboard a company",
      summary: "Platform administrators create an isolated workspace.",
      steps: [
        "Sign in as a platform administrator and open Companies.",
        "Enter the name, timezone, initial team, cost centre, and default language.",
        "Provide the initial company administrator and a strong initial password.",
        "Share credentials securely after creation. The new administrator configures users, budgets, providers, templates, and data.",
      ],
      note: "Ordinary company administrators cannot create other companies or view their operations. New companies start at zero budget and need approvers distinct from campaign creators.",
    },
  },
  {
    id: "settings",
    menu: "settings",
    idText: {
      title: "Pengguna, peran, dan profil",
      summary: "Sesuaikan akses dengan tanggung jawab tiap tim.",
      steps: [
        "Ubah nama, foto, bahasa, atau kata sandi melalui profil dan header.",
        "Admin perusahaan menambahkan tim, peran, pengguna, dan pusat biaya.",
        "Atur tingkat persetujuan dengan peran yang boleh memutuskan di tiap tingkat.",
        "Perubahan akses mengakhiri sesi lama agar izin baru berlaku.",
      ],
      note: "Menambah izin di UI saja tidak cukup; API juga memeriksa akses. Mengubah kata sandi akan mengakhiri sesi pengguna yang lain.",
    },
    enText: {
      title: "Users, roles, and profiles",
      summary: "Match access to each team responsibility.",
      steps: [
        "Edit name, picture, language, or password using profile and header controls.",
        "Company administrators create teams, roles, users, and cost centres.",
        "Configure approval levels and eligible roles for each stage.",
        "Access changes invalidate previous sessions so new permissions apply.",
      ],
      note: "APIs enforce permissions independently of UI visibility. Password changes end the user’s other sessions.",
    },
  },
  {
    id: "audit",
    menu: "audit",
    permission: "audit:read",
    idText: {
      title: "Jejak audit",
      summary: "Telusuri siapa melakukan tindakan dan kapan.",
      steps: [
        "Cari nama aksi atau ID objek pada Akses & audit.",
        "Periksa pengguna, waktu, alamat IP, dan referensi objek.",
        "Gunakan ID yang sama ketika menghubungkan tindakan persetujuan, perubahan tarif, atau penyesuaian anggaran.",
      ],
      note: "Kredensial, kata sandi, dan kunci langganan push tidak ditampilkan dalam audit. Hasil hanya mengikuti lingkup perusahaan dan tim yang diizinkan.",
    },
    enText: {
      title: "Audit evidence",
      summary: "Trace who performed an action and when.",
      steps: [
        "Search action names or object IDs in Access & audit.",
        "Review actor, time, IP, and object reference.",
        "Use the same object IDs to connect approvals, rate changes, and budget adjustments.",
      ],
      note: "Credentials, passwords, and push-subscription keys are excluded from audit output. Results remain company/team scoped.",
    },
  },
  {
    id: "notifications",
    menu: "push",
    idText: {
      title: "Notifikasi perangkat dan inbox",
      summary: "Tetap mendapat informasi tanpa mencampur akun atau perusahaan.",
      steps: [
        "Buka ikon lonceng untuk notifikasi tim; tanggal dan tombol tindakan berada pada area terpisah.",
        "Gunakan Tandai dibaca atau Tandai semua dibaca. Buka kampanye untuk melihat tindakan yang masih diperlukan.",
        "Pada Notifikasi perangkat, pilih Aktifkan pada perangkat ini lalu izinkan browser. Operator server harus mengaktifkan Web Push lebih dahulu.",
        "Pilih kategori persetujuan, anggaran, dan penyelesaian eksekusi. Gunakan Uji notifikasi dan periksa riwayat.",
        "Nonaktifkan perangkat yang tidak lagi dipakai. Keluar dari akun menonaktifkan langganan pada browser tersebut.",
      ],
      note: "HTTPS dan dukungan browser diperlukan. Layanan push menerima pesan tidak berarti perangkat telah menampilkannya. Browser memeriksa sesi aktif sebelum menampilkan isi; kampanye push ke pelanggan di luar portal merupakan perluasan terpisah.",
    },
    enText: {
      title: "Device notifications and inbox",
      summary: "Stay informed without mixing accounts or companies.",
      steps: [
        "Open the bell for team notifications; timestamps and actions have separate areas.",
        "Mark one or all as read. Open the campaign for pending actions.",
        "In Device notifications, Enable on this device and grant browser permission. The operator must configure Web Push first.",
        "Choose approval, budget, and completion categories. Use Test notification and inspect history.",
        "Disable unused devices. Signing out deactivates that browser’s subscription.",
      ],
      note: "HTTPS and browser support are required. Push-service acceptance does not mean device display. The browser checks the active session before showing content; customer push campaigns outside this portal are a separate extension.",
    },
  },
  {
    id: "deployment",
    menu: "settings",
    permission: "admin:write",
    idText: {
      title: "Untuk operator: instalasi dan migrasi",
      summary: "Mulai server tanpa membuat akun demo pada produksi.",
      steps: [
        "Ikuti panduan deployment di README dan docs/deployment-id.md untuk Docker/Compose atau Kubernetes.",
        "Siapkan PostgreSQL dan Redis persisten, domain HTTPS, origin aplikasi, serta kunci enkripsi yang tetap.",
        "Jalankan migrasi satu kali per rilis, lalu bootstrap admin platform pertama melalui perintah server.",
        "Pisahkan proses web, API, dan worker. Verifikasi kesehatan layanan dan cadangkan database beserta kunci enkripsi.",
      ],
      note: "K9s adalah alat pemantauan cluster, bukan bagian runtime aplikasi. Instalasi tidak otomatis menerapkan resource ke cluster yang sudah ada.",
    },
    enText: {
      title: "Operators: installation and migrations",
      summary: "Start a server without production demo accounts.",
      steps: [
        "Follow README and docs/deployment-en.md for Docker/Compose or Kubernetes.",
        "Configure persistent PostgreSQL/Redis, HTTPS, application origins, and a stable encryption key.",
        "Run migrations once per release, then bootstrap the first platform administrator from the server.",
        "Separate web, API, and worker processes. Verify health and back up the database with its encryption key.",
      ],
      note: "K9s is a cluster management tool, not an application runtime dependency. Installation does not automatically apply resources to an existing cluster.",
    },
  },
  {
    id: "help",
    menu: "help",
    idText: {
      title: "Menggunakan panduan ini",
      summary: "Temukan petunjuk sesuai menu dan tugas Anda.",
      steps: [
        "Cari kata kunci atau pilih topik pada daftar.",
        "Baca langkah dan catatan sebelum mencoba tindakan yang memengaruhi pengiriman atau biaya.",
        "Gunakan Buka menu untuk langsung berpindah ke fitur yang Anda miliki.",
        "Ganti bahasa pada header kapan saja; preferensi disimpan untuk akun Anda.",
      ],
      note: "Topik mengikuti izin Anda. Nama perusahaan, kampanye, peran khusus, dan isi pesan milik pengguna tidak diterjemahkan secara otomatis.",
    },
    enText: {
      title: "Using this guide",
      summary: "Find instructions for your menu and task.",
      steps: [
        "Search a keyword or choose an article.",
        "Read steps and notes before actions affecting delivery or cost.",
        "Use Open menu to navigate to an authorized feature.",
        "Switch language in the header at any time; your account retains the preference.",
      ],
      note: "Topics follow your permissions. User-authored company, campaign, custom-role names, and message content are not automatically translated.",
    },
  },
];

guideArticles.push(
  {
    id: "releases",
    menu: "releases",
    idText: {
      title: "Riwayat perubahan dan deployment",
      summary:
        "Telusuri perbaikan, peningkatan, fitur, dan riwayat status per perusahaan.",
      steps: [
        "Buka Riwayat perubahan untuk melihat versi, lingkungan, waktu deployment, pembuat catatan, dan rincian perubahan.",
        "Admin memilih Daftarkan perubahan, mengisi metadata rilis dan satu atau beberapa jenis perubahan, lalu menyimpan.",
        "Untuk rilis terencana, catat status diterapkan setelah deployment benar-benar diverifikasi. Catat rollback beserta alasannya jika diperlukan.",
        "Rincian yang sudah disimpan dipertahankan. Daftarkan catatan koreksi dengan referensi ke rilis sebelumnya.",
        "Gunakan pencarian dan halaman berikutnya untuk riwayat lama. Buka Riwayat status untuk melihat perubahan status dan pelakunya.",
      ],
      note: "Registrasi rilis hanya mencatat deployment; tidak menjalankan deployment. Pengguna biasa dapat membaca catatan perusahaannya, sedangkan pendaftaran/status hanya untuk admin perusahaan.",
    },
    enText: {
      title: "Change and deployment history",
      summary:
        "Trace fixes, enhancements, features and status history within a company.",
      steps: [
        "Open Change history to inspect version, environment, deployment time, registrant and change items.",
        "An administrator selects Register changes, enters release metadata and one or more change items, then saves.",
        "For a planned release, record deployment only after verification. Record rollback with a reason when needed.",
        "Saved details are retained. Create a correction record referencing the earlier release.",
        "Use search and pagination for older records. Expand Status history to see transitions and their authors.",
      ],
      note: "Release registration records a deployment; it does not execute one. Standard users can read their company records; registration and status changes require company administration.",
    },
  },
  {
    id: "maintenance",
    menu: "maintenance",
    permission: "admin:write",
    idText: {
      title: "Pemeliharaan per perusahaan",
      summary: "Batasi layanan perusahaan saat perubahan terencana.",
      steps: [
        "Buka Pemeliharaan dan periksa status serta corporate ID perusahaan.",
        "Isi informasi dan alasan pemeliharaan, konfirmasi dampaknya, lalu aktifkan.",
        "Pengguna biasa tidak dapat login atau menggunakan sesi operasional. Admin tetap dapat masuk untuk mengelola pemeliharaan.",
        "Eksekusi baru dan data masuk ditahan selama mode aktif; pekerjaan yang sudah berlangsung dapat selesai.",
        "Sesudah verifikasi selesai, isi alasan pembukaan layanan dan nonaktifkan pemeliharaan. Periksa jadwal terlewat dan lakukan penjadwalan ulang secara eksplisit jika diperlukan.",
      ],
      note: "Pengaturan berlaku hanya untuk perusahaan admin tersebut. Perusahaan lain tetap beroperasi. Perubahan status dicatat di Akses & audit.",
    },
    enText: {
      title: "Company maintenance",
      summary: "Restrict a company during planned changes.",
      steps: [
        "Open Maintenance and check the service state and corporate ID.",
        "Enter information and a reason, confirm the impact, then enable maintenance.",
        "Standard users cannot sign in or use operational sessions. Administrators retain access to manage maintenance.",
        "New executions and incoming data are held while enabled; work already in progress may finish.",
        "After verification, enter the reopening reason and disable maintenance. Review missed schedules and explicitly reschedule if needed.",
      ],
      note: "The setting affects only the administrator’s company. Other companies continue operating. Changes appear in Access & audit.",
    },
  },
  {
    id: "audit-details",
    menu: "audit",
    permission: "audit:read",
    idText: {
      title: "Filter dan investigasi perubahan",
      summary:
        "Cari peristiwa bisnis serta perubahan data dengan halaman yang stabil.",
      steps: [
        "Buka Akses & audit, pilih tanggal dan menu/use case, lalu Terapkan filter.",
        "Pilih 10, 30, 50, atau 100 baris per halaman. Halaman berikutnya memakai batas waktu pencarian yang sama; muat ulang untuk melihat aktivitas terbaru.",
        "Pilih Peristiwa bisnis untuk aksi pengguna, atau Perubahan data untuk metadata perubahan yang direkam database.",
        "Isi aksi spesifik seperti auth.login atau campaign.created jika perlu pencarian yang tepat.",
        "Buka Lihat perubahan untuk kolom berubah, nilai metadata sebelum/sesudah yang diizinkan, alamat IP, dan ID korelasi. Pilih Muat terbaru untuk catatan yang baru masuk.",
      ],
      note: "Audit tidak menyalin kata sandi, API key, isi pesan, atau seluruh data penerima. Akses mengikuti izin dan perusahaan/tim. Aksi layanan dapat tercatat sebagai Sistem.",
    },
    enText: {
      title: "Filter and investigate changes",
      summary:
        "Find business events and data changes with stable result pages.",
      steps: [
        "Open Access & audit, choose dates and a menu/use case, then Apply filters.",
        "Choose 10, 30, 50 or 100 rows per page. Further pages use the same search time cutoff; refresh to include the latest activity.",
        "Choose Business events for semantic user actions, or Data changes for metadata captured by the database.",
        "Enter an exact action such as auth.login or campaign.created when needed.",
        "Open View changes for changed fields, allowed before/after metadata, IP and correlation ID. Load latest starts a fresh view.",
      ],
      note: "Audit does not copy passwords, API keys, message content or full recipient data. Access follows company/team permissions. Service activity may appear as System.",
    },
  },
  {
    id: "workspace-personalization",
    menu: "settings",
    idText: {
      title: "Navigasi dan informasi pengguna",
      summary: "Atur sidebar dan pahami identitas kerja serta level peran.",
      steps: [
        "Gunakan pegangan di tepi sidebar untuk menarik lebar navigasi. Saat pegangan fokus, gunakan panah kiri/kanan; klik dua kali untuk mengembalikan lebar awal.",
        "Posisi scroll sidebar dipertahankan saat berpindah menu. Collapse tetap tersedia secara terpisah; layar kecil menggunakan navigasi ringkas.",
        "Admin membuka Pengaturan untuk mencari pengguna dan mengisi ID pegawai, departemen, jabatan serta telepon kerja. Corporate ID mengidentifikasi perusahaan.",
        "Peran memiliki level organisasi, izin fungsi dan cakupan data. Susun tingkat persetujuan dengan menetapkan peran secara eksplisit.",
        "Gunakan Tentang aplikasi untuk informasi pembuat dan identitas karya.",
      ],
      note: "Level peran tidak otomatis menambah izin atau melewati tahap persetujuan. Data perusahaan lain tetap tidak dapat diakses.",
    },
    enText: {
      title: "Navigation and work identity",
      summary:
        "Adjust navigation and understand user work details and role levels.",
      steps: [
        "Drag the sidebar edge handle to adjust width. When focused, use left/right arrows; double-click to restore the default.",
        "Sidebar scroll position stays in place across menus. Collapse remains separate; small screens use compact navigation.",
        "Administrators open Settings to find users and enter employee ID, department, job title and work phone. Corporate ID identifies the company.",
        "Roles have an organizational level, function permissions and data scope. Assign roles explicitly to approval stages.",
        "Open About for creator information and project provenance.",
      ],
      note: "Role level does not automatically grant permissions or bypass approvals. Other companies’ data remains inaccessible.",
    },
  },
);

guideArticles.push(
  {
    id: "campaign-recipient-mapping",
    menu: "campaigns",
    permission: "campaigns:create",
    idText: {
      title: "Parameter template dan penerima per channel",
      summary:
        "Pilih source data atau input satu penerima dengan tujuan yang jelas.",
      steps: [
        "Buat campaign dan pilih Mode penerima: Dari source data untuk CSV/XLSX/API, atau Input langsung untuk satu penerima.",
        "Pilih template. Setiap kartu menampilkan jumlah/nama parameter. Kolom parameter berubah saat template diganti; template tanpa parameter tidak meminta nilai.",
        "Pilih kolom tujuan untuk setiap channel, atau isi email/nomor/Slack ID/Telegram chat ID/Push token pada input langsung. Isi nilai atau mapping untuk parameter yang tampil.",
        "Gunakan Buat template untuk channel lain bila belum tersedia. Periksa Preview, biaya dan jadwal, lalu ajukan approval.",
        "Pada detail campaign, periksa contoh tujuan dan isi tiap channel sebelum menyetujui.",
      ],
      note: "Slack/Telegram/Push menggunakan simulasi pada versi ini. Token Push penerima berbeda dari subscription notifikasi internal pengguna. Input langsung disimpan sebagai dataset berversi dengan cakupan tim.",
    },
    enText: {
      title: "Template parameters and channel recipients",
      summary:
        "Choose source data or a single recipient with explicit destinations.",
      steps: [
        "Create a campaign and select Recipient mode: From source data for CSV/XLSX/API, or Direct input for one recipient.",
        "Select a template. Cards show parameter names/counts. Fields change when the template changes; a template with no parameters asks for no values.",
        "Map a destination column per channel or enter the email/phone/Slack ID/Telegram chat ID/Push token directly. Supply values or column mappings for the displayed parameters.",
        "Create a template for another channel if needed. Check previews, costs and schedule, then submit for approval.",
        "Review one destination/content sample per channel in campaign details before approving.",
      ],
      note: "Slack/Telegram/Push use simulation in this version. Customer Push tokens are separate from internal user notification subscriptions. Direct input creates a versioned team-scoped dataset.",
    },
  },
  {
    id: "integration-management",
    menu: "providers",
    permission: "admin:write",
    idText: {
      title: "Integration, sender dan rate card",
      summary:
        "Kelola konfigurasi API, credentials dan kontrak tarif yang dapat ditelusuri.",
      steps: [
        "Buka Vendor & integrasi → Integrations → Tambah provider. Form muncul di atas daftar; pilih simulator atau Generic HTTP.",
        "Untuk HTTP isi endpoint, method, authentication, header JSON, body mapping dan response message ID path. Preview dapat menggunakan template dan contoh parameter; validasi ini tidak menghubungi vendor.",
        "Validasi mapping lalu publikasikan. Di Account & sender, buat account dari definisi yang dipublikasikan, isi sender serta identitas channel dan credentials. Secret tidak ditampilkan kembali.",
        "Gunakan Versi baru untuk perubahan sender atau rotasi sebagian credentials; key lain dipertahankan. Penghapusan seluruh credentials merupakan pilihan eksplisit.",
        "Di Rate cards tambahkan tarif per account/channel, currency dan waktu berlaku. Currency selain IDR memerlukan kurs ke IDR; budget/ledger tetap IDR.",
      ],
      note: "Konfigurasi HTTP tersimpan belum berarti transport nyata aktif. Implementasi adapter dan sandbox vendor/Meta masih diperlukan. Kurs diisi admin, bukan diambil otomatis.",
    },
    enText: {
      title: "Integrations, senders and rate cards",
      summary:
        "Manage API configuration, credentials and traceable pricing contracts.",
      steps: [
        "Open Providers & integrations → Integrations → Add provider. Forms appear above lists; choose simulator or Generic HTTP.",
        "For HTTP enter endpoint, method, authentication, JSON headers/body and response message ID path. Preview can use a template and sample parameters; validation makes no vendor contact.",
        "Validate mappings and publish. Under Account & sender create an account from the published definition, with sender/channel identity and encrypted credentials. Secrets are never shown again.",
        "Create a new version for sender changes or partial credential rotation; other keys are retained. Clearing all credentials requires explicit selection.",
        "Under Rate cards set account/channel, currency and effective time. Non-IDR prices require an FX rate to IDR; budgets/ledger remain IDR.",
      ],
      note: "Saved HTTP configuration is not active real transport. Vendor/Meta adapter and sandbox verification remain necessary. The administrator supplies FX; no automatic rate feed is used.",
    },
  },
);
