'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface Kabupaten { id: number; nama: string }
interface JenisBencana { id: number; nama: string }
interface LkpdItem {
  id: string; judul: string; published: boolean
  kabupaten: { nama: string }; jenis_bencana: { nama: string }
  kabupaten_id: number; jenis_bencana_id: number; pertanyaan: Aktivitas[]
  bahan_bacaan?: string; bahan_gambar?: string[]; prinsip_pembelajaran?: string[]
}

type TipeAktivitas =
  | 'esai' | 'pilihan_ganda' | 'tabel' | 'diagram' | 'peta'
  | 'tts' | 'matching' | 'kategorisasi' | 'paint'
  | 'multi'

interface TtsKata { nomor: number; arah: 'mendatar' | 'menurun'; jawaban: string; pertanyaan: string; row: number; col: number }
interface MatchPair { kiri: string; kanan: string }
interface KategoriItem { item: string; kategori: string }

// Komponen tugas di dalam SATU aktivitas Fase Mengaplikasi.
// Satu aktivitas bisa memuat beberapa komponen sekaligus (tabel + diagram + esai, dst).
type TipeKomponen = 'esai' | 'pilihan_ganda' | 'tabel' | 'diagram' | 'peta' | 'paint'
interface Komponen {
  kid: number
  tipe: TipeKomponen
  soal?: string
  // pilihan ganda
  pilihan?: string[]; jawaban_benar?: number
  // tabel
  kolom_tabel?: string[]; jumlah_baris?: number; label_terkunci?: string[]  // label baris kolom-1 yang sudah terisi
  // diagram
  jenis_grafik?: 'bar' | 'pie' | 'line'; kolom_diagram?: string[]
  // peta
  peta_mode?: 'titik' | 'polygon' | 'keduanya'; peta_pertanyaan?: string
  // paint
  paint_instruksi?: string; paint_bg?: string
}

interface Aktivitas {
  id: number; judul: string; instruksi: string
  tipe: TipeAktivitas
  fase: 'Memahami' | 'Mengaplikasi' | 'Merefleksi'
  // opsional metadata
  kode_sdl?: string          // opsional sekarang
  dimensi_st?: string        // opsional
  literasi_bencana?: string  // opsional
  literasi_spasial?: string  // opsional
  ada_peta: boolean
  // esai / pg / tabel / diagram
  soal?: string
  pilihan?: string[]; jawaban_benar?: number
  kolom_tabel?: string[]; jumlah_baris?: number
  jenis_grafik?: 'bar' | 'pie' | 'line'; kolom_diagram?: string[]
  // peta
  peta_instruksi?: string; peta_mode?: 'titik' | 'polygon' | 'keduanya'; peta_pertanyaan?: string
  // TTS
  tts_kata?: TtsKata[]
  // Matching
  match_pairs?: MatchPair[]
  // Kategorisasi
  kat_kategori?: string[]; kat_items?: KategoriItem[]
  // Paint
  paint_instruksi?: string; paint_bg?: string  // optional base64 background to trace
  // Multi-komponen (Fase Mengaplikasi): satu aktivitas berisi banyak komponen tugas
  komponen?: Komponen[]
}

const SDL_OPTIONS = ['SML', 'SPL', 'SRL', 'SRcL']
const ST_OPTIONS = ['Map Reading', 'Spatial Orientation', 'Spatial Pattern Recognition', 'Spatial Visualization', 'Spatial Reasoning']
const PRINSIP_OPTIONS = ['Bermakna', 'Menggembirakan', 'Berkesadaran']

const TIPE_OPTIONS: { value: TipeAktivitas; label: string; icon: string; autoGrade: boolean }[] = [
  { value: 'esai', label: 'Esai', icon: '✏️', autoGrade: false },
  { value: 'pilihan_ganda', label: 'Pilihan Ganda', icon: '🔘', autoGrade: true },
  { value: 'tabel', label: 'Isi Tabel', icon: '📋', autoGrade: false },
  { value: 'diagram', label: 'Diagram', icon: '📊', autoGrade: false },
  { value: 'peta', label: 'Peta Interaktif', icon: '🗺️', autoGrade: false },
  { value: 'tts', label: 'Teka-Teki Silang', icon: '🔡', autoGrade: true },
  { value: 'matching', label: 'Mencocokkan', icon: '🔗', autoGrade: true },
  { value: 'kategorisasi', label: 'Kategorisasi', icon: '🗂️', autoGrade: true },
  { value: 'paint', label: 'Menggambar (Paint)', icon: '🎨', autoGrade: false },
  { value: 'multi', label: 'Aktivitas Gabungan (tabel + diagram + esai, dll)', icon: '🧩', autoGrade: false },
]

// Komponen yang boleh dipakai di dalam aktivitas gabungan (multi)
const KOMPONEN_OPTIONS: { value: TipeKomponen; label: string; icon: string }[] = [
  { value: 'esai', label: 'Pertanyaan Esai', icon: '✏️' },
  { value: 'pilihan_ganda', label: 'Pilihan Ganda', icon: '🔘' },
  { value: 'tabel', label: 'Isi Tabel', icon: '📋' },
  { value: 'diagram', label: 'Diagram', icon: '📊' },
  { value: 'paint', label: 'Menggambar (Paint)', icon: '🎨' },
  { value: 'peta', label: 'Peta Interaktif', icon: '🗺️' },
]
const defaultKomponen = (tipe: TipeKomponen): Komponen => ({
  kid: Date.now() + Math.floor(Math.random() * 100000),
  tipe,
  soal: '',
  pilihan: ['', '', '', ''], jawaban_benar: 0,
  kolom_tabel: ['Aspek', 'Nilai'], jumlah_baris: 3, label_terkunci: [],
  jenis_grafik: 'bar', kolom_diagram: ['Label', 'Nilai'],
  peta_mode: 'keduanya', peta_pertanyaan: '',
  paint_instruksi: '', paint_bg: '',
})

const inp = "w-full border border-gray-200 px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all bg-white"
const lbl = "text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block"

// Helper kompresi gambar (dipakai untuk bahan bacaan & paint referensi).
// Membaca file -> resize maks lebar -> ekspor JPEG base64 lewat callback.
function compressImage(file: File, cb: (dataUrl: string) => void, maxW = 1100, quality = 0.82) {
  const fr = new FileReader()
  fr.onload = () => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const cv = document.createElement('canvas')
      cv.width = Math.round(img.width * scale)
      cv.height = Math.round(img.height * scale)
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
      cb(cv.toDataURL('image/jpeg', quality))
    }
    img.src = fr.result as string
  }
  fr.readAsDataURL(file)
}

// Input gambar DUA MODE: unggah file (dikompres jadi base64) ATAU tempel URL/link.
// Mode link tidak menaikkan ukuran DB — cocok agar satu poster/gambar tidak
// diunggah berulang kali (cukup tempel tautannya). onAdd dipanggil sekali per gambar.
function ImageInput({ onAdd, multiple = false }: { onAdd: (url: string) => void; multiple?: boolean }) {
  const [mode, setMode] = useState<'file' | 'link'>('file')
  const [link, setLink] = useState('')

  const tambahLink = () => {
    const u = link.trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u) && !u.startsWith('data:')) {
      alert('Masukkan URL gambar yang valid (diawali http:// atau https://).')
      return
    }
    onAdd(u)
    setLink('')
  }

  return (
    <div className="border border-gray-200 rounded-xl p-2.5 bg-gray-50/60">
      <div className="flex gap-1 mb-2">
        {(['file', 'link'] as const).map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${mode === m ? 'bg-blue-950 border-blue-950 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300'}`}>
            {m === 'file' ? '📁 Pilih File' : '🔗 Tempel Link'}
          </button>
        ))}
      </div>
      {mode === 'file' ? (
        <input type="file" accept="image/*" multiple={multiple}
          className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          onChange={e => {
            const files = Array.from(e.target.files || [])
            files.forEach(f => compressImage(f, url => onAdd(url)))
            e.target.value = ''
          }} />
      ) : (
        <div className="flex gap-2">
          <input className={inp + ' flex-1'} placeholder="https://... (tautan gambar / poster)"
            value={link} onChange={e => setLink(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); tambahLink() } }} />
          <button type="button" onClick={tambahLink}
            className="text-xs font-semibold bg-blue-950 text-white px-4 rounded-xl hover:bg-blue-900 transition-all flex-shrink-0">Tambah</button>
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-1.5">
        {mode === 'file'
          ? 'File dikompres otomatis lalu disimpan ke database.'
          : 'Tempel URL gambar yang sudah ada online (Google Drive publik, Imgur, situs lain). Tidak menambah ukuran database — satu tautan bisa dipakai berulang.'}
      </p>
    </div>
  )
}

// Input daftar dipisah koma yang TIDAK merusak ketikan (spasi/koma aman).
// Nilai mentah disimpan lokal; array hasil parse dikirim ke parent tiap perubahan.
function CsvInput({ value, onCommit, placeholder }: { value: string[]; onCommit: (arr: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState((value || []).join(', '))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setDraft((value || []).join(', ')) }, [JSON.stringify(value), focused])
  return (
    <input className={inp} placeholder={placeholder} value={draft}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); onCommit(draft.split(',').map(s => s.trim()).filter(Boolean)) }}
      onChange={e => { setDraft(e.target.value); onCommit(e.target.value.split(',').map(s => s.trim()).filter(Boolean)) }} />
  )
}

const defaultAktivitas = (): Aktivitas => ({
  id: Date.now(), judul: '', instruksi: '', tipe: 'esai', fase: 'Memahami',
  kode_sdl: '', dimensi_st: '', literasi_bencana: '', literasi_spasial: '',
  ada_peta: false, soal: '', pilihan: ['', '', '', ''], jawaban_benar: 0,
  kolom_tabel: ['Kolom 1', 'Kolom 2'], jumlah_baris: 3,
  jenis_grafik: 'bar', kolom_diagram: ['Label', 'Nilai'],
  peta_instruksi: '', peta_mode: 'keduanya', peta_pertanyaan: '',
  tts_kata: [],
  match_pairs: [{ kiri: '', kanan: '' }, { kiri: '', kanan: '' }],
  kat_kategori: ['Kategori 1', 'Kategori 2'], kat_items: [{ item: '', kategori: 'Kategori 1' }],
  paint_instruksi: '', paint_bg: '',
  komponen: [],
})

const SDL_COLOR: Record<string, string> = {
  SML: 'bg-blue-50 text-blue-700 border-blue-200',
  SPL: 'bg-green-50 text-green-700 border-green-200',
  SRL: 'bg-red-50 text-red-700 border-red-200',
  SRcL: 'bg-amber-50 text-amber-700 border-amber-200',
}
const FASE_COLOR: Record<string, string> = {
  'Memahami': 'bg-blue-50 text-blue-700 border-blue-200',
  'Mengaplikasi': 'bg-green-50 text-green-700 border-green-200',
  'Merefleksi': 'bg-amber-50 text-amber-700 border-amber-200',
}

// ============================================================
// GANTIKAN fungsi buildCrossword LAMA dengan versi ini.
// Perbaikan: multi-attempt + coba semua titik silang + anti-duplikat,
// sehingga kata seperti RENDAH, LAHAN, BPBD tetap tertempatkan.
// ============================================================
function buildCrossword(entries: { jawaban: string; pertanyaan: string }[]): { kata: TtsKata[]; grid: (string | null)[][]; ok: boolean; gagal: string[] } {
  const SIZE = 60

  // Bersihkan + hilangkan duplikat (jawaban sama diambil yang pertama)
  const seen = new Set<string>()
  const clean = entries
    .map(e => ({ jawaban: e.jawaban.toUpperCase().replace(/[^A-Z]/g, ''), pertanyaan: e.pertanyaan }))
    .filter(e => {
      if (e.jawaban.length < 2) return false
      if (seen.has(e.jawaban)) return false
      seen.add(e.jawaban)
      return true
    })

  if (clean.length === 0) return { kata: [], grid: [], ok: false, gagal: [] }

  type Placed = { jawaban: string; pertanyaan: string; r: number; c: number; dir: 'H' | 'V' }

  // Satu kali percobaan penyusunan dengan urutan kata tertentu
  function attempt(order: { jawaban: string; pertanyaan: string }[]) {
    const grid: (string | null)[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(null))
    const placed: Placed[] = []

    function canPlace(word: string, r: number, c: number, dr: number, dc: number) {
      let crossings = 0
      for (let i = 0; i < word.length; i++) {
        const rr = r + dr * i, cc = c + dc * i
        if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE) return { ok: false, crossings: 0 }
        const cell = grid[rr][cc]
        if (cell !== null) {
          if (cell !== word[i]) return { ok: false, crossings: 0 }
          crossings++
        } else {
          if (dr === 0) {
            for (const ddr of [-1, 1]) { const nr = rr + ddr; if (nr >= 0 && nr < SIZE && grid[nr][cc] !== null) return { ok: false, crossings: 0 } }
          } else {
            for (const ddc of [-1, 1]) { const nc = cc + ddc; if (nc >= 0 && nc < SIZE && grid[rr][nc] !== null) return { ok: false, crossings: 0 } }
          }
        }
      }
      const br = r - dr, bc = c - dc
      if (br >= 0 && br < SIZE && bc >= 0 && bc < SIZE && grid[br][bc] !== null) return { ok: false, crossings: 0 }
      const er = r + dr * word.length, ec = c + dc * word.length
      if (er >= 0 && er < SIZE && ec >= 0 && ec < SIZE && grid[er][ec] !== null) return { ok: false, crossings: 0 }
      return { ok: true, crossings }
    }
    function doPlace(w: { jawaban: string; pertanyaan: string }, r: number, c: number, dr: number, dc: number) {
      for (let i = 0; i < w.jawaban.length; i++) grid[r + dr * i][c + dc * i] = w.jawaban[i]
      placed.push({ jawaban: w.jawaban, pertanyaan: w.pertanyaan, r, c, dir: dc === 1 ? 'H' : 'V' })
    }

    // kata pertama di tengah, horizontal
    const first = order[0]
    doPlace(first, Math.floor(SIZE / 2), Math.floor(SIZE / 2 - first.jawaban.length / 2), 0, 1)

    const gagal: { jawaban: string; pertanyaan: string }[] = []
    // sisa kata: proses berulang, tiap putaran ambil yang bisa ditempatkan
    let pool = order.slice(1)
    let progress = true
    while (pool.length && progress) {
      progress = false
      // cari kandidat terbaik di seluruh pool (crossing terbanyak) tapi coba SEMUA opsi
      let best: any = null
      for (const w of pool) {
        for (let i = 0; i < w.jawaban.length; i++) {
          for (let r = 0; r < SIZE; r++) {
            for (let c = 0; c < SIZE; c++) {
              if (grid[r][c] === w.jawaban[i]) {
                for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
                  const sr = r - dr * i, sc = c - dc * i
                  const res = canPlace(w.jawaban, sr, sc, dr, dc)
                  if (res.ok && res.crossings >= 1) {
                    if (!best || res.crossings > best.crossings) best = { crossings: res.crossings, w, sr, sc, dr, dc }
                  }
                }
              }
            }
          }
        }
      }
      if (best) {
        doPlace(best.w, best.sr, best.sc, best.dr, best.dc)
        pool = pool.filter(x => x.jawaban !== best.w.jawaban)
        progress = true
      }
    }
    pool.forEach(w => gagal.push(w))
    return { grid, placed, gagalCount: gagal.length, gagal }
  }

  // Multi-attempt: coba banyak urutan, ambil yang paling sedikit gagal.
  // Deterministik (seeded) agar hasil sama tiap kali tombol ditekan.
  const orders: { jawaban: string; pertanyaan: string }[][] = []
  // 1) terpanjang dulu  2) terpendek dulu
  orders.push([...clean].sort((a, b) => b.jawaban.length - a.jawaban.length))
  orders.push([...clean].sort((a, b) => a.jawaban.length - b.jawaban.length))
  // 3) rotasi: tiap kata bergiliran jadi kata pertama (tetap panjang-dulu untuk sisanya)
  const byLen = [...clean].sort((a, b) => b.jawaban.length - a.jawaban.length)
  for (let k = 0; k < byLen.length; k++) {
    orders.push([byLen[k], ...byLen.filter((_, i) => i !== k)])
  }
  // 4) 40 pengacakan deterministik (LCG seed) sebagai cadangan
  let seed = 12345
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (let s = 0; s < 40; s++) {
    const arr = [...clean]
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]] }
    orders.push(arr)
  }

  let bestRun: ReturnType<typeof attempt> | null = null
  for (const ord of orders) {
    const run = attempt(ord)
    if (!bestRun || run.gagalCount < bestRun.gagalCount) bestRun = run
    if (bestRun.gagalCount === 0) break
  }
  if (!bestRun) return { kata: [], grid: [], ok: false, gagal: [] }

  const { grid, placed, gagal } = bestRun

  // trim ke bounding box
  let minR = SIZE, maxR = 0, minC = SIZE, maxC = 0
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] !== null) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c) }
  const tgrid: (string | null)[][] = []
  for (let r = minR; r <= maxR; r++) { const row: (string | null)[] = []; for (let c = minC; c <= maxC; c++) row.push(grid[r][c]); tgrid.push(row) }

  // penomoran
  const starts: Record<string, { dir: 'H' | 'V'; jawaban: string; pertanyaan: string }[]> = {}
  placed.forEach(p => { const key = `${p.r - minR},${p.c - minC}`; (starts[key] ||= []).push({ dir: p.dir, jawaban: p.jawaban, pertanyaan: p.pertanyaan }) })
  const numMap: Record<string, number> = {}
  let n = 0
  for (let r = 0; r < tgrid.length; r++) for (let c = 0; c < (tgrid[0]?.length || 0); c++) { if (starts[`${r},${c}`]) { n++; numMap[`${r},${c}`] = n } }

  const kata: TtsKata[] = []
  Object.entries(starts).forEach(([key, lst]) => {
    const [r, c] = key.split(',').map(Number)
    lst.forEach(s => kata.push({ nomor: numMap[key], arah: s.dir === 'H' ? 'mendatar' : 'menurun', jawaban: s.jawaban, pertanyaan: s.pertanyaan, row: r, col: c }))
  })
  kata.sort((a, b) => a.nomor - b.nomor || (a.arah === 'mendatar' ? -1 : 1))

  return { kata, grid: tgrid, ok: gagal.length === 0, gagal: gagal.map(g => g.jawaban) }
}

function TtsEditor({ a, update }: { a: Aktivitas; update: (f: string, v: any) => void }) {
  // Ambil daftar kata unik dari tts_kata (buang duplikat jawaban agar tak dobel saat edit)
  const initialRows = (() => {
    if (a.tts_kata && a.tts_kata.length) {
      const seen = new Set<string>()
      const uniq: { jawaban: string; pertanyaan: string }[] = []
      a.tts_kata.forEach(k => {
        const key = k.jawaban.toUpperCase()
        if (!seen.has(key)) { seen.add(key); uniq.push({ jawaban: k.jawaban, pertanyaan: k.pertanyaan }) }
      })
      return uniq
    }
    return [{ jawaban: '', pertanyaan: '' }, { jawaban: '', pertanyaan: '' }]
  })()
  const [rows, setRows] = useState<{ jawaban: string; pertanyaan: string }[]>(initialRows)
  const [preview, setPreview] = useState<ReturnType<typeof buildCrossword> | null>(null)

  const apply = () => {
    // Dedup + bersihkan sebelum menyusun, cegah kunci ganda
    const seen = new Set<string>()
    const bersih = rows.filter(r => {
      const j = r.jawaban.trim().toUpperCase()
      if (!j || !r.pertanyaan.trim()) return false
      if (seen.has(j)) return false
      seen.add(j); return true
    })
    const res = buildCrossword(bersih)
    setPreview(res)
    update('tts_kata', res.kata)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className={lbl}>Daftar Kata & Pertanyaan (jawaban 1 kata, min. 2 huruf)</label>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input className={`${inp} max-w-[160px] uppercase`} placeholder="JAWABAN" value={r.jawaban}
            onChange={e => { const nr = [...rows]; nr[i] = { ...nr[i], jawaban: e.target.value.toUpperCase() }; setRows(nr) }} />
          <input className={inp} placeholder="Pertanyaan / petunjuk" value={r.pertanyaan}
            onChange={e => { const nr = [...rows]; nr[i] = { ...nr[i], pertanyaan: e.target.value }; setRows(nr) }} />
          {rows.length > 2 && <button type="button" onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs px-1 pt-2.5">✕</button>}
        </div>
      ))}
      <div className="flex gap-2">
        <button type="button" onClick={() => setRows([...rows, { jawaban: '', pertanyaan: '' }])}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-200 rounded-lg py-1.5 px-3 hover:bg-blue-50 transition-all">+ Tambah Kata</button>
        <button type="button" onClick={apply}
          className="text-xs text-white bg-blue-950 hover:bg-blue-900 font-medium rounded-lg py-1.5 px-3 transition-all">Susun Grid TTS</button>
      </div>
      {preview && (
        <div className="mt-2 p-3 bg-gray-50 rounded-xl">
          {preview.gagal.length > 0 && (
            <p className="text-[11px] text-red-500 mb-2">Kata tak bisa disambungkan ke grid: {preview.gagal.join(', ')}. Coba tambah kata yang berbagi huruf.</p>
          )}
          <p className="text-[11px] text-gray-500 mb-2">Pratinjau grid ({preview.kata.length} kata tersusun):</p>
          <div className="inline-block bg-white p-1 rounded-lg border border-gray-200">
            {preview.grid.map((row, ri) => (
              <div key={ri} className="flex">
                {row.map((ch, ci) => (
                  <div key={ci} className={`w-5 h-5 text-[8px] flex items-center justify-center ${ch === null ? 'bg-gray-800' : 'bg-white border border-gray-300'}`}>
                    {ch !== null && preview.kata.find(k => k.row === ri && k.col === ci) ? <span className="text-[7px] text-blue-600 font-bold self-start">{preview.kata.find(k => k.row === ri && k.col === ci)?.nomor}</span> : ''}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-green-600 mt-2">✓ Kunci jawaban tersimpan otomatis untuk penilaian.</p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// EDITOR: Matching
// ============================================================
function MatchingEditor({ a, update }: { a: Aktivitas; update: (f: string, v: any) => void }) {
  const pairs = a.match_pairs || []
  const setPairs = (np: MatchPair[]) => update('match_pairs', np)
  return (
    <div className="flex flex-col gap-2">
      <label className={lbl}>Pasangan yang Benar (Kolom A ↔ Kolom B)</label>
      <p className="text-[10px] text-gray-400">Saat dikerjakan, Kolom B akan diacak. Pasangan di bawah = kunci jawaban.</p>
      {pairs.map((p, i) => (
        <div key={i} className="flex gap-2 items-center">
          <span className="text-[11px] text-gray-400 w-4">{i + 1}</span>
          <input className={inp} placeholder="Kolom A (pernyataan)" value={p.kiri}
            onChange={e => { const np = [...pairs]; np[i] = { ...np[i], kiri: e.target.value }; setPairs(np) }} />
          <span className="text-gray-300">↔</span>
          <input className={inp} placeholder="Kolom B (jawaban)" value={p.kanan}
            onChange={e => { const np = [...pairs]; np[i] = { ...np[i], kanan: e.target.value }; setPairs(np) }} />
          {pairs.length > 2 && <button type="button" onClick={() => setPairs(pairs.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>}
        </div>
      ))}
      <button type="button" onClick={() => setPairs([...pairs, { kiri: '', kanan: '' }])}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 transition-all">+ Tambah Pasangan</button>
    </div>
  )
}

// ============================================================
// EDITOR: Kategorisasi
// ============================================================
function KategorisasiEditor({ a, update }: { a: Aktivitas; update: (f: string, v: any) => void }) {
  const kategori = a.kat_kategori || []
  const items = a.kat_items || []
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className={lbl}>Nama Kategori (kolom tujuan)</label>
        <CsvInput placeholder="Sebelum Banjir, Saat Banjir, Setelah Banjir"
          value={kategori}
          onCommit={arr => update('kat_kategori', arr)} />
      </div>
      <div>
        <label className={lbl}>Item & Kategori yang Benar (kunci jawaban)</label>
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 items-center mb-2">
            <span className="text-[11px] text-gray-400 w-4">{i + 1}</span>
            <input className={inp} placeholder="Tindakan / item" value={it.item}
              onChange={e => { const ni = [...items]; ni[i] = { ...ni[i], item: e.target.value }; update('kat_items', ni) }} />
            <select className={`${inp} max-w-[180px]`} value={it.kategori}
              onChange={e => { const ni = [...items]; ni[i] = { ...ni[i], kategori: e.target.value }; update('kat_items', ni) }}>
              {kategori.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            {items.length > 1 && <button type="button" onClick={() => update('kat_items', items.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>}
          </div>
        ))}
        <button type="button" onClick={() => update('kat_items', [...items, { item: '', kategori: kategori[0] || '' }])}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-200 rounded-lg py-1.5 px-3 hover:bg-blue-50 transition-all">+ Tambah Item</button>
      </div>
    </div>
  )
}

// ============================================================
// EDITOR: Satu komponen tugas di dalam aktivitas gabungan (multi)
// ============================================================
function KomponenEditor({ komp, onUpdate, onRemove, onMoveUp, onMoveDown, canUp, canDown, index }: {
  komp: Komponen; onUpdate: (patch: Partial<Komponen>) => void; onRemove: () => void
  onMoveUp: () => void; onMoveDown: () => void; canUp: boolean; canDown: boolean; index: number
}) {
  const info = KOMPONEN_OPTIONS.find(k => k.value === komp.tipe)
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 text-[11px] font-bold flex items-center justify-center">{index + 1}</span>
          <span className="text-xs font-semibold text-gray-700">{info?.icon} {info?.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onMoveUp} disabled={!canUp} title="Naikkan komponen"
            className="w-6 h-6 rounded-md text-gray-400 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-25 disabled:cursor-not-allowed text-xs transition-all">▲</button>
          <button type="button" onClick={onMoveDown} disabled={!canDown} title="Turunkan komponen"
            className="w-6 h-6 rounded-md text-gray-400 hover:text-blue-700 hover:bg-blue-50 disabled:opacity-25 disabled:cursor-not-allowed text-xs transition-all">▼</button>
          <button type="button" onClick={onRemove} className="text-[11px] text-red-400 hover:text-red-600 transition-all ml-1">Hapus komponen</button>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {/* ESAI */}
        {komp.tipe === 'esai' && (
          <div>
            <label className={lbl}>Pertanyaan Esai</label>
            <textarea className={inp} rows={2} placeholder="Tulis pertanyaan esai..."
              value={komp.soal || ''} onChange={e => onUpdate({ soal: e.target.value })} />
          </div>
        )}

        {/* PILIHAN GANDA */}
        {komp.tipe === 'pilihan_ganda' && (
          <div className="flex flex-col gap-2">
            <div>
              <label className={lbl}>Pertanyaan</label>
              <textarea className={inp} rows={2} placeholder="Tulis pertanyaan..."
                value={komp.soal || ''} onChange={e => onUpdate({ soal: e.target.value })} />
            </div>
            <label className={lbl}>Pilihan Jawaban</label>
            {(komp.pilihan || []).map((p, pi) => (
              <div key={pi} className="flex items-center gap-2">
                <input type="radio" name={`kjw-${komp.kid}`} checked={komp.jawaban_benar === pi}
                  onChange={() => onUpdate({ jawaban_benar: pi })} className="accent-blue-700 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-gray-400 w-4 flex-shrink-0">{String.fromCharCode(65 + pi)}</span>
                <input className={inp} placeholder={`Opsi ${String.fromCharCode(65 + pi)}`} value={p}
                  onChange={e => { const np = [...(komp.pilihan || [])]; np[pi] = e.target.value; onUpdate({ pilihan: np }) }} />
                {(komp.pilihan?.length || 0) > 2 && (
                  <button type="button" onClick={() => {
                    const np = (komp.pilihan || []).filter((_, idx) => idx !== pi)
                    let jb = komp.jawaban_benar ?? 0
                    if (pi === jb) jb = 0; else if (pi < jb) jb = jb - 1
                    onUpdate({ pilihan: np, jawaban_benar: jb })
                  }} className="text-red-400 hover:text-red-600 flex-shrink-0 text-xs px-1">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => onUpdate({ pilihan: [...(komp.pilihan || []), ''] })}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 transition-all">+ Tambah Opsi</button>
            <p className="text-[10px] text-gray-400">Klik radio untuk menandai jawaban benar (kunci).</p>
          </div>
        )}

        {/* TABEL */}
        {komp.tipe === 'tabel' && (
          <div className="flex flex-col gap-2">
            <div>
              <label className={lbl}>Instruksi Tabel (opsional)</label>
              <textarea className={inp} rows={2} placeholder="Instruksi pengisian tabel..."
                value={komp.soal || ''} onChange={e => onUpdate({ soal: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={lbl}>Nama Kolom (pisah koma)</label>
                <CsvInput placeholder="Kelas Kerawanan, Luas (ha), Persentase (%)"
                  value={komp.kolom_tabel || []} onCommit={arr => onUpdate({ kolom_tabel: arr })} />
              </div>
              <div>
                <label className={lbl}>Jumlah Baris</label>
                <input type="number" className={inp} value={komp.jumlah_baris} min={1} max={20}
                  onChange={e => onUpdate({ jumlah_baris: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className={lbl}>Label Baris Kolom-1 Terkunci (opsional, pisah koma)</label>
              <CsvInput placeholder="Sangat Rawan, Rawan, Rawan Sedang, Aman, Sangat Aman"
                value={komp.label_terkunci || []} onCommit={arr => onUpdate({ label_terkunci: arr })} />
              <p className="text-[10px] text-gray-400 mt-1">Bila diisi, kolom pertama tiap baris sudah berlabel & tidak bisa diubah siswa (mereka hanya mengisi kolom lain). Kosongkan jika semua sel dibiarkan kosong.</p>
            </div>
          </div>
        )}

        {/* DIAGRAM */}
        {komp.tipe === 'diagram' && (
          <div className="flex flex-col gap-2">
            <div>
              <label className={lbl}>Instruksi Diagram (opsional)</label>
              <textarea className={inp} rows={2} placeholder="Instruksi pembuatan diagram..."
                value={komp.soal || ''} onChange={e => onUpdate({ soal: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Jenis Grafik</label>
                <select className={inp} value={komp.jenis_grafik} onChange={e => onUpdate({ jenis_grafik: e.target.value as any })}>
                  <option value="bar">Bar Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="line">Line Chart</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Nama Kolom (pisah koma)</label>
                <CsvInput placeholder="Label, Nilai"
                  value={komp.kolom_diagram || []} onCommit={arr => onUpdate({ kolom_diagram: arr })} />
              </div>
            </div>
          </div>
        )}

        {/* PAINT */}
        {komp.tipe === 'paint' && (
          <div className="flex flex-col gap-2">
            <div>
              <label className={lbl}>Instruksi Menggambar</label>
              <textarea className={inp} rows={2} placeholder="cth: Gambar ulang bentuk grafik profil topografi."
                value={komp.paint_instruksi || ''} onChange={e => onUpdate({ paint_instruksi: e.target.value })} />
            </div>
            <div>
              <label className={lbl}>Gambar Referensi (opsional — latar kanvas untuk dijiplak)</label>
              {komp.paint_bg ? (
                <div className="flex items-start gap-3">
                  <img src={komp.paint_bg} alt="Referensi" className="w-40 rounded-lg border border-gray-200" />
                  <button type="button" onClick={() => onUpdate({ paint_bg: '' })}
                    className="text-[11px] text-red-500 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50 transition-all">Hapus Gambar</button>
                </div>
              ) : (
                <ImageInput onAdd={url => onUpdate({ paint_bg: url })} />
              )}
            </div>
          </div>
        )}

        {/* PETA */}
        {komp.tipe === 'peta' && (
          <div className="flex flex-col gap-2">
            <div>
              <label className={lbl}>Mode Menggambar Peta</label>
              <div className="grid grid-cols-3 gap-2">
                {[{ value: 'titik', label: 'Titik' }, { value: 'polygon', label: 'Polygon' }, { value: 'keduanya', label: 'Titik & Polygon' }].map(m => (
                  <button key={m.value} type="button" onClick={() => onUpdate({ peta_mode: m.value as any })}
                    className={`p-2.5 rounded-xl border text-center text-xs font-semibold transition-all ${komp.peta_mode === m.value ? 'bg-blue-950 border-blue-950 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'}`}>{m.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className={lbl}>Pertanyaan Analisis Peta</label>
              <textarea className={inp} rows={2} placeholder="cth: Wilayah mana yang paling rawan? Jelaskan."
                value={komp.peta_pertanyaan || ''} onChange={e => onUpdate({ peta_pertanyaan: e.target.value })} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// Bagian editor komponen-komponen untuk aktivitas tipe 'multi'
// ============================================================
function MultiKomponenSection({ a, update }: { a: Aktivitas; update: (f: string, v: any) => void }) {
  const komponen = a.komponen || []
  const setKomponen = (k: Komponen[]) => update('komponen', k)
  const patchKomp = (kid: number, patch: Partial<Komponen>) =>
    setKomponen(komponen.map(k => k.kid === kid ? { ...k, ...patch } : k))
  // Pindahkan komponen naik/turun (revisi urutan sub-aktivitas)
  const moveKomp = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= komponen.length) return
    const nk = [...komponen]
    ;[nk[index], nk[j]] = [nk[j], nk[index]]
    setKomponen(nk)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
        <p className="text-[11px] font-bold text-indigo-700 mb-1">🧩 Aktivitas Gabungan</p>
        <p className="text-xs text-indigo-600">Satu aktivitas ini bisa memuat beberapa komponen tugas sekaligus (mis. isi tabel, buat diagram, lalu jawab pertanyaan) — semua di bawah satu Instruksi Teknis, Literasi Bencana, dan Literasi Spasial. Gunakan tombol ▲▼ untuk mengatur urutan.</p>
      </div>
      {komponen.map((k, i) => (
        <KomponenEditor key={k.kid} komp={k} index={i}
          onUpdate={patch => patchKomp(k.kid, patch)}
          onRemove={() => setKomponen(komponen.filter(x => x.kid !== k.kid))}
          onMoveUp={() => moveKomp(i, -1)} onMoveDown={() => moveKomp(i, 1)}
          canUp={i > 0} canDown={i < komponen.length - 1} />
      ))}
      <div className="flex flex-wrap gap-2">
        {KOMPONEN_OPTIONS.map(opt => (
          <button key={opt.value} type="button"
            onClick={() => setKomponen([...komponen, defaultKomponen(opt.value)])}
            className="text-[11px] text-blue-700 border border-dashed border-blue-300 rounded-lg py-1.5 px-3 hover:bg-blue-50 transition-all font-medium">
            + {opt.icon} {opt.label}
          </button>
        ))}
      </div>
      {komponen.length === 0 && <p className="text-[11px] text-amber-500">Tambahkan minimal satu komponen tugas di atas.</p>}
    </div>
  )
}

// ============================================================
// FORM AKTIVITAS
// ============================================================
function FormAktivitas({ aktivitasList, setAktivitasList }: {
  aktivitasList: Aktivitas[]
  setAktivitasList: (a: Aktivitas[]) => void
}) {
  const update = (id: number, field: string, value: any) =>
    setAktivitasList(aktivitasList.map(a => a.id === id ? { ...a, [field]: value } : a))

  // Pindahkan aktivitas naik/turun (revisi urutan aktivitas)
  const moveAktivitas = (index: number, dir: -1 | 1) => {
    const j = index + dir
    if (j < 0 || j >= aktivitasList.length) return
    const ni = [...aktivitasList]
    ;[ni[index], ni[j]] = [ni[j], ni[index]]
    setAktivitasList(ni)
  }

  return (
    <div className="flex flex-col gap-4">
      {aktivitasList.map((a, index) => {
        const tipeInfo = TIPE_OPTIONS.find(t => t.value === a.tipe)
        return (
          <div key={a.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-950 to-blue-900 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">{index + 1}</span>
                </div>
                <span className="text-white font-semibold text-sm">Aktivitas {index + 1}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${FASE_COLOR[a.fase]}`}>{a.fase}</span>
                {a.kode_sdl && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SDL_COLOR[a.kode_sdl]}`}>{a.kode_sdl}</span>}
                <span className="text-[10px] text-blue-300/70">{tipeInfo?.icon} {tipeInfo?.label}</span>
                {tipeInfo?.autoGrade && <span className="text-[9px] bg-emerald-400/20 text-emerald-200 px-1.5 py-0.5 rounded-full">auto-nilai</span>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => moveAktivitas(index, -1)} disabled={index === 0} title="Naikkan aktivitas"
                  className="w-6 h-6 rounded-md text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed text-xs transition-all">▲</button>
                <button onClick={() => moveAktivitas(index, 1)} disabled={index === aktivitasList.length - 1} title="Turunkan aktivitas"
                  className="w-6 h-6 rounded-md text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed text-xs transition-all">▼</button>
                <button onClick={() => setAktivitasList(aktivitasList.filter(x => x.id !== a.id))}
                  className="text-[11px] text-red-300 hover:text-red-200 transition-all ml-1">Hapus</button>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-3">
              <input className={inp} placeholder="Judul aktivitas" value={a.judul}
                onChange={e => update(a.id, 'judul', e.target.value)} />

              {/* Fase + Tipe */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Fase Pembelajaran</label>
                  <select className={inp} value={a.fase} onChange={e => update(a.id, 'fase', e.target.value)}>
                    <option value="Memahami">📖 Memahami</option>
                    <option value="Mengaplikasi">🔬 Mengaplikasi</option>
                    <option value="Merefleksi">💭 Merefleksi</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Tipe Aktivitas</label>
                  <select className={inp} value={a.tipe} onChange={e => update(a.id, 'tipe', e.target.value)}>
                    {TIPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}{t.autoGrade ? ' (auto-nilai)' : ''}</option>)}
                  </select>
                </div>
              </div>

              {/* Metadata opsional: SDL & Spatial Thinking (boleh pilih lebih dari satu) */}
              <div className="flex flex-col gap-2">
                <div>
                  <label className={lbl}>Dimensi SDL (opsional, boleh lebih dari satu)</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {SDL_OPTIONS.map(s => {
                      const sel = (a.kode_sdl || '').split(',').map(x => x.trim()).filter(Boolean)
                      const on = sel.includes(s)
                      return (
                        <button key={s} type="button"
                          onClick={() => update(a.id, 'kode_sdl', (on ? sel.filter(x => x !== s) : [...sel, s]).join(', '))}
                          className={`text-[11px] px-3 py-1.5 rounded-full border font-bold transition-all ${on ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
                          {on ? '✓ ' : ''}{s}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className={lbl}>Dimensi Spatial Thinking (opsional, boleh lebih dari satu)</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {ST_OPTIONS.map(s => {
                      const sel = (a.dimensi_st || '').split(',').map(x => x.trim()).filter(Boolean)
                      const on = sel.includes(s)
                      return (
                        <button key={s} type="button"
                          onClick={() => update(a.id, 'dimensi_st', (on ? sel.filter(x => x !== s) : [...sel, s]).join(', '))}
                          className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${on ? 'bg-indigo-600 text-white border-indigo-600 font-semibold' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
                          {on ? '✓ ' : ''}{s}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className={lbl}>Instruksi Teknis untuk Siswa</label>
                <textarea className={inp} rows={2} placeholder="Langkah pengoperasian / petunjuk pengerjaan..."
                  value={a.instruksi} onChange={e => update(a.id, 'instruksi', e.target.value)} />
              </div>

              {/* Literasi Bencana & Spasial (opsional) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={lbl}>Literasi Bencana (opsional)</label>
                  <textarea className={inp} rows={2} placeholder="Pengetahuan kebencanaan terkait..."
                    value={a.literasi_bencana || ''} onChange={e => update(a.id, 'literasi_bencana', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Literasi Spasial (opsional)</label>
                  <textarea className={inp} rows={2} placeholder="Konsep keruangan yang dibutuhkan..."
                    value={a.literasi_spasial || ''} onChange={e => update(a.id, 'literasi_spasial', e.target.value)} />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3" />

              {/* ── ESAI ── */}
              {a.tipe === 'esai' && (
                <div>
                  <label className={lbl}>Pertanyaan</label>
                  <textarea className={inp} rows={2} placeholder="Tulis pertanyaan esai..."
                    value={a.soal} onChange={e => update(a.id, 'soal', e.target.value)} />
                </div>
              )}

              {/* ── PILIHAN GANDA ── */}
              {a.tipe === 'pilihan_ganda' && (
                <div className="flex flex-col gap-2">
                  <div>
                    <label className={lbl}>Pertanyaan</label>
                    <textarea className={inp} rows={2} placeholder="Tulis pertanyaan..."
                      value={a.soal} onChange={e => update(a.id, 'soal', e.target.value)} />
                  </div>
                  <label className={lbl}>Pilihan Jawaban</label>
                  {a.pilihan?.map((p, pi) => (
                    <div key={pi} className="flex items-center gap-2">
                      <input type="radio" name={`jawaban-${a.id}`} checked={a.jawaban_benar === pi}
                        onChange={() => update(a.id, 'jawaban_benar', pi)} className="accent-blue-700 flex-shrink-0" />
                      <span className="text-[11px] font-semibold text-gray-400 w-4 flex-shrink-0">{String.fromCharCode(65 + pi)}</span>
                      <input className={inp} placeholder={`Opsi ${String.fromCharCode(65 + pi)}`} value={p}
                        onChange={e => { const np = [...(a.pilihan || [])]; np[pi] = e.target.value; update(a.id, 'pilihan', np) }} />
                      {(a.pilihan?.length || 0) > 2 && (
                        <button type="button" onClick={() => {
                          const np = (a.pilihan || []).filter((_, idx) => idx !== pi)
                          let jb = a.jawaban_benar ?? 0
                          if (pi === jb) jb = 0; else if (pi < jb) jb = jb - 1
                          update(a.id, 'pilihan', np); update(a.id, 'jawaban_benar', jb)
                        }} className="text-red-400 hover:text-red-600 flex-shrink-0 text-xs px-1">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => update(a.id, 'pilihan', [...(a.pilihan || []), ''])}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 transition-all">+ Tambah Opsi</button>
                  <p className="text-[10px] text-gray-400">Klik radio untuk menandai jawaban benar (kunci).</p>
                </div>
              )}

              {/* ── TABEL ── */}
              {a.tipe === 'tabel' && (
                <div className="flex flex-col gap-2">
                  <div>
                    <label className={lbl}>Instruksi Tabel</label>
                    <textarea className={inp} rows={2} placeholder="Instruksi pengisian tabel..."
                      value={a.soal} onChange={e => update(a.id, 'soal', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className={lbl}>Nama Kolom (pisah koma)</label>
                      <CsvInput placeholder="Kecamatan, Luas (ha), Keterangan"
                        value={a.kolom_tabel || []}
                        onCommit={arr => update(a.id, 'kolom_tabel', arr)} />
                    </div>
                    <div>
                      <label className={lbl}>Jumlah Baris</label>
                      <input type="number" className={inp} value={a.jumlah_baris} min={1} max={20}
                        onChange={e => update(a.id, 'jumlah_baris', Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── DIAGRAM ── */}
              {a.tipe === 'diagram' && (
                <div className="flex flex-col gap-2">
                  <div>
                    <label className={lbl}>Instruksi Diagram</label>
                    <textarea className={inp} rows={2} placeholder="Instruksi pembuatan diagram..."
                      value={a.soal} onChange={e => update(a.id, 'soal', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={lbl}>Jenis Grafik</label>
                      <select className={inp} value={a.jenis_grafik} onChange={e => update(a.id, 'jenis_grafik', e.target.value as any)}>
                        <option value="bar">Bar Chart</option>
                        <option value="pie">Pie Chart</option>
                        <option value="line">Line Chart</option>
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>Nama Kolom (pisah koma)</label>
                      <CsvInput placeholder="Label, Nilai"
                        value={a.kolom_diagram || []}
                        onCommit={arr => update(a.id, 'kolom_diagram', arr)} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── PETA ── */}
              {a.tipe === 'peta' && (
                <div className="flex flex-col gap-3">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <p className="text-[11px] font-bold text-blue-700 mb-1">Tipe: Peta Interaktif</p>
                    <p className="text-xs text-blue-600">Siswa menggambar titik/polygon langsung di atas peta bencana.</p>
                  </div>
                  <div>
                    <label className={lbl}>Mode Menggambar</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ value: 'titik', label: 'Titik', desc: 'Klik buat marker' }, { value: 'polygon', label: 'Polygon', desc: 'Gambar area' }, { value: 'keduanya', label: 'Titik & Polygon', desc: 'Keduanya' }].map(m => (
                        <button key={m.value} type="button" onClick={() => update(a.id, 'peta_mode', m.value)}
                          className={`p-3 rounded-xl border text-left transition-all ${a.peta_mode === m.value ? 'bg-blue-950 border-blue-950 text-white' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                          <p className={`text-xs font-semibold ${a.peta_mode === m.value ? 'text-white' : 'text-gray-700'}`}>{m.label}</p>
                          <p className={`text-[10px] mt-0.5 ${a.peta_mode === m.value ? 'text-blue-200' : 'text-gray-400'}`}>{m.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Pertanyaan Analisis</label>
                    <textarea className={inp} rows={3} placeholder="cth: Berdasarkan titik yang kamu tandai, wilayah mana yang paling rawan? Jelaskan!"
                      value={a.peta_pertanyaan} onChange={e => update(a.id, 'peta_pertanyaan', e.target.value)} />
                  </div>
                </div>
              )}

              {/* ── TTS ── */}
              {a.tipe === 'tts' && <TtsEditor a={a} update={(f, v) => update(a.id, f, v)} />}

              {/* ── MATCHING ── */}
              {a.tipe === 'matching' && <MatchingEditor a={a} update={(f, v) => update(a.id, f, v)} />}

              {/* ── KATEGORISASI ── */}
              {a.tipe === 'kategorisasi' && <KategorisasiEditor a={a} update={(f, v) => update(a.id, f, v)} />}

              {/* ── PAINT ── */}
              {a.tipe === 'paint' && (
                <div className="flex flex-col gap-2">
                  <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
                    <p className="text-[11px] font-bold text-purple-700 mb-1">Tipe: Menggambar (Paint)</p>
                    <p className="text-xs text-purple-600">Siswa menggambar bebas (garis warna & titik) pada kanvas. Hasil disimpan di perangkat siswa dan ikut tercetak saat unduh PDF.</p>
                  </div>
                  <div>
                    <label className={lbl}>Instruksi Menggambar</label>
                    <textarea className={inp} rows={2} placeholder="cth: Gambar ulang bentuk grafik profil topografi; atau jiplak batas kelas kerawanan lalu tandai titik evakuasi."
                      value={a.paint_instruksi || ''} onChange={e => update(a.id, 'paint_instruksi', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Gambar Referensi (opsional — jadi latar kanvas untuk dijiplak siswa)</label>
                    {a.paint_bg ? (
                      <div className="flex items-start gap-3">
                        <img src={a.paint_bg} alt="Referensi" className="w-48 rounded-lg border border-gray-200" />
                        <button type="button" onClick={() => update(a.id, 'paint_bg', '')}
                          className="text-[11px] text-red-500 border border-red-200 rounded-lg px-2.5 py-1.5 hover:bg-red-50 transition-all">Hapus Gambar</button>
                      </div>
                    ) : (
                      <ImageInput onAdd={url => update(a.id, 'paint_bg', url)} />
                    )}
                    <p className="text-[10px] text-gray-400 mt-1">Contoh: peta administrasi Kec. Bumi Waras. Bisa unggah file (dikompres) atau tempel link. Tampil sebagai latar yang bisa dijiplak.</p>
                  </div>
                </div>
              )}

              {/* ── MULTI (aktivitas gabungan) ── */}
              {a.tipe === 'multi' && <MultiKomponenSection a={a} update={(f, v) => update(a.id, f, v)} />}

              {/* Checkbox peta referensi (untuk tipe non-peta/paint/multi) */}
              {a.tipe !== 'peta' && a.tipe !== 'paint' && a.tipe !== 'multi' && (
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <input type="checkbox" id={`peta-${a.id}`} checked={a.ada_peta}
                    onChange={e => update(a.id, 'ada_peta', e.target.checked)} className="accent-blue-700" />
                  <label htmlFor={`peta-${a.id}`} className="text-xs text-gray-600 cursor-pointer">Sertakan peta referensi di atas aktivitas ini</label>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <button className="w-full border-2 border-dashed border-blue-200 text-blue-600 py-3 rounded-2xl text-sm hover:border-blue-400 hover:bg-blue-50 transition-all font-medium"
        onClick={() => setAktivitasList([...aktivitasList, defaultAktivitas()])}>
        + Tambah Aktivitas
      </button>
    </div>
  )
}

// ============================================================
// HALAMAN ADMIN
// ============================================================
export default function AdminLkpdPage() {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [lkpdList, setLkpdList] = useState<LkpdItem[]>([])
  const [mode, setMode] = useState<'list' | 'buat' | 'edit'>('list')
  const [editTarget, setEditTarget] = useState<LkpdItem | null>(null)
  const [judul, setJudul] = useState('')
  const [selectedKabupaten, setSelectedKabupaten] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [bahanBacaan, setBahanBacaan] = useState('')
  const [bahanGambar, setBahanGambar] = useState<string[]>([])
  const [prinsip, setPrinsip] = useState<string[]>([])
  const [aktivitasList, setAktivitasList] = useState<Aktivitas[]>([])
  const [pesan, setPesan] = useState('')
  const [loading, setLoading] = useState(false)

  // Filter daftar LKPD (revisi #1): menurut kab/kota, jenis bencana, & pencarian judul
  const [filterKab, setFilterKab] = useState('')
  const [filterBencana, setFilterBencana] = useState('')
  const [filterCari, setFilterCari] = useState('')

  const fetchLkpd = async () => {
    const { data } = await supabase.from('e_lkpd').select('*, kabupaten(nama), jenis_bencana(nama)').order('created_at', { ascending: false })
    if (data) setLkpdList(data)
  }

  useEffect(() => {
    supabase.from('kabupaten').select('*').then(({ data }) => { if (data) setKabupatenList(data) })
    supabase.from('jenis_bencana').select('*').then(({ data }) => { if (data) setBencanaList(data) })
    fetchLkpd()
  }, [])

  const resetForm = () => {
    setJudul(''); setSelectedKabupaten(''); setSelectedBencana('')
    setBahanBacaan(''); setBahanGambar([]); setPrinsip([]); setAktivitasList([]); setEditTarget(null)
  }

  const handleEdit = (l: LkpdItem) => {
    setEditTarget(l); setJudul(l.judul)
    setSelectedKabupaten(String(l.kabupaten_id)); setSelectedBencana(String(l.jenis_bencana_id))
    setBahanBacaan(l.bahan_bacaan || ''); setBahanGambar(l.bahan_gambar || [])
    setPrinsip(l.prinsip_pembelajaran || [])
    setAktivitasList(l.pertanyaan || []); setMode('edit')
  }

  const togglePrinsip = (p: string) =>
    setPrinsip(prinsip.includes(p) ? prinsip.filter(x => x !== p) : [...prinsip, p])

  const handleSimpan = async (published: boolean) => {
    if (!judul || !selectedKabupaten || !selectedBencana) { setPesan('Lengkapi judul, kabupaten, dan jenis bencana!'); return }
    if (aktivitasList.length === 0) { setPesan('Tambah minimal 1 aktivitas!'); return }
    setLoading(true)
    const payload = {
      judul, kabupaten_id: Number(selectedKabupaten), jenis_bencana_id: Number(selectedBencana),
      bahan_bacaan: bahanBacaan, bahan_gambar: bahanGambar, prinsip_pembelajaran: prinsip,
      pertanyaan: aktivitasList, published
    }
    let error
    if (mode === 'edit' && editTarget) {
      const res = await supabase.from('e_lkpd').update(payload).eq('id', editTarget.id); error = res.error
    } else {
      const res = await supabase.from('e_lkpd').insert(payload); error = res.error
    }
    if (error) setPesan('Gagal: ' + error.message)
    else { resetForm(); setMode('list'); fetchLkpd() }
    setLoading(false)
  }

  const adaFaseMemahami = aktivitasList.some(a => a.fase === 'Memahami')

  // Daftar LKPD setelah difilter
  const lkpdTampil = lkpdList.filter(l =>
    (!filterKab || String(l.kabupaten_id) === filterKab) &&
    (!filterBencana || String(l.jenis_bencana_id) === filterBencana) &&
    (!filterCari || l.judul.toLowerCase().includes(filterCari.toLowerCase()))
  )
  const adaFilterAktif = !!(filterKab || filterBencana || filterCari)

  if (mode === 'list') return (
    <div className="p-6 max-w-[1000px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">E-LKPD</h1>
          <p className="text-sm text-gray-400 mt-0.5">Kelola lembar kerja peserta didik elektronik berbasis Pembelajaran Mendalam</p>
        </div>
        <button onClick={() => { resetForm(); setMode('buat') }}
          className="bg-blue-950 hover:bg-blue-900 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all">+ Buat E-LKPD</button>
      </div>

      {lkpdList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Belum ada E-LKPD</div>
      ) : (
        <>
          {/* Filter menurut kab/kota & jenis bencana */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className={lbl}>Cari Judul</label>
              <input className={inp} placeholder="Ketik judul..." value={filterCari} onChange={e => setFilterCari(e.target.value)} />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className={lbl}>Kabupaten/Kota</label>
              <select className={inp} value={filterKab} onChange={e => setFilterKab(e.target.value)}>
                <option value="">Semua Kab/Kota</option>
                {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className={lbl}>Jenis Bencana</label>
              <select className={inp} value={filterBencana} onChange={e => setFilterBencana(e.target.value)}>
                <option value="">Semua Bencana</option>
                {bencanaList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
              </select>
            </div>
            {adaFilterAktif && (
              <button onClick={() => { setFilterKab(''); setFilterBencana(''); setFilterCari('') }}
                className="text-xs text-gray-500 border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-gray-50 transition-all">Reset</button>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-3">Menampilkan {lkpdTampil.length} dari {lkpdList.length} E-LKPD</p>

          {lkpdTampil.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 text-sm">Tidak ada E-LKPD yang cocok dengan filter.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lkpdTampil.map(l => (
                <div key={l.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all group">
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${l.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{l.published ? 'Live' : 'Draft'}</span>
                      {(l.prinsip_pembelajaran || []).map(p => <span key={p} className="text-[9px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-200">{p}</span>)}
                    </div>
                    <h3 className="font-semibold text-gray-800 text-sm mb-1">{l.judul}</h3>
                    <p className="text-xs text-gray-400">{l.kabupaten?.nama} · {l.jenis_bencana?.nama} · {l.pertanyaan?.length || 0} aktivitas</p>
                  </div>
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                    <button onClick={() => handleEdit(l)} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 font-medium">Edit</button>
                    <button onClick={() => supabase.from('e_lkpd').update({ published: !l.published }).eq('id', l.id).then(fetchLkpd)}
                      className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 font-medium">{l.published ? 'Unpublish' : 'Publish'}</button>
                    <button onClick={async () => {
                      const { error } = await supabase.from('e_lkpd').insert({
                        judul: `${l.judul} (Salinan)`,
                        kabupaten_id: l.kabupaten_id,
                        jenis_bencana_id: l.jenis_bencana_id,
                        pertanyaan: l.pertanyaan || [],
                        bahan_bacaan: l.bahan_bacaan || '',
                        bahan_gambar: l.bahan_gambar || [],
                        prinsip_pembelajaran: l.prinsip_pembelajaran || [],
                        published: false,
                      })
                      if (error) alert('Gagal duplikat: ' + error.message)
                      else fetchLkpd()
                    }}
                      className="text-xs bg-blue-50 border border-blue-200 text-blue-600 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 font-medium">Duplikat</button>
                    <button onClick={async () => { if (!confirm('Yakin hapus?')) return; await supabase.from('e_lkpd').delete().eq('id', l.id); fetchLkpd() }}
                      className="text-xs bg-red-50 border border-red-100 text-red-500 px-2.5 py-1.5 rounded-lg hover:bg-red-100 font-medium">Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="p-6 max-w-[800px]">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { resetForm(); setMode('list') }} className="text-sm text-blue-600 hover:text-blue-800 transition-all">← Kembali</button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">{mode === 'edit' ? 'Edit E-LKPD' : 'Buat E-LKPD Baru'}</h1>
          <p className="text-sm text-gray-400">Susun aktivitas berbasis Pembelajaran Mendalam & SDL</p>
        </div>
      </div>

      {/* Info dasar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 flex flex-col gap-3">
        <h2 className="font-semibold text-sm text-gray-700">Informasi Dasar</h2>
        <input className={inp} placeholder="Judul E-LKPD" value={judul} onChange={e => setJudul(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <select className={inp} value={selectedKabupaten} onChange={e => setSelectedKabupaten(e.target.value)}>
            <option value="">Pilih Kabupaten/Kota</option>
            {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
          <select className={inp} value={selectedBencana} onChange={e => setSelectedBencana(e.target.value)}>
            <option value="">Pilih Jenis Bencana</option>
            {bencanaList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
          </select>
        </div>

        {/* Prinsip Pembelajaran Mendalam */}
        <div>
          <label className={lbl}>Prinsip Pembelajaran Mendalam</label>
          <div className="flex gap-2 flex-wrap">
            {PRINSIP_OPTIONS.map(p => (
              <button key={p} type="button" onClick={() => togglePrinsip(p)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${prinsip.includes(p) ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-purple-300'}`}>
                {prinsip.includes(p) ? '✓ ' : ''}{p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bahan Bacaan (Fase Memahami) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-700">Bahan Bacaan <span className="text-gray-400 font-normal">(Fase Memahami)</span></h2>
          <span className="text-[10px] text-gray-400">Muncul di awal sebelum aktivitas Fase Memahami</span>
        </div>
        <textarea className={inp} rows={6} placeholder="Tulis materi bacaan tentang bencana (definisi, jenis, faktor, lembaga, fase manajemen, dsb). Siswa membaca ini dulu sebelum mengerjakan aktivitas Fase Memahami."
          value={bahanBacaan} onChange={e => setBahanBacaan(e.target.value)} />

        {/* Gambar pendukung bacaan (revisi #2) */}
        <div>
          <label className={lbl}>Gambar Pendukung Bacaan (opsional — bisa lebih dari satu)</label>
          {bahanGambar.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-2">
              {bahanGambar.map((g, i) => (
                <div key={i} className="relative group/img">
                  <img src={g} alt={`Gambar bacaan ${i + 1}`} className="w-40 h-28 object-cover rounded-lg border border-gray-200" />
                  <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1.5 py-0.5 rounded">Gambar {i + 1}</span>
                  <button type="button" onClick={() => setBahanGambar(bahanGambar.filter((_, idx) => idx !== i))}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs opacity-0 group-hover/img:opacity-100 transition-all shadow flex items-center justify-center">✕</button>
                </div>
              ))}
            </div>
          )}
          <ImageInput multiple onAdd={url => setBahanGambar(prev => [...prev, url])} />
          <p className="text-[10px] text-gray-400 mt-1">Contoh: peta rawan bencana, foto lapangan, infografis. Tampil di bawah teks bacaan pada fase Memahami. Bisa unggah file atau tempel link.</p>
        </div>

        {!adaFaseMemahami && (bahanBacaan || bahanGambar.length > 0) && (
          <p className="text-[11px] text-amber-500">Catatan: belum ada aktivitas berfase "Memahami". Bahan bacaan & gambar hanya tampil bila ada aktivitas Fase Memahami.</p>
        )}
      </div>

      <FormAktivitas aktivitasList={aktivitasList} setAktivitasList={setAktivitasList} />

      {pesan && <div className={`text-sm px-4 py-2.5 rounded-xl mt-4 mb-2 ${pesan.includes('Gagal') || pesan.includes('Lengkapi') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>{pesan}</div>}

      <div className="flex gap-3 mt-6">
        <button onClick={() => handleSimpan(false)} disabled={loading}
          className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-200 disabled:opacity-50 transition-all text-sm">Simpan Draft</button>
        <button onClick={() => handleSimpan(true)} disabled={loading}
          className="flex-1 bg-blue-950 text-white py-2.5 rounded-xl font-medium hover:bg-blue-900 disabled:opacity-50 transition-all text-sm">{loading ? 'Menyimpan...' : 'Publish'}</button>
      </div>
    </div>
  )
}