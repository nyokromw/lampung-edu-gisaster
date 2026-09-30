'use client'

import { useMemo, useState, useRef, type DragEvent, type PointerEvent, type ReactNode } from 'react'

export type PilihanGanda = {
  tipe?: 'pilihan_ganda'; pertanyaan: string; pilihan: string[]; jawaban_benar: number; pembahasan: string
  gambar_url?: string; gambar_storage_path?: string
}
export type Pasangan = { id: string; kiri: string; kanan: string }
export type Matching = { tipe: 'matching'; pertanyaan: string; pasangan: Pasangan[]; pembahasan: string }
export type TitikPeta = { id: string; label: string; x: number; y: number }
export type PetaDragDrop = {
  tipe: 'peta'; pertanyaan: string; gambar_url: string; gambar_storage_path?: string
  titik: TitikPeta[]; pembahasan: string
}
export type KataTTS = { id: string; petunjuk: string; jawaban: string; baris: number; kolom: number; arah: 'mendatar' | 'menurun' }
export type EntriTTS = { id: string; jawaban: string; petunjuk: string }
export type TTS = { tipe: 'tts'; pertanyaan: string; baris: number; kolom: number; kata: KataTTS[]; entri?: EntriTTS[]; pembahasan: string }
export type KataCari = { id: string; jawaban: string }
export type PosisiCari = { id: string; baris: number; kolom: number; dr: number; dc: number }
export type CariKata = { tipe: 'cari_kata'; pertanyaan: string; ukuran: number; kata: KataCari[]; grid: string[]; posisi: PosisiCari[]; pembahasan: string }
export type Kuis = PilihanGanda | Matching | PetaDragDrop | TTS | CariKata
export type TipeKuis = 'pilihan_ganda' | 'matching' | 'peta' | 'tts' | 'cari_kata'
export const tipeKuis = (k: Kuis): TipeKuis => k.tipe || 'pilihan_ganda'

const key = (r: number, c: number) => `${r}-${c}`

// Mengikuti penyusun TTS di editor LKPD: beberapa urutan kata dicoba,
// kata berikutnya ditempatkan pada huruf silang yang cocok, lalu kisi dipangkas.
export function susunTTS(entries: EntriTTS[]) {
  const SIZE = 60
  const seen = new Set<string>()
  const clean = entries.map(e => ({ ...e, jawaban: e.jawaban.toUpperCase().replace(/[^A-Z]/g, '') }))
    .filter(e => {
      if (e.jawaban.length < 2 || seen.has(e.jawaban)) return false
      seen.add(e.jawaban)
      return true
    })
  type Entry = typeof clean[number]
  type Placed = Entry & { r: number; c: number; dir: 'H' | 'V' }
  const empty = { kata: [] as KataTTS[], baris: 0, kolom: 0, grid: [] as (string | null)[][], gagal: [] as string[] }
  if (!clean.length) return empty

  function attempt(order: Entry[]) {
    const grid: (string | null)[][] = Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill(null))
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
        } else if (dr === 0) {
          for (const ddr of [-1, 1]) { const nr = rr + ddr; if (nr >= 0 && nr < SIZE && grid[nr][cc] !== null) return { ok: false, crossings: 0 } }
        } else {
          for (const ddc of [-1, 1]) { const nc = cc + ddc; if (nc >= 0 && nc < SIZE && grid[rr][nc] !== null) return { ok: false, crossings: 0 } }
        }
      }
      const br = r - dr, bc = c - dc
      const er = r + dr * word.length, ec = c + dc * word.length
      if (br >= 0 && br < SIZE && bc >= 0 && bc < SIZE && grid[br][bc] !== null) return { ok: false, crossings: 0 }
      if (er >= 0 && er < SIZE && ec >= 0 && ec < SIZE && grid[er][ec] !== null) return { ok: false, crossings: 0 }
      return { ok: true, crossings }
    }
    function place(w: Entry, r: number, c: number, dr: number, dc: number) {
      for (let i = 0; i < w.jawaban.length; i++) grid[r + dr * i][c + dc * i] = w.jawaban[i]
      placed.push({ ...w, r, c, dir: dc === 1 ? 'H' : 'V' })
    }
    const first = order[0]
    place(first, Math.floor(SIZE / 2), Math.floor(SIZE / 2 - first.jawaban.length / 2), 0, 1)
    let pool = order.slice(1)
    let progress = true
    while (pool.length && progress) {
      progress = false
      let best: { crossings: number; w: Entry; sr: number; sc: number; dr: number; dc: number } | null = null
      for (const w of pool) for (let i = 0; i < w.jawaban.length; i++) {
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
          if (grid[r][c] !== w.jawaban[i]) continue
          for (const [dr, dc] of [[0, 1], [1, 0]] as const) {
            const sr = r - dr * i, sc = c - dc * i
            const result = canPlace(w.jawaban, sr, sc, dr, dc)
            if (result.ok && result.crossings >= 1 && (!best || result.crossings > best.crossings))
              best = { crossings: result.crossings, w, sr, sc, dr, dc }
          }
        }
      }
      if (best) { place(best.w, best.sr, best.sc, best.dr, best.dc); pool = pool.filter(x => x.id !== best.w.id); progress = true }
    }
    return { grid, placed, gagal: pool }
  }

  const byLength = [...clean].sort((a, b) => b.jawaban.length - a.jawaban.length)
  const orders: Entry[][] = [byLength, [...clean].sort((a, b) => a.jawaban.length - b.jawaban.length)]
  for (let i = 0; i < byLength.length; i++) orders.push([byLength[i], ...byLength.filter((_, j) => i !== j)])
  let seed = 12345
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (let n = 0; n < 40; n++) {
    const shuffled = [...clean]
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]] }
    orders.push(shuffled)
  }
  let bestRun: ReturnType<typeof attempt> | null = null
  for (const order of orders) {
    const run = attempt(order)
    if (!bestRun || run.gagal.length < bestRun.gagal.length) bestRun = run
    if (bestRun.gagal.length === 0) break
  }
  if (!bestRun) return empty
  const { grid, placed, gagal } = bestRun
  let minR = SIZE, maxR = 0, minC = SIZE, maxC = 0
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] !== null) {
    minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c)
  }
  const cropped = grid.slice(minR, maxR + 1).map(row => row.slice(minC, maxC + 1))
  const kata: KataTTS[] = placed.map(p => ({ id: p.id, jawaban: p.jawaban, petunjuk: p.petunjuk,
    baris: p.r - minR, kolom: p.c - minC, arah: p.dir === 'H' ? 'mendatar' : 'menurun' }))
  return { kata, baris: cropped.length, kolom: cropped[0]?.length || 0, grid: cropped, gagal: gagal.map(e => e.jawaban) }
}

export function buatKisi(k: TTS) {
  const cells: Record<string, { huruf: string; nomor?: number }> = {}
  const errors: string[] = []
  const starts: Record<string, number> = {}
  const startPositions = new Set(k.kata.map(w => key(w.baris, w.kolom)))
  let nomor = 0
  for (let r = 0; r < k.baris; r++) for (let c = 0; c < k.kolom; c++) {
    const pos = key(r, c)
    if (startPositions.has(pos)) starts[pos] = ++nomor
  }
  for (const w of k.kata) {
    const huruf = w.jawaban.trim().toUpperCase().replace(/\s+/g, '')
    if (!huruf || !w.petunjuk.trim()) continue
    if (!/^[A-Z]+$/.test(huruf)) { errors.push(`Jawaban ${w.jawaban}: gunakan huruf A–Z tanpa tanda baca.`); continue }
    if (!Number.isInteger(w.baris) || !Number.isInteger(w.kolom) || w.baris < 0 || w.kolom < 0 ||
        w.baris + (w.arah === 'menurun' ? huruf.length : 1) > k.baris ||
        w.kolom + (w.arah === 'mendatar' ? huruf.length : 1) > k.kolom) {
      errors.push(`Kata ${huruf} keluar dari kisi ${k.baris} × ${k.kolom}.`); continue
    }
    for (let i = 0; i < huruf.length; i++) {
      const pos = key(w.baris + (w.arah === 'menurun' ? i : 0), w.kolom + (w.arah === 'mendatar' ? i : 0))
      if (cells[pos] && cells[pos].huruf !== huruf[i]) errors.push(`Huruf kata ${huruf} bertabrakan di baris ${w.baris + 1}, kolom ${w.kolom + 1}.`)
      cells[pos] = { huruf: huruf[i], nomor: starts[pos] }
    }
  }
  for (const [pos, n] of Object.entries(starts)) if (cells[pos]) cells[pos].nomor = n
  return { cells, errors, starts }
}

export function validasiKuis(k: Kuis): string | null {
  if (!k.pertanyaan.trim()) return 'Petunjuk atau pertanyaan kuis wajib diisi.'
  switch (tipeKuis(k)) {
    case 'pilihan_ganda': {
      const q = k as PilihanGanda
      if (q.pilihan.length < 2 || q.pilihan.some(v => !v.trim())) return 'Isi minimal dua pilihan jawaban.'
      if (q.jawaban_benar < 0 || q.jawaban_benar >= q.pilihan.length) return 'Pilih satu jawaban benar.'
      return null
    }
    case 'matching': {
      const q = k as Matching
      if (q.pasangan.length < 2 || q.pasangan.some(p => !p.kiri.trim() || !p.kanan.trim())) return 'Isi minimal dua pasangan yang lengkap.'
      return null
    }
    case 'peta': {
      const q = k as PetaDragDrop
      if (!q.gambar_url) return 'Unggah gambar atau masukkan URL peta.'
      if (q.titik.length < 1 || q.titik.some(p => !p.label.trim())) return 'Buat minimal satu titik dan isi label jawabannya.'
      if (new Set(q.titik.map(p => p.label.trim().toLowerCase())).size !== q.titik.length) return 'Label jawaban pada peta harus berbeda.'
      return null
    }
    case 'tts': {
      const q = k as TTS
      const entri = q.entri || q.kata.map(w => ({ id: w.id, jawaban: w.jawaban, petunjuk: w.petunjuk }))
      if (entri.length < (q.entri ? 2 : 1)) return 'Isi minimal dua kata dan petunjuk TTS.'
      if (entri.some(w => !w.jawaban.trim() || !w.petunjuk.trim())) return 'Lengkapi setiap kata dan petunjuk TTS.'
      const normal = entri.map(w => w.jawaban.trim().toUpperCase())
      if (normal.some(w => !/^[A-Z]{2,30}$/.test(w))) return 'Jawaban TTS harus satu kata, 2–30 huruf A–Z tanpa spasi atau tanda baca.'
      if (new Set(normal).size !== normal.length) return 'Jawaban TTS tidak boleh sama.'
      if (q.kata.length !== entri.length) return 'Klik Susun Grid TTS; pastikan semua kata berhasil tersusun.'
      if (!Number.isInteger(q.baris) || !Number.isInteger(q.kolom) || q.baris < 1 || q.kolom < 1 || q.baris > 60 || q.kolom > 60) return 'Kisi TTS belum tersusun dengan benar.'
      return buatKisi(q).errors[0] || null
    }
    case 'cari_kata': {
      const q = k as CariKata
      if (!Number.isInteger(q.ukuran) || q.ukuran < 8 || q.ukuran > 16) return 'Ukuran kotak cari kata harus 8–16.'
      if (!Array.isArray(q.kata) || q.kata.length < 2 || q.kata.length > 12) return 'Isi 2–12 kata untuk dicari.'
      const kata = q.kata.map(w => w.jawaban.trim().toUpperCase())
      if (kata.some(w => !/^[A-Z]{3,16}$/.test(w) || w.length > q.ukuran)) return 'Setiap jawaban harus satu kata A–Z, 3–16 huruf, dan muat dalam kotak.'
      if (new Set(kata).size !== kata.length || new Set(q.kata.map(w => w.id)).size !== q.kata.length) return 'Kata yang dicari tidak boleh sama.'
      if (!Array.isArray(q.grid) || q.grid.length !== q.ukuran || q.grid.some(row => typeof row !== 'string' || row.length !== q.ukuran || !/^[A-Z]+$/.test(row))) return 'Klik Susun Kotak Kata untuk membuat kisi huruf.'
      if (!Array.isArray(q.posisi) || q.posisi.length !== q.kata.length || new Set(q.posisi.map(p => p.id)).size !== q.kata.length) return 'Susun ulang kotak agar semua kata masuk.'
      for (const w of q.kata) {
        const p = q.posisi.find(x => x.id === w.id)
        if (!p || !Number.isInteger(p.baris) || !Number.isInteger(p.kolom) || !Number.isInteger(p.dr) || !Number.isInteger(p.dc) ||
            ![-1, 0, 1].includes(p.dr) || ![-1, 0, 1].includes(p.dc) || (!p.dr && !p.dc)) return 'Posisi kata tidak valid; susun ulang kotak.'
        for (let i = 0; i < w.jawaban.length; i++) {
          const r = p.baris + p.dr * i, c = p.kolom + p.dc * i
          if (r < 0 || c < 0 || r >= q.ukuran || c >= q.ukuran || q.grid[r][c] !== w.jawaban.toUpperCase()[i]) return 'Kisi tidak sesuai daftar kata; susun ulang kotak.'
        }
      }
      return null
    }
  }
  return null
}

function Acak<T,>({ items, children }: { items: T[]; children: (sorted: T[]) => ReactNode }) {
  // Urutan deterministik agar tidak berubah ketika siswa mengetik atau menyeret.
  return <>{children([...items].reverse())}</>
}

function CariKataPlayer({ kuis, onSelesai }: { kuis: CariKata; onSelesai?: (benar: boolean) => void }) {
  const [awal, setAwal] = useState<[number, number] | null>(null)
  const [akhir, setAkhir] = useState<[number, number] | null>(null)
  const [ditemukan, setDitemukan] = useState<string[]>([])
  const [dinilai, setDinilai] = useState(false)
  const [pesan, setPesan] = useState('')
  const papan = useRef<HTMLDivElement>(null)
  const aktif = useRef(false)
  const awalRef = useRef<[number, number] | null>(null)
  const belumSiap = validasiKuis(kuis)
  const titik = (e: PointerEvent<HTMLDivElement>): [number, number] | null => {
    const rect = papan.current?.getBoundingClientRect()
    if (!rect || e.clientX < rect.left || e.clientY < rect.top || e.clientX >= rect.right || e.clientY >= rect.bottom) return null
    return [Math.min(kuis.ukuran - 1, Math.floor((e.clientY - rect.top) / rect.height * kuis.ukuran)),
      Math.min(kuis.ukuran - 1, Math.floor((e.clientX - rect.left) / rect.width * kuis.ukuran))]
  }
  const lintasan = (a: [number, number], b: [number, number]) => {
    const dr = b[0] - a[0], dc = b[1] - a[1]
    const n = Math.max(Math.abs(dr), Math.abs(dc))
    if (!n || (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc))) return []
    return Array.from({ length: n + 1 }, (_, i) => key(a[0] + Math.sign(dr) * i, a[1] + Math.sign(dc) * i))
  }
  const tandai = (a: [number, number], b: [number, number]) => {
    const path = lintasan(a, b)
    const cocok = kuis.posisi.find(p => {
      const end: [number, number] = [p.baris + p.dr * (kuis.kata.find(w => w.id === p.id)?.jawaban.length || 1) - p.dr,
        p.kolom + p.dc * (kuis.kata.find(w => w.id === p.id)?.jawaban.length || 1) - p.dc]
      return path.length && ((a[0] === p.baris && a[1] === p.kolom && b[0] === end[0] && b[1] === end[1]) ||
        (b[0] === p.baris && b[1] === p.kolom && a[0] === end[0] && a[1] === end[1]))
    })
    if (cocok) {
      setDitemukan(ids => ids.includes(cocok.id) ? ids : [...ids, cocok.id])
      setPesan(`Kata ${kuis.kata.find(w => w.id === cocok.id)?.jawaban} ditemukan!`)
    } else setPesan('Belum cocok. Coba pilih huruf pertama dan terakhir dari kata yang dicari.')
    awalRef.current = null; setAwal(null); setAkhir(null)
  }
  const pilihKeyboard = (pos: [number, number]) => {
    const start = awalRef.current
    if (!start) { awalRef.current = pos; setAwal(pos); setAkhir(pos) }
    else if (start[0] !== pos[0] || start[1] !== pos[1]) tandai(start, pos)
  }
  const disorot = new Set(kuis.posisi.filter(p => ditemukan.includes(p.id)).flatMap(p => {
    const panjang = kuis.kata.find(w => w.id === p.id)?.jawaban.length || 0
    return Array.from({ length: panjang }, (_, i) => key(p.baris + p.dr * i, p.kolom + p.dc * i))
  }))
  const aktifPath = new Set(awal && akhir ? lintasan(awal, akhir) : awal ? [key(...awal)] : [])
  return <div className="rounded-2xl border border-teal-200 bg-white p-4 text-gray-800 sm:p-5">
    <p className="mb-2 text-sm font-semibold">{kuis.pertanyaan}</p>
    {belumSiap ? <p className="text-sm text-amber-700">Kuis belum siap: {belumSiap}</p> : <>
      <p className="mb-3 text-xs text-gray-600">Seret dari huruf pertama ke huruf terakhir. Di ponsel atau dengan keyboard, pilih kedua hurufnya. Arah mendatar, menurun, atau diagonal.</p>
      <div className="max-w-full overflow-x-auto"><div ref={papan} role="group" aria-label="Kotak cari kata" className="grid w-max select-none gap-px rounded-lg bg-teal-200 p-px touch-none"
        style={{ gridTemplateColumns: `repeat(${kuis.ukuran}, minmax(0, 2.25rem))` }}
        onPointerDown={e => { if (dinilai) return; const pos = titik(e); if (!pos) return; aktif.current = true; e.currentTarget.setPointerCapture(e.pointerId); if (!awalRef.current) { awalRef.current = pos; setAwal(pos) } setAkhir(pos) }}
        onPointerMove={e => { if (aktif.current && !dinilai) { const pos = titik(e); if (pos) setAkhir(pos) } }}
        onPointerUp={e => { if (!aktif.current || dinilai) return; aktif.current = false; const pos = titik(e), start = awalRef.current; if (start && pos && (start[0] !== pos[0] || start[1] !== pos[1])) tandai(start, pos) }}
        onPointerCancel={() => { aktif.current = false; setAkhir(null) }}>
        {kuis.grid.map((row, r) => row.split('').map((huruf, c) => {
          const pos = key(r, c)
          return <button type="button" key={pos} disabled={dinilai} aria-label={`Baris ${r + 1}, kolom ${c + 1}, huruf ${huruf}`}
            onClick={e => { if (e.detail === 0) pilihKeyboard([r, c]) }}
            className={`h-9 w-9 text-center text-sm font-bold sm:text-base ${disorot.has(pos) ? 'bg-emerald-300 text-emerald-950' : aktifPath.has(pos) ? 'bg-amber-200 text-amber-950' : 'bg-white text-slate-800'} focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-600`}>{huruf}</button>
        }))}
      </div></div>
      <div className="mt-3 flex flex-wrap gap-2" aria-label="Daftar kata yang dicari">{kuis.kata.map(w => <span key={w.id} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ditemukan.includes(w.id) ? 'bg-emerald-100 text-emerald-800 line-through' : 'bg-slate-100 text-slate-700'}`}>{w.jawaban}</span>)}</div>
      <p className="mt-2 text-xs text-slate-600" role="status">{pesan || `${ditemukan.length} dari ${kuis.kata.length} kata ditemukan.`}</p>
      <div className="mt-4 flex items-center gap-3">
        {!dinilai ? <button type="button" onClick={() => { setDinilai(true); onSelesai?.(ditemukan.length === kuis.kata.length) }} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">Periksa jawaban</button>
          : <><span className={`text-sm font-semibold ${ditemukan.length === kuis.kata.length ? 'text-green-700' : 'text-amber-700'}`}>{ditemukan.length === kuis.kata.length ? 'Benar! 🎉' : `Baru ${ditemukan.length}/${kuis.kata.length} kata. Coba lagi.`}</span>
            <button type="button" onClick={() => { setDitemukan([]); awalRef.current = null; setAwal(null); setAkhir(null); setDinilai(false); setPesan('') }} className="rounded-lg border border-teal-300 px-3 py-2 text-sm text-teal-700">Ulangi</button></>}
      </div>
      {dinilai && kuis.pembahasan && <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">{kuis.pembahasan}</p>}
    </>}
  </div>
}

/** Pakai di halaman siswa: <KuisInteraktif key={segmen.id} kuis={segmen.kuis} /> */
export default function KuisInteraktif({ kuis, onSelesai }: { kuis: Kuis; onSelesai?: (benar: boolean) => void }) {
  const [pilihan, setPilihan] = useState<number | null>(null)
  const [matching, setMatching] = useState<Record<string, string>>({})
  const [titik, setTitik] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [huruf, setHuruf] = useState<Record<string, string>>({})
  const [dinilai, setDinilai] = useState(false)
  const jenis = tipeKuis(kuis)
  const kisi = useMemo(() => jenis === 'tts' ? buatKisi(kuis as TTS) : null, [kuis, jenis])
  const belumSiap = validasiKuis(kuis)
  const selesai = () => {
    if (belumSiap) return
    let benar = false
    if (jenis === 'pilihan_ganda') benar = pilihan === (kuis as PilihanGanda).jawaban_benar
    if (jenis === 'matching') benar = (kuis as Matching).pasangan.every(p => matching[p.id] === p.id)
    if (jenis === 'peta') benar = (kuis as PetaDragDrop).titik.every(p => titik[p.id] === p.id)
    if (jenis === 'tts') benar = Object.entries(kisi!.cells).every(([pos, val]) => (huruf[pos] || '').toUpperCase() === val.huruf)
    setDinilai(true); onSelesai?.(benar)
  }
  const benar = jenis === 'pilihan_ganda' ? pilihan === (kuis as PilihanGanda).jawaban_benar
    : jenis === 'matching' ? (kuis as Matching).pasangan.every(p => matching[p.id] === p.id)
    : jenis === 'peta' ? (kuis as PetaDragDrop).titik.every(p => titik[p.id] === p.id)
    : Object.entries(kisi?.cells || {}).every(([pos, val]) => (huruf[pos] || '').toUpperCase() === val.huruf)
  const reset = () => { setPilihan(null); setMatching({}); setTitik({}); setHuruf({}); setSelected(null); setDinilai(false) }
  const chip = 'rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800'
  if (jenis === 'cari_kata') return <CariKataPlayer kuis={kuis as CariKata} onSelesai={onSelesai} />
  return <div className="rounded-2xl border border-teal-200 bg-white p-4 sm:p-5 text-gray-800">
    <p className="mb-3 text-sm font-semibold">{kuis.pertanyaan}</p>
    {belumSiap && <p className="text-sm text-amber-700">Kuis belum siap: {belumSiap}</p>}
    {jenis === 'pilihan_ganda' && (() => { const q = kuis as PilihanGanda; return <>
      {q.gambar_url && <img src={q.gambar_url} alt="Gambar soal" className="mb-3 max-h-72 rounded-lg object-contain" />}
      <div className="grid gap-2">{q.pilihan.map((p, i) => <button type="button" key={i} disabled={dinilai} onClick={() => setPilihan(i)}
        className={`rounded-lg border px-3 py-2 text-left text-sm ${pilihan === i ? 'border-teal-500 bg-teal-50' : 'border-gray-200'}`}>{String.fromCharCode(65 + i)}. {p}</button>)}</div>
    </> })()}
    {jenis === 'matching' && (() => { const q = kuis as Matching; return <div className="grid gap-2">
      {q.pasangan.map(p => <div key={p.id} className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:items-center">
        <span className={chip}>{p.kiri}</span><select disabled={dinilai} aria-label={`Pasangan untuk ${p.kiri}`} value={matching[p.id] || ''}
          onChange={e => setMatching(v => ({ ...v, [p.id]: e.target.value }))} className="rounded-lg border border-gray-300 bg-white p-2 text-sm">
          <option value="">Pilih pasangan...</option><Acak items={q.pasangan}>{items => items.map(x => <option key={x.id} value={x.id}>{x.kanan}</option>)}</Acak>
        </select>
      </div>)}</div> })()}
    {jenis === 'peta' && (() => { const q = kuis as PetaDragDrop; return <>
      <p className="mb-2 text-xs text-gray-500">Seret label ke titik peta. Di ponsel, ketuk label lalu ketuk titik.</p>
      <div className="mb-3 flex flex-wrap gap-2">{[...q.titik].reverse().map(p => <button type="button" key={p.id} draggable={!dinilai}
        onDragStart={e => e.dataTransfer.setData('text/plain', p.id)} onClick={() => setSelected(p.id)} disabled={dinilai}
        className={`${chip} ${selected === p.id ? 'ring-2 ring-teal-500' : ''}`}>{p.label}</button>)}</div>
      <div className="relative inline-block max-w-full"><img src={q.gambar_url} alt="Peta soal" className="block max-h-[550px] max-w-full rounded-lg" />
        {q.titik.map(p => <button type="button" key={p.id} disabled={dinilai} style={{ left: `${p.x}%`, top: `${p.y}%` }}
          onDragOver={(e: DragEvent) => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (q.titik.some(t => t.id === id)) setTitik(v => ({ ...v, [p.id]: id })) }}
          onClick={() => { if (selected) { setTitik(v => ({ ...v, [p.id]: selected })); setSelected(null) } }}
          aria-label={`Titik peta ${p.label}`} title="Letakkan jawaban di sini"
          className="absolute min-h-9 min-w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-700 px-2 text-xs font-bold text-white shadow-lg">
          {titik[p.id] ? q.titik.find(x => x.id === titik[p.id])?.label : '?'}
        </button>)}
      </div>
    </> })()}
    {jenis === 'tts' && (() => { const q = kuis as TTS; return <>
      <div className="max-w-full overflow-auto"><div className="grid w-max gap-px rounded-lg bg-gray-300 p-px" style={{ gridTemplateColumns: `repeat(${q.kolom}, minmax(0, 2.3rem))` }}>
        {Array.from({ length: q.baris * q.kolom }, (_, i) => { const pos = key(Math.floor(i / q.kolom), i % q.kolom); const cell = kisi?.cells[pos]; return cell
          ? <label key={pos} className="relative block h-9 w-9 bg-white"><span className="absolute left-0.5 top-0 text-[9px] leading-none">{cell.nomor}</span>
              <input aria-label={`Baris ${Math.floor(i / q.kolom) + 1} kolom ${i % q.kolom + 1}`} maxLength={1} disabled={dinilai} value={huruf[pos] || ''}
                onChange={e => setHuruf(v => ({ ...v, [pos]: e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase() }))}
                className="h-full w-full bg-transparent pt-1 text-center text-base font-bold uppercase outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500" /></label>
          : <div key={pos} className="h-9 w-9 bg-gray-700" /> })}
      </div></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">{(['mendatar', 'menurun'] as const).map(arah => <div key={arah}>
        <strong className="text-xs capitalize">{arah}</strong><ul className="mt-1 space-y-1 text-xs">{q.kata.filter(w => w.arah === arah).map(w =>
          <li key={w.id}>{kisi?.starts[key(w.baris, w.kolom)] || '?'} ({w.baris + 1},{w.kolom + 1}). {w.petunjuk}</li>)}</ul>
      </div>)}</div>
    </> })()}
    {!belumSiap && <div className="mt-4 flex flex-wrap items-center gap-2">
      {!dinilai ? <button type="button" onClick={selesai} className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Periksa jawaban</button>
        : <><p role="status" className={`text-sm font-semibold ${benar ? 'text-green-700' : 'text-amber-700'}`}>{benar ? 'Benar! 🎉' : 'Belum tepat. Coba lagi.'}</p>
          <button type="button" onClick={reset} className="rounded-lg border border-teal-300 px-3 py-2 text-sm text-teal-700">Ulangi</button></>}
    </div>}
    {dinilai && kuis.pembahasan && <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">{kuis.pembahasan}</p>}
  </div>
}
