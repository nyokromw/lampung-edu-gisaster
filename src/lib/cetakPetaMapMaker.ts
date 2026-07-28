// src/lib/cetakPetaMapMaker.ts
//
// Cetak PDF peta buatan siswa (Map Maker). Lanskap A4.
//
// Strategi (opsi B — tanpa basemap):
//  • Basemap dimatikan sementara agar tidak ada masalah CORS/taint.
//  • Peta (layer administrasi + data sistem + layer buatan siswa)
//    dirender ke canvas dengan html2canvas.
//  • Judul, identitas, legenda, panah utara, skala, dan tabel fitur
//    digambar sebagai VEKTOR jsPDF supaya tajam saat dicetak.
//
// Halaman 1: peta + legenda + info tepi
// Halaman 2: tabel fitur (nama, koordinat, data lokasi, keterangan)
//
// Dependensi sudah ada di proyek: jspdf, html2canvas.

import L from 'leaflet'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type { MapMakerData } from '@/components/MapMakerPanel'

interface Args {
  map: L.Map
  group: L.FeatureGroup   // featureGroup fitur buatan siswa
  data: MapMakerData
}

// A4 lanskap dalam mm
const PW = 297, PH = 210, M = 10

export async function cetakPetaMapMaker({ map, group, data }: Args) {
  const container = map.getContainer()

  // ------------------------------------------------------------
  // 1. Sembunyikan basemap (tile) sementara
  // ------------------------------------------------------------
  const tilePane = container.querySelector('.leaflet-tile-pane') as HTMLElement | null
  const prevTileDisplay = tilePane?.style.display ?? ''
  if (tilePane) tilePane.style.display = 'none'
  // latar putih supaya area tanpa tile tidak transparan/hitam
  const prevBg = container.style.background
  container.style.background = '#ffffff'

  // Fit ke fitur buatan siswa bila ada, supaya peta terpusat
  let prevView: { center: L.LatLng; zoom: number } | null = null
  try {
    const b = group.getBounds()
    if (b.isValid()) {
      prevView = { center: map.getCenter(), zoom: map.getZoom() }
      map.fitBounds(b, { padding: [40, 40], maxZoom: 15 })
      await new Promise(r => setTimeout(r, 350)) // tunggu layer settle
    }
  } catch { }

  // Skala: hitung meter per piksel di tengah peta (untuk scale bar)
  const center = map.getCenter()
  const metersPerPx = 40075016.686 * Math.abs(Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, map.getZoom() + 8)

  // ------------------------------------------------------------
  // 2. Snapshot peta ke canvas
  // ------------------------------------------------------------
  let mapCanvas: HTMLCanvasElement
  try {
    mapCanvas = await html2canvas(container, {
      useCORS: true, backgroundColor: '#ffffff', scale: 2, logging: false,
    })
  } finally {
    // kembalikan tampilan peta apa pun yang terjadi
    if (tilePane) tilePane.style.display = prevTileDisplay
    container.style.background = prevBg
    if (prevView) map.setView(prevView.center, prevView.zoom)
  }

  // ------------------------------------------------------------
  // 3. Bangun PDF
  // ------------------------------------------------------------
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // --- kepala ---
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(20, 40, 80)
  pdf.text(data.judulPeta || 'Peta Tanpa Judul', M, M + 5)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(110, 110, 110)
  const idn = data.identitas
  const idLine = [idn.namaKelompok && `Kelompok: ${idn.namaKelompok}`, idn.kelas && `Kelas: ${idn.kelas}`, idn.sekolah].filter(Boolean).join('   •   ')
  if (idLine) pdf.text(idLine, M, M + 10)

  // --- area peta (kiri) & panel legenda (kanan) ---
  const bodyTop = M + 14
  const legendW = 68
  const mapW = PW - M * 2 - legendW - 4
  const mapH = PH - bodyTop - M

  // peta: jaga rasio aspek canvas, letakkan di kotak mapW×mapH
  const ratio = mapCanvas.width / mapCanvas.height
  let drawW = mapW, drawH = mapW / ratio
  if (drawH > mapH) { drawH = mapH; drawW = mapH * ratio }
  const mapX = M, mapY = bodyTop
  pdf.setDrawColor(180); pdf.setLineWidth(0.3)
  pdf.addImage(mapCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', mapX, mapY, drawW, drawH)
  pdf.rect(mapX, mapY, drawW, drawH)

  // panah utara (kiri atas peta)
  drawNorthArrow(pdf, mapX + 6, mapY + 10)

  // scale bar (kiri bawah peta) — pilih jarak bulat ~ 1/4 lebar peta
  drawScaleBar(pdf, mapX + 4, mapY + drawH - 6, drawW * 0.25, metersPerPx / 2 /* scale:2 */)

  // --- legenda (kanan) ---
  const lx = PW - M - legendW
  let ly = bodyTop
  pdf.setFillColor(248, 249, 251); pdf.setDrawColor(220)
  pdf.roundedRect(lx, ly, legendW, mapH, 2, 2, 'FD')
  ly += 6
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(40, 40, 40)
  pdf.text('Legenda', lx + 4, ly)
  ly += 5

  // layer buatan siswa
  for (const layer of data.layers) {
    if (layer.fitur.length === 0) continue
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(60, 60, 60)
    pdf.text(layer.nama || '(tanpa nama)', lx + 4, ly)
    ly += 4
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(90, 90, 90)
    // simbol sesuai geometri
    const sy = ly - 2
    if (layer.geometri === 'garis') { pdf.setDrawColor(...hexRgb(layer.warna)); pdf.setLineWidth(0.8); pdf.line(lx + 5, sy, lx + 11, sy) }
    else if (layer.geometri === 'area') { pdf.setFillColor(...hexRgb(layer.warna)); pdf.rect(lx + 5, sy - 1.5, 6, 3, 'F') }
    else { pdf.setFillColor(...hexRgb(layer.warna)); pdf.circle(lx + 8, sy, 1.4, 'F') }
    pdf.text(`${layer.fitur.length} fitur`, lx + 14, ly)
    ly += 5
  }

  // catatan layer dasar
  ly += 2
  pdf.setDrawColor(225); pdf.line(lx + 4, ly, lx + legendW - 4, ly); ly += 4
  pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(140, 140, 140)
  pdf.text('Peta dasar: layer sistem WebGIS', lx + 4, ly, { maxWidth: legendW - 8 })
  ly += 3
  pdf.text('Lampung Edu-Gisaster', lx + 4, ly)

  // ------------------------------------------------------------
  // 4. Halaman 2 — tabel fitur
  // ------------------------------------------------------------
  const semuaFitur = data.layers.flatMap(l => l.fitur.map(f => ({ layer: l.nama, f })))
  if (semuaFitur.length > 0) {
    pdf.addPage('a4', 'landscape')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(20, 40, 80)
    pdf.text('Daftar Fitur & Alasan', M, M + 5)

    // kolom faktor = gabungan semua kunci faktor yang muncul
    const kunciFaktor = Array.from(new Set(semuaFitur.flatMap(x => Object.keys(x.f.faktor))))
    const cols = ['Layer', 'Nama', 'Koordinat', ...kunciFaktor, 'Keterangan']

    // lebar kolom proporsional
    const totalW = PW - M * 2
    const wLayer = 30, wNama = 28, wKoord = 32, wKet = 46
    const wFaktor = kunciFaktor.length ? Math.max(18, (totalW - wLayer - wNama - wKoord - wKet) / kunciFaktor.length) : 0
    const widths = [wLayer, wNama, wKoord, ...kunciFaktor.map(() => wFaktor), wKet]

    let y = M + 12
    // header
    pdf.setFillColor(30, 58, 95); pdf.setTextColor(255, 255, 255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7)
    pdf.rect(M, y, totalW, 7, 'F')
    let x = M
    cols.forEach((c, i) => { pdf.text(c, x + 1.5, y + 4.6, { maxWidth: widths[i] - 2 }); x += widths[i] })
    y += 7

    pdf.setFont('helvetica', 'normal'); pdf.setTextColor(40, 40, 40); pdf.setFontSize(6.8)
    semuaFitur.forEach(({ layer, f }, idx) => {
      const g = f.geojson.geometry as any
      const koord = g.type === 'Point'
        ? `${g.coordinates[1].toFixed(5)}, ${g.coordinates[0].toFixed(5)}`
        : `${g.type}`
      const row = [layer, f.nama, koord, ...kunciFaktor.map(k => f.faktor[k] || '–'), f.keterangan || '–']

      // tinggi baris dinamis dari kolom keterangan
      const ketLines = pdf.splitTextToSize(f.keterangan || '–', wKet - 3)
      const rowH = Math.max(6, ketLines.length * 3 + 2)
      if (y + rowH > PH - M) { pdf.addPage('a4', 'landscape'); y = M + 6 }

      // zebra
      if (idx % 2 === 1) { pdf.setFillColor(245, 247, 250); pdf.rect(M, y, totalW, rowH, 'F') }
      x = M
      row.forEach((cell, i) => {
        const lines = pdf.splitTextToSize(String(cell), widths[i] - 3)
        pdf.text(lines, x + 1.5, y + 4, { maxWidth: widths[i] - 2 })
        x += widths[i]
      })
      pdf.setDrawColor(230); pdf.line(M, y + rowH, M + totalW, y + rowH)
      y += rowH
    })
  }

  // ------------------------------------------------------------
  // 5. Simpan
  // ------------------------------------------------------------
  const nama = (data.judulPeta || 'peta-mapmaker').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
  pdf.save(`${nama}.pdf`)
}

// ------------------------------------------------------------
// util
// ------------------------------------------------------------
function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function drawNorthArrow(pdf: jsPDF, cx: number, cy: number) {
  pdf.setFillColor(40, 40, 40); pdf.setDrawColor(40, 40, 40)
  // segitiga sederhana + huruf U
  pdf.triangle(cx, cy - 5, cx - 2.5, cy + 2, cx + 2.5, cy + 2, 'F')
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(40, 40, 40)
  pdf.text('U', cx - 1.1, cy - 6.5)
}

function drawScaleBar(pdf: jsPDF, x: number, y: number, maxLenMm: number, mPerMm: number) {
  // panjang dunia nyata untuk maxLenMm, lalu bulatkan
  const realM = maxLenMm * mPerMm
  const nice = niceRound(realM)
  const barMm = nice / mPerMm
  const label = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`
  pdf.setDrawColor(40); pdf.setFillColor(40, 40, 40); pdf.setLineWidth(0.3)
  pdf.rect(x, y - 1, barMm, 1.4, 'S')
  pdf.rect(x, y - 1, barMm / 2, 1.4, 'F')
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(40, 40, 40)
  pdf.text('0', x - 0.5, y + 4)
  pdf.text(label, x + barMm - 3, y + 4)
}

function niceRound(v: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / pow
  const nf = f >= 5 ? 5 : f >= 2 ? 2 : 1
  return nf * pow
}