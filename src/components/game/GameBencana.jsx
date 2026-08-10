'use client'

// ============================================================
//  Game Edukasi Bencana v4 — Lampung Edu Gisaster
//  PRA  : (1) MITIGASI STRUKTURAL — mode perencanaan top-down,
//         siswa menempatkan 5 struktur mitigasi nyata di peta
//         (sumur resapan / mangrove-tanggul / terasering / retrofit)
//         (2) TAS SIAGA — karakter muncul; semua item di zona merah
//  SAAT : evakuasi dimulai dari ZONA SANGAT RAWAN menuju SATU-SATUNYA
//         area evakuasi (zona hijau tunggal), dipandu panah di jalan
//         + rambu; ruas jalan terputus tampil live di minimap
//  PASCA: pemulihan 5 titik infrastruktur
// ============================================================

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// ---------------- IKON VEKTOR ----------------
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
  peta: ['M9 5l6-2 6 2v14l-6-2-6 2-6-2V3z', 'M9 5v14', 'M15 3v14'],
  sumur: ['M4 12a8 4 0 1 0 16 0a8 4 0 1 0-16 0', 'M4 12v5c0 2.2 3.6 4 8 4s8-1.8 8-4v-5', 'M9 11h.01', 'M15 13h.01'],
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

// ---------------- THUMBNAIL SVG SKENARIO ----------------
function ThumbBencana({ jenis }) {
  const svgProps = { viewBox: '0 0 200 112', className: 'w-full h-full', preserveAspectRatio: 'xMidYMid slice' }
  if (jenis === 'banjir') {
    return (
      <svg {...svgProps}>
        <defs>
          <linearGradient id="tb-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#475569" /><stop offset="1" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="tb-air" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#38bdf8" /><stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <rect width="200" height="112" fill="url(#tb-sky)" />
        {[20, 55, 90, 125, 160].map((x, i) => (
          <line key={i} x1={x + 8} y1="8" x2={x} y2="26" stroke="#cbd5e1" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
        ))}
        <g>
          <rect x="38" y="46" width="40" height="30" rx="1" fill="#fef3c7" />
          <polygon points="33,47 58,28 83,47" fill="#b91c1c" />
          <rect x="52" y="60" width="12" height="16" fill="#78350f" />
          <rect x="120" y="52" width="34" height="24" rx="1" fill="#e2e8f0" />
          <polygon points="116,53 137,38 158,53" fill="#9f1239" />
        </g>
        <path d="M0 78c14 0 14-7 28-7s14 7 28 7 14-7 28-7 14 7 28 7 14-7 28-7 14 7 28 7 14-7 28-7 14 7 28 7v34H0z" fill="url(#tb-air)" opacity=".95" />
        <path d="M0 90c12 0 12-5 24-5s12 5 24 5 12-5 24-5 12 5 24 5 12-5 24-5 12 5 24 5 12-5 24-5 12 5 24 5 12-5 24-5v27H0z" fill="#60a5fa" opacity=".55" />
      </svg>
    )
  }
  if (jenis === 'longsor') {
    return (
      <svg {...svgProps}>
        <defs>
          <linearGradient id="tl-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#64748b" /><stop offset="1" stopColor="#cbd5e1" />
          </linearGradient>
          <linearGradient id="tl-slide" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#92400e" /><stop offset="1" stopColor="#57330f" />
          </linearGradient>
        </defs>
        <rect width="200" height="112" fill="url(#tl-sky)" />
        <polygon points="70,112 145,14 200,112" fill="#166534" />
        <polygon points="0,112 55,52 110,112" fill="#15803d" />
        <polygon points="128,36 158,36 178,112 96,112" fill="url(#tl-slide)" />
        <circle cx="120" cy="88" r="7" fill="#78350f" />
        <circle cx="142" cy="100" r="9" fill="#57330f" />
        <circle cx="158" cy="78" r="5" fill="#92400e" />
        <rect x="18" y="82" width="30" height="22" fill="#fef3c7" />
        <polygon points="14,83 33,68 52,83" fill="#b91c1c" />
        <rect x="180" y="100" width="20" height="12" fill="#3f6212" />
      </svg>
    )
  }
  if (jenis === 'gempa') {
    return (
      <svg {...svgProps}>
        <defs>
          <linearGradient id="tg-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#78716c" /><stop offset="1" stopColor="#d6d3d1" />
          </linearGradient>
        </defs>
        <rect width="200" height="112" fill="url(#tg-sky)" />
        <rect x="24" y="34" width="30" height="58" fill="#94a3b8" transform="rotate(-6 39 92)" />
        <rect x="86" y="22" width="34" height="70" fill="#cbd5e1" />
        <rect x="150" y="40" width="28" height="52" fill="#94a3b8" transform="rotate(7 164 92)" />
        {[28, 40, 92, 104, 154, 166].map((x, i) => (
          <g key={i} fill="#334155">
            <rect x={x} y="38" width="7" height="8" /><rect x={x} y="54" width="7" height="8" /><rect x={x} y="70" width="7" height="8" />
          </g>
        ))}
        <rect x="0" y="92" width="200" height="20" fill="#57534e" />
        <polyline points="0,100 34,98 58,106 92,96 124,104 156,97 200,103" fill="none" stroke="#1c1917" strokeWidth="4" strokeLinejoin="round" />
        <circle cx="70" cy="30" r="2.5" fill="#78716c" /><circle cx="132" cy="18" r="3" fill="#78716c" />
      </svg>
    )
  }
  return (
    <svg {...svgProps}>
      <defs>
        <linearGradient id="tt-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f766e" /><stop offset="1" stopColor="#99f6e4" />
        </linearGradient>
        <linearGradient id="tt-wave" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0ea5e9" /><stop offset="1" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <rect width="200" height="112" fill="url(#tt-sky)" />
      <circle cx="168" cy="24" r="13" fill="#fde68a" />
      <rect x="0" y="96" width="200" height="16" fill="#d8c48f" />
      <rect x="152" y="76" width="26" height="20" fill="#fef3c7" />
      <polygon points="148,77 165,62 182,77" fill="#b91c1c" />
      <path d="M-4 112V70c0-28 26-44 54-40-14 6-20 16-18 26 26-16 62-8 70 16 8 22-6 40-6 40z" fill="url(#tt-wave)" />
      <circle cx="46" cy="34" r="6" fill="#e0f2fe" /><circle cx="60" cy="28" r="4.5" fill="#e0f2fe" />
      <circle cx="34" cy="42" r="5" fill="#bae6fd" /><circle cx="96" cy="52" r="5" fill="#e0f2fe" />
      <path d="M0 112c16 0 16-6 32-6s16 6 32 6z" fill="#38bdf8" />
    </svg>
  )
}

// ---------------- PRATINJAU KARAKTER (SVG) ----------------
function KarakterSVG({ gender, kulit }) {
  const baju = gender === 'perempuan' ? '#e0529c' : '#2e77d0'
  const rambut = gender === 'perempuan' ? '#4a2c14' : '#1d1d1d'
  return (
    <svg viewBox="0 0 120 168" className="w-full h-full" aria-hidden="true">
      {gender === 'perempuan' && (
        <g fill={rambut}>
          <rect x="28" y="40" width="13" height="58" rx="6" />
          <rect x="79" y="40" width="13" height="58" rx="6" />
        </g>
      )}
      <rect x="42" y="118" width="15" height="36" rx="3" fill="#2f3b52" />
      <rect x="63" y="118" width="15" height="36" rx="3" fill="#2f3b52" />
      <rect x="40" y="150" width="19" height="9" rx="3" fill="#1e293b" />
      <rect x="61" y="150" width="19" height="9" rx="3" fill="#1e293b" />
      <rect x="24" y="80" width="13" height="40" rx="6" fill={kulit} />
      <rect x="83" y="80" width="13" height="40" rx="6" fill={kulit} />
      <rect x="36" y="76" width="48" height="46" rx="5" fill={baju} />
      <rect x="36" y="76" width="48" height="10" rx="5" fill="rgba(255,255,255,0.18)" />
      <rect x="36" y="26" width="48" height="48" rx="9" fill={kulit} />
      <path d={gender === 'perempuan'
        ? 'M36 44v-9a9 9 0 0 1 9-9h30a9 9 0 0 1 9 9v9c-4-6-10-9-24-9s-20 3-24 9z'
        : 'M36 40v-5a9 9 0 0 1 9-9h30a9 9 0 0 1 9 9v5c-6-4-12-6-24-6s-18 2-24 6z'} fill={rambut} />
      <g>
        <ellipse cx="50" cy="52" rx="5.5" ry="6.5" fill="#fff" />
        <ellipse cx="70" cy="52" rx="5.5" ry="6.5" fill="#fff" />
        <circle cx="50" cy="53" r="3" fill="#3d2b1f" />
        <circle cx="70" cy="53" r="3" fill="#3d2b1f" />
        <circle cx="51" cy="52" r="1" fill="#fff" />
        <circle cx="71" cy="52" r="1" fill="#fff" />
      </g>
      <path d="M44 43q6-4 12 0" stroke="#3d2b1f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M64 43q6-4 12 0" stroke="#3d2b1f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {gender === 'perempuan' && (
        <g stroke="#222" strokeWidth="1.4" strokeLinecap="round">
          <line x1="43.5" y1="49" x2="41" y2="47" />
          <line x1="76.5" y1="49" x2="79" y2="47" />
        </g>
      )}
      <line x1="60" y1="57" x2="60" y2="62" stroke="rgba(0,0,0,0.22)" strokeWidth="2" strokeLinecap="round" />
      <path d="M52 66q8 6 16 0" stroke={gender === 'perempuan' ? '#c0392b' : '#7a4636'}
        strokeWidth={gender === 'perempuan' ? 3.4 : 2.6} fill="none" strokeLinecap="round" />
      <circle cx="43" cy="61" r="4" fill="rgba(255,120,120,0.3)" />
      <circle cx="77" cy="61" r="4" fill="rgba(255,120,120,0.3)" />
    </svg>
  )
}

// ---------------- KONFIGURASI ----------------
const SC = 1.55
const BATAS = 56 * SC
const TOWN = 57
const P = 19
const RW = 2.4
const R_EVAK = 12 // radius zona hijau (area evakuasi tunggal), koordinat tak berskala

const gauss = (x, z, cx, cz, r, h) =>
  h * Math.exp(-(((x - cx) ** 2 + (z - cz) ** 2) / (2 * r * r)))

// ZONA: hijau (0) HANYA di sekitar titik evakuasi; sisanya waspada (1) / rawan (2)
const MODES = {
  banjir: {
    nama: 'Banjir',
    langit: 0x8fb8d8,
    deskripsi: 'Air meluap menggenangi kota. Satu-satunya zona aman: bukit evakuasi.',
    briefing:
      'Hujan deras membuat sungai meluap. Di peta ini HANYA ADA SATU zona hijau — bukit evakuasi. Mulailah dengan membangun 5 SUMUR RESAPAN di permukiman rawan untuk mengurangi limpasan, siapkan tas siaga, lalu saat banjir datang ikuti PANAH JALUR EVAKUASI menuju bukit.',
    tinggi: (x, z) =>
      2.2 -
      2.6 * Math.exp(-((x + 18) ** 2) / 98) +
      gauss(x, z, 45, -40, 15, 7) +
      gauss(x, z, 42, 45, 13, 5.5) +
      gauss(x, z, -50, 42, 12, 3.5) +
      0.3 * Math.sin(x * 0.15) * Math.cos(z * 0.12),
    rawan: function (x, z) {
      if (Math.hypot(x - 45, z + 40) < R_EVAK) return 0
      return this.tinggi(x, z) < 1.1 ? 2 : 1
    },
    spawn: [0, 30],
    goal: [45, -40],
    goalLabel: 'Bukit Evakuasi',
  },
  longsor: {
    nama: 'Tanah Longsor',
    langit: 0x9fb3a8,
    deskripsi: 'Lereng timur runtuh memutus jalan. Satu titik aman di barat daya.',
    briefing:
      'Lereng di sisi TIMUR mulai retak. Zona hijau HANYA SATU: titik aman di barat daya. Bangun 5 TERASERING di lereng untuk memperlambat luncuran, siapkan tas siaga, lalu saat longsor terjadi lari menjauh dan menyamping mengikuti panah jalur evakuasi.',
    tinggi: (x, z) =>
      1.6 +
      (x > 12 ? (x - 12) * 0.38 : 0) +
      gauss(x, z, 60, 0, 26, 9) +
      gauss(x, z, -45, -42, 14, 3.2) +
      0.25 * Math.sin(x * 0.13) * Math.cos(z * 0.14),
    rawan: (x, z) => {
      if (Math.hypot(x + 45, z + 42) < R_EVAK) return 0
      return x > 6 && Math.abs(z) < 30 ? 2 : 1
    },
    spawn: [-9.5, 0],
    goal: [-45, -42],
    goalLabel: 'Titik Aman',
  },
  gempa: {
    nama: 'Gempa Bumi',
    langit: 0xbcd0e0,
    deskripsi: 'Guncangan merobohkan bangunan dekat sesar. Satu lapangan terbuka aman.',
    briefing:
      'Kota dilewati jalur sesar aktif. Zona hijau HANYA SATU: lapangan terbuka di barat laut. Perkuat 5 BANGUNAN di dekat sesar (retrofit), siapkan tas siaga, lalu saat gempa: BERLINDUNG (tahan C), dan setelah reda ikuti panah jalur evakuasi ke lapangan.',
    tinggi: (x, z) => 1.4 + 0.35 * Math.sin(x * 0.09) * Math.cos(z * 0.11),
    rawan: (x, z) => {
      if (Math.hypot(x + 40, z - 36) < R_EVAK) return 0
      return Math.abs(x - 10) < 9 ? 2 : 1
    },
    spawn: [-12.3, -12.3],
    goal: [-40, 36],
    goalLabel: 'Lapangan Terbuka',
  },
  tsunami: {
    nama: 'Tsunami',
    langit: 0x9cc4d8,
    deskripsi: 'Gelombang raksasa dari timur. Satu-satunya zona aman: bukit di barat.',
    briefing:
      'Kota pesisir dengan laut di timur. Zona hijau HANYA SATU: bukit evakuasi di barat. Tanam 5 sabuk MANGROVE & TANGGUL di garis pantai untuk meredam gelombang, siapkan tas siaga, lalu saat gempa kuat: BERLINDUNG, dan segera ikuti panah jalur evakuasi ke bukit.',
    tinggi: (x, z) => {
      const t = Math.max(0, Math.min(1.4, (-x + 30) / 30))
      return Math.max(
        -1.3,
        -1 + t * 3 + gauss(x, z, -46, -8, 17, 8) + 0.15 * Math.sin(z * 0.2)
      )
    },
    rawan: function (x, z) {
      if (Math.hypot(x + 46, z + 8) < R_EVAK) return 0
      return x > -2 || this.tinggi(x, z) < 0.6 ? 2 : 1
    },
    spawn: [-12.3, 24.5],
    goal: [-46, -8],
    goalLabel: 'Bukit Evakuasi',
  },
}

// Struktur mitigasi per skenario (fase perencanaan)
const MITIGASI = {
  banjir: {
    nama: 'Sumur Resapan',
    ikon: 'sumur',
    petunjuk: 'Tempatkan di permukiman ZONA MERAH (dataran rendah langganan banjir) untuk menyerap limpasan air.',
    benar: 'Tepat! Sumur resapan menyerap limpasan di dataran rendah.',
    salah: 'Kurang tepat — resapan paling efektif di zona merah dataran rendah.',
  },
  longsor: {
    nama: 'Terasering',
    ikon: 'longsor',
    petunjuk: 'Tempatkan di LERENG sisi timur (zona merah) untuk memperlambat luncuran tanah.',
    benar: 'Tepat! Terasering menstabilkan lereng.',
    salah: 'Kurang tepat — terasering harus di lereng zona merah, bukan dataran.',
  },
  gempa: {
    nama: 'Retrofit Bangunan',
    ikon: 'gempa',
    petunjuk: 'Klik BANGUNAN di dekat jalur sesar (zona merah) untuk diperkuat strukturnya.',
    benar: 'Tepat! Bangunan dekat sesar diperkuat.',
    salah: 'Kurang tepat — prioritaskan bangunan di zona merah dekat sesar.',
  },
  tsunami: {
    nama: 'Mangrove & Tanggul',
    ikon: 'tsunami',
    petunjuk: 'Tempatkan di GARIS PANTAI (sisi timur) untuk meredam energi gelombang.',
    benar: 'Tepat! Sabuk hijau pantai meredam gelombang.',
    salah: 'Kurang tepat — mangrove/tanggul harus di garis pantai.',
  },
}

// Sulit 60s, Normal 90s, Mudah 120s untuk tas siaga; evakuasi & pemulihan 30/60/90
const DIFF = {
  mudah: { label: 'Mudah', tas: 120, aksi: 90, mult: 0.7, drain: 0.7 },
  normal: { label: 'Normal', tas: 90, aksi: 60, mult: 1, drain: 1 },
  sulit: { label: 'Sulit', tas: 60, aksi: 30, mult: 1.45, drain: 1.3 },
}

const ITEMS = [
  {
    ikon: 'dokumen', nama: 'Dokumen Penting',
    tanya: 'Kenapa salinan KK/KTP masuk tas siaga?',
    opsi: ['Untuk dijual', 'Sulit diurus ulang jika hilang', 'Bahan bakar api', 'Pengisi tas'],
    benar: 1,
    info: 'Dokumen jadi dasar bantuan & administrasi pasca bencana.',
  },
  {
    ikon: 'air', nama: 'Air Minum',
    tanya: 'Stok air minum yang disarankan BNPB?',
    opsi: ['1 jam', '±3 hari', 'Tidak perlu', '2 minggu'],
    benar: 1,
    info: 'Cukup untuk bertahan sebelum bantuan datang.',
  },
  {
    ikon: 'makanan', nama: 'Makanan',
    tanya: 'Makanan paling tepat untuk tas siaga?',
    opsi: ['Makanan beku', 'Sayur segar', 'Siap santap & awet', 'Mi mentah'],
    benar: 2,
    info: 'Bisa langsung dimakan saat listrik & gas padam.',
  },
  {
    ikon: 'senter', nama: 'Senter & Baterai',
    tanya: 'Kenapa senter penting saat bencana?',
    opsi: ['Lebih terang', 'Listrik biasanya padam', 'Memanggil pesawat', 'Hemat energi'],
    benar: 1,
    info: 'Sumber cahaya andal saat jaringan listrik mati.',
  },
  {
    ikon: 'p3k', nama: 'P3K & Obat',
    tanya: 'Yang wajib ditambah selain P3K umum?',
    opsi: ['Obat rutin keluarga', 'Vitamin peninggi', 'Suplemen gym', 'Obat tidur'],
    benar: 0,
    info: 'Penyakit kronis bisa kambuh tanpa obat rutinnya.',
  },
  {
    ikon: 'radio', nama: 'Radio / Powerbank',
    tanya: 'Fungsi utama radio/HP saat bencana?',
    opsi: ['Hiburan musik', 'Pantau info resmi BMKG/BPBD', 'Main game', 'Usir hewan'],
    benar: 1,
    info: 'Info resmi mencegah hoaks & salah keputusan.',
  },
  {
    ikon: 'peluit', nama: 'Peluit',
    tanya: 'Kenapa peluit, bukan berteriak?',
    opsi: ['Nyaring & hemat tenaga', 'Usir nyamuk', 'Aturan SAR', 'Teriak dilarang'],
    benar: 0,
    info: 'Bunyinya menembus reruntuhan tanpa menguras energi.',
  },
  {
    ikon: 'pakaian', nama: 'Pakaian & Selimut',
    tanya: 'Fungsi pakaian ganti & selimut?',
    opsi: ['Tetap modis', 'Bendera darurat', 'Cegah hipotermia', 'Alas duduk'],
    benar: 2,
    info: 'Tubuh basah & dingin bisa berakibat fatal.',
  },
  {
    ikon: 'uang', nama: 'Uang Tunai',
    tanya: 'Kenapa tunai, bukan hanya ATM?',
    opsi: ['Lebih ringan', 'ATM mati saat listrik padam', 'Harga murah', 'Bank tutup'],
    benar: 1,
    info: 'Pembayaran digital lumpuh tanpa listrik & internet.',
  },
  {
    ikon: 'masker', nama: 'Masker',
    tanya: 'Fungsi masker pasca bencana?',
    opsi: ['Saring debu & cegah penyakit', 'Samarkan wajah', 'Penghangat', 'Syarat tenda'],
    benar: 0,
    info: 'Udara berdebu & pengungsian padat rawan penularan.',
  },
]

const RECOVERY = {
  banjir: [
    {
      ikon: 'rumah', judul: 'Rumah Terendam',
      tanya: 'Langkah pertama sebelum masuk rumah bekas banjir?',
      opsi: ['Langsung masuk', 'Padamkan listrik dari meteran', 'Nyalakan kompor', 'Tunggu sebulan'],
      benar: 1,
      info: 'Instalasi listrik basah bisa menyetrum.',
    },
    {
      ikon: 'peringatan', judul: 'Bersih Lumpur',
      tanya: 'Wajib dipakai saat bersihkan lumpur banjir?',
      opsi: ['Sandal jepit', 'Tanpa alat', 'Sepatu bot & sarung tangan', 'Kacamata renang'],
      benar: 2,
      info: 'Lumpur banjir rawan bakteri leptospirosis.',
    },
    {
      ikon: 'air', judul: 'Air Tercemar',
      tanya: 'Cara dapat air minum aman pasca banjir?',
      opsi: ['Minum langsung', 'Rebus / air kemasan posko', 'Saring kain saja', 'Tambah garam'],
      benar: 1,
      info: 'Air tercemar membawa kuman diare.',
    },
    {
      ikon: 'dokumen', judul: 'Lapor Kerusakan',
      tanya: 'Kerusakan rumah dilaporkan ke mana?',
      opsi: ['Media sosial', 'Perbaiki sendiri', 'RT/kelurahan & BPBD', 'Stasiun TV'],
      benar: 2,
      info: 'Pendataan resmi = dasar bantuan perbaikan.',
    },
    {
      ikon: 'p3k', judul: 'Kesehatan',
      tanya: 'Penyakit yang diwaspadai pasca banjir?',
      opsi: ['Diare & leptospirosis', 'Patah tulang', 'Sakit gigi', 'Rabun jauh'],
      benar: 0,
      info: 'Genangan & sanitasi buruk memicu penyakit.',
    },
  ],
  longsor: [
    {
      ikon: 'peringatan', judul: 'Zona Longsoran',
      tanya: 'Boleh langsung kembali ke zona longsor?',
      opsi: ['Boleh', 'Jangan — tunggu pernyataan aman petugas', 'Boleh pelan-pelan', 'Boleh jika reda'],
      benar: 1,
      info: 'Longsor susulan sangat mungkin terjadi.',
    },
    {
      ikon: 'perbaikan', judul: 'Jalan Tertimbun',
      tanya: 'Jalan tertutup material longsor, sebaiknya?',
      opsi: ['Bersihkan sendiri', 'Lapor BPBD/PU & pasang rambu', 'Bakar material', 'Biarkan'],
      benar: 1,
      info: 'Butuh alat berat & penilaian kestabilan lereng.',
    },
    {
      ikon: 'longsor', judul: 'Lereng Gundul',
      tanya: 'Cegah longsor jangka panjang?',
      opsi: ['Tanam vegetasi & perbaiki drainase', 'Siram tiap hari', 'Bangun rumah lagi', 'Cat semen'],
      benar: 0,
      info: 'Akar mengikat tanah, drainase cegah jenuh air.',
    },
    {
      ikon: 'rumah', judul: 'Rumah Zona Merah',
      tanya: 'Solusi rumah di jalur longsor aktif?',
      opsi: ['Relokasi sesuai arahan pemerintah', 'Tambah lantai', 'Pagar tinggi', 'Jaga bergantian'],
      benar: 0,
      info: 'Relokasi = pilihan paling aman jangka panjang.',
    },
    {
      ikon: 'dokumen', judul: 'Pendataan Warga',
      tanya: 'Manfaat pendataan warga terdampak?',
      opsi: ['Difoto wartawan', 'Bantuan tepat sasaran', 'Undian', 'Tidak ada'],
      benar: 1,
      info: 'Memastikan tak ada korban terlewat.',
    },
  ],
  gempa: [
    {
      ikon: 'gempa', judul: 'Bangunan Retak',
      tanya: 'Rumah retak pasca gempa, sebaiknya?',
      opsi: ['Langsung masuk', 'Tunggu penilaian petugas', 'Pakai helm saja', 'Lakban retakan'],
      benar: 1,
      info: 'Bangunan retak bisa roboh saat gempa susulan.',
    },
    {
      ikon: 'peringatan', judul: 'Gas Bocor',
      tanya: 'Tercium gas bocor, yang benar?',
      opsi: ['Nyalakan lampu', 'Nyalakan korek', 'Jangan nyalakan api, buka ventilasi', 'Semprot pewangi'],
      benar: 2,
      info: 'Percikan sekecil apa pun bisa memicu ledakan.',
    },
    {
      ikon: 'radio', judul: 'Kabar Hoaks',
      tanya: '"Akan ada gempa besar jam 9" — sikapmu?',
      opsi: ['Sebar ke grup', 'Cek hanya kanal resmi BMKG', 'Percaya teman', 'Panik mengungsi'],
      benar: 1,
      info: 'Waktu gempa tidak bisa diprediksi siapa pun.',
    },
    {
      ikon: 'p3k', judul: 'Warga Terluka',
      tanya: 'Tetangga luka ringan, bantuan awal?',
      opsi: ['P3K & hubungi medis', 'Pindahkan kasar', 'Beri kopi', 'Diam saja'],
      benar: 0,
      info: 'Korban terjepit jangan dipindah sembarangan.',
    },
    {
      ikon: 'dokumen', judul: 'Lapor Kerusakan',
      tanya: 'Agar dapat bantuan rehabilitasi, lapor ke?',
      opsi: ['RT/kelurahan & BPBD', 'Media sosial', 'Tidak perlu', 'Asuransi tetangga'],
      benar: 0,
      info: 'Data resmi = dasar program rekonstruksi.',
    },
  ],
  tsunami: [
    {
      ikon: 'tsunami', judul: 'Kembali ke Pesisir',
      tanya: 'Kapan boleh kembali ke pesisir?',
      opsi: ['Saat air surut pertama', 'Setelah pernyataan resmi BMKG', 'Setelah 15 menit', 'Ikut orang lain'],
      benar: 1,
      info: 'Gelombang berikutnya bisa lebih besar.',
    },
    {
      ikon: 'gempa', judul: 'Bangunan Terdampak',
      tanya: 'Bangunan bekas terjangan tampak utuh, aman?',
      opsi: ['Aman', 'Tidak — tunggu pemeriksaan petugas', 'Lewat jendela', 'Aman 5 menit'],
      benar: 1,
      info: 'Struktur bisa keropos meski tampak berdiri.',
    },
    {
      ikon: 'air', judul: 'Air & Sanitasi',
      tanya: 'Sumber air payau/tercemar, sebaiknya?',
      opsi: ['Air bersih posko & rebus', 'Minum air laut', 'Mandi genangan', 'Tidak minum'],
      benar: 0,
      info: 'Air bekas tsunami bercampur limbah.',
    },
    {
      ikon: 'hati', judul: 'Pemulihan Psikis',
      tanya: 'Adik trauma & sulit tidur, bantuan tepat?',
      opsi: ['Suruh lupakan', 'Temani & dukungan psikososial', 'Takut-takuti', 'Tonton berita terus'],
      benar: 1,
      info: 'Trauma healing bagian penting pemulihan.',
    },
    {
      ikon: 'dokumen', judul: 'Pendataan',
      tanya: 'Agar bantuan hunian tepat sasaran?',
      opsi: ['Terdata di RT/kelurahan & BPBD', 'Diam di rumah', 'Ikut undian', 'Pindah diam-diam'],
      benar: 0,
      info: 'Pendataan = pintu masuk semua program bantuan.',
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

const WARNA_RUMAH = [0xe8dcc0, 0xd9c8a8, 0xcfd8dc, 0xe0cfc0, 0xd4c19a, 0xc9d6c0]
const WARNA_ATAP = [0xb03a2e, 0x8d4a2f, 0x6d4c41, 0x37474f, 0x7b3f00]
function buatRumahWarga(seed = 0) {
  const grp = new THREE.Group()
  const w = 3.6 + (seed % 3) * 0.5
  const d = 3.0 + ((seed * 7) % 3) * 0.5
  const dinding = new THREE.Mesh(
    new THREE.BoxGeometry(w, 2.4, d),
    new THREE.MeshLambertMaterial({ color: WARNA_RUMAH[seed % WARNA_RUMAH.length] })
  )
  dinding.position.y = 1.2
  const atap = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(w, d) * 0.82, 1.7, 4),
    new THREE.MeshLambertMaterial({ color: WARNA_ATAP[(seed * 3) % WARNA_ATAP.length] })
  )
  atap.position.y = 3.2
  atap.rotation.y = Math.PI / 4
  grp.add(dinding, atap)
  dinding.castShadow = true
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
  daun.castShadow = true
  return grp
}

function buatPenutupJalan(mode) {
  const grp = new THREE.Group()
  if (mode === 'banjir' || mode === 'tsunami') {
    const batang = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.65, 6.5, 8),
      new THREE.MeshLambertMaterial({ color: 0x5e3f28 })
    )
    batang.rotation.z = Math.PI / 2
    batang.position.y = 0.6
    const daun = new THREE.Mesh(
      new THREE.SphereGeometry(1.6, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a6b45 })
    )
    daun.position.set(3.2, 1, 0)
    grp.add(batang, daun)
  } else {
    const warna = mode === 'gempa' ? 0x8d8d8d : 0x6b4423
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.9 + Math.random() * 0.9, 0),
        new THREE.MeshLambertMaterial({ color: warna })
      )
      b.position.set((Math.random() - 0.5) * 4.5, 0.5 + Math.random() * 0.8, (Math.random() - 0.5) * 4.5)
      b.rotation.set(Math.random(), Math.random(), Math.random())
      b.castShadow = true
      grp.add(b)
    }
  }
  return grp
}

function buatGenangan() {
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(4.2, 24),
    new THREE.MeshPhongMaterial({ color: 0x2f6db3, transparent: true, opacity: 0.8, shininess: 90 })
  )
  disc.rotation.x = -Math.PI / 2
  return disc
}

// ---- struktur mitigasi (fase perencanaan) ----
function buatStrukturMitigasi(mode) {
  const grp = new THREE.Group()
  if (mode === 'banjir') {
    const bibir = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.3, 0.5, 16),
      new THREE.MeshLambertMaterial({ color: 0xb0b7bd })
    )
    bibir.position.y = 0.25
    const lubang = new THREE.Mesh(
      new THREE.CircleGeometry(0.85, 16),
      new THREE.MeshBasicMaterial({ color: 0x16324a })
    )
    lubang.rotation.x = -Math.PI / 2
    lubang.position.y = 0.51
    grp.add(bibir, lubang)
  } else if (mode === 'tsunami') {
    const tanggul = new THREE.Mesh(
      new THREE.BoxGeometry(6, 1.1, 1),
      new THREE.MeshLambertMaterial({ color: 0x9aa3ab })
    )
    tanggul.position.y = 0.55
    grp.add(tanggul)
    for (let i = -2; i <= 2; i++) {
      const akar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.16, 1, 5),
        new THREE.MeshLambertMaterial({ color: 0x5e4a30 })
      )
      akar.position.set(i * 1.2, 0.9, 1.2)
      const daun = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 7, 5),
        new THREE.MeshLambertMaterial({ color: 0x2f7d4f })
      )
      daun.position.set(i * 1.2, 1.7, 1.2)
      grp.add(akar, daun)
    }
  } else if (mode === 'longsor') {
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(5.5 - i, 0.5, 1.6),
        new THREE.MeshLambertMaterial({ color: 0x7c9a5a })
      )
      step.position.set(0, 0.25 + i * 0.55, -i * 1.3)
      const tepi = new THREE.Mesh(
        new THREE.BoxGeometry(5.5 - i, 0.6, 0.22),
        new THREE.MeshLambertMaterial({ color: 0x5e4a30 })
      )
      tepi.position.set(0, 0.3 + i * 0.55, -i * 1.3 + 0.8)
      grp.add(step, tepi)
    }
  } else {
    // retrofit: rangka baja di sekeliling bangunan
    const mat = new THREE.MeshLambertMaterial({ color: 0x4f6d8c })
    const posisi = [[-2, -2], [2, -2], [-2, 2], [2, 2]]
    for (const [ox, oz] of posisi) {
      const tiang = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.6, 0.28), mat)
      tiang.position.set(ox, 1.8, oz)
      grp.add(tiang)
    }
    for (const rot of [0, Math.PI / 2]) {
      const balok = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.24, 0.24), mat)
      balok.position.y = 3.4
      balok.rotation.y = rot
      grp.add(balok)
    }
  }
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true })
  return grp
}

// panah penunjuk jalur evakuasi di permukaan jalan
function buatPanahJalan() {
  const c = document.createElement('canvas')
  c.width = c.height = 96
  const g = c.getContext('2d')
  g.strokeStyle = '#16a34a'
  g.lineWidth = 15
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(14, 48); g.lineTo(74, 48)
  g.moveTo(52, 24); g.lineTo(78, 48); g.lineTo(52, 72)
  g.stroke()
  g.strokeStyle = '#ffffff'
  g.lineWidth = 7
  g.beginPath()
  g.moveTo(14, 48); g.lineTo(74, 48)
  g.moveTo(52, 24); g.lineTo(78, 48); g.lineTo(52, 72)
  g.stroke()
  const geo = new THREE.PlaneGeometry(3.4, 3.4)
  geo.rotateX(-Math.PI / 2)
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
  )
  return mesh
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

function jarakKeSegmen(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az
  const l2 = dx * dx + dz * dz
  if (l2 === 0) return Math.hypot(px - ax, pz - az)
  let t = ((px - ax) * dx + (pz - az) * dz) / l2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

// ---------------- KOMPONEN UTAMA ----------------
export default function GameBencana() {
  const [layar, setLayar] = useState('menu')
  const [mode, setMode] = useState('banjir')
  const [tingkat, setTingkat] = useState('normal')
  const [gender, setGender] = useState('laki')
  const [kulit, setKulit] = useState(KULIT[0])
  const [runId, setRunId] = useState(0)

  const [fase, setFase] = useState('mitigasi')
  const [hp, setHp] = useState(100)
  const [timer, setTimer] = useState(0)
  const [pesan, setPesan] = useState('')
  const [mitCount, setMitCount] = useState(0)
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
  const kuisTimerRef = useRef(null)

  const M = MODES[mode]
  const D = DIFF[tingkat]
  const MIT = MITIGASI[mode]
  const TAHAP = { mitigasi: 'PRA BENCANA', tas: 'PRA BENCANA', bencana: 'SAAT BENCANA', pemulihan: 'PASCA BENCANA' }

  const mulai = () => {
    setFase('mitigasi'); setHp(100); setTimer(0); setMitCount(0); setTasIsi([]); setRecSelesai(0)
    setKuis(null); setHasil(null); setPesan(''); setInstruksi('')
    pausedRef.current = false
    if (kuisTimerRef.current) clearTimeout(kuisTimerRef.current)
    setBriefFase({
      judul: `Misi: Selamat dari ${M.nama}`,
      isi: M.briefing,
      langkah: [
        `PRA BENCANA — (1) Mitigasi struktural: klik peta untuk menempatkan 5 ${MIT.nama} di lokasi yang tepat (mode perencanaan, karakter belum muncul). (2) Karakter muncul dan mengisi tas siaga dalam ${D.tas} detik — semua barang tersebar di zona merah!`,
        `SAAT BENCANA — kamu memulai dari ZONA SANGAT RAWAN. Hanya ada SATU area evakuasi (zona hijau). Ikuti panah hijau di jalan & rambu, hindari ruas terputus (lihat minimap), waktumu ${D.aksi} detik.`,
        `PASCA BENCANA — tangani 5 titik infrastruktur rusak dalam ${D.aksi} detik.`,
      ],
      tombol: 'Mulai Bermain',
      aksi: () => setBriefFase(null),
    })
    setLayar('main')
    setRunId((r) => r + 1)
  }

  const jawabKuis = (idx) => {
    if (!kuis || kuis.jawab != null) return
    const item = kuis.item
    const tipe = kuis.tipe
    const benar = idx === item.benar
    setKuis({ item, tipe, jawab: idx })
    kuisTimerRef.current = setTimeout(() => {
      if (tipe === 'tas') {
        apiRef.current.selesaiKuis?.(item, benar)
        setTasIsi((t) => [...t, { ...item, benar }])
      } else {
        apiRef.current.selesaiRec?.(item, benar)
        setRecSelesai((n) => n + 1)
      }
      setKuis(null)
      pausedRef.current = false
    }, 1400)
  }

  // ---------- ENGINE ----------
  useEffect(() => {
    if (layar !== 'main') return
    const mount = mountRef.current
    if (!mount) return
    const cfgM = MODES[mode]
    const cfgD = DIFF[tingkat]
    const cfgMit = MITIGASI[mode]

    const W = mount.clientWidth, H = mount.clientHeight
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(cfgM.langit)
    scene.fog = new THREE.Fog(cfgM.langit, 90, 400) // jauh saat mode perencanaan
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 500)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x556b5f, 0.95))
    const matahari = new THREE.DirectionalLight(0xfff2d0, 1.05)
    matahari.position.set(60, 90, 40)
    matahari.castShadow = true
    matahari.shadow.mapSize.set(2048, 2048)
    matahari.shadow.camera.left = -100; matahari.shadow.camera.right = 100
    matahari.shadow.camera.top = 100; matahari.shadow.camera.bottom = -100
    scene.add(matahari)

    const tinggiDi = (x, z) => cfgM.tinggi(x / SC, z / SC)
    const rawanDi = (x, z) => cfgM.rawan(x / SC, z / SC)
    const GOAL = [cfgM.goal[0] * SC, cfgM.goal[1] * SC]
    const SPAWN = [cfgM.spawn[0] * SC, cfgM.spawn[1] * SC]

    // ---- jaringan jalan ----
    const maxG = Math.max(Math.abs(GOAL[0]), Math.abs(GOAL[1]))
    const TE = [GOAL[0] * (TOWN / maxG), GOAL[1] * (TOWN / maxG)]
    const isRoad = (x, z) => {
      if (Math.abs(x) <= TOWN + RW && Math.abs(z) <= TOWN + RW) {
        const dx = Math.abs(x - Math.round(x / P) * P)
        const dz = Math.abs(z - Math.round(z / P) * P)
        if (dx < RW || dz < RW) return true
      }
      return jarakKeSegmen(x, z, TE[0], TE[1], GOAL[0], GOAL[1]) < RW + 0.4
    }
    const snapJalan = (x, z) => {
      const gx = Math.round(x / P) * P, gz = Math.round(z / P) * P
      if (Math.abs(x - gx) < Math.abs(z - gz)) return [gx, z]
      return [x, gz]
    }

    // ---- terrain ----
    const SIZE = 200, SEG = 120
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)
    geo.rotateX(-Math.PI / 2)
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const cAman = new THREE.Color('#4f9e51'), cWas = new THREE.Color('#d9c04a'),
      cRawan = new THREE.Color('#cf6a50'), cSesar = new THREE.Color('#3a3a3a'),
      cPasir = new THREE.Color('#d8c48f'), cJalan = new THREE.Color('#6b7280'),
      tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const h = tinggiDi(x, z)
      pos.setY(i, h)
      const zona = rawanDi(x, z)
      tmp.copy(zona === 2 ? cRawan : zona === 1 ? cWas : cAman)
      if (isRoad(x, z) && h > 0.35) tmp.copy(cJalan)
      if (mode === 'gempa' && Math.abs(x / SC - 10) < 1.6 && !isRoad(x, z)) tmp.copy(cSesar)
      if (mode === 'tsunami' && h < 0.4 && h > -0.6) tmp.copy(cPasir)
      const shade = 0.88 + Math.min(0.16, Math.max(0, h) * 0.018) + Math.random() * 0.05
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
    const tabrak = (x, z, rad = 0.5) => {
      for (const c of colliders) {
        const dx = x - c.x, dz = z - c.z
        if (dx * dx + dz * dz < (c.r + rad) * (c.r + rad)) return true
      }
      return false
    }

    const rand = (a, b) => a + Math.random() * (b - a)
    const jauhDari = (x, z, px2, pz2, d) => Math.hypot(x - px2, z - pz2) > d

    // ---- permukiman padat ----
    const bangunan = []
    let seed = 0
    for (let bi = -3; bi < 3; bi++) {
      for (let bj = -3; bj < 3; bj++) {
        const cx0 = bi * P + P / 2
        const cz0 = bj * P + P / 2
        const off = 4.6
        const posisi = [[-off, -off], [off, -off], [-off, off], [off, off]]
        for (const [ox, oz] of posisi) {
          const x = cx0 + ox + rand(-0.6, 0.6)
          const z = cz0 + oz + rand(-0.6, 0.6)
          seed++
          if (tinggiDi(x, z) < 0.6) continue
          if (mode === 'longsor' && tinggiDi(x, z) > 14) continue
          if (!jauhDari(x, z, SPAWN[0], SPAWN[1], 5)) continue
          if (!jauhDari(x, z, GOAL[0], GOAL[1], 12)) continue
          const r = buatRumahWarga(seed)
          r.position.set(x, tinggiDi(x, z), z)
          r.rotation.y = (seed % 4) * (Math.PI / 2)
          scene.add(r); bangunan.push(r)
          colliders.push({ x, z, r: 2.55 })
        }
      }
    }
    for (let i = 0; i < 30; i++) {
      const x = rand(-84, 84), z = rand(-84, 84)
      if (Math.abs(x) < TOWN && Math.abs(z) < TOWN) continue
      if (tinggiDi(x, z) < 0.6 || !jauhDari(x, z, GOAL[0], GOAL[1], 6)) continue
      const p = buatPohon()
      p.position.set(x, tinggiDi(x, z), z)
      p.scale.setScalar(rand(0.9, 1.7))
      scene.add(p)
      colliders.push({ x, z, r: 0.7 })
    }

    // ---- JALUR EVAKUASI: rute jalan + panah di aspal + rambu berarah ----
    const gx = Math.max(-TOWN, Math.min(TOWN, Math.round(TE[0] / P) * P))
    const gz = Math.max(-TOWN, Math.min(TOWN, Math.round(TE[1] / P) * P))
    const spawnDiVertikal = Math.abs(SPAWN[0] - Math.round(SPAWN[0] / P) * P) < RW
    const rute = spawnDiVertikal
      ? [[SPAWN[0], SPAWN[1]], [SPAWN[0], gz], [gx, gz], TE, GOAL]
      : [[SPAWN[0], SPAWN[1]], [gx, SPAWN[1]], [gx, gz], TE, GOAL]
    const panahList = []
    for (let s = 0; s < rute.length - 1; s++) {
      const [ax, az] = rute[s], [bx, bz] = rute[s + 1]
      const len = Math.hypot(bx - ax, bz - az)
      if (len < 2) continue
      const dirX = (bx - ax) / len, dirZ = (bz - az) / len
      const n = Math.max(1, Math.floor(len / 11))
      for (let k = 1; k <= n; k++) {
        const px2 = ax + dirX * (k * len) / (n + 0.0001)
        const pz2 = az + dirZ * (k * len) / (n + 0.0001)
        if (tinggiDi(px2, pz2) < 0.4) continue
        const panah = buatPanahJalan()
        panah.position.set(px2, tinggiDi(px2, pz2) + 0.08, pz2)
        panah.rotation.y = -Math.atan2(dirZ, dirX)
        panah.visible = false // muncul saat bencana
        scene.add(panah)
        panahList.push(panah)
      }
      // rambu di tiap belokan, menghadap arah segmen berikutnya
      if (s > 0) {
        const rambu = buatRambu()
        rambu.position.set(ax + 2.6, tinggiDi(ax + 2.6, az), az + 2.6)
        rambu.rotation.y = Math.atan2(bx - ax, bz - az) + Math.PI / 2
        scene.add(rambu)
      }
    }

    // ---- karakter (BELUM muncul di fase mitigasi) ----
    const pemain = buatKarakter({ gender, kulit })
    pemain.position.set(SPAWN[0], tinggiDi(SPAWN[0], SPAWN[1]), SPAWN[1])
    pemain.visible = false
    scene.add(pemain)
    const anim = pemain.userData

    // ---- goal ----
    const goal = buatGoal(cfgM.goalLabel)
    goal.position.set(GOAL[0], tinggiDi(GOAL[0], GOAL[1]), GOAL[1])
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

    // ---- titik pemutus jalan ----
    let cuts = []
    const spawnPemutusJalan = () => {
      const tipePerMode = {
        banjir: ['air', 'air', 'air', 'air', 'air', 'blok', 'blok', 'blok', 'blok'],
        tsunami: ['air', 'air', 'air', 'air', 'air', 'blok', 'blok', 'blok', 'blok'],
        longsor: ['blok', 'blok', 'blok', 'blok', 'blok', 'blok', 'air', 'air', 'air'],
        gempa: ['blok', 'blok', 'blok', 'blok', 'blok', 'blok', 'air', 'air', 'air'],
      }
      const daftar = tipePerMode[mode]
      let percobaan = 0
      while (cuts.length < daftar.length && percobaan < 300) {
        percobaan++
        const garis = (Math.floor(rand(-2, 3))) * P
        const tSepanjang = rand(-46, 46)
        const vertikal = Math.random() < 0.5
        const x = vertikal ? garis : tSepanjang
        const z = vertikal ? tSepanjang : garis
        if (!isRoad(x, z)) continue
        if (tinggiDi(x, z) < 0.5) continue
        if (!jauhDari(x, z, pemain.position.x, pemain.position.z, 12)) continue
        if (!jauhDari(x, z, GOAL[0], GOAL[1], 15)) continue
        if (cuts.some((c) => !jauhDari(x, z, c.x, c.z, 13))) continue
        const tipe = daftar[cuts.length]
        let mesh
        if (tipe === 'air') {
          mesh = buatGenangan()
          mesh.position.set(x, tinggiDi(x, z) + 0.1, z)
        } else {
          mesh = buatPenutupJalan(mode)
          mesh.position.set(x, tinggiDi(x, z), z)
          mesh.rotation.y = rand(0, Math.PI)
          colliders.push({ x, z, r: 3.3 })
        }
        scene.add(mesh)
        cuts.push({ x, z, tipe, mesh })
      }
    }

    // ---- item tas siaga: SEMUA di jalan zona merah ----
    let itemMeshes = []
    const spawnItems = (cx, cz) => {
      const terpasang = []
      const cariTitikJalan = (butuhMerah) => {
        for (let coba = 0; coba < 250; coba++) {
          const ang = rand(0, Math.PI * 2)
          const r = rand(8, 75)
          const tx = Math.max(-TOWN, Math.min(TOWN, cx + Math.cos(ang) * r))
          const tz = Math.max(-TOWN, Math.min(TOWN, cz + Math.sin(ang) * r))
          const [sx2, sz2] = snapJalan(tx, tz)
          if (!isRoad(sx2, sz2)) continue
          if (tinggiDi(sx2, sz2) < 0.5) continue
          if (tabrak(sx2, sz2, 0.8)) continue
          if (butuhMerah && rawanDi(sx2, sz2) !== 2) continue
          if (Math.hypot(sx2 - cx, sz2 - cz) < 9) continue
          if (terpasang.some((p) => Math.hypot(p[0] - sx2, p[1] - sz2) < 9)) continue
          return [sx2, sz2]
        }
        return null
      }
      itemMeshes = ITEMS.map((it, i) => {
        const titik2 = cariTitikJalan(true) || cariTitikJalan(false) || [cx + 6 + i * 3, cz]
        const [x, z] = titik2
        terpasang.push(titik2)
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
        .filter((b) => jauhDari(b.position.x, b.position.z, GOAL[0], GOAL[1], 14))
        .sort(() => Math.random() - 0.5)
      const terpakai = []
      for (const b of dipilih) {
        if (terpakai.length >= tugasList.length) break
        if (terpakai.some((t2) => !jauhDari(b.position.x, b.position.z, t2.position.x, t2.position.z, 16))) continue
        terpakai.push(b)
      }
      recPoints = tugasList.map((tugas, i) => {
        const b = terpakai[i]
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
    mmC.width = mmC.height = 128
    const mmG = mmC.getContext('2d')
    for (let i = 0; i < 128; i++) for (let j = 0; j < 128; j++) {
      const x = (i / 127) * 2 * BATAS - BATAS, z = (j / 127) * 2 * BATAS - BATAS
      const h = tinggiDi(x, z), zona = rawanDi(x, z)
      let warna = zona === 2 ? '#cf6a50' : zona === 1 ? '#d9c04a' : '#4f9e51'
      if (isRoad(x, z) && h > 0.35) warna = '#4b5563'
      if (mode === 'gempa' && Math.abs(x / SC - 10) < 1.8 && !isRoad(x, z)) warna = '#333'
      if (mode === 'tsunami' && h < 0) warna = '#1d6fa5'
      mmG.fillStyle = warna
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
      cuts.forEach((c) => {
        titik(g, px(c.x), px(c.z), 4.5, c.tipe === 'air' ? '#3b82f6' : '#78350f', '#ffffff')
      })
      itemMeshes.forEach((s) => {
        if (s.userData.ambil) return
        titik(g, px(s.position.x), px(s.position.z), 4, '#ffd60a', '#ffffff')
      })
      recPoints.forEach((r) => {
        if (r.selesai) return
        titik(g, px(r.x), px(r.z), 4.5, '#f97316', '#ffffff')
      })
      titik(g, px(goal.position.x), px(goal.position.z), 6, '#22c55e', '#ffffff')
      if (pemain.visible) {
        g.save()
        g.translate(px(pemain.position.x), px(pemain.position.z))
        g.rotate(-pemain.rotation.y)
        g.fillStyle = '#fff'
        g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill()
        g.strokeStyle = '#111'; g.lineWidth = 1.5; g.stroke()
        g.restore()
      }
    }

    // ---- state internal ----
    const st = {
      faseNow: 'mitigasi',
      hp: 100,
      timerTas: cfgD.tas,
      timerEvak: cfgD.aksi,
      timerRec: cfgD.aksi,
      tEvakPakai: 0,
      stage: 0,
      stageT: 0,
      selesai: false,
      benarMit: 0,
      jumlahMit: 0,
      benarTas: 0,
      benarRec: 0,
      selamat: false,
      hpAkhir: 0,
      shake: 0,
      susulanT: 8,
      pesanT: 0,
      blokirT: 0,
    }
    const shakeDur = Math.min(10, cfgD.aksi * 0.25)

    const kirimPesan = (p) => { setPesan(p); st.pesanT = 3.5 }

    // ---- FASE 1: penempatan struktur mitigasi (klik peta) ----
    const validMitigasi = (x, z) => {
      const xu = x / SC
      const h = tinggiDi(x, z)
      if (mode === 'banjir') return rawanDi(x, z) === 2 && h > 0.2
      if (mode === 'longsor') return xu > 10
      if (mode === 'tsunami') return xu > 8 && h > -0.6 && h < 2.2
      // gempa: dekat bangunan di zona merah
      if (rawanDi(x, z) !== 2) return false
      return bangunan.some((b) => Math.hypot(b.position.x - x, b.position.z - z) < 6)
    }
    const tempatkanStruktur = (pt) => {
      if (st.jumlahMit >= 5) return
      const x = pt.x, z = pt.z
      const valid = validMitigasi(x, z)
      if (valid) st.benarMit++
      st.jumlahMit++
      setMitCount(st.jumlahMit)
      const struktur = buatStrukturMitigasi(mode)
      struktur.position.set(x, tinggiDi(x, z), z)
      if (mode === 'longsor') struktur.rotation.y = -Math.PI / 2
      scene.add(struktur)
      const tanda = spriteIkon(valid ? 'perisai' : 'gagal', valid ? '#16a34a' : '#dc2626', 1.8)
      tanda.position.set(x, tinggiDi(x, z) + 4.5, z)
      scene.add(tanda)
      setTimeout(() => scene.remove(tanda), 2200)
      kirimPesan(valid ? cfgMit.benar : cfgMit.salah)
      if (st.jumlahMit >= 5) setTimeout(mulaiTas, 900)
    }

    const mulaiTas = () => {
      if (st.faseNow !== 'mitigasi') return
      st.faseNow = 'tas'
      setFase('tas')
      pemain.visible = true
      scene.fog.far = 210
      spawnItems(SPAWN[0], SPAWN[1])
      setBriefFase({
        judul: 'PRA BENCANA — Isi Tas Siaga',
        isi: `Mitigasi struktural selesai: ${st.benarMit}/5 di lokasi tepat (+${st.benarMit * 20} poin). Sekarang karaktermu muncul di kota. Kumpulkan 10 barang tas siaga — SEMUA tersebar di jalan-jalan ZONA MERAH (titik kuning di minimap). Benar = +10. Waktu: ${cfgD.tas} detik!`,
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
      if (itemMeshes.length && itemMeshes.every((s) => s.userData.ambil)) mulaiBencana()
    }

    apiRef.current.selesaiRec = (tugas, benar) => {
      if (benar) st.benarRec++
      const rp = recPoints.find((r) => r.tugas === tugas)
      if (rp) {
        rp.selesai = true
        rp.sprite.visible = false
        rp.ring.material.color.set(0x22c55e)
      }
      if (recPoints.length && recPoints.every((r) => r.selesai)) selesaiGame()
    }

    // titik awal evakuasi: ruas jalan ZONA MERAH terjauh dari area evakuasi
    const cariTitikSangatRawan = () => {
      let best = null, bestD = -1
      for (let i = 0; i < 300; i++) {
        const garis = (Math.floor(rand(-3, 4))) * P
        const tSepanjang = rand(-TOWN, TOWN)
        const vertikal = Math.random() < 0.5
        const x = vertikal ? garis : tSepanjang
        const z = vertikal ? tSepanjang : garis
        if (!isRoad(x, z)) continue
        if (tinggiDi(x, z) < 0.5) continue
        if (rawanDi(x, z) !== 2) continue
        if (tabrak(x, z, 0.8)) continue
        const d = Math.hypot(x - GOAL[0], z - GOAL[1])
        if (d > bestD) { bestD = d; best = [x, z] }
      }
      return best || [SPAWN[0], SPAWN[1]]
    }

    const mulaiBencana = () => {
      if (st.faseNow === 'bencana') return
      st.faseNow = 'bencana'
      st.stage = 0; st.stageT = 0
      setFase('bencana')
      itemMeshes.forEach((s) => { s.visible = false; if (s.userData.ring) s.userData.ring.visible = false })
      // karakter dipindahkan ke zona sangat rawan — evakuasi dari titik terburuk
      const [rx, rz] = cariTitikSangatRawan()
      pemain.position.set(rx, tinggiDi(rx, rz), rz)
      targetRef.current = null
      spawnPemutusJalan()
      panahList.forEach((p) => { p.visible = true })
      scene.background = new THREE.Color(0x4a5a6a)
      scene.fog.color.set(0x4a5a6a)
      const teks = {
        banjir: `AIR NAIK dan kamu terjebak di ZONA SANGAT RAWAN! Ikuti panah hijau di jalan menuju satu-satunya ${cfgM.goalLabel}. Ruas biru di minimap = genangan (menguras nyawa), cokelat = buntu. Waktu: ${cfgD.aksi} detik!`,
        longsor: `LONGSOR SEGERA TERJADI dan kamu berada di zona sangat rawan! Ikuti panah hijau ke ${cfgM.goalLabel} — satu-satunya zona aman. Cek minimap untuk ruas terputus. Waktu: ${cfgD.aksi} detik!`,
        gempa: `GEMPA! Kamu berada di zona sesar. TAHAN BERLINDUNG (C) dulu, lalu ikuti panah hijau ke ${cfgM.goalLabel} — satu-satunya zona aman. Waktu total: ${cfgD.aksi} detik!`,
        tsunami: `GEMPA KUAT di zona pesisir rawan! BERLINDUNG (C) dulu, lalu lari mengikuti panah hijau ke ${cfgM.goalLabel} — satu-satunya zona aman — sebelum gelombang tiba! Waktu: ${cfgD.aksi} detik!`,
      }
      setBriefFase({
        judul: `SAAT BENCANA — ${cfgM.nama}!`,
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
      st.hpAkhir = Math.max(0, Math.round(st.hp))
      setFase('pemulihan')
      rain.visible = false
      st.shake = 0
      panahList.forEach((p) => { p.visible = false })
      scene.background = new THREE.Color(0xa8c8e0)
      scene.fog.color.set(0xa8c8e0)
      spawnRecovery()
      setBriefFase({
        judul: 'PASCA BENCANA — Pemulihan',
        isi: `Kamu selamat dengan sisa nyawa ${st.hpAkhir}%. Tangani 5 titik infrastruktur rusak (oranye di minimap). Jawaban benar = +20. Waktu: ${cfgD.aksi} detik.`,
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
      const skorMit = st.benarMit * 20
      const skorTas = st.benarTas * 10
      const hpAkhir = st.selamat ? st.hpAkhir : 0
      const skorEvak = st.selamat
        ? Math.round(30 + 40 * Math.max(0, st.timerEvak) / cfgD.aksi + 30 * hpAkhir / 100)
        : 0
      const skorRec = st.benarRec * 20
      setHasil({
        selamat: st.selamat,
        mode, tingkat,
        benarMit: st.benarMit, skorMit,
        benarTas: st.benarTas, skorTas,
        waktuEvak: Math.round(st.tEvakPakai),
        hpAkhir,
        skorEvak,
        benarRec: st.benarRec, skorRec,
        total: skorMit + skorTas + skorEvak + skorRec,
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
      if (!hit) return
      if (st.faseNow === 'mitigasi') tempatkanStruktur(hit.point)
      else targetRef.current = hit.point.clone()
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

    // fokus kamera mode perencanaan per skenario (mengarah ke zona target mitigasi)
    const fokusMit = {
      banjir: [-18 * SC, 0],
      longsor: [30 * SC, 0],
      gempa: [10 * SC, 0],
      tsunami: [14 * SC, 0],
    }[mode]

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

      if (!pausedRef.current && !st.selesai && st.faseNow !== 'mitigasi') {
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

        let dalamGenangan = false
        if (st.faseNow === 'bencana') {
          for (const c of cuts) {
            if (c.tipe !== 'air') continue
            if (Math.hypot(c.x - pemain.position.x, c.z - pemain.position.z) < 4.2) { dalamGenangan = true; break }
          }
        }
        let depth = 0
        if (mode === 'banjir' && st.faseNow === 'bencana') {
          depth = levelAir - tinggiDi(pemain.position.x, pemain.position.z)
        }
        if (dalamGenangan || depth > 0.35) kecepatan *= 0.45

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
          kirimPesan('Jalan buntu! Lihat minimap dan cari ruas jalan lain.')
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

          if (dalamGenangan) {
            drain += 20
            if (st.pesanT <= 0) kirimPesan('Kamu menerobos genangan! Nyawa terkuras — cari ruas jalan lain!')
          }

          if (mode === 'banjir') {
            levelAir = Math.min(levelAir + 0.1 * cfgD.mult * dt, 10)
            airBanjir.position.y = levelAir + 0.05 * Math.sin(t * 2)
            depth = levelAir - ph
            if (depth > 2.0) drain += 26
            else if (depth > 1.2) drain += 11
            else if (depth > 0.4) drain += 4.5
            if (depth > 0.4 && st.pesanT <= 0) kirimPesan('Kamu berjalan di air! Cari jalur lebih tinggi!')
          }

          if (mode === 'tsunami') {
            if (st.stage === 0) {
              st.shake = 1
              if (!crouchRef.current) {
                drain += 3.5
                if (st.pesanT <= 0) kirimPesan('TAHAN tombol BERLINDUNG (C) selama guncangan!')
              }
              if (st.stageT > shakeDur * 0.8) {
                st.stage = 1; st.stageT = 0; st.shake = 0; frontX = 92
                kirimPesan('PERINGATAN TSUNAMI! LARI KE BUKIT SEKARANG!')
              }
            } else {
              frontX -= 2.9 * cfgD.mult * dt
              gelombang.visible = true
              gelombang.position.set(frontX, 5.5, 0)
              gelombang.scale.y = 1 + 0.12 * Math.sin(t * 6)
              banjirTsu.visible = true
              const lebar = Math.max(0.1, 96 - frontX)
              banjirTsu.scale.x = lebar
              banjirTsu.position.set(frontX + lebar / 2, 0.5, 0)
              if (px > frontX - 2 && ph < 5) {
                drain += 55
                if (st.pesanT <= 0) kirimPesan('Gelombang menghantammu! Naik ke tempat tinggi!')
              }
            }
          }

          if (mode === 'longsor') {
            if (st.stage === 0) {
              if (st.stageT > Math.min(6, cfgD.aksi * 0.15)) {
                st.stage = 1; st.stageT = 0; frontX = 44 * SC
                kirimPesan('LONGSOR! Lari menjauh dan menyamping dari jalur luncuran!')
              } else if (Math.random() < dt * 1.2) {
                const bz = rand(-28, 28) * SC
                buatBatu(rand(20, 40) * SC, tinggiDi(30 * SC, bz) + 15, bz, rand(0.5, 1.1))
              }
            } else {
              frontX -= 3.6 * cfgD.mult * dt
              longsoran.visible = true
              const lebar = Math.max(0.1, 44 * SC - frontX + 4)
              longsoran.scale.x = lebar
              longsoran.position.set(frontX + lebar / 2, tinggiDi(Math.max(frontX, -70), 0) + 1.3, 0)
              if (Math.random() < dt * 2.5) {
                const bz = rand(-28, 28) * SC
                buatBatu(frontX + rand(1, 9), tinggiDi(frontX, bz) + 13, bz, rand(0.5, 1.3))
              }
              if (px > frontX - 1.5 && Math.abs(pz) < 30 * SC) {
                drain += 45
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
              if (Math.random() < dt * 1.2) {
                const b = bangunan[Math.floor(Math.random() * bangunan.length)]
                buatBatu(b.position.x + rand(-3, 3), b.position.y + 8, b.position.z + rand(-3, 3), rand(0.4, 0.9))
              }
              if (st.stageT > shakeDur) {
                st.stage = 1; st.stageT = 0; st.shake = 0; st.susulanT = 9
                kirimPesan('Guncangan berhenti! Ikuti panah hijau — jauhi bangunan!')
              }
            } else {
              st.susulanT -= dt
              if (st.susulanT < 2 && st.susulanT > 0) st.shake = 0.6
              else st.shake = 0
              if (st.susulanT <= 0) {
                st.susulanT = rand(8, 13)
                kirimPesan('Gempa susulan! Menjauh dari bangunan!')
              }
              if (st.shake > 0 && Math.random() < dt * 2) {
                const b = bangunan[Math.floor(Math.random() * bangunan.length)]
                buatBatu(b.position.x + rand(-3.5, 3.5), b.position.y + 8, b.position.z + rand(-3.5, 3.5), rand(0.4, 0.9))
              }
            }
            if (st.shake > 0) {
              for (const b of bangunan) {
                if (Math.hypot(b.position.x - px, b.position.z - pz) < 5) { drain += 6; break }
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
      } else if (st.faseNow === 'mitigasi') {
        st.pesanT -= dt
        if (st.pesanT <= 0 && st.pesanT > -dt * 2) setPesan('')
      }

      // kamera: mode perencanaan (top-down) vs mengikuti karakter
      if (st.faseNow === 'mitigasi') {
        camera.position.lerp(new THREE.Vector3(fokusMit[0], 100, fokusMit[1] + 62), 0.06)
        camera.lookAt(fokusMit[0], 0, fokusMit[1] - 8)
      } else {
        camera.position.lerp(
          new THREE.Vector3(pemain.position.x, pemain.position.y + 12, pemain.position.z + 12),
          0.08
        )
        if (st.shake > 0) {
          camera.position.x += (Math.random() - 0.5) * 0.5 * st.shake
          camera.position.y += (Math.random() - 0.5) * 0.5 * st.shake
        }
        camera.lookAt(pemain.position.x, pemain.position.y + 1.6, pemain.position.z)
      }

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
        setHp(Math.max(0, Math.round(st.hp)))
        if (st.faseNow === 'tas') setTimer(Math.max(0, Math.ceil(st.timerTas)))
        else if (st.faseNow === 'bencana') setTimer(Math.max(0, Math.ceil(st.timerEvak)))
        else if (st.faseNow === 'pemulihan') setTimer(Math.max(0, Math.ceil(st.timerRec)))
        const ins = {
          mitigasi: cfgMit.petunjuk,
          tas: 'Kumpulkan titik KUNING di jalan zona merah!',
          bencana:
            (mode === 'gempa' || mode === 'tsunami') && st.stage === 0
              ? 'TAHAN tombol BERLINDUNG (C)!'
              : `Ikuti PANAH HIJAU ke ${cfgM.goalLabel} — satu-satunya zona aman!`,
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
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900 pt-24 pb-12 px-4 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center shadow-lg shadow-teal-900/40 flex-shrink-0">
              <Ikon jenis="perisai" className="w-8 h-8 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-none">Game Edukasi Bencana</h1>
              <p className="text-white/60 mt-1.5 text-sm">
                Bangun mitigasi struktural, siapkan tas siaga, evakuasi ke satu-satunya zona aman, dan pulihkan kota — siklus penanggulangan bencana yang utuh.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-blue-950 text-xs font-black flex items-center justify-center">1</span>
            <p className="font-bold">Pilih Skenario Bencana</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Object.entries(MODES).map(([k, m]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`${btn} overflow-hidden text-left border-2 group ${mode === k ? 'border-amber-400 shadow-lg shadow-amber-900/30' : 'border-white/10 hover:border-white/30'}`}>
                <div className="aspect-video overflow-hidden bg-slate-800">
                  <ThumbBencana jenis={k} />
                </div>
                <div className="p-3 bg-white/5">
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Ikon jenis={k} className="w-4 h-4 text-teal-300" />
                    {m.nama}
                    {mode === k && (
                      <span className="ml-auto text-[9px] font-black bg-amber-400 text-blue-950 px-2 py-0.5 rounded-full">DIPILIH</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/55 mt-1 leading-snug">{m.deskripsi}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-blue-950 text-xs font-black flex items-center justify-center">2</span>
            <p className="font-bold">Tingkat Kesulitan</p>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {Object.entries(DIFF).map(([k, d]) => (
              <button key={k} onClick={() => setTingkat(k)}
                className={`${btn} py-3.5 border-2 ${tingkat === k ? 'border-amber-400 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className="flex items-center justify-center gap-1.5">
                  <Ikon jenis="jam" className="w-4 h-4 text-teal-300" />{d.label}
                </div>
                <div className="text-[10px] font-normal text-white/55 mt-0.5">Tas {d.tas}s · Evakuasi & Pemulihan {d.aksi}s</div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded-full bg-amber-400 text-blue-950 text-xs font-black flex items-center justify-center">3</span>
            <p className="font-bold">Karakter</p>
          </div>
          <div className="border border-white/10 bg-white/5 rounded-2xl p-4 flex flex-wrap items-center gap-5 mb-10">
            <div className="flex gap-3">
              {[['laki', 'Laki-laki'], ['perempuan', 'Perempuan']].map(([k, l]) => (
                <button key={k} onClick={() => setGender(k)}
                  className={`${btn} w-28 pt-3 pb-2 border-2 flex flex-col items-center gap-1.5 ${gender === k ? 'border-amber-400 bg-white/10' : 'border-white/10 hover:bg-white/10'}`}>
                  <div className="w-16 h-[86px]">
                    <KarakterSVG gender={k} kulit={kulit} />
                  </div>
                  <span className="text-xs font-bold">{l}</span>
                </button>
              ))}
            </div>
            <div className="w-px h-16 bg-white/10 hidden sm:block" />
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-white/60">Warna kulit</span>
              {KULIT.map((c) => (
                <button key={c} onClick={() => setKulit(c)}
                  className={`w-9 h-9 rounded-full border-[3px] transition-all ${kulit === c ? 'border-amber-400 scale-110' : 'border-white/20'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          <button onClick={mulai}
            className={`${btn} w-full py-4 text-lg bg-amber-400 text-blue-950 hover:bg-amber-300 shadow-xl shadow-amber-900/40 flex items-center justify-center gap-2`}>
            <Ikon jenis="lari" className="w-5 h-5" strokeWidth={2.2} /> Mulai Misi: {M.nama}
          </button>
          <p className="text-center text-[11px] text-white/35 mt-4">
            Fase mitigasi: klik peta · Karakter: WASD / panah / klik peta · C = Berlindung · kontrol sentuh otomatis di HP
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
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900 pt-24 pb-10 px-4 text-white">
        <div className="max-w-lg mx-auto bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="text-center mb-4">
            <Ikon jenis={hasil.selamat ? 'piala' : 'gagal'}
              className={`w-16 h-16 mx-auto mb-2 ${hasil.selamat ? 'text-amber-400' : 'text-red-400'}`} />
            <h2 className="text-2xl font-black">{hasil.selamat ? 'KAMU SELAMAT!' : 'TIDAK SELAMAT...'}</h2>
            <p className="text-white/60 text-sm">Skenario {MODES[hasil.mode].nama} · {DIFF[hasil.tingkat].label}</p>
          </div>
          <Baris tahap="PRA BENCANA · MITIGASI STRUKTURAL" ikon="perisai" label={MITIGASI[hasil.mode].nama} nilai={hasil.skorMit} max={100}
            ket={`${hasil.benarMit}/5 struktur di lokasi tepat`} />
          <Baris tahap="PRA BENCANA · KESIAPSIAGAAN" ikon="tas" label="Tas Siaga Bencana" nilai={hasil.skorTas} max={100}
            ket={`${hasil.benarTas}/10 kuis benar`} />
          <Baris tahap="SAAT BENCANA · TANGGAP DARURAT" ikon="lari" label="Evakuasi" nilai={hasil.skorEvak} max={100}
            ket={hasil.selamat
              ? `Tepat sampai tujuan · ${hasil.waktuEvak}s · sisa nyawa ${hasil.hpAkhir}%`
              : 'Tidak mencapai titik evakuasi'} />
          <Baris tahap="PASCA BENCANA · PEMULIHAN" ikon="perbaikan" label="Pemulihan Infrastruktur" nilai={hasil.skorRec} max={100}
            ket={hasil.selamat ? `${hasil.benarRec}/5 keputusan benar` : 'Tidak sampai tahap pemulihan'} />
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
            <button onClick={() => setLayar('menu')} className={`${btn} flex-1 py-3 bg-white/10 hover:bg-white/20`}>Ganti Skenario</button>
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
          {fase !== 'mitigasi' && (
            <div className="flex items-center gap-2 mt-1">
              <Ikon jenis="hati" className="w-4 h-4 text-red-400" />
              <div className="w-28 h-2.5 bg-white/20 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${hp > 50 ? 'bg-green-400' : hp > 25 ? 'bg-amber-400' : 'bg-red-500'}`}
                  style={{ width: `${hp}%` }} />
              </div>
              <span className="font-mono">{hp}</span>
            </div>
          )}
        </div>
        <div className="bg-black/55 backdrop-blur rounded-xl px-3 py-2 text-white text-center">
          <div className="text-[10px] text-white/60">
            {fase === 'mitigasi' ? 'PERENCANAAN' : fase === 'tas' ? 'SISA WAKTU' : fase === 'bencana' ? 'BATAS EVAKUASI' : 'WAKTU PEMULIHAN'}
          </div>
          <div className={`text-xl font-black font-mono flex items-center justify-center gap-1 ${fase !== 'mitigasi' && timer < 15 ? 'text-red-400' : ''}`}>
            {fase === 'mitigasi'
              ? <Ikon jenis="peta" className="w-5 h-5" />
              : <><Ikon jenis="jam" className="w-4 h-4 opacity-70" />{timer}s</>}
          </div>
        </div>
        <div className="bg-black/55 backdrop-blur rounded-xl px-3 py-2 text-white text-xs md:text-sm max-w-[42%]">
          <div className="font-bold flex items-center gap-1.5">
            <Ikon jenis={fase === 'mitigasi' ? MIT.ikon : fase === 'pemulihan' ? 'perbaikan' : 'tas'} className="w-4 h-4 text-amber-400" />
            {fase === 'mitigasi' ? `${mitCount}/5` : fase === 'pemulihan' ? `${recSelesai}/5` : `${tasIsi.length}/10`}
          </div>
          <div className="text-[10px] text-white/60 leading-tight">{instruksi}</div>
        </div>
      </div>

      {/* panel mode perencanaan */}
      {fase === 'mitigasi' && !briefFase && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur border border-white/15 rounded-2xl px-5 py-3 text-white text-center max-w-md pointer-events-none">
          <div className="flex items-center justify-center gap-2 font-black text-sm mb-0.5">
            <Ikon jenis={MIT.ikon} className="w-5 h-5 text-teal-300" />
            MODE PERENCANAAN — {MIT.nama} ({mitCount}/5)
          </div>
          <p className="text-[11px] text-white/70 leading-snug">{MIT.petunjuk}</p>
        </div>
      )}

      {pesan && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-red-600/90 text-white font-bold px-4 py-2 rounded-xl text-sm md:text-base text-center max-w-[90%] shadow-xl animate-pulse pointer-events-none flex items-center gap-2">
          <Ikon jenis="peringatan" className="w-5 h-5 flex-shrink-0" />
          {pesan}
        </div>
      )}

      {/* minimap */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
        <canvas ref={minimapRef} width={176} height={176}
          className="rounded-xl border-2 border-white/40 shadow-xl" />
        {fase === 'bencana' && (
          <div className="bg-black/55 backdrop-blur rounded-lg px-2 py-1 text-[9px] text-white/80 flex gap-2">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />genangan</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-900 inline-block" />buntu</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />evakuasi</span>
          </div>
        )}
      </div>

      {/* tombol sentuh (bukan di mode perencanaan) */}
      {fase !== 'mitigasi' && (
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
      )}
      {(mode === 'gempa' || mode === 'tsunami') && fase === 'bencana' && (
        <button
          className="absolute bottom-3 left-1/2 -translate-x-1/2 md:left-44 md:translate-x-0 bg-blue-600/90 text-white font-bold px-5 py-4 rounded-2xl shadow-xl active:bg-blue-500 flex items-center gap-2"
          onTouchStart={tekan('c', true)} onTouchEnd={tekan('c', false)}
          onMouseDown={tekan('c', true)} onMouseUp={tekan('c', false)} onMouseLeave={tekan('c', false)}>
          <Ikon jenis="perisai" className="w-5 h-5" /> BERLINDUNG (tahan)
        </button>
      )}

      {/* kuis — auto-lanjut */}
      {kuis && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4 z-20">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 text-slate-800">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0 ${kuis.tipe === 'rec' ? 'bg-orange-500' : 'bg-amber-500'}`}>
                <Ikon jenis={kuis.item.ikon} className="w-6 h-6" />
              </div>
              <div>
                <div className={`text-[9px] font-bold tracking-wider ${kuis.tipe === 'rec' ? 'text-orange-600' : 'text-blue-700'}`}>
                  {kuis.tipe === 'rec' ? 'KEPUTUSAN PEMULIHAN' : 'TAS SIAGA'}
                </div>
                <div className="font-black leading-tight">{kuis.item.nama || kuis.item.judul}</div>
              </div>
            </div>
            <p className="text-sm font-semibold mb-3">{kuis.item.tanya}</p>
            <div className="grid grid-cols-1 gap-1.5">
              {kuis.item.opsi.map((o, i) => {
                const terjawab = kuis.jawab != null
                const stil = !terjawab
                  ? 'bg-slate-100 hover:bg-blue-100 border-slate-200'
                  : i === kuis.item.benar
                    ? 'bg-green-100 border-green-500'
                    : i === kuis.jawab
                      ? 'bg-red-100 border-red-400'
                      : 'bg-slate-50 border-slate-100 opacity-50'
                return (
                  <button key={i} onClick={() => jawabKuis(i)} disabled={terjawab}
                    className={`text-left text-sm px-3 py-2 rounded-lg border-2 transition-all ${stil}`}>
                    <b>{'ABCD'[i]}.</b> {o}
                  </button>
                )
              })}
            </div>
            {kuis.jawab != null && (
              <div className={`mt-3 text-sm font-bold flex items-center gap-2 ${kuis.jawab === kuis.item.benar ? 'text-green-600' : 'text-red-500'}`}>
                <Ikon jenis={kuis.jawab === kuis.item.benar ? 'perisai' : 'gagal'} className="w-4 h-4 flex-shrink-0" />
                {kuis.jawab === kuis.item.benar
                  ? `Benar +${kuis.tipe === 'rec' ? 20 : 10}!`
                  : 'Kurang tepat.'} <span className="font-normal text-slate-500">{kuis.item.info}</span>
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