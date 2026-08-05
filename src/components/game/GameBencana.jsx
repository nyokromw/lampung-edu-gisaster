'use client'

// ============================================================
//  SIGANA 3D v2.1 — Game Survival Bencana | Lampung Edu Gisaster
//  4 mode: Banjir, Tanah Longsor, Gempa Bumi, Tsunami
//  3 tahap: PRA (rumah + tas siaga) → SAAT (evakuasi) → PASCA (pemulihan)
//  Semua ikon memakai SVG vektor (tanpa emoji)
// ============================================================

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// ---------------- IKON VEKTOR (viewBox 24, stroke) ----------------
const IKON = {
  banjir: ['M4 11l8-7 8 7', 'M2 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2', 'M2 21c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2'],
  tsunami: ['M3 18c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3', 'M15 12a8 8 0 0 0-10-7c4 .5 6.5 3 7 7'],
  longsor: ['M3 20L10 7l4 7 3-4 4 10z', 'M8 20l2-3'],
  gempa: ['M6 21V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v16', 'M15 21v-9h4v9', 'M9 8h2', 'M9 12h2', 'M3 21h18'],
  dokumen: ['M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  air: ['M12 3c3.5 4.5 6 7.7 6 10.5a6 6 0 0 1-12 0C6 10.7 8.5 7.5 12 3z'],
  makanan: ['M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z', 'M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6'],
  senter: ['M8 3h8v4l-2 3v11h-4V10L8 7z', 'M12 13v3'],
  p3k: ['M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z', 'M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M12 11v6', 'M9 14h6'],
  radio: ['M4 9h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z', 'M7 9l10-6', 'M13.5 14.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M6 13h4', 'M6 16h4'],
  peluit: ['M4 14a5 5 0 1 0 10 0a5 5 0 1 0-10 0', 'M13.5 12l7.5-3v5l-6 1.6'],
  pakaian: ['M8 4l4 2 4-2 4 4-3 2.5V20H7v-9.5L4 8z'],
  uang: ['M3 7h18v10H3z', 'M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M6 12h.01', 'M18 12h.01'],
  masker: ['M4 10c0-2.2 3.6-4 8-4s8 1.8 8 4v3.5c0 2.5-3.6 4.5-8 4.5s-8-2-8-4.5z', 'M4 10L2 9', 'M4 13l-2 1', 'M20 10l2-1', 'M20 13l2 1', 'M9 11h6', 'M9 14h6'],
  perbaikan: ['M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0', 'M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M4.9 4.9L7 7', 'M17 17l2.1 2.1', 'M19.1 4.9L17 7', 'M7 17l-2.1 2.1'],
  bendera: ['M6 21V4', 'M6 5h11l-2.5 3.5L17 12H6'],
  peringatan: ['M12 3L2 21h20z', 'M12 10v5', 'M12 18h.01'],
  hati: ['M12 20S3.5 15 3.5 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8.5 3.5C20.5 15 12 20 12 20z'],
  tas: ['M8 7V5a4 4 0 0 1 8 0v2', 'M5 7h14v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z', 'M9 13h6v4H9z'],
  jam: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M12 7v5l3 2'],
  lari: ['M13 2L4 14h6l-1 8 9-12h-6z'],
  perisai: ['M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5z', 'M9 12l2 2 4-4'],
  piala: ['M7 4h10v4a5 5 0 0 1-10 0z', 'M7 5H4a3 3 0 0 0 3.5 3.5', 'M17 5h3a3 3 0 0 1-3.5 3.5', 'M12 13v4', 'M8 21h8', 'M10 17h4v4'],
  gagal: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0', 'M9 9l6 6', 'M15 9l-6 6'],
  ulang: ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v4h-4'],
  rumah: ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  lokasi: ['M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z', 'M9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'],
  atas: ['M6 15l6-6 6 6'],
  bawah: ['M6 9l6 6 6-6'],
  kiri: ['M15 6l-6 6 6 6'],
  kanan: ['M9 6l6 6-6 6'],
}

function Ikon({ jenis, className = 'w-5 h-5', strokeWidth = 1.8 }) {
  const paths = IKON[jenis] || []
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

// sprite 3D dari ikon vektor: glyph putih di atas lingkaran berwarna
function spriteIkon(jenis, warnaBg = '#f59e0b', ukuran = 2.2) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2)
  g.fillStyle = warnaBg; g.fill()
  g.lineWidth = 7; g.strokeStyle = '#ffffff'; g.stroke()
  const sc = 3.1
  g.save()
  g.translate(64 - 12 * sc, 64 - 12 * sc)
  g.scale(sc, sc)
  g.strokeStyle = '#ffffff'
  g.lineWidth = 1.9
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const d of IKON[jenis] || []) g.stroke(new Path2D(d))
  g.restore()
  const spr = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })
  )
  spr.scale.set(ukuran, ukuran, 1)
  return spr
}

// ---------------- KONFIGURASI ----------------
const SC = 1.55
const BATAS = 56 * SC

const gauss = (x, z, cx, cz, r, h) =>
  h * Math.exp(-(((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r)))

const MODES = {
  banjir: {
    nama: 'Banjir',
    langit: 0x8fb8d8,
    deskripsi: 'Air sungai meluap dan menggenangi permukiman secara perlahan.',
    briefing:
      'Hujan deras berhari-hari membuat sungai meluap. Air akan naik terus-menerus. Larilah ke dataran TINGGI mengikuti rambu jalur evakuasi. Hindari air dalam — dan hati-hati, banyak jalan terhalang pohon tumbang!',
    tinggi: (x, z) =>
      2.2 -
      2.6 * Math.exp(-((x + 18) ** 2) / 98) +
      gauss(x, z, 45, -40, 15, 7) +
      gauss(x, z, 42, 45, 13, 5.5) +
      gauss(x, z, -50, 42, 12, 3.5) +
      0.3 * Math.sin(x * 0.15) * Math.cos(z * 0.12),
    rawan: function (x, z) {
      const h = this.tinggi(x, z)
      return h < 1.1 ? 2 : h < 2.5 ? 1 : 0
    },
    spawn: [0, 20],
    goal: [45, -40],
    goalLabel: 'Bukit Evakuasi',
  },
  longsor: {
    nama: 'Tanah Longsor',
    langit: 0x9fb3a8,
    deskripsi: 'Lereng jenuh air runtuh dan material meluncur ke bawah.',
    briefing:
      'Hujan deras mengguyur lereng di sisi TIMUR. Tanah mulai retak! Saat longsor terjadi, JANGAN lari searah luncuran — larilah MENJAUH dan MENYAMPING mengikuti rambu evakuasi. Waspadai batu berjatuhan dan jalan yang terputus.',
    tinggi: (x, z) =>
      1.6 +
      (x > 12 ? (x - 12) * 0.38 : 0) +
      gauss(x, z, 60, 0, 26, 9) +
      gauss(x, z, -45, -42, 14, 3.2) +
      0.25 * Math.sin(x * 0.13) * Math.cos(z * 0.14),
    rawan: (x, z) =>
      x > 6 && Math.abs(z) < 30 ? 2 : x > -12 && Math.abs(z) < 42 ? 1 : 0,
    spawn: [-5, 0],
    goal: [-45, -42],
    goalLabel: 'Titik Aman',
  },
  gempa: {
    nama: 'Gempa Bumi',
    langit: 0xbcd0e0,
    deskripsi: 'Guncangan kuat merobohkan bangunan di dekat jalur sesar.',
    briefing:
      'Kota ini dilewati JALUR SESAR aktif (garis gelap). Saat guncangan: BERLINDUNG (tahan tombol C) — jangan berlari! Setelah reda, evakuasi ke LAPANGAN TERBUKA mengikuti rambu, jauhi bangunan, dan waspadai gempa susulan serta reruntuhan yang menutup jalan.',
    tinggi: (x, z) => 1.4 + 0.35 * Math.sin(x * 0.09) * Math.cos(z * 0.11),
    rawan: (x) => {
      const d = Math.abs(x - 10)
      return d < 9 ? 2 : d < 24 ? 1 : 0
    },
    spawn: [-10, -12],
    goal: [-40, 36],
    goalLabel: 'Lapangan Terbuka',
  },
  tsunami: {
    nama: 'Tsunami',
    langit: 0x9cc4d8,
    deskripsi: 'Gempa di laut memicu gelombang raksasa menghantam pesisir.',
    briefing:
      'Kamu tinggal di kawasan PESISIR (laut di timur). Jika terjadi gempa kuat: BERLINDUNG selama guncangan, lalu SEGERA lari ke BUKIT mengikuti rambu evakuasi tanpa menunggu sirine. Waktumu hanya beberapa menit — dan jalanan tidak selalu mulus!',
    tinggi: (x, z) => {
      const t = Math.max(0, Math.min(1.4, (-x + 30) / 30))
      return Math.max(
        -1.3,
        -1 + t * 3 + gauss(x, z, -46, -8, 17, 8) + 0.15 * Math.sin(z * 0.2)
      )
    },
    rawan: (x) => (x > -2 ? 2 : x > -24 ? 1 : 0),
    spawn: [-5, 20],
    goal: [-46, -8],
    goalLabel: 'Bukit Evakuasi',
  },
}

const DIFF = {
  mudah: { label: 'Mudah', tasWaktu: 200, evakWaktu: 150, recWaktu: 130, mult: 0.72, drain: 0.7 },
  normal: { label: 'Normal', tasWaktu: 140, evakWaktu: 115, recWaktu: 100, mult: 1, drain: 1 },
  sulit: { label: 'Sulit', tasWaktu: 95, evakWaktu: 85, recWaktu: 75, mult: 1.3, drain: 1.35 },
}

// Isi tas siaga sesuai anjuran BNPB
const ITEMS = [
  {
    ikon: 'dokumen', nama: 'Dokumen Penting',
    tanya: 'Mengapa salinan dokumen penting (KK, KTP, ijazah) harus masuk tas siaga?',
    opsi: [
      'Untuk dijual jika butuh uang darurat',
      'Sulit & lama diurus ulang jika hilang, penting untuk bantuan & administrasi pasca bencana',
      'Sebagai bahan bakar untuk menyalakan api unggun',
      'Agar tas terlihat lebih penuh dan rapi',
    ],
    benar: 1,
    info: 'Simpan salinan dokumen dalam map plastik kedap air. Dokumen dibutuhkan untuk klaim bantuan dan pengurusan administrasi pasca bencana.',
  },
  {
    ikon: 'air', nama: 'Air Minum',
    tanya: 'Berapa lama persediaan air minum yang disarankan BNPB dalam tas siaga?',
    opsi: ['Cukup untuk 1 jam', 'Cukup untuk ±3 hari', 'Tidak perlu, cari sumber air di jalan', 'Cukup untuk 2 minggu penuh'],
    benar: 1,
    info: 'Manusia hanya bertahan beberapa hari tanpa air. Siapkan air minum kemasan untuk kebutuhan ±3 hari pertama sebelum bantuan datang.',
  },
  {
    ikon: 'makanan', nama: 'Makanan Tahan Lama',
    tanya: 'Jenis makanan apa yang paling tepat untuk tas siaga bencana?',
    opsi: [
      'Makanan beku yang harus dimasak dulu',
      'Buah dan sayur segar',
      'Makanan siap santap & awet: biskuit, abon, makanan kaleng',
      'Mi instan mentah tanpa air',
    ],
    benar: 2,
    info: 'Pilih makanan yang tidak mudah basi dan bisa langsung dimakan tanpa dimasak, karena listrik dan gas bisa padam.',
  },
  {
    ikon: 'senter', nama: 'Senter & Baterai',
    tanya: 'Mengapa senter lebih diandalkan daripada lampu rumah saat bencana?',
    opsi: [
      'Cahayanya lebih terang dari lampu rumah',
      'Listrik biasanya padam saat bencana, senter tetap menyala dengan baterai',
      'Senter bisa dipakai memanggil pesawat',
      'Lampu rumah boros energi',
    ],
    benar: 1,
    info: 'Jaringan listrik hampir selalu padam saat bencana besar. Senter + baterai cadangan adalah sumber cahaya paling andal.',
  },
  {
    ikon: 'p3k', nama: 'Kotak P3K & Obat',
    tanya: 'Selain perlengkapan P3K umum, apa yang WAJIB ditambahkan sesuai kondisi keluarga?',
    opsi: [
      'Obat-obatan pribadi/rutin anggota keluarga (mis. obat darah tinggi, asma)',
      'Vitamin penambah tinggi badan',
      'Suplemen olahraga',
      'Obat tidur agar bisa istirahat',
    ],
    benar: 0,
    info: 'Luka kecil mudah terinfeksi saat bencana, dan penderita penyakit kronis bisa kambuh tanpa obat rutinnya. Sertakan obat pribadi!',
  },
  {
    ikon: 'radio', nama: 'Radio / Powerbank',
    tanya: 'Apa fungsi utama radio baterai atau HP + powerbank saat bencana?',
    opsi: [
      'Untuk hiburan mendengarkan musik',
      'Memantau informasi resmi (BMKG/BPBD) & menghubungi keluarga',
      'Untuk bermain game menunggu bantuan',
      'Menakut-nakuti hewan liar dengan suara keras',
    ],
    benar: 1,
    info: 'Informasi resmi dari BMKG/BPBD mencegah kita termakan hoaks dan membantu mengambil keputusan evakuasi yang tepat.',
  },
  {
    ikon: 'peluit', nama: 'Peluit',
    tanya: 'Mengapa peluit lebih efektif daripada berteriak saat terjebak reruntuhan?',
    opsi: [
      'Suara peluit nyaring & hemat tenaga, teriakan cepat menghabiskan energi',
      'Peluit bisa mengusir nyamuk',
      'Tim SAR hanya merespons suara peluit',
      'Berteriak dilarang saat bencana',
    ],
    benar: 0,
    info: 'Meniup peluit jauh lebih hemat energi daripada berteriak, dan bunyinya menembus reruntuhan lebih baik. Alat kecil penyelamat nyawa.',
  },
  {
    ikon: 'pakaian', nama: 'Pakaian & Selimut',
    tanya: 'Mengapa pakaian ganti dan jaket/selimut penting dalam tas siaga?',
    opsi: [
      'Agar tetap tampil modis di pengungsian',
      'Untuk dijadikan bendera tanda bahaya',
      'Mencegah hipotermia — tubuh basah & kedinginan bisa berakibat fatal',
      'Sebagai alas duduk di tenda',
    ],
    benar: 2,
    info: 'Tubuh yang basah dan kedinginan berisiko hipotermia, terutama bagi anak-anak dan lansia. Pakaian kering menjaga suhu tubuh.',
  },
  {
    ikon: 'uang', nama: 'Uang Tunai',
    tanya: 'Mengapa perlu menyiapkan uang TUNAI, bukan hanya kartu ATM/e-wallet?',
    opsi: [
      'Uang tunai lebih ringan dibawa',
      'ATM & jaringan pembayaran digital sering mati saat bencana',
      'Harga barang lebih murah jika bayar tunai',
      'Bank tutup selamanya setelah bencana',
    ],
    benar: 1,
    info: 'Saat listrik dan jaringan internet padam, ATM dan pembayaran digital tidak bisa dipakai. Uang tunai secukupnya sangat membantu.',
  },
  {
    ikon: 'masker', nama: 'Masker',
    tanya: 'Apa fungsi masker dalam tas siaga bencana?',
    opsi: [
      'Menyaring udara kotor: debu reruntuhan, abu, dan mencegah penularan penyakit di pengungsian',
      'Menyamarkan wajah dari kamera',
      'Menghangatkan wajah saat malam',
      'Syarat wajib masuk tenda pengungsian',
    ],
    benar: 0,
    info: 'Udara pasca bencana penuh debu/abu, dan pengungsian yang padat rawan penularan penyakit pernapasan. Masker melindungi keduanya.',
  },
]

// Tugas pemulihan (PASCA BENCANA) per mode
const RECOVERY = {
  banjir: [
    {
      ikon: 'rumah', judul: 'Rumah Terendam',
      tanya: 'Air sudah surut dan kamu ingin masuk rumah. Apa langkah PERTAMA yang aman?',
      opsi: [
        'Langsung masuk dan nyalakan lampu untuk memeriksa',
        'Pastikan aliran listrik DIPADAMKAN dari meteran sebelum masuk',
        'Nyalakan kompor untuk mengeringkan ruangan',
        'Tunggu 1 bulan tanpa melakukan apa pun',
      ],
      benar: 1,
      info: 'Instalasi listrik yang terendam bisa menyetrum. Padamkan listrik dari meteran/MCB dulu, dan periksa bersama petugas bila ragu.',
    },
    {
      ikon: 'peringatan', judul: 'Bersih-Bersih Lumpur',
      tanya: 'Apa yang wajib dipakai saat membersihkan lumpur sisa banjir?',
      opsi: [
        'Sandal jepit agar tidak licin',
        'Tidak perlu alat apa pun, yang penting cepat',
        'Sepatu bot & sarung tangan — lumpur banjir rawan bakteri leptospirosis',
        'Kacamata renang',
      ],
      benar: 2,
      info: 'Air dan lumpur banjir dapat mengandung bakteri leptospirosis dari kencing tikus yang masuk lewat luka kecil di kulit. Lindungi kaki dan tanganmu!',
    },
    {
      ikon: 'air', judul: 'Sumber Air Tercemar',
      tanya: 'Sumur warga tercampur air banjir. Bagaimana mendapat air minum yang aman?',
      opsi: [
        'Minum langsung, air sumur selalu bersih',
        'Rebus air sampai mendidih atau gunakan air kemasan/bantuan',
        'Saring dengan kain lalu langsung minum',
        'Tambahkan garam agar kumannya mati',
      ],
      benar: 1,
      info: 'Air yang tercemar banjir bisa membawa kuman diare & penyakit kulit. Rebus hingga mendidih, atau gunakan air kemasan dari posko bantuan.',
    },
    {
      ikon: 'dokumen', judul: 'Pendataan Kerusakan',
      tanya: 'Rumah dan fasilitas umum rusak. Ke mana kerusakan sebaiknya dilaporkan?',
      opsi: [
        'Ke media sosial agar viral',
        'Tidak perlu dilaporkan, perbaiki sendiri',
        'Ke RT/kelurahan dan BPBD agar terdata untuk bantuan perbaikan',
        'Ke stasiun televisi',
      ],
      benar: 2,
      info: 'Pendataan resmi melalui RT/kelurahan dan BPBD adalah dasar penyaluran bantuan perbaikan (rehabilitasi & rekonstruksi).',
    },
    {
      ikon: 'p3k', judul: 'Kesehatan Pasca Banjir',
      tanya: 'Beberapa hari setelah banjir, penyakit apa yang paling perlu diwaspadai?',
      opsi: [
        'Diare, leptospirosis, dan penyakit kulit',
        'Patah tulang',
        'Sakit gigi',
        'Rabun jauh',
      ],
      benar: 0,
      info: 'Genangan dan sanitasi buruk memicu diare, leptospirosis, DBD, dan penyakit kulit. Jaga kebersihan dan segera periksa bila demam.',
    },
  ],
  longsor: [
    {
      ikon: 'peringatan', judul: 'Zona Longsoran',
      tanya: 'Setelah longsor berhenti, bolehkah segera kembali ke rumah di zona longsoran?',
      opsi: [
        'Boleh, longsor tidak akan terulang',
        'JANGAN — longsor susulan sangat mungkin terjadi, tunggu pernyataan aman dari petugas',
        'Boleh asal berjalan pelan-pelan',
        'Boleh jika hujan sudah berhenti 10 menit',
      ],
      benar: 1,
      info: 'Lereng yang sudah bergerak sangat labil. Longsor susulan sering terjadi. Tunggu pemeriksaan dan pernyataan aman dari BPBD.',
    },
    {
      ikon: 'perbaikan', judul: 'Jalan Tertutup Material',
      tanya: 'Jalan desa tertutup material longsor. Tindakan yang tepat adalah…',
      opsi: [
        'Membersihkan sendirian dengan tangan kosong',
        'Melaporkan ke BPBD/PU dan memasang rambu peringatan sementara',
        'Membakar material agar cepat hilang',
        'Membiarkannya saja selamanya',
      ],
      benar: 1,
      info: 'Pembersihan material longsor butuh alat berat dan penilaian kestabilan lereng. Laporkan, dan pasang tanda agar warga tidak melintas.',
    },
    {
      ikon: 'longsor', judul: 'Lereng Gundul',
      tanya: 'Agar lereng tidak mudah longsor lagi, upaya jangka panjang yang tepat adalah…',
      opsi: [
        'Menanami lereng dengan vegetasi berakar kuat & memperbaiki drainase',
        'Menyiram lereng setiap hari agar padat',
        'Membangun lebih banyak rumah di lereng',
        'Mengecat lereng dengan semen tipis',
      ],
      benar: 0,
      info: 'Akar tanaman mengikat tanah dan drainase yang baik mencegah lereng jenuh air — dua kunci mitigasi longsor jangka panjang.',
    },
    {
      ikon: 'rumah', judul: 'Rumah di Zona Merah',
      tanya: 'Rumah warga berada tepat di jalur longsoran. Solusi paling aman jangka panjang?',
      opsi: [
        'Relokasi ke tempat lebih aman sesuai arahan pemerintah',
        'Menambah lantai rumah jadi 3 tingkat',
        'Memasang pagar tinggi',
        'Tetap tinggal sambil berjaga bergantian',
      ],
      benar: 0,
      info: 'Untuk permukiman di jalur longsor aktif, relokasi adalah pilihan paling aman. Peta rawan bencana membantu menentukan lokasi baru.',
    },
    {
      ikon: 'dokumen', judul: 'Pendataan Warga',
      tanya: 'Apa manfaat pendataan warga terdampak setelah bencana?',
      opsi: [
        'Agar bisa difoto wartawan',
        'Memastikan semua warga selamat & bantuan tersalurkan tepat sasaran',
        'Untuk menentukan pemenang undian',
        'Tidak ada manfaatnya',
      ],
      benar: 1,
      info: 'Pendataan memastikan tidak ada korban yang terlewat, dan menjadi dasar distribusi bantuan logistik, hunian sementara, dan perbaikan.',
    },
  ],
  gempa: [
    {
      ikon: 'gempa', judul: 'Bangunan Retak',
      tanya: 'Rumahmu retak-retak setelah gempa. Apa yang harus dilakukan sebelum masuk?',
      opsi: [
        'Langsung masuk mengambil barang berharga',
        'Periksa kondisi struktur dari luar; jangan masuk bila retak parah — tunggu penilaian petugas',
        'Masuk sambil memakai helm saja',
        'Menutup retakan dengan lakban',
      ],
      benar: 1,
      info: 'Bangunan yang retak bisa runtuh saat gempa susulan. Tunggu penilaian kelayakan dari petugas sebelum masuk kembali.',
    },
    {
      ikon: 'peringatan', judul: 'Bau Gas Bocor',
      tanya: 'Tercium bau gas di dapur setelah gempa. Tindakan yang BENAR adalah…',
      opsi: [
        'Menyalakan lampu untuk memeriksa sumber bau',
        'Menyalakan korek api untuk melihat kebocoran',
        'Jangan nyalakan api/listrik, buka ventilasi, tutup regulator, menjauh',
        'Menyemprotkan pewangi ruangan',
      ],
      benar: 2,
      info: 'Percikan listrik atau api sekecil apa pun dapat memicu ledakan gas. Amankan regulator, buka jendela, dan menjauhlah.',
    },
    {
      ikon: 'radio', judul: 'Kabar Simpang Siur',
      tanya: 'Beredar pesan berantai "akan ada gempa lebih besar jam 9 malam". Sikapmu?',
      opsi: [
        'Sebarkan ke semua grup agar semua siaga',
        'Cek kebenarannya HANYA dari kanal resmi BMKG/BPBD — waktu gempa tidak bisa diprediksi',
        'Percaya karena pengirimnya teman dekat',
        'Panik dan mengungsi ke luar kota',
      ],
      benar: 1,
      info: 'Hingga kini TIDAK ADA teknologi yang bisa memprediksi waktu gempa. Informasi resmi hanya dari BMKG/BPBD — jangan sebarkan hoaks.',
    },
    {
      ikon: 'p3k', judul: 'Warga Terluka',
      tanya: 'Ada tetangga terluka ringan tertimpa reruntuhan. Bantuan awal yang tepat?',
      opsi: [
        'Berikan pertolongan pertama (P3K) & hubungi petugas medis/SAR untuk luka berat',
        'Memindahkannya kasar agar cepat',
        'Memberi minum kopi panas',
        'Menunggu tanpa melakukan apa pun',
      ],
      benar: 0,
      info: 'Gunakan isi tas siagamu! P3K untuk luka ringan; untuk korban terjepit/luka berat, jangan pindahkan sembarangan — panggil tim SAR/medis.',
    },
    {
      ikon: 'dokumen', judul: 'Pendataan Kerusakan',
      tanya: 'Banyak rumah rusak di kampungmu. Agar dapat bantuan rehabilitasi, kerusakan dilaporkan ke…',
      opsi: [
        'RT/kelurahan dan BPBD untuk pendataan resmi',
        'Grup media sosial saja',
        'Tidak perlu dilaporkan',
        'Perusahaan asuransi milik tetangga',
      ],
      benar: 0,
      info: 'Data kerusakan dari RT/kelurahan/BPBD menjadi dasar program rehabilitasi dan rekonstruksi pemerintah.',
    },
  ],
  tsunami: [
    {
      ikon: 'tsunami', judul: 'Kembali ke Pesisir',
      tanya: 'Gelombang pertama sudah lewat. Kapan boleh kembali ke kawasan pesisir?',
      opsi: [
        'Segera setelah air surut pertama kali',
        'Setelah ada pernyataan RESMI "ancaman berakhir" dari BMKG/BPBD — tsunami bisa datang berkali-kali',
        'Setelah 15 menit menunggu',
        'Saat melihat orang lain sudah turun',
      ],
      benar: 1,
      info: 'Tsunami terdiri dari BEBERAPA gelombang dan gelombang berikutnya bisa lebih besar. Tunggu pernyataan resmi ancaman berakhir.',
    },
    {
      ikon: 'gempa', judul: 'Bangunan Terdampak',
      tanya: 'Bangunan yang diterjang tsunami tampak masih berdiri. Amankah langsung dimasuki?',
      opsi: [
        'Aman, karena masih berdiri',
        'Tidak — struktur bisa keropos & bisa roboh; tunggu pemeriksaan petugas',
        'Aman jika masuk lewat jendela',
        'Aman jika hanya 5 menit',
      ],
      benar: 1,
      info: 'Terjangan air berkecepatan tinggi merusak struktur bangunan meski tampak utuh. Tunggu penilaian kelayakan dari petugas.',
    },
    {
      ikon: 'air', judul: 'Air & Sanitasi',
      tanya: 'Pasca tsunami, sumber air payau/tercemar. Yang paling tepat dilakukan…',
      opsi: [
        'Gunakan air bersih dari posko; rebus air sebelum diminum; jaga sanitasi',
        'Minum air laut karena melimpah',
        'Mandi di genangan bekas tsunami',
        'Tidak minum sama sekali selama seminggu',
      ],
      benar: 0,
      info: 'Air bekas tsunami bercampur air laut, lumpur, dan limbah. Gunakan pasokan air bersih posko dan selalu rebus sebelum diminum.',
    },
    {
      ikon: 'hati', judul: 'Pemulihan Psikologis',
      tanya: 'Adik kelasmu ketakutan dan sulit tidur setelah tsunami. Bantuan yang tepat?',
      opsi: [
        'Menyuruhnya melupakan kejadian itu sendirian',
        'Menemani, mengajak bicara/bermain, dan menghubungkan ke layanan dukungan psikososial',
        'Menakut-nakutinya agar terbiasa',
        'Memberinya tontonan berita bencana terus-menerus',
      ],
      benar: 1,
      info: 'Pemulihan bukan hanya fisik. Dukungan psikososial (trauma healing) membantu penyintas, terutama anak-anak, pulih dari trauma.',
    },
    {
      ikon: 'dokumen', judul: 'Pendataan & Bantuan',
      tanya: 'Agar bantuan hunian & perbaikan tepat sasaran, warga terdampak harus…',
      opsi: [
        'Terdata resmi melalui RT/kelurahan dan BPBD',
        'Menunggu di rumah masing-masing tanpa lapor',
        'Mendaftar lewat undian',
        'Pindah kota tanpa memberi tahu siapa pun',
      ],
      benar: 0,
      info: 'Pendataan resmi adalah pintu masuk program bantuan: hunian sementara, jaminan hidup, hingga rekonstruksi rumah.',
    },
  ],
}

const KULIT = ['#f5cba7', '#d19a6a', '#8d5a3b']

// ---------------- HELPER 3D ----------------
function teksturWajah(gender, kulit) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = kulit
  g.fillRect(0, 0, 128, 128)
  const mataY = 58
  ;[40, 88].forEach((x) => {
    g.fillStyle = '#fff'
    g.beginPath(); g.ellipse(x, mataY, 11, 13, 0, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#3d2b1f'
    g.beginPath(); g.arc(x, mataY + 2, 6, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#000'
    g.beginPath(); g.arc(x, mataY + 2, 3, 0, Math.PI * 2); g.fill()
    g.fillStyle = '#fff'
    g.beginPath(); g.arc(x + 2, mataY - 1, 2, 0, Math.PI * 2); g.fill()
    g.strokeStyle = '#3d2b1f'; g.lineWidth = 4
    g.beginPath(); g.moveTo(x - 10, mataY - 18); g.quadraticCurveTo(x, mataY - 23, x + 10, mataY - 18); g.stroke()
    if (gender === 'perempuan') {
      g.strokeStyle = '#222'; g.lineWidth = 2
      g.beginPath(); g.moveTo(x - 11, mataY - 8); g.lineTo(x - 14, mataY - 12); g.stroke()
      g.beginPath(); g.moveTo(x + 11, mataY - 8); g.lineTo(x + 14, mataY - 12); g.stroke()
    }
  })
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3
  g.beginPath(); g.moveTo(64, 68); g.lineTo(64, 80); g.stroke()
  g.strokeStyle = gender === 'perempuan' ? '#c0392b' : '#7a4636'
  g.lineWidth = gender === 'perempuan' ? 6 : 4
  g.beginPath(); g.moveTo(48, 96); g.quadraticCurveTo(64, 106, 80, 96); g.stroke()
  g.fillStyle = 'rgba(255,120,120,0.25)'
  g.beginPath(); g.arc(30, 84, 9, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(98, 84, 9, 0, Math.PI * 2); g.fill()
  return new THREE.CanvasTexture(c)
}

function buatKarakter({ gender, kulit }) {
  const grp = new THREE.Group()
  const matKulit = new THREE.MeshLambertMaterial({ color: new THREE.Color(kulit) })
  const matBaju = new THREE.MeshLambertMaterial({ color: gender === 'perempuan' ? 0xe0529c : 0x2e77d0 })
  const matCelana = new THREE.MeshLambertMaterial({ color: 0x2f3b52 })
  const matRambut = new THREE.MeshLambertMaterial({ color: gender === 'perempuan' ? 0x4a2c14 : 0x1d1d1d })

  const kakiG = new THREE.BoxGeometry(0.32, 0.85, 0.32)
  const kakiKi = new THREE.Mesh(kakiG, matCelana)
  const kakiKa = new THREE.Mesh(kakiG, matCelana)
  kakiKi.position.set(-0.22, 0.425, 0)
  kakiKa.position.set(0.22, 0.425, 0)
  const badan = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.55), matBaju)
  badan.position.y = 1.37
  const tas = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.3), new THREE.MeshLambertMaterial({ color: 0xd97706 }))
  tas.position.set(0, 1.42, -0.45)
  tas.visible = false
  const lenganG = new THREE.BoxGeometry(0.28, 0.95, 0.28)
  const lenganKi = new THREE.Mesh(lenganG, matKulit)
  const lenganKa = new THREE.Mesh(lenganG, matKulit)
  lenganKi.position.set(-0.62, 1.4, 0)
  lenganKa.position.set(0.62, 1.4, 0)
  const matWajah = new THREE.MeshLambertMaterial({ map: teksturWajah(gender, kulit) })
  const kepala = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.78, 0.78),
    [matKulit, matKulit, matKulit, matKulit, matWajah, matKulit]
  )
  kepala.position.y = 2.33
  const rambutAtas = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.3, 0.84), matRambut)
  rambutAtas.position.y = 2.72
  const rambutBel = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.62, 0.2), matRambut)
  rambutBel.position.set(0, 2.42, -0.42)
  grp.add(kakiKi, kakiKa, badan, tas, lenganKi, lenganKa, kepala, rambutAtas, rambutBel)
  if (gender === 'perempuan') {
    const rambutPjg = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.9, 0.22), matRambut)
    rambutPjg.position.set(0, 1.85, -0.45)
    grp.add(rambutPjg)
  }
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true })
  grp.userData = { kakiKi, kakiKa, lenganKi, lenganKa, tas }
  return grp
}

function buatRumah(warna = 0xf5e6c8, skala = 1) {
  const grp = new THREE.Group()
  const dinding = new THREE.Mesh(
    new THREE.BoxGeometry(4 * skala, 2.6 * skala, 3.4 * skala),
    new THREE.MeshLambertMaterial({ color: warna })
  )
  dinding.position.y = 1.3 * skala
  const atap = new THREE.Mesh(
    new THREE.ConeGeometry(3.3 * skala, 1.9 * skala, 4),
    new THREE.MeshLambertMaterial({ color: 0xb03a2e })
  )
  atap.position.y = 3.55 * skala
  atap.rotation.y = Math.PI / 4
  const pintu = new THREE.Mesh(
    new THREE.BoxGeometry(0.9 * skala, 1.5 * skala, 0.1),
    new THREE.MeshLambertMaterial({ color: 0x6e3b1f })
  )
  pintu.position.set(0, 0.75 * skala, 1.72 * skala)
  const jendela = new THREE.Mesh(
    new THREE.BoxGeometry(1 * skala, 0.8 * skala, 0.08),
    new THREE.MeshLambertMaterial({ color: 0xaed6f1, emissive: 0x223344 })
  )
  jendela.position.set(1.2 * skala, 1.5 * skala, 1.72 * skala)
  grp.add(dinding, atap, pintu, jendela)
  grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  return grp
}

function buatPohon() {
  const grp = new THREE.Group()
  const batang = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x6e4a2f })
  )
  batang.position.y = 0.8
  const daun = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 2.6, 7),
    new THREE.MeshLambertMaterial({ color: 0x2e8b57 })
  )
  daun.position.y = 2.8
  grp.add(batang, daun)
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return grp
}

function buatPohonTumbang(panjang = 6) {
  const grp = new THREE.Group()
  const batang = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.6, panjang, 8),
    new THREE.MeshLambertMaterial({ color: 0x5e3f28 })
  )
  batang.rotation.z = Math.PI / 2
  batang.position.y = 0.55
  const daun = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a6b45 })
  )
  daun.position.set(panjang / 2, 0.9, 0)
  grp.add(batang, daun)
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return grp
}

function buatPagar(panjang = 12) {
  const grp = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 })
  const papan = new THREE.Mesh(new THREE.BoxGeometry(panjang, 0.35, 0.14), mat)
  papan.position.y = 1.15
  const papan2 = papan.clone(); papan2.position.y = 0.65
  grp.add(papan, papan2)
  const n = Math.floor(panjang / 1.6)
  for (let i = 0; i <= n; i++) {
    const tiang = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22), mat)
    tiang.position.set(-panjang / 2 + (i * panjang) / n, 0.8, 0)
    grp.add(tiang)
  }
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return grp
}

function buatRambu() {
  const grp = new THREE.Group()
  const tiang = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x888888 })
  )
  tiang.position.y = 1.3
  const c = document.createElement('canvas')
  c.width = 256; c.height = 96
  const g = c.getContext('2d')
  g.fillStyle = '#0b7a3b'; g.fillRect(0, 0, 256, 96)
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 88)
  g.fillStyle = '#fff'
  g.font = 'bold 26px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'
  g.fillText('JALUR', 16, 30)
  g.fillText('EVAKUASI', 16, 62)
  // panah vektor
  g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(168, 48); g.lineTo(232, 48)
  g.moveTo(210, 28); g.lineTo(232, 48); g.lineTo(210, 68)
  g.stroke()
  const papan = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.9, 0.08),
    new THREE.MeshLambertMaterial({ map: new THREE.CanvasTexture(c) })
  )
  papan.position.y = 2.35
  grp.add(tiang, papan)
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return grp
}

function buatGoal(label) {
  const grp = new THREE.Group()
  const tiang = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0xdddddd })
  )
  tiang.position.y = 2.5
  const bendera = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1, 0.06),
    new THREE.MeshLambertMaterial({ color: 0x16a34a, side: THREE.DoubleSide })
  )
  bendera.position.set(0.95, 4.3, 0)
  const cincin = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.18, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.85 })
  )
  cincin.rotation.x = -Math.PI / 2
  cincin.position.y = 0.15
  const sinar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.6, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  )
  sinar.position.y = 17
  const tanda = spriteIkon('bendera', '#16a34a', 3.2)
  tanda.position.y = 7.5
  grp.add(tiang, bendera, cincin, sinar, tanda)
  grp.userData.cincin = cincin
  grp.userData.label = label
  return grp
}

// ---------------- KOMPONEN UTAMA ----------------
export default function GameBencana() {
  const [layar, setLayar] = useState('menu')
  const [mode, setMode] = useState('banjir')
  const [tingkat, setTingkat] = useState('normal')
  const [gender, setGender] = useState('laki')
  const [kulit, setKulit] = useState(KULIT[0])
  const [runId, setRunId] = useState(0)

  const [fase, setFase] = useState('rumah')
  const [hp, setHp] = useState(100)
  const [timer, setTimer] = useState(0)
  const [pesan, setPesan] = useState('')
  const [zonaSkrg, setZonaSkrg] = useState(0)
  const [tasIsi, setTasIsi] = useState([])
  const [recSelesai, setRecSelesai] = useState(0)
  const [kuis, setKuis] = useState(null)
  const [briefFase, setBriefFase] = useState(null)
  const [instruksi, setInstruksi] = useState('')
  const [hasil, setHasil] = useState(null)

  const mountRef = useRef(null)
  const minimapRef = useRef(null)
  const apiRef = useRef({})
  const keysRef = useRef({})
  const crouchRef = useRef(false)
  const pausedRef = useRef(false)
  const targetRef = useRef(null)

  const M = MODES[mode]
  const D = DIFF[tingkat]
  const TAHAP = { rumah: 'PRA BENCANA', tas: 'PRA BENCANA', bencana: 'SAAT BENCANA', pemulihan: 'PASCA BENCANA' }

  const mulai = () => {
    setFase('rumah'); setHp(100); setTimer(0); setTasIsi([]); setRecSelesai(0)
    setKuis(null); setHasil(null); setPesan(''); setInstruksi('')
    pausedRef.current = false
    setBriefFase({
      judul: `Misi: Selamat dari ${M.nama}`,
      isi: M.briefing,
      langkah: [
        'PRA BENCANA — (1) pilih lokasi rumah dengan membaca peta rawan (hijau aman, kuning waspada, merah rawan), lalu (2) isi tas siaga: jawab kuis tiap barang sebelum waktu habis.',
        'SAAT BENCANA — evakuasi berbatas waktu. Ikuti rambu JALUR EVAKUASI, hindari bahaya, pohon tumbang, dan jalan buntu.',
        'PASCA BENCANA — kembali ke permukiman dan tangani 5 titik infrastruktur rusak dengan keputusan pemulihan yang benar, sebelum waktu habis.',
      ],
      tombol: 'Mulai Bermain',
      aksi: () => setBriefFase(null),
    })
    setLayar('main')
    setRunId((r) => r + 1)
  }

  const jawabKuis = (idx) => {
    if (!kuis || kuis.jawab != null) return
    setKuis({ ...kuis, jawab: idx })
  }
  const tutupKuis = () => {
    if (!kuis) return
    const benar = kuis.jawab === kuis.item.benar
    if (kuis.tipe === 'tas') {
      apiRef.current.selesaiKuis?.(kuis.item, benar)
      setTasIsi((t) => [...t, { ...kuis.item, benar }])
    } else {
      apiRef.current.selesaiRec?.(kuis.item, benar)
      setRecSelesai((n) => n + 1)
    }
    setKuis(null)
    pausedRef.current = false
  }

  // ---------- ENGINE ----------
  useEffect(() => {
    if (layar !== 'main') return
    const mount = mountRef.current
    if (!mount) return
    const cfgM = MODES[mode]
    const cfgD = DIFF[tingkat]

    const W = mount.clientWidth, H = mount.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(cfgM.langit)
    scene.fog = new THREE.Fog(cfgM.langit, 80, 210)
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 500)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x556b5f, 0.9))
    const matahari = new THREE.DirectionalLight(0xfff2d0, 1.1)
    matahari.position.set(60, 90, 40)
    matahari.castShadow = true
    matahari.shadow.mapSize.set(2048, 2048)
    matahari.shadow.camera.left = -110; matahari.shadow.camera.right = 110
    matahari.shadow.camera.top = 110; matahari.shadow.camera.bottom = -110
    scene.add(matahari)

    const tinggiDi = (x, z) => cfgM.tinggi(x / SC, z / SC)
    const rawanDi = (x, z) => cfgM.rawan(x / SC, z / SC)
    const GOAL = [cfgM.goal[0] * SC, cfgM.goal[1] * SC]
    const SPAWN = [cfgM.spawn[0] * SC, cfgM.spawn[1] * SC]

    // ---- terrain ----
    const SIZE = 200, SEG = 130
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const cAman = new THREE.Color('#5aa65c'), cWas = new THREE.Color('#d9c04a'),
      cRawan = new THREE.Color('#cf6a50'), cSesar = new THREE.Color('#3a3a3a'),
      cPasir = new THREE.Color('#d8c48f'), tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const h = tinggiDi(x, z)
      pos.setY(i, h)
      const zona = rawanDi(x, z)
      tmp.copy(zona === 2 ? cRawan : zona === 1 ? cWas : cAman)
      if (mode === 'gempa' && Math.abs(x / SC - 10) < 1.6) tmp.copy(cSesar)
      if (mode === 'tsunami' && h < 0.4 && h > -0.6) tmp.copy(cPasir)
      const shade = 0.86 + Math.min(0.2, Math.max(0, h) * 0.02) + Math.random() * 0.06
      tmp.multiplyScalar(shade)
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    const tanah = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }))
    tanah.receiveShadow = true
    scene.add(tanah)

    // ---- tabrakan ----
    const colliders = []
    const tabrak = (x, z, rad = 0.55) => {
      for (const c of colliders) {
        const dx = x - c.x, dz = z - c.z
        if (dx * dx + dz * dz < (c.r + rad) * (c.r + rad)) return true
      }
      return false
    }

    const rand = (a, b) => a + Math.random() * (b - a)
    const jauhDari = (x, z, px2, pz2, d) => Math.hypot(x - px2, z - pz2) > d

    // ---- rumah warga & pohon ----
    const bangunan = []
    for (let i = 0; i < 18; i++) {
      let x, z, coba = 0
      do { x = rand(-78, 78); z = rand(-78, 78); coba++ } while (
        coba < 40 && (rawanDi(x, z) === 2 || tinggiDi(x, z) < 0.6 ||
          !jauhDari(x, z, GOAL[0], GOAL[1], 12) || !jauhDari(x, z, SPAWN[0], SPAWN[1], 8))
      )
      const r = buatRumah(0xe8dcc0 + ((i * 1234) % 0x111111), 0.85)
      r.position.set(x, tinggiDi(x, z), z)
      r.rotation.y = rand(0, Math.PI * 2)
      scene.add(r); bangunan.push(r)
      colliders.push({ x, z, r: 2.6 })
    }
    for (let i = 0; i < 45; i++) {
      const x = rand(-82, 82), z = rand(-82, 82)
      if (tinggiDi(x, z) < 0.6 || !jauhDari(x, z, GOAL[0], GOAL[1], 6)) continue
      const p = buatPohon()
      p.position.set(x, tinggiDi(x, z), z)
      p.scale.setScalar(rand(0.9, 1.7))
      scene.add(p)
      colliders.push({ x, z, r: 0.7 })
    }

    // ---- barikade (jalan buntu) ----
    for (let i = 0; i < 9; i++) {
      const f = rand(0.2, 0.8)
      const cx = SPAWN[0] + (GOAL[0] - SPAWN[0]) * f + rand(-22, 22)
      const cz = SPAWN[1] + (GOAL[1] - SPAWN[1]) * f + rand(-22, 22)
      if (!jauhDari(cx, cz, GOAL[0], GOAL[1], 10) || !jauhDari(cx, cz, SPAWN[0], SPAWN[1], 9)) continue
      if (mode === 'tsunami' && tinggiDi(cx, cz) < 0.4) continue
      const pj = rand(9, 17)
      const rot = rand(0, Math.PI)
      const pagar = buatPagar(pj)
      pagar.position.set(cx, tinggiDi(cx, cz), cz)
      pagar.rotation.y = rot
      scene.add(pagar)
      const nSeg = Math.ceil(pj / 1.1)
      for (let s = 0; s <= nSeg; s++) {
        const tSeg = -pj / 2 + (s * pj) / nSeg
        colliders.push({ x: cx + Math.cos(rot) * tSeg, z: cz - Math.sin(rot) * tSeg, r: 0.7 })
      }
    }

    // ---- rambu jalur evakuasi ----
    for (let i = 1; i <= 5; i++) {
      const f = i / 6
      let sx = SPAWN[0] + (GOAL[0] - SPAWN[0]) * f + rand(-6, 6)
      let sz = SPAWN[1] + (GOAL[1] - SPAWN[1]) * f + rand(-6, 6)
      if (mode === 'tsunami' && tinggiDi(sx, sz) < 0.4) sx = Math.min(sx, 20)
      const rambu = buatRambu()
      rambu.position.set(sx, tinggiDi(sx, sz), sz)
      rambu.rotation.y = Math.atan2(GOAL[0] - sx, GOAL[1] - sz) + Math.PI / 2
      scene.add(rambu)
    }

    // ---- karakter ----
    const pemain = buatKarakter({ gender, kulit })
    pemain.position.set(SPAWN[0], tinggiDi(SPAWN[0], SPAWN[1]), SPAWN[1])
    scene.add(pemain)
    const anim = pemain.userData

    // ---- rumah hantu ----
    const rumahGhost = buatRumah(0xffffff)
    rumahGhost.traverse((o) => {
      if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45 }
    })
    scene.add(rumahGhost)
    let rumahTetap = null

    // ---- goal ----
    const goal = buatGoal(cfgM.goalLabel)
    goal.position.set(GOAL[0], tinggiDi(GOAL[0], GOAL[1]), GOAL[1])
    goal.visible = false
    scene.add(goal)

    // ---- hujan ----
    const RAIN_N = 900
    const rainGeo = new THREE.BufferGeometry()
    const rainPos = new Float32Array(RAIN_N * 3)
    for (let i = 0; i < RAIN_N; i++) {
      rainPos[i * 3] = rand(-90, 90); rainPos[i * 3 + 1] = rand(0, 45); rainPos[i * 3 + 2] = rand(-90, 90)
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3))
    const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaaccee, size: 0.24, transparent: true, opacity: 0.7 }))
    rain.visible = false
    scene.add(rain)

    // ---- laut / air / gelombang / longsoran ----
    if (mode === 'tsunami') {
      const laut = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 300),
        new THREE.MeshPhongMaterial({ color: 0x1d6fa5, transparent: true, opacity: 0.8, shininess: 90 })
      )
      laut.rotation.x = -Math.PI / 2
      laut.position.y = 0.05
      scene.add(laut)
    }
    let airBanjir = null, gelombang = null, banjirTsu = null, longsoran = null
    let levelAir = -0.6, frontX = 999
    if (mode === 'banjir') {
      airBanjir = new THREE.Mesh(
        new THREE.PlaneGeometry(220, 220),
        new THREE.MeshPhongMaterial({ color: 0x3b82c4, transparent: true, opacity: 0.72, shininess: 100 })
      )
      airBanjir.rotation.x = -Math.PI / 2
      airBanjir.position.y = levelAir
      airBanjir.visible = false
      scene.add(airBanjir)
    }
    if (mode === 'tsunami') {
      gelombang = new THREE.Mesh(
        new THREE.BoxGeometry(6, 13, 220),
        new THREE.MeshPhongMaterial({ color: 0x2c7fb8, transparent: true, opacity: 0.85 })
      )
      gelombang.visible = false
      scene.add(gelombang)
      banjirTsu = new THREE.Mesh(
        new THREE.BoxGeometry(1, 9, 220),
        new THREE.MeshPhongMaterial({ color: 0x2c7fb8, transparent: true, opacity: 0.7 })
      )
      banjirTsu.visible = false
      scene.add(banjirTsu)
    }
    if (mode === 'longsor') {
      longsoran = new THREE.Mesh(
        new THREE.BoxGeometry(1, 3.2, 62 * SC),
        new THREE.MeshLambertMaterial({ color: 0x6b4423 })
      )
      longsoran.visible = false
      scene.add(longsoran)
    }
    const batuan = []
    const buatBatu = (x, y, z, r) => {
      const b = new THREE.Mesh(
        new THREE.DodecahedronGeometry(r, 0),
        new THREE.MeshLambertMaterial({ color: mode === 'gempa' ? 0x9a9a9a : 0x7a5a3a })
      )
      b.position.set(x, y, z)
      b.castShadow = true
      b.userData = { vy: 0, hidup: 4 }
      scene.add(b); batuan.push(b)
    }

    // ---- pohon tumbang dinamis ----
    const spawnPohonTumbang = () => {
      const asal = rumahTetap ? rumahTetap.position : pemain.position
      for (let i = 0; i < 6; i++) {
        const f = 0.18 + 0.62 * (i / 5) + rand(-0.05, 0.05)
        const cx = asal.x + (GOAL[0] - asal.x) * f + rand(-10, 10)
        const cz = asal.z + (GOAL[1] - asal.z) * f + rand(-10, 10)
        if (!jauhDari(cx, cz, GOAL[0], GOAL[1], 8)) continue
        if (mode === 'tsunami' && tinggiDi(cx, cz) < 0.4) continue
        const pj = rand(5, 8)
        const rot = rand(0, Math.PI)
        const log = buatPohonTumbang(pj)
        log.position.set(cx, tinggiDi(cx, cz), cz)
        log.rotation.y = rot
        scene.add(log)
        for (let s = 0; s <= 4; s++) {
          const tSeg = -pj / 2 + (s * pj) / 4
          colliders.push({ x: cx + Math.cos(rot) * tSeg, z: cz - Math.sin(rot) * tSeg, r: 0.85 })
        }
      }
    }

    // ---- item tas siaga ----
    let itemMeshes = []
    const spawnItems = (cx, cz) => {
      itemMeshes = ITEMS.map((it, i) => {
        const ang = (i / ITEMS.length) * Math.PI * 2 + rand(-0.25, 0.25)
        const r = rand(12, 27)
        let x = cx + Math.cos(ang) * r, z = cz + Math.sin(ang) * r
        x = Math.max(-BATAS + 2, Math.min(BATAS - 2, x))
        z = Math.max(-BATAS + 2, Math.min(BATAS - 2, z))
        if (mode === 'tsunami' && tinggiDi(x, z) < 0.5) x -= 14
        const s = spriteIkon(it.ikon, '#f59e0b', 2.4)
        const y0 = tinggiDi(x, z) + 1.5
        s.position.set(x, y0, z)
        s.userData = { item: it, y0, ambil: false }
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.05, 0.1, 8, 24),
          new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.9 })
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.set(x, tinggiDi(x, z) + 0.12, z)
        s.userData.ring = ring
        scene.add(s, ring)
        return s
      })
    }

    // ---- titik pemulihan ----
    let recPoints = []
    const spawnRecovery = () => {
      const tugasList = RECOVERY[mode]
      const dipilih = [...bangunan]
        .sort(() => Math.random() - 0.5)
        .slice(0, tugasList.length)
      recPoints = tugasList.map((tugas, i) => {
        const b = dipilih[i]
        const x = b ? b.position.x : rand(-40, 40)
        const z = b ? b.position.z : rand(-40, 40)
        if (b) { b.rotation.z = 0.14; b.rotation.x = 0.08 }
        const s = spriteIkon('perbaikan', '#ea580c', 2.8)
        s.position.set(x, tinggiDi(x, z) + 5, z)
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(3.6, 0.18, 8, 34),
          new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9 })
        )
        ring.rotation.x = -Math.PI / 2
        ring.position.set(x, tinggiDi(x, z) + 0.15, z)
        scene.add(s, ring)
        return { sprite: s, ring, tugas, selesai: false, x, z }
      })
    }

    // ---- minimap ----
    const mmC = document.createElement('canvas')
    mmC.width = mmC.height = 110
    const mmG = mmC.getContext('2d')
    for (let i = 0; i < 110; i++) for (let j = 0; j < 110; j++) {
      const x = (i / 109) * 2 * BATAS - BATAS, z = (j / 109) * 2 * BATAS - BATAS
      const h = tinggiDi(x, z), zona = rawanDi(x, z)
      mmG.fillStyle = mode === 'tsunami' && h < 0
        ? '#1d6fa5'
        : zona === 2 ? '#cf6a50' : zona === 1 ? '#d9c04a' : '#5aa65c'
      if (mode === 'gempa' && Math.abs(x / SC - 10) < 1.8) mmG.fillStyle = '#333'
      mmG.fillRect(i, j, 1, 1)
    }
    const titik = (g, x, y, r, isi, stroke) => {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2)
      g.fillStyle = isi; g.fill()
      g.lineWidth = 2; g.strokeStyle = stroke; g.stroke()
    }
    const gambarMinimap = (st) => {
      const cv = minimapRef.current
      if (!cv) return
      const g = cv.getContext('2d')
      const S = cv.width
      const px = (v) => ((v + BATAS) / (2 * BATAS)) * S
      g.clearRect(0, 0, S, S)
      g.drawImage(mmC, 0, 0, S, S)
      if (mode === 'banjir' && st.faseNow === 'bencana') {
        g.fillStyle = 'rgba(40,100,200,0.45)'
        for (let i = 0; i < 34; i++) for (let j = 0; j < 34; j++) {
          const x = (i / 33) * 2 * BATAS - BATAS, z = (j / 33) * 2 * BATAS - BATAS
          if (tinggiDi(x, z) < levelAir) g.fillRect((i / 33) * S - S / 68, (j / 33) * S - S / 68, S / 32, S / 32)
        }
      }
      if ((mode === 'tsunami' || mode === 'longsor') && st.faseNow === 'bencana' && frontX < 900) {
        g.fillStyle = mode === 'tsunami' ? 'rgba(40,100,200,0.5)' : 'rgba(107,68,35,0.55)'
        const x0 = px(frontX)
        if (mode === 'tsunami') g.fillRect(x0, 0, S - x0, S)
        else g.fillRect(x0, px(-30 * SC), S - x0, px(30 * SC) - px(-30 * SC))
      }
      itemMeshes.forEach((s) => {
        if (s.userData.ambil) return
        titik(g, px(s.position.x), px(s.position.z), 4, '#ffd60a', '#ffffff')
      })
      recPoints.forEach((r) => {
        if (r.selesai) return
        titik(g, px(r.x), px(r.z), 4.5, '#f97316', '#ffffff')
      })
      if (goal.visible) titik(g, px(goal.position.x), px(goal.position.z), 6, '#22c55e', '#ffffff')
      if (rumahTetap) {
        g.fillStyle = '#7c3aed'
        g.strokeStyle = '#fff'; g.lineWidth = 1.5
        g.fillRect(px(rumahTetap.position.x) - 4, px(rumahTetap.position.z) - 4, 8, 8)
        g.strokeRect(px(rumahTetap.position.x) - 4, px(rumahTetap.position.z) - 4, 8, 8)
      }
      g.save()
      g.translate(px(pemain.position.x), px(pemain.position.z))
      g.rotate(-pemain.rotation.y)
      g.fillStyle = '#fff'
      g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill()
      g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke()
      g.restore()
    }

    // ---- state internal ----
    const st = {
      faseNow: 'rumah',
      hp: 100,
      timerTas: cfgD.tasWaktu,
      timerEvak: cfgD.evakWaktu,
      timerRec: cfgD.recWaktu,
      tEvakPakai: 0,
      stage: 0,
      stageT: 0,
      selesai: false,
      skorRumah: 0,
      zonaRumah: 0,
      benarTas: 0,
      benarRec: 0,
      selamat: false,
      shake: 0,
      susulanT: 8,
      pesanT: 0,
      blokirT: 0,
    }

    const kirimPesan = (p) => { setPesan(p); st.pesanT = 3.5 }

    apiRef.current.bangunRumah = () => {
      if (st.faseNow !== 'rumah') return
      const x = pemain.position.x, z = pemain.position.z
      if (mode === 'tsunami' && tinggiDi(x, z) < 0.4) { kirimPesan('Tidak bisa membangun di laut!'); return }
      const zona = rawanDi(x, z)
      st.zonaRumah = zona
      st.skorRumah = zona === 0 ? 100 : zona === 1 ? 60 : 25
      rumahTetap = buatRumah(0xf7e9c6)
      rumahTetap.position.set(x + 3.4, tinggiDi(x + 3.4, z), z)
      scene.add(rumahTetap)
      colliders.push({ x: x + 3.4, z, r: 2.6 })
      scene.remove(rumahGhost)
      st.faseNow = 'tas'
      setFase('tas')
      spawnItems(x, z)
      setBriefFase({
        judul: 'PRA BENCANA — Isi Tas Siaga',
        isi: `Rumah dibangun di zona ${zona === 0 ? 'AMAN (+100 poin)' : zona === 1 ? 'WASPADA (+60 poin)' : 'RAWAN (+25 poin)'}. Kumpulkan 10 barang tas siaga BNPB (titik kuning di minimap). Jawab benar = +10 poin. Waktu: ${cfgD.tasWaktu} detik.`,
        langkah: [],
        tombol: 'Mulai Mengumpulkan',
        aksi: () => { setBriefFase(null); pausedRef.current = false },
      })
      pausedRef.current = true
    }

    apiRef.current.selesaiKuis = (item, benar) => {
      if (benar) st.benarTas++
      const spr = itemMeshes.find((s) => s.userData.item === item)
      if (spr) {
        spr.userData.ambil = true
        spr.visible = false
        if (spr.userData.ring) spr.userData.ring.visible = false
      }
      anim.tas.visible = true
      if (itemMeshes.every((s) => s.userData.ambil)) mulaiBencana()
    }

    apiRef.current.selesaiRec = (tugas, benar) => {
      if (benar) st.benarRec++
      const rp = recPoints.find((r) => r.tugas === tugas)
      if (rp) {
        rp.selesai = true
        rp.sprite.visible = false
        rp.ring.material.color.set(0x22c55e)
      }
      if (recPoints.every((r) => r.selesai)) selesaiGame()
    }

    const mulaiBencana = () => {
      if (st.faseNow === 'bencana') return
      st.faseNow = 'bencana'
      st.stage = 0; st.stageT = 0
      setFase('bencana')
      itemMeshes.forEach((s) => { s.visible = false; if (s.userData.ring) s.userData.ring.visible = false })
      goal.visible = true
      spawnPohonTumbang()
      scene.background = new THREE.Color(0x4a5a6a)
      scene.fog.color.set(0x4a5a6a)
      const teks = {
        banjir: `AIR MULAI NAIK! Capai ${cfgM.goalLabel} dalam ${cfgD.evakWaktu} detik. Ikuti rambu, hindari air dalam dan pohon tumbang.`,
        longsor: `Hujan deras, terdengar gemuruh dari lereng! Kamu punya ${cfgD.evakWaktu} detik untuk mencapai ${cfgM.goalLabel} — lari MENJAUH dan MENYAMPING dari jalur luncuran.`,
        gempa: `GEMPA! TAHAN tombol BERLINDUNG (C) dulu. Setelah reda, capai ${cfgM.goalLabel} dalam sisa waktu (total ${cfgD.evakWaktu} detik).`,
        tsunami: `GEMPA KUAT! BERLINDUNG (C) selama guncangan, lalu capai ${cfgM.goalLabel} sebelum gelombang tiba. Batas waktu ${cfgD.evakWaktu} detik.`,
      }
      setBriefFase({
        judul: `SAAT BENCANA — ${cfgM.nama} Datang!`,
        isi: teks[mode],
        langkah: [],
        tombol: 'Hadapi Bencana',
        aksi: () => { setBriefFase(null); pausedRef.current = false },
      })
      pausedRef.current = true
      if (mode !== 'gempa') rain.visible = true
      if (mode === 'banjir') airBanjir.visible = true
    }

    const mulaiPemulihan = () => {
      st.faseNow = 'pemulihan'
      st.selamat = true
      setFase('pemulihan')
      goal.visible = false
      rain.visible = false
      st.shake = 0
      scene.background = new THREE.Color(0xa8c8e0)
      scene.fog.color.set(0xa8c8e0)
      spawnRecovery()
      setBriefFase({
        judul: 'PASCA BENCANA — Pemulihan (Recovery)',
        isi: `Kamu selamat! Tapi tugas belum selesai. Bencana merusak infrastruktur permukiman. Kunjungi 5 titik rusak (titik oranye di minimap) dan ambil keputusan pemulihan yang BENAR. Jawaban benar = +20 poin. Waktu: ${cfgD.recWaktu} detik.`,
        langkah: [],
        tombol: 'Mulai Pemulihan',
        aksi: () => { setBriefFase(null); pausedRef.current = false },
      })
      pausedRef.current = true
    }

    const selesaiGame = () => {
      if (st.selesai) return
      st.selesai = true
      pausedRef.current = true
      const skorTas = st.benarTas * 10
      const skorEvak = st.selamat
        ? Math.round(60 + 40 * Math.max(0, st.timerEvak) / cfgD.evakWaktu)
        : 0
      const skorRec = st.benarRec * 20
      setHasil({
        selamat: st.selamat,
        mode, tingkat,
        zonaRumah: st.zonaRumah,
        skorRumah: st.skorRumah,
        benarTas: st.benarTas, skorTas,
        waktuEvak: Math.round(st.tEvakPakai),
        skorEvak,
        benarRec: st.benarRec, skorRec,
        total: st.skorRumah + skorTas + skorEvak + skorRec,
      })
      setTimeout(() => setLayar('hasil'), 900)
    }

    // ---- input ----
    const kd = (e) => {
      const k = e.key.toLowerCase()
      keysRef.current[k] = true
      if (k === 'c') crouchRef.current = true
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
    }
    const ku = (e) => {
      const k = e.key.toLowerCase()
      keysRef.current[k] = false
      if (k === 'c') crouchRef.current = false
    }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)

    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const klik = (e) => {
      if (pausedRef.current) return
      const rect = renderer.domElement.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      ray.setFromCamera(ndc, camera)
      const hit = ray.intersectObject(tanah)[0]
      if (hit) targetRef.current = hit.point.clone()
    }
    renderer.domElement.addEventListener('pointerdown', klik)

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', resize)

    // ---- loop ----
    const clock = new THREE.Clock()
    let raf = 0, mmT = 0, hudT = 0
    const arah = new THREE.Vector3()

    const cobaGerak = (dx, dz) => {
      const nx = pemain.position.x + dx, nz = pemain.position.z + dz
      if (!tabrak(nx, nz)) { pemain.position.x = nx; pemain.position.z = nz; return true }
      if (!tabrak(nx, pemain.position.z)) { pemain.position.x = nx; st.blokirT += 1; return true }
      if (!tabrak(pemain.position.x, nz)) { pemain.position.z = nz; st.blokirT += 1; return true }
      st.blokirT += 2
      return false
    }

    const loop = () => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(clock.getDelta(), 0.05)
      const t = clock.elapsedTime

      goal.userData.cincin.scale.setScalar(1 + 0.18 * Math.sin(t * 4))
      itemMeshes.forEach((s) => {
        if (s.userData.ambil) return
        s.position.y = s.userData.y0 + 0.25 * Math.sin(t * 3 + s.position.x)
        if (s.userData.ring) s.userData.ring.rotation.z = t * 2
      })
      recPoints.forEach((r) => {
        if (r.selesai) return
        r.sprite.position.y = tinggiDi(r.x, r.z) + 5 + 0.3 * Math.sin(t * 3 + r.x)
        r.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 4))
      })

      if (!pausedRef.current && !st.selesai) {
        const K = keysRef.current
        arah.set(0, 0, 0)
        if (K['w'] || K['arrowup']) arah.z -= 1
        if (K['s'] || K['arrowdown']) arah.z += 1
        if (K['a'] || K['arrowleft']) arah.x -= 1
        if (K['d'] || K['arrowright']) arah.x += 1
        if (arah.lengthSq() > 0) targetRef.current = null
        let bergerak = false
        const guncanganAktif =
          st.faseNow === 'bencana' && (mode === 'gempa' || mode === 'tsunami') && st.stage === 0
        const bolehGerak = !(guncanganAktif && crouchRef.current)
        let kecepatan = 7.6 * (crouchRef.current ? 0.35 : 1)

        let depth = 0
        if (mode === 'banjir' && st.faseNow === 'bencana') {
          depth = levelAir - tinggiDi(pemain.position.x, pemain.position.z)
          if (depth > 0.35) kecepatan *= 0.45
        }

        if (bolehGerak) {
          if (arah.lengthSq() > 0) {
            arah.normalize()
            bergerak = cobaGerak(arah.x * kecepatan * dt, arah.z * kecepatan * dt)
            pemain.rotation.y = Math.atan2(arah.x, arah.z)
          } else if (targetRef.current) {
            const d = new THREE.Vector3().subVectors(targetRef.current, pemain.position)
            d.y = 0
            if (d.length() > 0.6) {
              d.normalize()
              bergerak = cobaGerak(d.x * kecepatan * dt, d.z * kecepatan * dt)
              pemain.rotation.y = Math.atan2(d.x, d.z)
              if (!bergerak) targetRef.current = null
            } else targetRef.current = null
          }
        }
        if (st.blokirT > 25 && st.pesanT <= 0) {
          st.blokirT = 0
          kirimPesan('Jalan terhalang! Putari rintangan dan cari rute lain.')
        }
        pemain.position.x = Math.max(-BATAS, Math.min(BATAS, pemain.position.x))
        pemain.position.z = Math.max(-BATAS, Math.min(BATAS, pemain.position.z))
        pemain.position.y = tinggiDi(pemain.position.x, pemain.position.z)
        pemain.scale.y = crouchRef.current ? 0.62 : 1

        const sw = bergerak ? Math.sin(t * 11) * 0.55 : 0
        anim.kakiKi.rotation.x = sw
        anim.kakiKa.rotation.x = -sw
        anim.lenganKi.rotation.x = -sw
        anim.lenganKa.rotation.x = sw

        if (st.faseNow === 'rumah') {
          rumahGhost.position.set(
            pemain.position.x + 3.4,
            tinggiDi(pemain.position.x + 3.4, pemain.position.z),
            pemain.position.z
          )
        }

        // -------- FASE TAS --------
        if (st.faseNow === 'tas') {
          st.timerTas -= dt
          if (st.timerTas <= 0) { kirimPesan('Waktu persiapan habis! Bencana datang...'); mulaiBencana() }
          for (const s of itemMeshes) {
            if (s.userData.ambil) continue
            if (Math.hypot(s.position.x - pemain.position.x, s.position.z - pemain.position.z) < 2.2) {
              pausedRef.current = true
              setKuis({ item: s.userData.item, jawab: null, tipe: 'tas' })
              break
            }
          }
        }

        // -------- FASE BENCANA --------
        if (st.faseNow === 'bencana') {
          st.timerEvak -= dt
          st.tEvakPakai += dt
          if (st.timerEvak <= 0) {
            kirimPesan('Waktu evakuasi habis!')
            st.selamat = false
            selesaiGame()
          }
          st.stageT += dt
          let drain = 0
          const px = pemain.position.x, pz = pemain.position.z
          const ph = tinggiDi(px, pz)

          if (mode === 'banjir') {
            levelAir = Math.min(levelAir + 0.06 * cfgD.mult * dt, 10)
            airBanjir.position.y = levelAir + 0.05 * Math.sin(t * 2)
            depth = levelAir - ph
            if (depth > 2.0) drain = 26
            else if (depth > 1.2) drain = 11
            else if (depth > 0.4) drain = 4.5
            if (depth > 0.4 && st.pesanT <= 0) kirimPesan('Kamu berjalan di air! Cari jalur lebih tinggi!')
          }

          if (mode === 'tsunami') {
            if (st.stage === 0) {
              st.shake = 1
              if (!crouchRef.current) {
                drain += 3.5
                if (st.pesanT <= 0) kirimPesan('TAHAN tombol BERLINDUNG (C) selama guncangan!')
              }
              if (st.stageT > 10) {
                st.stage = 1; st.stageT = 0; st.shake = 0; frontX = 92
                kirimPesan('PERINGATAN TSUNAMI! LARI KE BUKIT SEKARANG!')
              }
            } else {
              frontX -= 2.1 * cfgD.mult * dt
              gelombang.visible = true
              gelombang.position.set(frontX, 5.5, 0)
              gelombang.scale.y = 1 + 0.12 * Math.sin(t * 6)
              banjirTsu.visible = true
              const lebar = Math.max(0.1, 96 - frontX)
              banjirTsu.scale.x = lebar
              banjirTsu.position.set(frontX + lebar / 2, 0.5, 0)
              if (px > frontX - 2 && ph < 5) {
                drain = 55
                if (st.pesanT <= 0) kirimPesan('Gelombang menghantammu! Naik ke tempat tinggi!')
              }
            }
          }

          if (mode === 'longsor') {
            if (st.stage === 0) {
              if (st.stageT > 7) {
                st.stage = 1; st.stageT = 0; frontX = 44 * SC
                kirimPesan('LONGSOR! Lari menjauh dan menyamping dari jalur luncuran!')
              } else if (Math.random() < dt * 1.2) {
                const bz = rand(-28, 28) * SC
                buatBatu(rand(20, 40) * SC, tinggiDi(30 * SC, bz) + 15, bz, rand(0.5, 1.1))
              }
            } else {
              frontX -= 3.4 * cfgD.mult * dt
              longsoran.visible = true
              const lebar = Math.max(0.1, 44 * SC - frontX + 4)
              longsoran.scale.x = lebar
              longsoran.position.set(frontX + lebar / 2, tinggiDi(Math.max(frontX, -70), 0) + 1.3, 0)
              if (Math.random() < dt * 2.5) {
                const bz = rand(-28, 28) * SC
                buatBatu(frontX + rand(1, 9), tinggiDi(frontX, bz) + 13, bz, rand(0.5, 1.3))
              }
              if (px > frontX - 1.5 && Math.abs(pz) < 30 * SC) {
                drain = 45
                if (st.pesanT <= 0) kirimPesan('Kamu terkena material longsoran!')
              }
            }
          }

          if (mode === 'gempa') {
            if (st.stage === 0) {
              st.shake = 1
              if (!crouchRef.current) {
                drain += 2.8
                if (st.pesanT <= 0) kirimPesan('TAHAN tombol BERLINDUNG (C)! Jangan berlari saat guncangan!')
              }
              if (Math.random() < dt * 1.4) {
                const b = bangunan[Math.floor(Math.random() * bangunan.length)]
                buatBatu(b.position.x + rand(-3, 3), b.position.y + 8, b.position.z + rand(-3, 3), rand(0.4, 0.9))
              }
              if (st.stageT > 12) {
                st.stage = 1; st.stageT = 0; st.shake = 0; st.susulanT = 9
                kirimPesan('Guncangan berhenti! Evakuasi ke LAPANGAN TERBUKA — jauhi bangunan!')
              }
            } else {
              st.susulanT -= dt
              if (st.susulanT < 2 && st.susulanT > 0) st.shake = 0.6
              else st.shake = 0
              if (st.susulanT <= 0) {
                st.susulanT = rand(8, 13)
                kirimPesan('Gempa susulan! Menjauh dari bangunan!')
              }
              if (st.shake > 0 && Math.random() < dt * 2.2) {
                const b = bangunan[Math.floor(Math.random() * bangunan.length)]
                buatBatu(b.position.x + rand(-3.5, 3.5), b.position.y + 8, b.position.z + rand(-3.5, 3.5), rand(0.4, 0.9))
              }
            }
            if (st.shake > 0) {
              for (const b of bangunan) {
                if (Math.hypot(b.position.x - px, b.position.z - pz) < 5.5) { drain += 6; break }
              }
            }
          }

          for (let i = batuan.length - 1; i >= 0; i--) {
            const b = batuan[i]
            b.userData.vy -= 22 * dt
            b.position.y += b.userData.vy * dt
            const gh = tinggiDi(b.position.x, b.position.z)
            if (b.position.y < gh + 0.3) { b.position.y = gh + 0.3; b.userData.vy = 0 }
            b.userData.hidup -= dt
            if (
              Math.hypot(b.position.x - px, b.position.z - pz) < 1.4 &&
              Math.abs(b.position.y - pemain.position.y - 1) < 2 && !b.userData.kena
            ) {
              b.userData.kena = true
              st.hp -= 16
              kirimPesan('Tertimpa reruntuhan! -16 HP')
            }
            if (b.userData.hidup <= 0) { scene.remove(b); batuan.splice(i, 1) }
          }

          st.hp -= drain * cfgD.drain * dt
          if (st.hp <= 0) { st.hp = 0; st.selamat = false; selesaiGame() }

          const dGoal = Math.hypot(goal.position.x - px, goal.position.z - pz)
          const bolehSelamat = !((mode === 'gempa' || mode === 'tsunami') && st.stage === 0)
          if (dGoal < 3.6 && bolehSelamat) mulaiPemulihan()
        }

        // -------- FASE PEMULIHAN --------
        if (st.faseNow === 'pemulihan') {
          st.timerRec -= dt
          if (st.timerRec <= 0) {
            kirimPesan('Waktu pemulihan habis!')
            selesaiGame()
          }
          if (mode === 'banjir' && levelAir > -0.6) {
            levelAir -= 1.2 * dt
            airBanjir.position.y = levelAir
            if (levelAir <= -0.6) airBanjir.visible = false
          }
          if (mode === 'tsunami') {
            if (gelombang.visible) gelombang.visible = false
            if (banjirTsu.visible) {
              banjirTsu.position.y -= 1.5 * dt
              if (banjirTsu.position.y < -6) banjirTsu.visible = false
            }
          }
          // jarak pemicu 4.8 > collider rumah (2.6) + radius pemain — kuis pasti terpicu
          for (const r of recPoints) {
            if (r.selesai) continue
            if (Math.hypot(r.x - pemain.position.x, r.z - pemain.position.z) < 4.8) {
              pausedRef.current = true
              setKuis({ item: r.tugas, jawab: null, tipe: 'rec' })
              break
            }
          }
        }

        st.pesanT -= dt
        if (st.pesanT <= 0 && st.pesanT > -dt * 2) setPesan('')
      }

      const tinggiKam = st.faseNow === 'rumah' ? 24 : 10
      const jarakKam = st.faseNow === 'rumah' ? 18 : 12.5
      camera.position.lerp(
        new THREE.Vector3(pemain.position.x, pemain.position.y + tinggiKam, pemain.position.z + jarakKam),
        0.08
      )
      if (st.shake > 0) {
        camera.position.x += (Math.random() - 0.5) * 0.5 * st.shake
        camera.position.y += (Math.random() - 0.5) * 0.5 * st.shake
      }
      camera.lookAt(pemain.position.x, pemain.position.y + 1.6, pemain.position.z)

      if (rain.visible) {
        const rp = rain.geometry.attributes.position
        for (let i = 0; i < RAIN_N; i++) {
          let y = rp.getY(i) - 34 * dt
          if (y < 0) y = 45
          rp.setY(i, y)
        }
        rp.needsUpdate = true
      }

      hudT += dt
      if (hudT > 0.2) {
        hudT = 0
        if (st.faseNow === 'rumah') setZonaSkrg(rawanDi(pemain.position.x, pemain.position.z))
        setHp(Math.max(0, Math.round(st.hp)))
        if (st.faseNow === 'tas') setTimer(Math.max(0, Math.ceil(st.timerTas)))
        else if (st.faseNow === 'bencana') setTimer(Math.max(0, Math.ceil(st.timerEvak)))
        else if (st.faseNow === 'pemulihan') setTimer(Math.max(0, Math.ceil(st.timerRec)))
        const ins = {
          rumah: 'Pilih lokasi rumah — baca warna zona di peta!',
          tas: 'Kumpulkan titik KUNING di minimap dan jawab kuisnya!',
          bencana:
            (mode === 'gempa' || mode === 'tsunami') && st.stage === 0
              ? 'TAHAN tombol BERLINDUNG (C)!'
              : `Ikuti rambu ke ${cfgM.goalLabel}!`,
          pemulihan: 'Datangi titik ORANYE dan putuskan pemulihan yang benar!',
        }
        setInstruksi(ins[st.faseNow] || '')
      }
      mmT += dt
      if (mmT > 0.12) { mmT = 0; gambarMinimap(st) }

      renderer.render(scene, camera)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('pointerdown', klik)
      renderer.dispose()
      scene.traverse((o) => {
        if (o.isMesh || o.isSprite || o.isPoints) {
          o.geometry?.dispose?.()
          const m = o.material
          if (Array.isArray(m)) m.forEach((x) => { x.map?.dispose?.(); x.dispose?.() })
          else { m?.map?.dispose?.(); m?.dispose?.() }
        }
      })
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, layar])

  const tekan = (k, v) => (e) => {
    e.preventDefault()
    if (k === 'c') crouchRef.current = v
    else keysRef.current[k] = v
  }

  const btn = 'rounded-xl font-bold transition-all active:scale-95'

  // ---------------- MENU ----------------
  if (layar === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-950 via-blue-900 to-slate-900 pt-20 pb-10 px-4 text-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black tracking-tight">SIGANA <span className="text-amber-400">3D</span></h1>
            <p className="text-white/70 mt-1 text-sm">Pra Bencana → Saat Bencana → Pasca Bencana — mainkan siklus penanggulangan bencana secara utuh</p>
          </div>

          <p className="font-semibold mb-2 text-teal-300">1. Pilih Bencana</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {Object.entries(MODES).map(([k, m]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`${btn} p-4 text-left border-2 ${mode === k ? 'border-amber-400 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <Ikon jenis={k} className="w-8 h-8 mb-2 text-teal-300" />
                <div className="font-bold">{m.nama}</div>
                <div className="text-[11px] text-white/60 mt-1 leading-snug">{m.deskripsi}</div>
              </button>
            ))}
          </div>

          <p className="font-semibold mb-2 text-teal-300">2. Tingkat Kesulitan</p>
          <div className="flex gap-3 mb-6">
            {Object.entries(DIFF).map(([k, d]) => (
              <button key={k} onClick={() => setTingkat(k)}
                className={`${btn} flex-1 py-3 border-2 ${tingkat === k ? 'border-amber-400 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                {d.label}
                <div className="text-[10px] font-normal text-white/60">
                  Tas {d.tasWaktu}s · Evakuasi {d.evakWaktu}s · Pemulihan {d.recWaktu}s
                </div>
              </button>
            ))}
          </div>

          <p className="font-semibold mb-2 text-teal-300">3. Karaktermu</p>
          <div className="flex flex-wrap items-center gap-3 mb-8">
            {[['laki', 'Laki-laki'], ['perempuan', 'Perempuan']].map(([k, l]) => (
              <button key={k} onClick={() => setGender(k)}
                className={`${btn} px-5 py-3 border-2 ${gender === k ? 'border-amber-400 bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                {l}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm text-white/60">Warna kulit:</span>
              {KULIT.map((c) => (
                <button key={c} onClick={() => setKulit(c)}
                  className={`w-9 h-9 rounded-full border-4 ${kulit === c ? 'border-amber-400' : 'border-white/20'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <button onClick={mulai}
            className={`${btn} w-full py-4 text-lg bg-amber-400 text-blue-950 hover:bg-amber-300 shadow-lg shadow-amber-900/40 flex items-center justify-center gap-2`}>
            <Ikon jenis="lari" className="w-5 h-5" /> Mulai Misi: Selamat dari {M.nama}
          </button>
          <p className="text-center text-[11px] text-white/40 mt-4">
            Kontrol: WASD / panah / klik peta untuk berjalan · C = Berlindung · tombol sentuh tersedia di HP
          </p>
        </div>
      </div>
    )
  }

  // ---------------- HASIL ----------------
  if (layar === 'hasil' && hasil) {
    const grade = hasil.total >= 340 ? 'A' : hasil.total >= 280 ? 'B' : hasil.total >= 210 ? 'C' : 'D'
    const Baris = ({ tahap, ikon, label, nilai, max, ket }) => (
      <div className="flex items-center justify-between py-3 border-b border-white/10 gap-3">
        <div className="flex items-start gap-3">
          <Ikon jenis={ikon} className="w-6 h-6 text-teal-300 mt-1 flex-shrink-0" />
          <div>
            <div className="text-[9px] font-bold tracking-wider text-teal-300">{tahap}</div>
            <div className="font-semibold">{label}</div>
            <div className="text-[11px] text-white/60">{ket}</div>
          </div>
        </div>
        <div className="text-xl font-black text-amber-400">{nilai}<span className="text-xs text-white/50">/{max}</span></div>
      </div>
    )
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-950 via-blue-900 to-slate-900 pt-24 pb-10 px-4 text-white">
        <div className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="text-center mb-4">
            <Ikon jenis={hasil.selamat ? 'piala' : 'gagal'}
              className={`w-16 h-16 mx-auto mb-2 ${hasil.selamat ? 'text-amber-400' : 'text-red-400'}`} />
            <h2 className="text-2xl font-black">{hasil.selamat ? 'KAMU SELAMAT!' : 'TIDAK SELAMAT...'}</h2>
            <p className="text-white/60 text-sm">Misi {MODES[hasil.mode].nama} · Mode {DIFF[hasil.tingkat].label}</p>
          </div>
          <Baris tahap="PRA BENCANA · MITIGASI" ikon="lokasi" label="Ketepatan Lokasi Rumah" nilai={hasil.skorRumah} max={100}
            ket={`Zona ${hasil.zonaRumah === 0 ? 'AMAN — pilihan terbaik!' : hasil.zonaRumah === 1 ? 'WASPADA — masih berisiko' : 'RAWAN — sangat berbahaya!'}`} />
          <Baris tahap="PRA BENCANA · KESIAPSIAGAAN" ikon="tas" label="Tas Siaga Bencana" nilai={hasil.skorTas} max={100}
            ket={`${hasil.benarTas}/10 pertanyaan benar`} />
          <Baris tahap="SAAT BENCANA · TANGGAP DARURAT" ikon="lari" label="Evakuasi" nilai={hasil.skorEvak} max={100}
            ket={hasil.selamat ? `Selamat dalam ${hasil.waktuEvak} detik` : 'Tidak mencapai titik evakuasi'} />
          <Baris tahap="PASCA BENCANA · PEMULIHAN" ikon="perbaikan" label="Pemulihan Infrastruktur" nilai={hasil.skorRec} max={100}
            ket={hasil.selamat ? `${hasil.benarRec}/5 keputusan pemulihan benar` : 'Tidak sampai tahap pemulihan'} />
          <div className="flex items-center justify-between pt-4">
            <div className="text-lg font-bold">TOTAL</div>
            <div className="text-3xl font-black text-amber-400">{hasil.total}<span className="text-sm text-white/50">/400</span></div>
          </div>
          <div className="text-center my-4">
            <span className="inline-block px-6 py-2 rounded-full text-2xl font-black bg-amber-400 text-blue-950">Nilai: {grade}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={mulai} className={`${btn} flex-1 py-3 bg-amber-400 text-blue-950 hover:bg-amber-300 flex items-center justify-center gap-2`}>
              <Ikon jenis="ulang" className="w-4 h-4" /> Main Lagi
            </button>
            <button onClick={() => setLayar('menu')} className={`${btn} flex-1 py-3 bg-white/10 hover:bg-white/20`}>Ganti Mode</button>
          </div>
        </div>
      </div>
    )
  }

  // ---------------- LAYAR MAIN ----------------
  return (
    <div className="fixed inset-0 top-16 bg-slate-900 select-none overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />

      {/* HUD atas */}
      <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-2 pointer-events-none">
        <div className="bg-black/55 backdrop-blur rounded-xl px-3 py-2 text-white text-xs md:text-sm">
          <div className="text-[9px] font-bold tracking-wider text-teal-300">{TAHAP[fase]}</div>
          <div className="font-bold flex items-center gap-1.5">
            <Ikon jenis={mode} className="w-4 h-4 text-teal-300" /> {M.nama} · {D.label}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Ikon jenis="hati" className="w-4 h-4 text-red-400" />
            <div className="w-28 h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${hp > 50 ? 'bg-green-400' : hp > 25 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${hp}%` }} />
            </div>
            <span className="font-mono">{hp}</span>
          </div>
        </div>
        <div className="bg-black/55 backdrop-blur rounded-xl px-3 py-2 text-white text-center">
          <div className="text-[10px] text-white/60">
            {fase === 'tas' ? 'SISA WAKTU' : fase === 'bencana' ? 'BATAS EVAKUASI' : fase === 'pemulihan' ? 'WAKTU PEMULIHAN' : 'FASE 1'}
          </div>
          <div className={`text-xl font-black font-mono flex items-center justify-center gap-1 ${fase !== 'rumah' && timer < 20 ? 'text-red-400' : ''}`}>
            {fase === 'rumah'
              ? <Ikon jenis="rumah" className="w-5 h-5" />
              : <><Ikon jenis="jam" className="w-4 h-4 opacity-70" />{timer}s</>}
          </div>
        </div>
        <div className="bg-black/55 backdrop-blur rounded-xl px-3 py-2 text-white text-xs md:text-sm max-w-[40%]">
          <div className="font-bold flex items-center gap-1.5">
            <Ikon jenis={fase === 'pemulihan' ? 'perbaikan' : 'tas'} className="w-4 h-4 text-amber-400" />
            {fase === 'pemulihan' ? `${recSelesai}/5` : `${tasIsi.length}/10`}
          </div>
          <div className="text-[10px] text-white/60 leading-tight">{instruksi}</div>
        </div>
      </div>

      {/* indikator zona */}
      {fase === 'rumah' && !briefFase && (
        <div className="absolute bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className={`px-4 py-1.5 rounded-full text-sm font-bold text-white ${zonaSkrg === 0 ? 'bg-green-600' : zonaSkrg === 1 ? 'bg-amber-500' : 'bg-red-600'}`}>
            Zona saat ini: {zonaSkrg === 0 ? 'AMAN' : zonaSkrg === 1 ? 'WASPADA' : 'RAWAN'}
          </div>
          <button onClick={() => apiRef.current.bangunRumah?.()}
            className={`${btn} px-6 py-3 bg-amber-400 text-blue-950 hover:bg-amber-300 shadow-xl text-sm md:text-base flex items-center gap-2`}>
            <Ikon jenis="rumah" className="w-5 h-5" /> Bangun Rumah di Sini
          </button>
        </div>
      )}

      {pesan && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-600/90 text-white font-bold px-4 py-2 rounded-xl text-sm md:text-base text-center max-w-[90%] shadow-xl animate-pulse pointer-events-none flex items-center gap-2">
          <Ikon jenis="peringatan" className="w-5 h-5 flex-shrink-0" />
          {pesan}
        </div>
      )}

      {/* minimap */}
      <canvas ref={minimapRef} width={170} height={170}
        className="absolute bottom-3 right-3 rounded-xl border-2 border-white/40 shadow-xl" />

      {/* tombol sentuh */}
      <div className="absolute bottom-3 left-3 md:hidden">
        <div className="grid grid-cols-3 gap-1 w-36">
          <div />
          <button className="bg-white/20 backdrop-blur rounded-lg py-3 text-white flex items-center justify-center active:bg-white/40"
            onTouchStart={tekan('w', true)} onTouchEnd={tekan('w', false)}><Ikon jenis="atas" className="w-5 h-5" strokeWidth={2.5} /></button>
          <div />
          <button className="bg-white/20 backdrop-blur rounded-lg py-3 text-white flex items-center justify-center active:bg-white/40"
            onTouchStart={tekan('a', true)} onTouchEnd={tekan('a', false)}><Ikon jenis="kiri" className="w-5 h-5" strokeWidth={2.5} /></button>
          <button className="bg-white/20 backdrop-blur rounded-lg py-3 text-white flex items-center justify-center active:bg-white/40"
            onTouchStart={tekan('s', true)} onTouchEnd={tekan('s', false)}><Ikon jenis="bawah" className="w-5 h-5" strokeWidth={2.5} /></button>
          <button className="bg-white/20 backdrop-blur rounded-lg py-3 text-white flex items-center justify-center active:bg-white/40"
            onTouchStart={tekan('d', true)} onTouchEnd={tekan('d', false)}><Ikon jenis="kanan" className="w-5 h-5" strokeWidth={2.5} /></button>
        </div>
      </div>
      {(mode === 'gempa' || mode === 'tsunami') && fase === 'bencana' && (
        <button
          className="absolute bottom-3 left-1/2 -translate-x-1/2 md:left-44 md:translate-x-0 bg-blue-600/90 text-white font-bold px-5 py-4 rounded-2xl shadow-xl active:bg-blue-500 flex items-center gap-2"
          onTouchStart={tekan('c', true)} onTouchEnd={tekan('c', false)}
          onMouseDown={tekan('c', true)} onMouseUp={tekan('c', false)} onMouseLeave={tekan('c', false)}>
          <Ikon jenis="perisai" className="w-5 h-5" /> BERLINDUNG (tahan)
        </button>
      )}

      {/* kuis */}
      {kuis && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 text-slate-800 max-h-[85vh] overflow-y-auto">
            <div className={`text-center text-[10px] font-bold tracking-wider mb-2 ${kuis.tipe === 'rec' ? 'text-orange-600' : 'text-blue-700'}`}>
              {kuis.tipe === 'rec' ? 'PASCA BENCANA · KEPUTUSAN PEMULIHAN' : 'PRA BENCANA · TAS SIAGA'}
            </div>
            <div className={`w-14 h-14 mx-auto mb-2 rounded-full flex items-center justify-center text-white ${kuis.tipe === 'rec' ? 'bg-orange-500' : 'bg-amber-500'}`}>
              <Ikon jenis={kuis.item.ikon} className="w-8 h-8" />
            </div>
            <div className="text-center font-black text-lg mb-1">{kuis.item.nama || kuis.item.judul}</div>
            <p className="text-sm font-semibold text-center mb-4">{kuis.item.tanya}</p>
            <div className="flex flex-col gap-2">
              {kuis.item.opsi.map((o, i) => {
                const terjawab = kuis.jawab != null
                const stil = !terjawab
                  ? 'bg-slate-100 hover:bg-blue-100 border-slate-200'
                  : i === kuis.item.benar
                    ? 'bg-green-100 border-green-500'
                    : i === kuis.jawab
                      ? 'bg-red-100 border-red-400'
                      : 'bg-slate-50 border-slate-100 opacity-60'
                return (
                  <button key={i} onClick={() => jawabKuis(i)} disabled={terjawab}
                    className={`text-left text-sm px-3 py-2.5 rounded-xl border-2 transition-all ${stil}`}>
                    <b>{'ABCD'[i]}.</b> {o}
                  </button>
                )
              })}
            </div>
            {kuis.jawab != null && (
              <div className="mt-4">
                <div className={`font-black mb-1 ${kuis.jawab === kuis.item.benar ? 'text-green-600' : 'text-red-500'}`}>
                  {kuis.jawab === kuis.item.benar
                    ? `Benar! +${kuis.tipe === 'rec' ? 20 : 10} poin`
                    : 'Kurang tepat (0 poin)'}
                </div>
                <p className="text-xs text-slate-600 bg-slate-100 rounded-lg p-2.5">{kuis.item.info}</p>
                <button onClick={tutupKuis}
                  className={`${btn} w-full mt-3 py-2.5 bg-blue-900 text-white hover:bg-blue-800`}>
                  {kuis.tipe === 'rec' ? 'Tangani & Lanjut' : 'Masukkan ke Tas & Lanjut'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* briefing */}
      {briefFase && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 z-30">
          <div className="bg-gradient-to-b from-blue-950 to-slate-900 border border-white/15 rounded-2xl max-w-lg w-full p-6 text-white max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-black mb-2">{briefFase.judul}</h3>
            <p className="text-sm text-white/85 leading-relaxed mb-3">{briefFase.isi}</p>
            {briefFase.langkah.map((l, i) => (
              <p key={i} className="text-xs text-white/70 mb-1.5 leading-relaxed">{l}</p>
            ))}
            <button onClick={briefFase.aksi}
              className={`${btn} w-full mt-4 py-3 bg-amber-400 text-blue-950 hover:bg-amber-300`}>
              {briefFase.tombol}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}