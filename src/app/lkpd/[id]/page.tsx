'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const MapComponent = dynamic(() => import('@/components/Map'), { ssr: false })
const MapDraw = dynamic(() => import('@/components/MapDraw'), { ssr: false })

// ============================================================
// TIPE DATA — sinkron dengan admin/lkpd/page.tsx
// ============================================================
type TipeAktivitas =
  | 'esai' | 'pilihan_ganda' | 'tabel' | 'diagram' | 'peta'
  | 'tts' | 'matching' | 'kategorisasi' | 'paint'
  | 'multi'

interface TtsKata { nomor: number; arah: 'mendatar' | 'menurun'; jawaban: string; pertanyaan: string; row: number; col: number }
interface MatchPair { kiri: string; kanan: string }
interface KategoriItem { item: string; kategori: string }

type TipeKomponen = 'esai' | 'pilihan_ganda' | 'tabel' | 'diagram' | 'peta' | 'paint'
interface Komponen {
  kid: number
  tipe: TipeKomponen
  soal?: string
  pilihan?: string[]; jawaban_benar?: number
  kolom_tabel?: string[]; jumlah_baris?: number; label_terkunci?: string[]
  jenis_grafik?: 'bar' | 'pie' | 'line'; kolom_diagram?: string[]
  peta_mode?: 'titik' | 'polygon' | 'keduanya'; peta_pertanyaan?: string
  paint_instruksi?: string; paint_bg?: string
}

interface Aktivitas {
  id: number
  judul: string
  instruksi: string
  tipe: TipeAktivitas
  fase?: 'Memahami' | 'Mengaplikasi' | 'Merefleksi'
  kode_sdl?: string
  dimensi_st?: string
  literasi_bencana?: string
  literasi_spasial?: string
  ada_peta: boolean
  soal?: string
  pilihan?: string[]; jawaban_benar?: number
  kolom_tabel?: string[]; jumlah_baris?: number
  jenis_grafik?: 'bar' | 'pie' | 'line'; kolom_diagram?: string[]
  peta_mode?: 'titik' | 'polygon' | 'keduanya'; peta_pertanyaan?: string
  tts_kata?: TtsKata[]
  match_pairs?: MatchPair[]
  kat_kategori?: string[]; kat_items?: KategoriItem[]
  paint_instruksi?: string; paint_bg?: string
  komponen?: Komponen[]
}

interface Lkpd {
  id: string
  judul: string
  kabupaten: { nama: string }
  jenis_bencana: { nama: string }
  pertanyaan: Aktivitas[]
  bahan_bacaan?: string
  prinsip_pembelajaran?: string[]
}

type Fase = 'Memahami' | 'Mengaplikasi' | 'Merefleksi'
const FASE_URUT: Fase[] = ['Memahami', 'Mengaplikasi', 'Merefleksi']

const SDL_COLOR: Record<string, string> = {
  SML: 'bg-blue-50 text-blue-700 border-blue-200',
  SPL: 'bg-green-50 text-green-700 border-green-200',
  SRL: 'bg-red-50 text-red-700 border-red-200',
  SRcL: 'bg-amber-50 text-amber-700 border-amber-200',
}

const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all bg-white"

// ============================================================
// HELPER: bangun tampilan grid TTS + set sel petunjuk (huruf awal)
// ============================================================
function buildTtsView(kata: TtsKata[]) {
  let maxR = 0, maxC = 0
  const cells = new Map<string, { letter: string; nums: number[] }>()
  const hint = new Set<string>()  // sel awal tiap nomor = huruf petunjuk
  for (const k of kata) {
    const len = k.jawaban.length
    for (let i = 0; i < len; i++) {
      const r = k.arah === 'menurun' ? k.row + i : k.row
      const c = k.arah === 'mendatar' ? k.col + i : k.col
      maxR = Math.max(maxR, r); maxC = Math.max(maxC, c)
      const key = `${r},${c}`
      const ex = cells.get(key)
      if (ex) ex.letter = k.jawaban[i]
      else cells.set(key, { letter: k.jawaban[i], nums: [] })
    }
    const startKey = `${k.row},${k.col}`
    hint.add(startKey)
    const sc = cells.get(startKey)
    if (sc && !sc.nums.includes(k.nomor)) sc.nums.push(k.nomor)
  }
  return { rows: maxR + 1, cols: maxC + 1, cells, hint }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Pecah teks instruksi menjadi langkah-langkah.
// Menangani dua pola: dipisah baris-baru, ATAU menyambung "1. ... 2. ... 3. ...".
function parseLangkah(teks: string): { steps: string[]; bernomor: boolean } {
  const t = (teks || '').trim()
  if (!t) return { steps: [], bernomor: false }
  // Jika ada baris baru, pecah per baris
  if (t.includes('\n')) {
    const baris = t.split('\n').map(s => s.replace(/^\s*\d+[\.\)]\s*/, '').trim()).filter(Boolean)
    const adaNomor = /^\s*\d+[\.\)]/.test(t)
    return { steps: baris, bernomor: adaNomor || baris.length > 1 }
  }
  // Pola menyambung "1. xxx 2. xxx" -> pecah di depan "angka." bila ada minimal 2 penanda
  const penanda = t.match(/\d+[\.\)]\s/g)
  if (penanda && penanda.length >= 2) {
    const potong = t.split(/\s*(?=\d+[\.\)]\s)/).map(s => s.replace(/^\s*\d+[\.\)]\s*/, '').trim()).filter(Boolean)
    return { steps: potong, bernomor: true }
  }
  return { steps: [t], bernomor: false }
}

// ============================================================
// BAHAN BACAAN — render teks polos jadi tampilan terformat.
// Aturan: baris "A. Judul" -> heading berbadge huruf;
// baris diawali •/-/* -> bullet (istilah sebelum " — " ditebalkan);
// baris lain -> paragraf.
// ============================================================
function BahanBacaan({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="px-6 py-5">
      {lines.map((ln, i) => {
        const t = ln.trim()
        if (!t) return <div key={i} className="h-2" />
        // Heading "A. ..." / "B. ..."
        const mHead = t.match(/^([A-Z])\.\s+(.*)$/)
        if (mHead) {
          return (
            <div key={i} className="flex items-center gap-2.5 mt-4 first:mt-0 mb-1.5">
              <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0">{mHead[1]}</span>
              <p className="font-bold text-gray-800 text-[15px] leading-snug">{mHead[2]}</p>
            </div>
          )
        }
        // Bullet
        if (/^[•\-\*]\s*/.test(t)) {
          const body = t.replace(/^[•\-\*]\s*/, '')
          const sep = body.indexOf(' — ')
          return (
            <div key={i} className="flex gap-2 pl-9 pr-1 mb-1.5">
              <span className="text-blue-400 mt-[1px] flex-shrink-0">•</span>
              <p className="text-sm text-gray-700 leading-relaxed">
                {sep > -1
                  ? <><b className="text-gray-900">{body.slice(0, sep)}</b><span className="text-gray-400"> — </span>{body.slice(sep + 3)}</>
                  : body}
              </p>
            </div>
          )
        }
        // Paragraf biasa
        return <p key={i} className="text-sm text-gray-700 leading-relaxed mb-1.5 pl-0.5">{t}</p>
      })}
    </div>
  )
}

// ============================================================
// PLAYER: Teka-Teki Silang
// Grid di atas, petunjuk full-width 2 kolom di bawah (tidak terjepit).
// Huruf pertama tiap nomor terisi (petunjuk, read-only, tak dihitung poin)
// ============================================================
function TtsPlayer({ a, value, onChange, revealed, locked }: {
  a: Aktivitas; value: Record<string, string>; onChange: (v: Record<string, string>) => void; revealed: boolean; locked: boolean
}) {
  const kata = a.tts_kata || []
  const view = useMemo(() => buildTtsView(kata), [kata])
  const wrapRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(32)
  const mendatar = kata.filter(k => k.arah === 'mendatar').sort((x, y) => x.nomor - y.nomor)
  const menurun = kata.filter(k => k.arah === 'menurun').sort((x, y) => x.nomor - y.nomor)

  // Ukur lebar container -> sel menyesuaikan agar seluruh grid muat tanpa scroll
  useEffect(() => {
    const compute = () => {
      const w = wrapRef.current?.clientWidth || 0
      if (!w || !view.cols) return
      setCellSize(Math.max(14, Math.min(36, Math.floor((w - 16) / view.cols))))
    }
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [view.cols])

  if (kata.length === 0) return <p className="text-sm text-gray-400 italic">Grid TTS belum disusun oleh guru.</p>

  const CELL = cellSize
  const fontPx = Math.max(9, Math.round(CELL * 0.45))
  const numPx = Math.max(6, Math.round(CELL * 0.24))

  return (
    <div className="flex flex-col gap-5" ref={wrapRef}>
      {/* Grid — otomatis menyesuaikan lebar layar */}
      <div className="flex justify-center">
        <div className="inline-block bg-gray-100 p-1.5 rounded-lg" style={{ lineHeight: 0 }}>
          {Array.from({ length: view.rows }).map((_, r) => (
            <div key={r} className="flex">
              {Array.from({ length: view.cols }).map((_, c) => {
                const key = `${r},${c}`
                const cell = view.cells.get(key)
                if (!cell) return <div key={c} style={{ width: CELL, height: CELL }} />

                const isHint = view.hint.has(key)
                if (isHint) {
                  return (
                    <div key={c} className="relative" style={{ width: CELL, height: CELL }}>
                      {cell.nums.length > 0 && (
                        <span className="absolute top-0 left-0.5 font-bold text-blue-600 z-10 pointer-events-none" style={{ fontSize: numPx }}>{cell.nums.join('/')}</span>
                      )}
                      <div className="w-full h-full flex items-center justify-center font-bold uppercase bg-slate-200 border border-slate-300 text-slate-600 select-none"
                        style={{ fontSize: fontPx }} title="Huruf petunjuk">{cell.letter}</div>
                    </div>
                  )
                }

                const val = (value?.[key] || '').toUpperCase()
                const benar = val && val === cell.letter
                const salah = revealed && val && val !== cell.letter
                return (
                  <div key={c} className="relative" style={{ width: CELL, height: CELL }}>
                    {cell.nums.length > 0 && (
                      <span className="absolute top-0 left-0.5 font-bold text-gray-500 z-10 pointer-events-none" style={{ fontSize: numPx }}>{cell.nums.join('/')}</span>
                    )}
                    <input maxLength={1} value={val} disabled={locked}
                      onChange={e => onChange({ ...value, [key]: e.target.value.toUpperCase().slice(-1) })}
                      style={{ fontSize: fontPx }}
                      className={`w-full h-full text-center font-bold uppercase border outline-none transition-all disabled:cursor-not-allowed
                        ${revealed && benar ? 'bg-green-100 border-green-400 text-green-700'
                          : salah ? 'bg-red-100 border-red-400 text-red-600'
                          : 'bg-white border-gray-300 text-gray-800 focus:border-blue-500 focus:bg-blue-50'}`} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="text-[10px] text-slate-400 -mt-3 flex items-center gap-1 justify-center">
        <span className="inline-block w-3 h-3 bg-slate-200 border border-slate-300 rounded-sm" /> Huruf abu-abu = petunjuk awal (bukan poin)
      </p>

      {/* Petunjuk — full width, 2 kolom di layar lebar */}
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4">
        {mendatar.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2 pb-1 border-b border-gray-100">Mendatar</p>
            <ol className="flex flex-col gap-1.5">
              {mendatar.map(k => (
                <li key={`m${k.nomor}`} className="text-[13px] text-gray-700 leading-relaxed">
                  <span className="font-bold text-blue-700">{k.nomor}.</span> {k.pertanyaan}
                  <span className="text-gray-300"> ({k.jawaban.length})</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {menurun.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2 pb-1 border-b border-gray-100">Menurun</p>
            <ol className="flex flex-col gap-1.5">
              {menurun.map(k => (
                <li key={`d${k.nomor}`} className="text-[13px] text-gray-700 leading-relaxed">
                  <span className="font-bold text-blue-700">{k.nomor}.</span> {k.pertanyaan}
                  <span className="text-gray-300"> ({k.jawaban.length})</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

// Skor TTS — sel petunjuk (huruf awal) TIDAK dihitung
function scoreTts(a: Aktivitas, value: Record<string, string> = {}) {
  const kata = a.tts_kata || []
  const hint = new Set(kata.map(k => `${k.row},${k.col}`))
  let benar = 0
  for (const k of kata) {
    let ok = true
    for (let i = 0; i < k.jawaban.length; i++) {
      const r = k.arah === 'menurun' ? k.row + i : k.row
      const c = k.arah === 'mendatar' ? k.col + i : k.col
      const key = `${r},${c}`
      if (hint.has(key)) continue // petunjuk, lewati
      if ((value[key] || '').toUpperCase() !== k.jawaban[i]) { ok = false; break }
    }
    if (ok) benar++
  }
  return { benar, total: kata.length }
}

// ============================================================
// PLAYER: Matching — TARIK GARIS
// Klik pernyataan kiri -> klik jawaban kanan -> garis tersambung.
// Klik jawaban yang sudah terhubung (tanpa memilih kiri) = hapus garis.
// Data jawaban tetap Record<indexKiri, teksKanan> (kompatibel skor lama).
// ============================================================
const LINE_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#db2777', '#ca8a04', '#dc2626', '#4f46e5', '#059669']

function MatchingPlayer({ a, value, onChange, revealed, locked }: {
  a: Aktivitas; value: Record<number, string>; onChange: (v: Record<number, string>) => void; revealed: boolean; locked: boolean
}) {
  const pairs = a.match_pairs || []
  const opsiKanan = useMemo(() => shuffle(pairs.map(p => p.kanan)), [a.id])
  const containerRef = useRef<HTMLDivElement>(null)
  const leftRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const rightRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null)
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; li: number; kanan: string }[]>([])

  // Hitung ulang koordinat garis setiap jawaban berubah / layar berubah ukuran
  useEffect(() => {
    const compute = () => {
      const cont = containerRef.current
      if (!cont) return
      const crect = cont.getBoundingClientRect()
      const ls: { x1: number; y1: number; x2: number; y2: number; li: number; kanan: string }[] = []
      Object.entries(value || {}).forEach(([liStr, kanan]) => {
        const li = Number(liStr)
        const le = leftRefs.current[li]
        const re = rightRefs.current[kanan as string]
        if (!le || !re) return
        const lr = le.getBoundingClientRect(), rr = re.getBoundingClientRect()
        ls.push({
          x1: lr.right - crect.left, y1: lr.top + lr.height / 2 - crect.top,
          x2: rr.left - crect.left, y2: rr.top + rr.height / 2 - crect.top,
          li, kanan: kanan as string,
        })
      })
      setLines(ls)
    }
    const raf = requestAnimationFrame(compute)
    window.addEventListener('resize', compute)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', compute) }
  }, [value, a.id, revealed])

  if (pairs.length === 0) return <p className="text-sm text-gray-400 italic">Belum ada pasangan.</p>

  const kananTerpakai = new Set(Object.values(value || {}))

  const klikKiri = (i: number) => {
    if (locked) return
    setSelectedLeft(selectedLeft === i ? null : i)
  }
  const klikKanan = (k: string) => {
    if (locked) return
    if (selectedLeft === null) {
      // hapus garis yang menuju jawaban ini (jika ada)
      const existing = Object.entries(value || {}).find(([, v]) => v === k)
      if (existing) {
        const nv = { ...value }
        delete nv[Number(existing[0])]
        onChange(nv)
      }
      return
    }
    const nv: Record<number, string> = { ...value }
    // satu jawaban kanan hanya boleh dipakai satu garis
    Object.keys(nv).forEach(key => { if (nv[Number(key)] === k) delete nv[Number(key)] })
    nv[selectedLeft] = k
    onChange(nv)
    setSelectedLeft(null)
  }

  return (
    <div className="flex flex-col gap-2">
      {!locked && (
        <p className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          <b className="text-gray-500">Cara:</b> klik pernyataan di kiri, lalu klik jawaban di kanan untuk menarik garis.
          Klik jawaban yang sudah terhubung untuk menghapus garisnya.
        </p>
      )}
      <div ref={containerRef} className="relative">
        {/* Garis-garis */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible', zIndex: 1 }}>
          {lines.map((l, i) => {
            const benar = pairs[l.li]?.kanan === l.kanan
            const stroke = revealed ? (benar ? '#16a34a' : '#dc2626') : LINE_COLORS[l.li % LINE_COLORS.length]
            const midX = (l.x1 + l.x2) / 2
            return (
              <g key={i}>
                <path d={`M ${l.x1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${l.x2} ${l.y2}`}
                  stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                <circle cx={l.x1} cy={l.y1} r={4} fill={stroke} />
                <circle cx={l.x2} cy={l.y2} r={4} fill={stroke} />
              </g>
            )
          })}
        </svg>

        <div className="grid grid-cols-[1fr_120px_1fr] sm:grid-cols-[1fr_160px_1fr] items-start" style={{ zIndex: 2, position: 'relative' }}>
          {/* Kolom kiri */}
          <div className="flex flex-col gap-2.5">
            {pairs.map((p, i) => {
              const terhubung = (value || {})[i] !== undefined
              const benar = revealed && terhubung && value[i] === p.kanan
              const salah = revealed && terhubung && value[i] !== p.kanan
              const aktif = selectedLeft === i
              const warna = LINE_COLORS[i % LINE_COLORS.length]
              return (
                <button key={i} type="button" disabled={locked}
                  ref={el => { leftRefs.current[i] = el }}
                  onClick={() => klikKiri(i)}
                  className={`text-left text-[13px] leading-snug p-3 rounded-xl border-2 transition-all relative disabled:cursor-default
                    ${benar ? 'bg-green-50 border-green-400 text-green-800'
                      : salah ? 'bg-red-50 border-red-400 text-red-700'
                      : aktif ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-sm'
                      : terhubung ? 'bg-white text-gray-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50/50'}`}
                  style={!revealed && terhubung && !aktif ? { borderColor: warna } : undefined}>
                  <span className="text-[10px] font-bold text-gray-400 mr-1.5">{i + 1}.</span>
                  {p.kiri}
                  {revealed && terhubung && <span className="absolute top-1.5 right-2 text-[10px] font-bold">{benar ? '✓' : '✗'}</span>}
                </button>
              )
            })}
          </div>

          {/* Ruang tengah untuk garis */}
          <div />

          {/* Kolom kanan (acak) */}
          <div className="flex flex-col gap-2.5">
            {opsiKanan.map((k, ki) => {
              const dipakaiOleh = Object.entries(value || {}).find(([, v]) => v === k)
              const terhubung = !!dipakaiOleh
              const li = terhubung ? Number(dipakaiOleh![0]) : -1
              const benar = revealed && terhubung && pairs[li]?.kanan === k
              const salah = revealed && terhubung && pairs[li]?.kanan !== k
              const warna = li >= 0 ? LINE_COLORS[li % LINE_COLORS.length] : undefined
              const bisaTerima = selectedLeft !== null
              return (
                <button key={ki} type="button" disabled={locked}
                  ref={el => { rightRefs.current[k] = el }}
                  onClick={() => klikKanan(k)}
                  className={`text-left text-[13px] font-semibold leading-snug p-3 rounded-xl border-2 transition-all disabled:cursor-default
                    ${benar ? 'bg-green-50 border-green-400 text-green-800'
                      : salah ? 'bg-red-50 border-red-400 text-red-700'
                      : terhubung ? 'bg-white text-gray-800'
                      : bisaTerima ? 'bg-blue-50/50 border-blue-300 border-dashed text-gray-700 hover:border-blue-500 hover:bg-blue-50'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300'}`}
                  style={!revealed && terhubung ? { borderColor: warna } : undefined}>
                  {k}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function scoreMatching(a: Aktivitas, value: Record<number, string> = {}) {
  const pairs = a.match_pairs || []
  let benar = 0
  pairs.forEach((p, i) => { if ((value[i] || '') === p.kanan) benar++ })
  return { benar, total: pairs.length }
}

// ============================================================
// PLAYER: Kategorisasi — DRAG & DROP
// Item di "bank" atas di-drag ke kotak kategori. Fallback sentuh:
// tap item (terpilih) lalu tap kategori. Item dalam kategori bisa
// di-drag pindah, atau klik ✕ untuk kembali ke bank.
// Data jawaban tetap Record<indexItem, namaKategori>.
// ============================================================
function KategorisasiPlayer({ a, value, onChange, revealed, locked }: {
  a: Aktivitas; value: Record<number, string>; onChange: (v: Record<number, string>) => void; revealed: boolean; locked: boolean
}) {
  const kategori = a.kat_kategori || []
  const items = a.kat_items || []
  const urutan = useMemo(() => shuffle(items.map((_, i) => i)), [a.id])
  const containerRef = useRef<HTMLDivElement>(null)
  const katRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({})
  const [selKat, setSelKat] = useState<string | null>(null)
  const [lines, setLines] = useState<{ x1: number; y1: number; x2: number; y2: number; idx: number; kat: string }[]>([])

  // Warna tetap per kategori (indeks) — semua garis ke kategori sama = warna sama
  const katWarna = (kat: string) => {
    const i = kategori.indexOf(kat)
    return LINE_COLORS[(i < 0 ? 0 : i) % LINE_COLORS.length]
  }

  useEffect(() => {
    const compute = () => {
      const cont = containerRef.current
      if (!cont) return
      const crect = cont.getBoundingClientRect()
      const ls: { x1: number; y1: number; x2: number; y2: number; idx: number; kat: string }[] = []
      Object.entries(value || {}).forEach(([idxStr, kat]) => {
        const idx = Number(idxStr)
        const ke = katRefs.current[kat as string]
        const ie = itemRefs.current[idx]
        if (!ke || !ie) return
        const kr = ke.getBoundingClientRect(), ir = ie.getBoundingClientRect()
        ls.push({
          x1: kr.right - crect.left, y1: kr.top + kr.height / 2 - crect.top,
          x2: ir.left - crect.left, y2: ir.top + ir.height / 2 - crect.top,
          idx, kat: kat as string,
        })
      })
      setLines(ls)
    }
    const raf = requestAnimationFrame(compute)
    window.addEventListener('resize', compute)
    const t = setInterval(compute, 400) // jaga posisi saat layout berubah (mis. kolom item makin panjang)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', compute); clearInterval(t) }
  }, [value, a.id, revealed, selKat])

  if (items.length === 0) return <p className="text-sm text-gray-400 italic">Belum ada item.</p>

  const jmlPerKat = (kat: string) => Object.values(value || {}).filter(v => v === kat).length

  const klikKat = (kat: string) => {
    if (locked) return
    setSelKat(prev => (prev === kat ? null : kat))
  }
  const klikItem = (idx: number) => {
    if (locked) return
    if (selKat) {
      onChange({ ...value, [idx]: selKat })   // assign; kategori tetap terpilih untuk lanjut cepat
    } else if ((value || {})[idx] !== undefined) {
      const nv = { ...value }; delete nv[idx]; onChange(nv)   // lepas garis
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!locked && (
        <p className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          <b className="text-gray-500">Cara:</b> klik satu kategori di kiri, lalu klik semua tindakan di kanan yang termasuk kategori itu — garis akan tersambung.
          Klik tindakan yang sudah tersambung (tanpa memilih kategori) untuk melepasnya.
        </p>
      )}
      <div ref={containerRef} className="relative">
        {/* Garis */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible', zIndex: 1 }}>
          {lines.map((l, i) => {
            const benar = items[l.idx]?.kategori === l.kat
            const stroke = revealed ? (benar ? '#16a34a' : '#dc2626') : katWarna(l.kat)
            const midX = (l.x1 + l.x2) / 2
            return (
              <g key={i}>
                <path d={`M ${l.x1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${l.x2} ${l.y2}`}
                  stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                <circle cx={l.x1} cy={l.y1} r={4} fill={stroke} />
                <circle cx={l.x2} cy={l.y2} r={4} fill={stroke} />
              </g>
            )
          })}
        </svg>

        <div className="grid grid-cols-[minmax(110px,0.8fr)_40px_1.4fr] sm:grid-cols-[minmax(140px,0.8fr)_64px_1.4fr] items-start gap-y-3" style={{ zIndex: 2, position: 'relative' }}>
          {/* Kolom kiri: KATEGORI */}
          <div className="flex flex-col gap-3">
            {kategori.map(kat => {
              const aktif = selKat === kat
              const n = jmlPerKat(kat)
              const warna = katWarna(kat)
              return (
                <button key={kat} type="button" disabled={locked}
                  ref={el => { katRefs.current[kat] = el }}
                  onClick={() => klikKat(kat)}
                  className={`text-left p-3 rounded-xl border-2 transition-all relative disabled:cursor-default
                    ${aktif ? 'text-white shadow-md' : 'bg-white hover:shadow-sm'}`}
                  style={aktif ? { background: warna, borderColor: warna } : { borderColor: warna }}>
                  <span className={`text-[12.5px] font-bold leading-snug block ${aktif ? 'text-white' : 'text-gray-700'}`}>{kat}</span>
                  {n > 0 && (
                    <span className={`text-[10px] mt-0.5 inline-block ${aktif ? 'text-white/80' : 'text-gray-400'}`}>{n} tindakan</span>
                  )}
                  {!locked && (
                    <span className={`absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${aktif ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {aktif ? 'dipilih' : 'pilih'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Ruang tengah garis */}
          <div />

          {/* Kolom kanan: ITEM TINDAKAN (acak) */}
          <div className="flex flex-col gap-3">
            {urutan.map(idx => {
              const it = items[idx]
              const kat = (value || {})[idx]
              const terhubung = kat !== undefined
              const benar = revealed && terhubung && it.kategori === kat
              const salah = revealed && terhubung && it.kategori !== kat
              const warna = terhubung ? katWarna(kat) : undefined
              const bisaTerima = selKat !== null
              return (
                <button key={idx} type="button" disabled={locked}
                  ref={el => { itemRefs.current[idx] = el }}
                  onClick={() => klikItem(idx)}
                  className={`text-left text-[12.5px] leading-snug p-3 rounded-xl border-2 transition-all relative disabled:cursor-default
                    ${benar ? 'bg-green-50 border-green-400 text-green-800'
                      : salah ? 'bg-red-50 border-red-400 text-red-700'
                      : terhubung ? 'bg-white text-gray-800'
                      : bisaTerima ? 'bg-blue-50/40 border-blue-300 border-dashed text-gray-700 hover:border-blue-500 hover:bg-blue-50'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300'}`}
                  style={!revealed && terhubung ? { borderColor: warna } : undefined}>
                  {it.item}
                  {terhubung && !revealed && (
                    <span className="absolute top-1.5 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full text-white" style={{ background: warna }}>{kat}</span>
                  )}
                  {revealed && terhubung && <span className="absolute top-1.5 right-2 text-[10px] font-bold">{benar ? '✓' : '✗'}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function scoreKategorisasi(a: Aktivitas, value: Record<number, string> = {}) {
  const items = a.kat_items || []
  let benar = 0
  items.forEach((it, i) => { if ((value[i] || '') === it.kategori) benar++ })
  return { benar, total: items.length }
}

// ============================================================
// PLAYER: Paint
// ============================================================
// Gambar image ke canvas secara proporsional (contain, di tengah)
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height)
  const dw = img.width * s, dh = img.height * s
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

const PAINT_COLORS = ['#1e293b', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed', '#ffffff']
type PaintTool = 'pena' | 'garis' | 'kotak' | 'lingkaran' | 'teks'

function PaintCanvas({ a, value, onChange, locked }: {
  a: Aktivitas; value: string; onChange: (v: string) => void; locked: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [color, setColor] = useState('#dc2626')
  const [size, setSize] = useState(3)
  const [tool, setTool] = useState<PaintTool>('pena')
  const last = useRef<{ x: number; y: number } | null>(null)
  const startPt = useRef<{ x: number; y: number } | null>(null)
  const baseSnapshot = useRef<ImageData | null>(null)   // kondisi kanvas sebelum shape sedang digambar
  const history = useRef<string[]>([])                  // riwayat untuk undo (dataURL)

  // Gambar latar (background referensi atau jawaban tersimpan)
  const paintBase = () => {
    const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height); img.src = value }
    else if (a.paint_bg) { const img = new Image(); img.onload = () => drawContain(ctx, img, canvas.width, canvas.height); img.src = a.paint_bg }
  }

  useEffect(() => {
    paintBase()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }
  }

  const pushHistory = () => {
    const c = canvasRef.current!
    history.current.push(c.toDataURL('image/png'))
    if (history.current.length > 20) history.current.shift()
  }
  const commit = () => onChange(canvasRef.current!.toDataURL('image/png'))

  const start = (e: React.PointerEvent) => {
    if (locked) return
    const p = pos(e)
    const ctx = canvasRef.current!.getContext('2d')!
    if (tool === 'teks') {
      const teks = window.prompt('Tulis teks:')
      if (teks) {
        pushHistory()
        ctx.fillStyle = color
        ctx.font = `bold ${Math.max(12, size * 5)}px system-ui, sans-serif`
        ctx.textBaseline = 'top'
        ctx.fillText(teks, p.x, p.y)
        commit()
      }
      return
    }
    pushHistory()
    drawing.current = true
    last.current = p; startPt.current = p
    if (tool !== 'pena') baseSnapshot.current = ctx.getImageData(0, 0, canvasRef.current!.width, canvasRef.current!.height)
  }

  const move = (e: React.PointerEvent) => {
    if (!drawing.current || locked) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    if (tool === 'pena') {
      ctx.beginPath(); ctx.moveTo(last.current!.x, last.current!.y); ctx.lineTo(p.x, p.y); ctx.stroke()
      last.current = p
    } else {
      // shape: pulihkan snapshot lalu gambar preview
      if (baseSnapshot.current) ctx.putImageData(baseSnapshot.current, 0, 0)
      const s = startPt.current!
      ctx.beginPath()
      if (tool === 'garis') { ctx.moveTo(s.x, s.y); ctx.lineTo(p.x, p.y); ctx.stroke() }
      else if (tool === 'kotak') { ctx.strokeRect(Math.min(s.x, p.x), Math.min(s.y, p.y), Math.abs(p.x - s.x), Math.abs(p.y - s.y)) }
      else if (tool === 'lingkaran') {
        const cx = (s.x + p.x) / 2, cy = (s.y + p.y) / 2
        const rx = Math.abs(p.x - s.x) / 2, ry = Math.abs(p.y - s.y) / 2
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
      }
    }
  }

  const end = () => {
    if (!drawing.current || locked) return
    drawing.current = false; last.current = null; startPt.current = null; baseSnapshot.current = null
    commit()
  }

  const undo = () => {
    if (locked || history.current.length === 0) return
    const prev = history.current.pop()!
    const ctx = canvasRef.current!.getContext('2d')!
    const img = new Image()
    img.onload = () => { ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); ctx.drawImage(img, 0, 0); commit() }
    img.src = prev
  }

  const clear = () => {
    if (locked) return
    history.current = []
    const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (a.paint_bg) { const img = new Image(); img.onload = () => drawContain(ctx, img, canvas.width, canvas.height); img.src = a.paint_bg }
    onChange('')
  }

  const TOOLS: { value: PaintTool; label: string; icon: string }[] = [
    { value: 'pena', label: 'Pena', icon: '✏️' },
    { value: 'garis', label: 'Garis', icon: '╱' },
    { value: 'kotak', label: 'Kotak', icon: '▭' },
    { value: 'lingkaran', label: 'Lingkaran', icon: '◯' },
    { value: 'teks', label: 'Teks', icon: 'T' },
  ]

  return (
    <div className="flex flex-col gap-2">
      {!locked && (
        <div className="flex flex-col gap-2 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
          {/* Alat */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {TOOLS.map(t => (
              <button key={t.value} type="button" onClick={() => setTool(t.value)}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${tool === t.value ? 'bg-blue-950 border-blue-950 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'}`}>
                <span className="text-[13px] leading-none">{t.icon}</span> {t.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" onClick={undo} className="text-[11px] text-gray-600 border border-gray-200 hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-all">↶ Undo</button>
              <button type="button" onClick={clear} className="text-[11px] text-red-500 border border-red-200 hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition-all">Bersihkan</button>
            </div>
          </div>
          {/* Warna & tebal */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {PAINT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${c === '#ffffff' ? 'border-gray-300' : 'border-white'}`}
                  style={{ background: c }} title={c === '#ffffff' ? 'Penghapus (putih)' : c} />
              ))}
            </div>
            <div className="flex items-center gap-1.5 ml-1">
              <span className="text-[10px] text-gray-400">Tebal</span>
              <input type="range" min={1} max={16} value={size} onChange={e => setSize(Number(e.target.value))} className="w-20 accent-blue-700" />
              <span className="text-[10px] text-gray-500 w-4">{size}</span>
            </div>
          </div>
        </div>
      )}
      <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white" style={{ touchAction: 'none' }}>
        <canvas ref={canvasRef} width={760} height={420}
          className={`w-full block ${locked ? 'cursor-default' : 'cursor-crosshair'}`}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
      </div>
      {!locked && <p className="text-[10px] text-gray-400">Pilih alat lalu gambar di kanvas. Untuk garis/kotak/lingkaran: tekan–tarik–lepas. Hasil otomatis tersimpan & ikut tercetak di PDF.</p>}
    </div>
  )
}

// ============================================================
// RENDERER: Aktivitas Gabungan (multi) — render tiap komponen berurutan.
// Data tabel/diagram/esai/paint/peta per komponen disimpan di `jawaban`
// dengan kunci komposit: `${aktId}__${kid}` sehingga tidak bentrok antar komponen.
// ============================================================
function MultiRenderer({ a, jawaban, setJawaban, locked, revealed }: {
  a: Aktivitas
  jawaban: Record<string, any>
  setJawaban: (updater: (prev: Record<string, any>) => Record<string, any>) => void
  locked: boolean
  revealed: boolean
}) {
  const komponen = a.komponen || []
  const chartRefs = useRef<Record<string, any>>({})

  const key = (kid: number, suffix = '') => `${a.id}__${kid}${suffix}`

  const getTabel = (k: Komponen): string[][] => {
    const kk = key(k.kid, '_tabel')
    if (jawaban[kk]) return jawaban[kk]
    const rows = k.jumlah_baris || 3
    const cols = k.kolom_tabel?.length || 2
    const labels = k.label_terkunci || []
    return Array(rows).fill(null).map((_, ri) => Array(cols).fill('').map((_, ci) => (ci === 0 && labels[ri]) ? labels[ri] : ''))
  }
  const setTabel = (k: Komponen, ri: number, ci: number, val: string) => {
    const cur = getTabel(k).map(r => [...r])
    if (cur[ri]) cur[ri][ci] = val
    setJawaban(prev => ({ ...prev, [key(k.kid, '_tabel')]: cur }))
  }
  const getDiagram = (k: Komponen): string[][] => {
    const kk = key(k.kid, '_diagram')
    if (jawaban[kk]) return jawaban[kk]
    const cols = k.kolom_diagram?.length || 2
    return Array(5).fill(null).map(() => Array(cols).fill(''))
  }
  const setDiagram = (k: Komponen, ri: number, ci: number, val: string) => {
    const cur = getDiagram(k).map(r => [...r])
    if (cur[ri]) cur[ri][ci] = val
    setJawaban(prev => ({ ...prev, [key(k.kid, '_diagram')]: cur }))
  }
  const buatGrafik = (k: Komponen) => {
    const data = getDiagram(k)
    const labels = data.map(r => r[0]).filter(Boolean)
    const values = data.map(r => parseFloat(r[1])).filter(v => !isNaN(v))
    if (labels.length === 0) return
    const canvas = document.getElementById(`chart-${key(k.kid)}`) as HTMLCanvasElement
    if (!canvas) return
    if (chartRefs.current[k.kid]) chartRefs.current[k.kid].destroy()
    chartRefs.current[k.kid] = new Chart(canvas, {
      type: k.jenis_grafik || 'bar',
      data: { labels, datasets: [{ label: k.kolom_diagram?.[1] || 'Nilai', data: values, backgroundColor: ['#1e3a8a', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'] }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    })
  }

  const labelKomp = (t: TipeKomponen) => ({ esai: 'Pertanyaan', pilihan_ganda: 'Pilihan Ganda', tabel: 'Isi Tabel', diagram: 'Diagram', paint: 'Menggambar', peta: 'Peta' }[t] || t)

  return (
    <div className="flex flex-col gap-5">
      {komponen.map((k, ki) => (
        <div key={k.kid} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 text-[10px] flex items-center justify-center font-bold">{ki + 1}</span>
            {labelKomp(k.tipe)}
          </p>

          {/* ESAI */}
          {k.tipe === 'esai' && (
            <div>
              {k.soal && <p className="text-sm font-semibold text-gray-800 mb-2 leading-relaxed">{k.soal}</p>}
              <textarea disabled={locked} rows={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all resize-none bg-white disabled:opacity-70 disabled:cursor-not-allowed"
                placeholder="Tulis jawabanmu di sini..." value={jawaban[key(k.kid)] || ''}
                onChange={e => setJawaban(prev => ({ ...prev, [key(k.kid)]: e.target.value }))} />
            </div>
          )}

          {/* PILIHAN GANDA */}
          {k.tipe === 'pilihan_ganda' && (
            <div>
              {k.soal && <p className="text-sm font-semibold text-gray-800 mb-3 leading-relaxed">{k.soal}</p>}
              <div className="flex flex-col gap-2">
                {(k.pilihan || []).map((p, pi) => {
                  const dipilih = jawaban[key(k.kid)] === pi
                  const benar = pi === k.jawaban_benar
                  return (
                    <label key={pi} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${locked ? 'cursor-default' : 'cursor-pointer'}
                      ${revealed && dipilih && benar ? 'bg-green-50 border-green-300' : revealed && dipilih && !benar ? 'bg-red-50 border-red-300' : revealed && benar ? 'bg-green-50 border-green-200' : dipilih ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${revealed && dipilih && benar ? 'border-green-500 bg-green-500' : revealed && dipilih && !benar ? 'border-red-500 bg-red-500' : revealed && benar ? 'border-green-400' : dipilih ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                        {dipilih && <span className="text-white text-[9px]">●</span>}
                      </div>
                      <input type="radio" name={`pg-${key(k.kid)}`} checked={dipilih} disabled={locked} onChange={() => setJawaban(prev => ({ ...prev, [key(k.kid)]: pi }))} className="hidden" />
                      <span className="text-sm text-gray-700">{p}</span>
                      {revealed && benar && <span className="ml-auto text-[10px] text-green-600 font-bold">✓ Benar</span>}
                      {revealed && dipilih && !benar && <span className="ml-auto text-[10px] text-red-500 font-bold">✗ Pilihanmu</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {/* TABEL */}
          {k.tipe === 'tabel' && (
            <div>
              {k.soal && <p className="text-sm text-gray-700 mb-2">{k.soal}</p>}
              <div className="overflow-x-auto rounded-xl border-2 border-gray-300">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="bg-blue-950">{(k.kolom_tabel || []).map((kol, ci) => <th key={ci} className="text-left px-4 py-3 text-white text-[11px] font-semibold uppercase tracking-wide border-r border-blue-800 last:border-r-0">{kol}</th>)}</tr></thead>
                  <tbody>{getTabel(k).map((row, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'}>
                      {row.map((cell, ci) => {
                        const terkunci = ci === 0 && (k.label_terkunci || [])[ri]
                        return (
                          <td key={ci} className="border border-gray-300 px-1 py-0.5 min-w-[120px]">
                            {terkunci
                              ? <div className="px-2 py-2 text-sm text-gray-700 font-medium bg-gray-50">{cell}</div>
                              : <input disabled={locked} className="w-full px-2 py-2 text-sm text-gray-700 bg-transparent outline-none focus:bg-amber-50 rounded transition-all disabled:cursor-not-allowed" placeholder="—" value={cell} onChange={e => setTabel(k, ri, ci, e.target.value)} />}
                          </td>
                        )
                      })}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* DIAGRAM */}
          {k.tipe === 'diagram' && (
            <div>
              {k.soal && <p className="text-sm text-gray-700 mb-2">{k.soal}</p>}
              <div className="overflow-x-auto rounded-xl border-2 border-gray-300 mb-3">
                <table className="w-full text-sm border-collapse">
                  <thead><tr className="bg-blue-950">{(k.kolom_diagram || []).map((kol, ci) => <th key={ci} className="text-left px-4 py-3 text-white text-[11px] font-semibold uppercase tracking-wide border-r border-blue-800 last:border-r-0">{kol}</th>)}</tr></thead>
                  <tbody>{getDiagram(k).map((row, ri) => (<tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'}>{row.map((cell, ci) => <td key={ci} className="border border-gray-300 px-1 py-0.5 min-w-[120px]"><input disabled={locked} className="w-full px-2 py-2 text-sm text-gray-700 bg-transparent outline-none focus:bg-amber-50 rounded transition-all disabled:cursor-not-allowed" placeholder="—" value={cell} onChange={e => setDiagram(k, ri, ci, e.target.value)} /></td>)}</tr>))}</tbody>
                </table>
              </div>
              {!locked && <button onClick={() => buatGrafik(k)} className="no-print text-xs bg-blue-950 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-900 transition-all">Buat Grafik</button>}
              <div className="mt-3 rounded-xl overflow-hidden" style={{ maxHeight: '220px' }}><canvas id={`chart-${key(k.kid)}`} /></div>
            </div>
          )}

          {/* PAINT */}
          {k.tipe === 'paint' && (
            <div className="flex flex-col gap-2">
              {k.paint_instruksi && <p className="text-sm text-gray-700">{k.paint_instruksi}</p>}
              <PaintCanvas a={{ ...a, paint_bg: k.paint_bg } as Aktivitas} value={jawaban[key(k.kid)] || ''} locked={locked}
                onChange={v => setJawaban(prev => ({ ...prev, [key(k.kid)]: v }))} />
            </div>
          )}

          {/* PETA */}
          {k.tipe === 'peta' && (
            <div className="flex flex-col gap-3" style={{ isolation: 'isolate' }}>
              <MapDraw aktivitasId={k.kid} mode={k.peta_mode || 'keduanya'} onDataChange={(data: any) => { if (!locked) setTimeout(() => setJawaban(prev => ({ ...prev, [key(k.kid, '_peta')]: data })), 0) }} />
              {k.peta_pertanyaan && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-2">{k.peta_pertanyaan}</p>
                  <textarea disabled={locked} rows={4}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all resize-none bg-white disabled:opacity-70 disabled:cursor-not-allowed"
                    placeholder="Tulis analisismu..." value={jawaban[key(k.kid)] || ''}
                    onChange={e => setJawaban(prev => ({ ...prev, [key(k.kid)]: e.target.value }))} />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// HALAMAN SISWA
// ============================================================
export default function LkpdDetailPage() {
  const params = useParams()
  const [lkpd, setLkpd] = useState<Lkpd | null>(null)
  const [loading, setLoading] = useState(true)
  const [identitas, setIdentitas] = useState<{ nama: string; sekolah: string; kelas: string; anggota: string[] }>({ nama: '', sekolah: '', kelas: '', anggota: [] })
  const [identitasSelesai, setIdentitasSelesai] = useState(false)
  const [jawaban, setJawaban] = useState<Record<string, any>>({})
  const [tabelData, setTabelData] = useState<Record<number, string[][]>>({})
  const [diagramData, setDiagramData] = useState<Record<number, string[][]>>({})
  const [faseSelesai, setFaseSelesai] = useState<Record<string, boolean>>({})
  const [generating, setGenerating] = useState(false)
  const [activeAktivitas, setActiveAktivitas] = useState<number>(0)
  const [fullscreenMapId, setFullscreenMapId] = useState<number | null>(null)
  const chartRefs = useRef<Record<number, Chart>>({})

  const cacheKey = `lkpd-cache-${params.id}`

  useEffect(() => {
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        const c = JSON.parse(cached)
        if (c.identitas) setIdentitas({ nama: '', sekolah: '', kelas: '', anggota: [], ...c.identitas })
        if (c.identitasSelesai) setIdentitasSelesai(c.identitasSelesai)
        if (c.jawaban) setJawaban(c.jawaban)
        if (c.tabelData) setTabelData(c.tabelData)
        if (c.diagramData) setDiagramData(c.diagramData)
        if (c.faseSelesai) setFaseSelesai(c.faseSelesai)
      }
    } catch (_) {}
  }, [cacheKey])

  useEffect(() => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ identitas, identitasSelesai, jawaban, tabelData, diagramData, faseSelesai }))
    } catch (_) {}
  }, [identitas, identitasSelesai, jawaban, tabelData, diagramData, faseSelesai, cacheKey])

  useEffect(() => {
    const fetchLkpd = async () => {
      const { data } = await supabase.from('e_lkpd').select('*, kabupaten(nama), jenis_bencana(nama)').eq('id', params.id).single()
      if (data) {
        setLkpd(data)
        const initTabel: Record<number, string[][]> = {}
        const initDiagram: Record<number, string[][]> = {}
        data.pertanyaan?.forEach((a: Aktivitas) => {
          if (a.tipe === 'tabel') initTabel[a.id] = Array(a.jumlah_baris || 3).fill(null).map(() => Array(a.kolom_tabel?.length || 2).fill(''))
          if (a.tipe === 'diagram') initDiagram[a.id] = Array(5).fill(null).map(() => Array(a.kolom_diagram?.length || 2).fill(''))
        })
        setTabelData(prev => ({ ...initTabel, ...prev }))
        setDiagramData(prev => ({ ...initDiagram, ...prev }))
      }
      setLoading(false)
    }
    fetchLkpd()
  }, [params.id])

  const updateTabel = (id: number, row: number, col: number, val: string) => {
    setTabelData(prev => { const u = (prev[id] || []).map(r => [...r]); if (u[row]) u[row][col] = val; return { ...prev, [id]: u } })
  }
  const updateDiagram = (id: number, row: number, col: number, val: string) => {
    setDiagramData(prev => { const u = (prev[id] || []).map(r => [...r]); if (u[row]) u[row][col] = val; return { ...prev, [id]: u } })
  }

  const buatGrafik = (a: Aktivitas) => {
    const data = diagramData[a.id]
    if (!data) return
    const labels = data.map(r => r[0]).filter(Boolean)
    const values = data.map(r => parseFloat(r[1])).filter(v => !isNaN(v))
    if (labels.length === 0) return
    const canvas = document.getElementById(`chart-${a.id}`) as HTMLCanvasElement
    if (!canvas) return
    if (chartRefs.current[a.id]) chartRefs.current[a.id].destroy()
    chartRefs.current[a.id] = new Chart(canvas, {
      type: a.jenis_grafik || 'bar',
      data: { labels, datasets: [{ label: a.kolom_diagram?.[1] || 'Nilai', data: values, backgroundColor: ['#1e3a8a', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'] }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    })
  }

  const getScore = (a: Aktivitas): { benar: number; total: number } | null => {
    if (a.tipe === 'tts') return scoreTts(a, jawaban[a.id])
    if (a.tipe === 'matching') return scoreMatching(a, jawaban[a.id])
    if (a.tipe === 'kategorisasi') return scoreKategorisasi(a, jawaban[a.id])
    if (a.tipe === 'pilihan_ganda') return { benar: jawaban[a.id] === a.jawaban_benar ? 1 : 0, total: 1 }
    return null
  }
  const isAutoGrade = (t: TipeAktivitas) => t === 'tts' || t === 'matching' || t === 'kategorisasi' || t === 'pilihan_ganda'

  const isAnswered = (a: Aktivitas): boolean => {
    if (a.tipe === 'multi') {
      const komp = a.komponen || []
      return komp.some(k => {
        const base = jawaban[`${a.id}__${k.kid}`]
        const tab = jawaban[`${a.id}__${k.kid}_tabel`]
        const dia = jawaban[`${a.id}__${k.kid}_diagram`]
        const pet = jawaban[`${a.id}__${k.kid}_peta`]
        if (base !== undefined && base !== null && base !== '') return true
        if (Array.isArray(tab) && tab.some(r => r.some((c: string, ci: number) => ci !== 0 && c))) return true
        if (Array.isArray(dia) && dia.some(r => r.some((c: string) => c))) return true
        if (Array.isArray(pet) && pet.length > 0) return true
        return false
      })
    }
    const v = jawaban[a.id]
    if (v === undefined || v === null) return false
    if (typeof v === 'object') return Object.keys(v).length > 0 || (Array.isArray(v) && v.length > 0)
    if (typeof v === 'string') return v.length > 0
    return true
  }

  // ============================================================
  // GENERATE PDF
  // ============================================================
  const generatePDF = async () => {
    if (!lkpd) return
    const aktivitas = lkpd.pertanyaan || []
    setGenerating(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: html2canvas } = await import('html2canvas')

      const container = document.createElement('div')
      container.style.cssText = 'width:794px;padding:48px;background:white;font-family:system-ui,sans-serif;position:fixed;top:-9999px;left:-9999px'
      document.body.appendChild(container)

      container.innerHTML = `
        <div style="border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px">
          <div style="background:#1e3a8a;color:white;padding:16px 20px;border-radius:8px;margin-bottom:12px">
            <div style="font-size:10px;font-weight:600;letter-spacing:2px;opacity:0.7;margin-bottom:4px">LEMBAR KERJA PESERTA DIDIK · E-LKPD</div>
            <div style="font-size:20px;font-weight:800;line-height:1.3">${lkpd.judul}</div>
            <div style="font-size:11px;opacity:0.7;margin-top:4px">${lkpd.kabupaten?.nama} · ${lkpd.jenis_bencana?.nama}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
            ${[['Anggota', [identitas.nama, ...(identitas.anggota || [])].filter(Boolean).join(', ')], ['Kelas', identitas.kelas], ['Sekolah', identitas.sekolah]].map(([label, val]) => `
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px">
                <div style="font-size:9px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:3px">${label.toUpperCase()}</div>
                <div style="font-size:13px;font-weight:600;color:#1e293b">${val}</div>
              </div>`).join('')}
          </div>
        </div>`

      if (lkpd.bahan_bacaan) {
        container.innerHTML += `
          <div style="margin-bottom:20px;border:1px solid #dbeafe;border-radius:8px;overflow:hidden">
            <div style="background:#eff6ff;padding:10px 16px;font-size:11px;font-weight:700;color:#1d4ed8;letter-spacing:1px">BAHAN BACAAN</div>
            <div style="padding:14px 16px;font-size:12px;color:#374151;line-height:1.7;white-space:pre-wrap">${lkpd.bahan_bacaan}</div>
          </div>`
      }

      const aktivitasDivs = aktivitas.map((a, index) => {
        const jawabanVal = jawaban[a.id]
        const SDL_BG: Record<string, string> = { SML: '#dbeafe', SPL: '#dcfce7', SRL: '#fee2e2', SRcL: '#fef3c7' }
        const SDL_TXT: Record<string, string> = { SML: '#1d4ed8', SPL: '#15803d', SRL: '#dc2626', SRcL: '#d97706' }
        let jawabanHtml = ''

        if (a.tipe === 'esai') {
          jawabanHtml = `<div style="margin-top:8px"><div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:4px">${a.soal || ''}</div><div style="min-height:80px;border:1px solid #d1d5db;border-radius:6px;padding:10px;font-size:12px;color:${jawabanVal ? '#1e293b' : '#94a3b8'};background:#f9fafb">${jawabanVal || 'Belum dijawab'}</div></div>`
        } else if (a.tipe === 'pilihan_ganda') {
          jawabanHtml = `<div style="margin-top:8px"><div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:8px">${a.soal || ''}</div>${(a.pilihan || []).map((p, pi) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:4px;border-radius:6px;border:1px solid ${jawabanVal === pi ? '#93c5fd' : '#e5e7eb'};background:${jawabanVal === pi ? '#eff6ff' : 'white'}"><div style="width:14px;height:14px;border-radius:50%;border:2px solid ${jawabanVal === pi ? '#1d4ed8' : '#d1d5db'};background:${jawabanVal === pi ? '#1d4ed8' : 'white'}"></div><span style="font-size:11px;color:#374151">${String.fromCharCode(65 + pi)}. ${p}${pi === a.jawaban_benar ? ' ✓' : ''}</span></div>`).join('')}</div>`
        } else if (a.tipe === 'tabel') {
          const tData = tabelData[a.id] || []
          jawabanHtml = `<div style="margin-top:8px"><div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:6px">${a.soal || ''}</div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#1e3a8a">${(a.kolom_tabel || []).map(k => `<th style="padding:8px 10px;color:white;font-weight:600;text-align:left;border:1px solid #1e3a8a">${k}</th>`).join('')}</tr></thead><tbody>${tData.map((row, ri) => `<tr style="background:${ri % 2 === 0 ? 'white' : '#f8fafc'}">${row.map(cell => `<td style="padding:7px 10px;border:1px solid #e2e8f0;color:#374151">${cell || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        } else if (a.tipe === 'tts') {
          const view = buildTtsView(a.tts_kata || [])
          const val: Record<string, string> = jawabanVal || {}
          let gridHtml = '<div style="display:inline-block">'
          for (let r = 0; r < view.rows; r++) {
            gridHtml += '<div style="display:flex">'
            for (let c = 0; c < view.cols; c++) {
              const cell = view.cells.get(`${r},${c}`)
              if (!cell) { gridHtml += '<div style="width:24px;height:24px"></div>'; continue }
              const isHint = view.hint.has(`${r},${c}`)
              const numBadge = cell.nums.length ? `<span style="position:absolute;top:0;left:1px;font-size:6px;color:#2563eb;font-weight:700">${cell.nums.join('/')}</span>` : ''
              if (isHint) { gridHtml += `<div style="width:24px;height:24px;border:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;position:relative;background:#e2e8f0;color:#475569">${numBadge}${cell.letter}</div>`; continue }
              const letter = (val[`${r},${c}`] || '').toUpperCase()
              const ok = letter === cell.letter
              gridHtml += `<div style="width:24px;height:24px;border:1px solid #cbd5e1;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;position:relative;background:${letter ? (ok ? '#dcfce7' : '#fee2e2') : 'white'};color:${ok ? '#15803d' : '#dc2626'}">${numBadge}${letter}</div>`
            }
            gridHtml += '</div>'
          }
          gridHtml += '</div>'
          const clues = (dir: string) => (a.tts_kata || []).filter(k => k.arah === dir).sort((x, y) => x.nomor - y.nomor).map(k => `<div style="font-size:10px;color:#374151;margin-bottom:2px"><b>${k.nomor}.</b> ${k.pertanyaan}</div>`).join('')
          jawabanHtml = `<div style="margin-top:8px;display:flex;gap:16px;flex-wrap:wrap"><div>${gridHtml}</div><div style="flex:1;min-width:200px"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:3px">Mendatar</div>${clues('mendatar')}<div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;margin:6px 0 3px">Menurun</div>${clues('menurun')}</div></div>`
        } else if (a.tipe === 'matching') {
          const val: Record<number, string> = jawabanVal || {}
          jawabanHtml = `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px"><thead><tr style="background:#1e3a8a"><th style="padding:6px 10px;color:white;text-align:left;border:1px solid #1e3a8a">Pernyataan</th><th style="padding:6px 10px;color:white;text-align:left;border:1px solid #1e3a8a">Jawaban Siswa</th></tr></thead><tbody>${(a.match_pairs || []).map((p, i) => { const pilih = val[i] || '—'; const ok = pilih === p.kanan; return `<tr style="background:${ok ? '#f0fdf4' : pilih !== '—' ? '#fef2f2' : 'white'}"><td style="padding:6px 10px;border:1px solid #e2e8f0;color:#374151">${p.kiri}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;color:${ok ? '#15803d' : '#dc2626'};font-weight:600">${pilih} ${pilih !== '—' ? (ok ? '✓' : '✗') : ''}</td></tr>` }).join('')}</tbody></table>`
        } else if (a.tipe === 'kategorisasi') {
          const val: Record<number, string> = jawabanVal || {}
          jawabanHtml = `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:8px"><thead><tr style="background:#1e3a8a"><th style="padding:6px 10px;color:white;text-align:left;border:1px solid #1e3a8a">Item</th><th style="padding:6px 10px;color:white;text-align:left;border:1px solid #1e3a8a">Kategori (Siswa)</th></tr></thead><tbody>${(a.kat_items || []).map((it, i) => { const pilih = val[i] || '—'; const ok = pilih === it.kategori; return `<tr style="background:${ok ? '#f0fdf4' : pilih !== '—' ? '#fef2f2' : 'white'}"><td style="padding:6px 10px;border:1px solid #e2e8f0;color:#374151">${it.item}</td><td style="padding:6px 10px;border:1px solid #e2e8f0;color:${ok ? '#15803d' : '#dc2626'};font-weight:600">${pilih} ${pilih !== '—' ? (ok ? '✓' : '✗') : ''}</td></tr>` }).join('')}</tbody></table>`
        } else if (a.tipe === 'paint') {
          jawabanHtml = `<div style="margin-top:8px">${a.paint_instruksi ? `<div style="font-size:11px;color:#374151;margin-bottom:6px">${a.paint_instruksi}</div>` : ''}${jawabanVal ? `<img src="${jawabanVal}" style="width:100%;border:1px solid #e2e8f0;border-radius:6px" />` : '<div style="height:120px;border:2px dashed #d1d5db;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;font-style:italic">Belum ada gambar</div>'}</div>`
        } else if (a.tipe === 'peta') {
          const petaData = Array.isArray(jawabanVal) ? jawabanVal : []
          jawabanHtml = `<div style="margin-top:8px"><div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:12px"><div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:8px;letter-spacing:1px">OBJEK DIBUAT DI APLIKASI (${petaData.length})</div>${petaData.length === 0 ? '<div style="font-size:11px;color:#94a3b8;font-style:italic">Belum ada objek</div>' : `<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#0369a1"><th style="padding:6px 10px;color:white;text-align:left;border:1px solid #0369a1;width:30px">No</th><th style="padding:6px 10px;color:white;text-align:left;border:1px solid #0369a1">Label</th><th style="padding:6px 10px;color:white;text-align:left;border:1px solid #0369a1">Tipe</th></tr></thead><tbody>${petaData.map((item: any, ii: number) => `<tr style="background:${ii % 2 === 0 ? 'white' : '#f0f9ff'}"><td style="padding:6px 10px;border:1px solid #bae6fd;color:#374151">${ii + 1}</td><td style="padding:6px 10px;border:1px solid #bae6fd;color:#374151;font-weight:600">${item.label}</td><td style="padding:6px 10px;border:1px solid #bae6fd;color:#64748b;text-transform:capitalize">${item.tipe}</td></tr>`).join('')}</tbody></table>`}</div>${a.peta_pertanyaan ? `<div style="margin-top:12px"><div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:6px">${a.peta_pertanyaan}</div><div style="min-height:70px;border:1px solid #d1d5db;border-radius:6px;padding:10px;font-size:11px;color:${jawaban[`${a.id}_analisis`] ? '#1e293b' : '#94a3b8'};background:#f9fafb">${jawaban[`${a.id}_analisis`] || 'Belum dijawab'}</div></div>` : ''}</div>`
        } else if (a.tipe === 'multi') {
          const komps = a.komponen || []
          jawabanHtml = komps.map((k, ki) => {
            const kkey = `${a.id}__${k.kid}`
            let inner = ''
            if (k.tipe === 'esai') {
              const v = jawaban[kkey]
              inner = `${k.soal ? `<div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:4px">${k.soal}</div>` : ''}<div style="min-height:70px;border:1px solid #d1d5db;border-radius:6px;padding:10px;font-size:12px;color:${v ? '#1e293b' : '#94a3b8'};background:#f9fafb">${v || 'Belum dijawab'}</div>`
            } else if (k.tipe === 'pilihan_ganda') {
              const v = jawaban[kkey]
              inner = `${k.soal ? `<div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:8px">${k.soal}</div>` : ''}${(k.pilihan || []).map((p, pi) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;margin-bottom:4px;border-radius:6px;border:1px solid ${v === pi ? '#93c5fd' : '#e5e7eb'};background:${v === pi ? '#eff6ff' : 'white'}"><div style="width:14px;height:14px;border-radius:50%;border:2px solid ${v === pi ? '#1d4ed8' : '#d1d5db'};background:${v === pi ? '#1d4ed8' : 'white'}"></div><span style="font-size:11px;color:#374151">${String.fromCharCode(65 + pi)}. ${p}${pi === k.jawaban_benar ? ' ✓' : ''}</span></div>`).join('')}`
            } else if (k.tipe === 'tabel') {
              const tData = jawaban[`${kkey}_tabel`] || []
              inner = `${k.soal ? `<div style="font-size:11px;color:#374151;margin-bottom:6px">${k.soal}</div>` : ''}<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#1e3a8a">${(k.kolom_tabel || []).map(kol => `<th style="padding:8px 10px;color:white;font-weight:600;text-align:left;border:1px solid #1e3a8a">${kol}</th>`).join('')}</tr></thead><tbody>${(tData.length ? tData : (k.label_terkunci || []).map((lbl: string) => [lbl])).map((row: string[], ri: number) => `<tr style="background:${ri % 2 === 0 ? 'white' : '#f8fafc'}">${(k.kolom_tabel || []).map((_, ci) => `<td style="padding:7px 10px;border:1px solid #e2e8f0;color:#374151">${(row && row[ci]) || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`
            } else if (k.tipe === 'diagram') {
              const dData = jawaban[`${kkey}_diagram`] || []
              inner = `${k.soal ? `<div style="font-size:11px;color:#374151;margin-bottom:6px">${k.soal}</div>` : ''}<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:#1e3a8a">${(k.kolom_diagram || []).map(kol => `<th style="padding:8px 10px;color:white;font-weight:600;text-align:left;border:1px solid #1e3a8a">${kol}</th>`).join('')}</tr></thead><tbody>${dData.map((row: string[], ri: number) => `<tr style="background:${ri % 2 === 0 ? 'white' : '#f8fafc'}">${row.map(cell => `<td style="padding:7px 10px;border:1px solid #e2e8f0;color:#374151">${cell || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`
            } else if (k.tipe === 'paint') {
              const v = jawaban[kkey]
              inner = `${k.paint_instruksi ? `<div style="font-size:11px;color:#374151;margin-bottom:6px">${k.paint_instruksi}</div>` : ''}${v ? `<img src="${v}" style="width:100%;border:1px solid #e2e8f0;border-radius:6px" />` : '<div style="height:120px;border:2px dashed #d1d5db;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;font-style:italic">Belum ada gambar</div>'}`
            } else if (k.tipe === 'peta') {
              const pd = jawaban[`${kkey}_peta`]
              const petaData = Array.isArray(pd) ? pd : []
              const v = jawaban[kkey]
              inner = `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:10px"><div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:6px">OBJEK DI PETA (${petaData.length})</div>${petaData.length === 0 ? '<div style="font-size:11px;color:#94a3b8;font-style:italic">Belum ada objek</div>' : `<table style="width:100%;border-collapse:collapse;font-size:11px"><tbody>${petaData.map((item: any, ii: number) => `<tr><td style="padding:5px 8px;border:1px solid #bae6fd;color:#374151;width:24px">${ii + 1}</td><td style="padding:5px 8px;border:1px solid #bae6fd;color:#374151;font-weight:600">${item.label}</td><td style="padding:5px 8px;border:1px solid #bae6fd;color:#64748b">${item.tipe}</td></tr>`).join('')}</tbody></table>`}</div>${k.peta_pertanyaan ? `<div style="margin-top:8px"><div style="font-size:11px;font-weight:600;color:#374151;margin-bottom:4px">${k.peta_pertanyaan}</div><div style="min-height:60px;border:1px solid #d1d5db;border-radius:6px;padding:10px;font-size:11px;color:${v ? '#1e293b' : '#94a3b8'};background:#f9fafb">${v || 'Belum dijawab'}</div></div>` : ''}`
            }
            const labelKomp = ({ esai: 'Pertanyaan', pilihan_ganda: 'Pilihan Ganda', tabel: 'Isi Tabel', diagram: 'Diagram', paint: 'Menggambar', peta: 'Peta' } as any)[k.tipe] || k.tipe
            return `<div style="margin-bottom:14px"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${ki + 1}. ${labelKomp}</div>${inner}</div>`
          }).join('')
        }

        const sdlKode = (a.kode_sdl || '').split(',').map(s => s.trim()).filter(Boolean)
        const sdlBadge = sdlKode.length ? `<div style="display:flex;gap:4px">${sdlKode.map(kd => `<div style="background:${SDL_BG[kd] || '#f1f5f9'};color:${SDL_TXT[kd] || '#64748b'};padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700">${kd}</div>`).join('')}</div>` : ''
        return `<div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;page-break-inside:avoid"><div style="background:#1e3a8a;padding:12px 16px;display:flex;align-items:center;justify-content:space-between"><div style="display:flex;align-items:center;gap:10px"><div style="background:rgba(255,255,255,0.15);width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:800">${index + 1}</div><div><div style="color:white;font-size:13px;font-weight:700">${a.judul}</div><div style="color:rgba(255,255,255,0.6);font-size:10px;text-transform:capitalize">${a.tipe.replace('_', ' ')}${a.fase ? ' · ' + a.fase : ''}</div></div></div>${sdlBadge}</div><div style="padding:14px 16px;background:#eff6ff;border-bottom:1px solid #dbeafe"><div style="font-size:9px;font-weight:700;color:#1d4ed8;letter-spacing:1px;margin-bottom:3px">INSTRUKSI</div>${(() => { const { steps, bernomor } = parseLangkah(a.instruksi); if (bernomor && steps.length > 1) return `<ol style="margin:0;padding-left:0;list-style:none">${steps.map((s, si) => `<li style="display:flex;gap:6px;font-size:11px;color:#1e40af;margin-bottom:3px"><span style="flex-shrink:0;width:15px;height:15px;border-radius:50%;background:#2563eb;color:white;font-size:8px;font-weight:700;display:flex;align-items:center;justify-content:center">${si + 1}</span><span>${s}</span></li>`).join('')}</ol>`; return `<div style="font-size:11px;color:#1e40af">${a.instruksi}</div>` })()}</div><div style="padding:14px 16px">${jawabanHtml}</div></div>`
      }).join('')

      container.innerHTML += `<div>${aktivitasDivs}</div>`
      container.innerHTML += `<div style="margin-top:24px;border-top:2px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8"><span>Lampung Edu Gisaster · FKIP Universitas Lampung</span><span>Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>`

      const canvas = await html2canvas(container, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', width: 794 })
      document.body.removeChild(container)

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height * pageW) / canvas.width
      let yPos = 0
      while (yPos < imgH) {
        if (yPos > 0) pdf.addPage()
        const srcY = (yPos / imgH) * canvas.height
        const srcH = Math.min((pageH / imgH) * canvas.height, canvas.height - srcY)
        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width; sliceCanvas.height = srcH
        const ctx = sliceCanvas.getContext('2d')!
        ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH)
        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, (srcH * pageW) / canvas.width)
        yPos += pageH
      }
      pdf.save(`LKPD_${lkpd.judul.replace(/\s+/g, '_')}_${identitas.nama.replace(/\s+/g, '_')}.pdf`)
    } catch (e) {
      console.error('Gagal generate PDF:', e)
      alert('Gagal generate PDF. Pastikan sudah install: npm install jspdf html2canvas')
    }
    setGenerating(false)
  }

  const progress = lkpd ? Math.round((lkpd.pertanyaan.filter(isAnswered).length / (lkpd.pertanyaan?.length || 1)) * 100) : 0

  if (loading) return (<div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>)
  if (!lkpd) return (<div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">E-LKPD tidak ditemukan</p></div>)

  // ── Halaman Identitas ──
  if (!identitasSelesai) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-br from-blue-950 to-blue-900 rounded-2xl p-6 mb-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
            </div>
            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider">E-LKPD</span>
          </div>
          <h1 className="text-lg font-bold leading-snug mb-1">{lkpd.judul}</h1>
          <p className="text-blue-200/70 text-xs">{lkpd.kabupaten?.nama} · {lkpd.jenis_bencana?.nama}</p>
          {(lkpd.prinsip_pembelajaran || []).length > 0 && (
            <div className="mt-3 flex gap-1.5 flex-wrap">{(lkpd.prinsip_pembelajaran || []).map(p => <span key={p} className="text-[10px] bg-white/10 text-blue-100 px-2 py-0.5 rounded-full">{p}</span>)}</div>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-blue-200/60"><span>{lkpd.pertanyaan?.length || 0} aktivitas</span><span>·</span><span>Pembelajaran Mendalam</span></div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 text-sm mb-1">Isi Identitas Dulu</h2><p className="text-[11px] text-gray-400 mb-4">Bisa perorangan atau kelompok — tambahkan anggota bila mengerjakan berkelompok.</p>
          <div className="flex flex-col gap-3">
            <div><label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Nama {(identitas.anggota.length > 0) ? '(Ketua Kelompok)' : 'Lengkap'}</label><input className={inp} placeholder="Nama lengkap" value={identitas.nama} onChange={e => setIdentitas({ ...identitas, nama: e.target.value })} /></div>

            {/* Anggota tambahan */}
            {identitas.anggota.map((ang, ai) => (
              <div key={ai}>
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Anggota {ai + 2}</label>
                <div className="flex gap-2">
                  <input className={inp} placeholder={`Nama anggota ${ai + 2}`} value={ang}
                    onChange={e => { const na = [...identitas.anggota]; na[ai] = e.target.value; setIdentitas({ ...identitas, anggota: na }) }} />
                  <button type="button" onClick={() => setIdentitas({ ...identitas, anggota: identitas.anggota.filter((_, i) => i !== ai) })}
                    className="text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-xl px-3 text-sm transition-all flex-shrink-0">✕</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setIdentitas({ ...identitas, anggota: [...identitas.anggota, ''] })}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-dashed border-blue-200 rounded-xl py-2 hover:bg-blue-50 transition-all">
              + Tambah Anggota Kelompok
            </button>

            <div><label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Nama Sekolah</label><input className={inp} placeholder="SMA/MA/SMK..." value={identitas.sekolah} onChange={e => setIdentitas({ ...identitas, sekolah: e.target.value })} /></div>
            <div><label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Kelas</label><input className={inp} placeholder="cth: XI IPS 2" value={identitas.kelas} onChange={e => setIdentitas({ ...identitas, kelas: e.target.value })} /></div>
            <button onClick={() => { if (!identitas.nama || !identitas.sekolah || !identitas.kelas) { alert('Lengkapi nama, sekolah, dan kelas!'); return } if (identitas.anggota.some(x => !x.trim())) { alert('Lengkapi nama semua anggota, atau hapus yang kosong!'); return } setIdentitasSelesai(true) }} className="mt-2 w-full bg-blue-950 hover:bg-blue-900 text-white py-3 rounded-xl font-semibold text-sm transition-all">Mulai Mengerjakan →</button>
          </div>
        </div>
      </div>
    </div>
  )

  const aktivitas = lkpd.pertanyaan || []

  // ── Halaman Utama ──
  return (
    <div className="min-h-screen bg-gray-50" id="lkpd-print">
      <style>{`@media print { .no-print{display:none!important} #lkpd-sidebar{display:none!important} body{background:white} }`}</style>

      {/* Top bar */}
      <div className="no-print sticky top-16 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{lkpd.judul}</p>
            <p className="text-[10px] text-gray-400">{lkpd.kabupaten?.nama} · {lkpd.jenis_bencana?.nama}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} /></div>
              <span className="text-[11px] text-gray-500">{progress}%</span>
            </div>
            <button onClick={generatePDF} disabled={generating} className="flex items-center gap-1.5 text-xs bg-blue-950 text-white px-3 py-1.5 rounded-lg hover:bg-blue-900 transition-all font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" /></svg>
              {generating ? 'Generating PDF...' : 'Cetak PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 flex gap-6">
        {/* Sidebar */}
        <div id="lkpd-sidebar" className="no-print w-52 flex-shrink-0">
          <div className="sticky top-36">
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Identitas</p>
              <p className="text-xs font-semibold text-gray-800">{[identitas.nama, ...(identitas.anggota || [])].filter(Boolean).join(', ')}</p>
              <p className="text-[11px] text-gray-500">{identitas.kelas}</p>
              <p className="text-[11px] text-gray-400 truncate">{identitas.sekolah}</p>
              <button onClick={() => { if (!confirm('Hapus semua jawaban dan mulai ulang?')) return; localStorage.removeItem(cacheKey); setIdentitas({ nama: '', sekolah: '', kelas: '', anggota: [] }); setIdentitasSelesai(false); setJawaban({}); setFaseSelesai({}) }} className="mt-3 w-full text-[10px] text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg py-1.5 transition-all">Mulai Ulang</button>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-4 py-3 border-b border-gray-100">Aktivitas</p>
              {aktivitas.map((a: Aktivitas, i: number) => (
                <button key={a.id} onClick={() => { setActiveAktivitas(i); document.getElementById(`aktivitas-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all border-b border-gray-50 last:border-0 ${activeAktivitas === i ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${faseSelesai[a.fase || 'Memahami'] ? 'bg-blue-950 text-white' : isAnswered(a) ? 'bg-green-500 text-white' : activeAktivitas === i ? 'bg-blue-900 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {faseSelesai[a.fase || 'Memahami'] ? '🔒' : isAnswered(a) ? '✓' : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className={`text-[11px] truncate font-medium block ${activeAktivitas === i ? 'text-blue-800' : 'text-gray-600'}`}>{a.judul}</span>
                    <span className={`text-[9px] ${(a.fase || 'Memahami') === 'Memahami' ? 'text-blue-400' : (a.fase || 'Memahami') === 'Mengaplikasi' ? 'text-green-500' : 'text-amber-500'}`}>{a.fase || 'Memahami'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Konten */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <div className="hidden print:block text-center border-b-2 pb-4 mb-4">
            <h1 className="text-xl font-bold">LEMBAR KERJA PESERTA DIDIK</h1>
            <h2 className="text-base mt-1">{lkpd.judul}</h2>
            <p className="text-sm text-gray-500">{lkpd.kabupaten?.nama} — {lkpd.jenis_bencana?.nama}</p>
          </div>

          {FASE_URUT.map(fase => {
            const faseAktivitas = aktivitas.filter((a: Aktivitas) => (a.fase || 'Memahami') === fase)
            if (faseAktivitas.length === 0) return null
            const FASE_STYLE = {
              Memahami: { bar: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: '📖' },
              Mengaplikasi: { bar: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200', icon: '🔬' },
              Merefleksi: { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: '💭' },
            }
            const fs = FASE_STYLE[fase]
            const locked = !!faseSelesai[fase]
            const revealed = locked
            const gradeItems = faseAktivitas.filter(a => isAutoGrade(a.tipe))
            const totalBenar = gradeItems.reduce((s, a) => s + (getScore(a)?.benar || 0), 0)
            const totalSoal = gradeItems.reduce((s, a) => s + (getScore(a)?.total || 0), 0)
            const belumDijawab = faseAktivitas.filter(a => !isAnswered(a)).length

            return (
              <div key={fase}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${fs.badge}`}><span>{fs.icon}</span> Fase {fase}</div>
                  {locked && <span className="text-[10px] text-gray-400 flex items-center gap-1">🔒 Terkunci</span>}
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Bahan Bacaan — awal Fase Memahami, tampil terformat */}
                {fase === 'Memahami' && lkpd.bahan_bacaan && (
                  <div className="bg-white border border-blue-100 rounded-2xl overflow-hidden mb-5 shadow-sm">
                    <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3.5 flex items-center gap-2.5">
                      <span className="text-lg">📚</span>
                      <div>
                        <p className="text-[11px] font-bold text-white uppercase tracking-wide">Bahan Bacaan</p>
                        <p className="text-[10px] text-blue-100">Baca dengan teliti — semua jawaban aktivitas ada di sini</p>
                      </div>
                    </div>
                    <BahanBacaan text={lkpd.bahan_bacaan} />
                  </div>
                )}

                {faseAktivitas.map((a: Aktivitas) => {
                  const index = aktivitas.indexOf(a)
                  return (
                    <div key={a.id} id={`aktivitas-${index}`} className="bg-white border border-gray-200 rounded-2xl overflow-hidden scroll-mt-36 mb-5">
                      <div className={`h-1 ${fs.bar}`} />
                      <div className="bg-gradient-to-r from-blue-950 to-blue-900 px-6 py-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-white font-bold text-sm">{index + 1}</span></div>
                            <div className="min-w-0"><p className="text-white font-bold text-sm leading-tight truncate">{a.judul}</p><p className="text-blue-300/70 text-[10px] mt-0.5 capitalize">{a.tipe.replace('_', ' ')}</p></div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {a.dimensi_st && <span className="text-[9px] bg-white/10 text-blue-100 px-2 py-1 rounded-full hidden sm:inline">{a.dimensi_st}</span>}
                            {(a.kode_sdl || '').split(',').map(s => s.trim()).filter(Boolean).map(kd => (
                              <span key={kd} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${SDL_COLOR[kd] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>{kd}</span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="px-6 py-5">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-5">
                          <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wide mb-1.5">Instruksi</p>
                          {(() => {
                            const { steps, bernomor } = parseLangkah(a.instruksi)
                            if (bernomor && steps.length > 1) return (
                              <ol className="flex flex-col gap-1.5">
                                {steps.map((s, si) => (
                                  <li key={si} className="flex gap-2 text-sm text-blue-800 leading-relaxed">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{si + 1}</span>
                                    <span className="flex-1">{s}</span>
                                  </li>
                                ))}
                              </ol>
                            )
                            return <p className="text-sm text-blue-800 leading-relaxed">{a.instruksi}</p>
                          })()}
                        </div>

                        {(a.literasi_bencana || a.literasi_spasial) && (
                          <div className="grid sm:grid-cols-2 gap-2 mb-5">
                            {a.literasi_bencana && <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"><p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Literasi Bencana</p><p className="text-[12px] text-gray-600 leading-snug">{a.literasi_bencana}</p></div>}
                            {a.literasi_spasial && <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"><p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Literasi Spasial</p><p className="text-[12px] text-gray-600 leading-snug">{a.literasi_spasial}</p></div>}
                          </div>
                        )}

                        {a.ada_peta && (
                          <div className="no-print mb-5">
                            <div className="relative rounded-xl overflow-hidden border border-gray-200" style={{ height: '380px', isolation: 'isolate' }}>
                              <MapComponent mapId={`map-lkpd-${a.id}`} height="380px" />
                              <button onClick={() => setFullscreenMapId(a.id)} className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 bg-white border border-gray-200 shadow-md px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                                Peta Penuh
                              </button>
                            </div>
                          </div>
                        )}

                        {a.soal && a.tipe !== 'tts' && <p className="text-sm font-semibold text-gray-800 mb-3 leading-relaxed">{a.soal}</p>}

                        {/* ESAI */}
                        {a.tipe === 'esai' && (
                          <textarea disabled={locked} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all resize-none bg-gray-50 focus:bg-white disabled:opacity-70 disabled:cursor-not-allowed"
                            rows={6} placeholder="Tulis jawabanmu di sini..." value={jawaban[a.id] || ''} onChange={e => setJawaban({ ...jawaban, [a.id]: e.target.value })} />
                        )}

                        {/* PILIHAN GANDA — hasil hanya tampil setelah fase dikunci */}
                        {a.tipe === 'pilihan_ganda' && (
                          <div className="flex flex-col gap-2">
                            {a.pilihan?.map((p: string, pi: number) => {
                              const dipilih = jawaban[a.id] === pi
                              const benar = pi === a.jawaban_benar
                              return (
                                <label key={pi} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${locked ? 'cursor-default' : 'cursor-pointer'}
                                  ${revealed && dipilih && benar ? 'bg-green-50 border-green-300' : revealed && dipilih && !benar ? 'bg-red-50 border-red-300' : revealed && benar ? 'bg-green-50 border-green-200' : dipilih ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${revealed && dipilih && benar ? 'border-green-500 bg-green-500' : revealed && dipilih && !benar ? 'border-red-500 bg-red-500' : revealed && benar ? 'border-green-400' : dipilih ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                                    {dipilih && <span className="text-white text-[9px]">●</span>}
                                  </div>
                                  <input type="radio" name={`pg-${a.id}`} value={pi} checked={dipilih} disabled={locked} onChange={() => setJawaban({ ...jawaban, [a.id]: pi })} className="hidden" />
                                  <span className="text-sm text-gray-700">{p}</span>
                                  {revealed && benar && <span className="ml-auto text-[10px] text-green-600 font-bold">✓ Benar</span>}
                                  {revealed && dipilih && !benar && <span className="ml-auto text-[10px] text-red-500 font-bold">✗ Pilihanmu</span>}
                                </label>
                              )
                            })}
                          </div>
                        )}

                        {/* TABEL */}
                        {a.tipe === 'tabel' && (
                          <div className="overflow-x-auto rounded-xl border-2 border-gray-300">
                            <table className="w-full text-sm border-collapse">
                              <thead><tr className="bg-blue-950">{a.kolom_tabel?.map((k: string, ki: number) => <th key={ki} className="text-left px-4 py-3 text-white text-[11px] font-semibold uppercase tracking-wide border-r border-blue-800 last:border-r-0">{k}</th>)}</tr></thead>
                              <tbody>{tabelData[a.id]?.map((row, ri) => (<tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'}>{row.map((cell, ci) => <td key={ci} className="border border-gray-300 px-1 py-0.5 min-w-[120px]"><input disabled={locked} className="w-full px-2 py-2 text-sm text-gray-700 bg-transparent outline-none focus:bg-amber-50 rounded transition-all disabled:cursor-not-allowed" placeholder="—" value={cell} onChange={e => updateTabel(a.id, ri, ci, e.target.value)} /></td>)}</tr>))}</tbody>
                            </table>
                          </div>
                        )}

                        {/* DIAGRAM */}
                        {a.tipe === 'diagram' && (
                          <div>
                            <div className="overflow-x-auto rounded-xl border-2 border-gray-300 mb-3">
                              <table className="w-full text-sm border-collapse">
                                <thead><tr className="bg-blue-950">{a.kolom_diagram?.map((k: string, ki: number) => <th key={ki} className="text-left px-4 py-3 text-white text-[11px] font-semibold uppercase tracking-wide border-r border-blue-800 last:border-r-0">{k}</th>)}</tr></thead>
                                <tbody>{diagramData[a.id]?.map((row, ri) => (<tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'}>{row.map((cell, ci) => <td key={ci} className="border border-gray-300 px-1 py-0.5 min-w-[120px]"><input disabled={locked} className="w-full px-2 py-2 text-sm text-gray-700 bg-transparent outline-none focus:bg-amber-50 rounded transition-all disabled:cursor-not-allowed" placeholder="—" value={cell} onChange={e => updateDiagram(a.id, ri, ci, e.target.value)} /></td>)}</tr>))}</tbody>
                              </table>
                            </div>
                            {!locked && <button onClick={() => buatGrafik(a)} className="no-print text-xs bg-blue-950 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-900 transition-all">Buat Grafik</button>}
                            <div className="mt-3 rounded-xl overflow-hidden" style={{ maxHeight: '200px' }}><canvas id={`chart-${a.id}`} /></div>
                          </div>
                        )}

                        {/* PETA */}
                        {a.tipe === 'peta' && (
                          <div className="flex flex-col gap-3" style={{ isolation: 'isolate' }}>
                            <MapDraw aktivitasId={a.id} mode={a.peta_mode || 'keduanya'} onDataChange={(data) => { if (!locked) setTimeout(() => setJawaban(prev => ({ ...prev, [a.id]: data })), 0) }} />
                            {a.peta_pertanyaan && (
                              <div>
                                <p className="text-sm font-semibold text-gray-800 mb-2">{a.peta_pertanyaan}</p>
                                <textarea disabled={locked} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all resize-none bg-gray-50 focus:bg-white disabled:opacity-70 disabled:cursor-not-allowed" rows={4} placeholder="Tulis analisismu berdasarkan gambar di peta..." value={jawaban[`${a.id}_analisis`] || ''} onChange={e => setJawaban(prev => ({ ...prev, [`${a.id}_analisis`]: e.target.value }))} />
                              </div>
                            )}
                          </div>
                        )}

                        {a.tipe === 'tts' && <TtsPlayer a={a} value={jawaban[a.id] || {}} revealed={revealed} locked={locked} onChange={v => setJawaban({ ...jawaban, [a.id]: v })} />}
                        {a.tipe === 'matching' && <MatchingPlayer a={a} value={jawaban[a.id] || {}} revealed={revealed} locked={locked} onChange={v => setJawaban({ ...jawaban, [a.id]: v })} />}
                        {a.tipe === 'kategorisasi' && <KategorisasiPlayer a={a} value={jawaban[a.id] || {}} revealed={revealed} locked={locked} onChange={v => setJawaban({ ...jawaban, [a.id]: v })} />}
                        {a.tipe === 'paint' && (<div className="flex flex-col gap-2">{a.paint_instruksi && <p className="text-sm text-gray-700">{a.paint_instruksi}</p>}<PaintCanvas a={a} value={jawaban[a.id] || ''} locked={locked} onChange={v => setJawaban({ ...jawaban, [a.id]: v })} /></div>)}
                        {a.tipe === 'multi' && <MultiRenderer a={a} jawaban={jawaban} setJawaban={updater => setJawaban(updater)} locked={locked} revealed={revealed} />}

                        {/* Skor per aktivitas — hanya setelah fase dikunci */}
                        {locked && isAutoGrade(a.tipe) && (() => {
                          const s = getScore(a)!
                          return (
                            <div className={`mt-4 text-sm font-bold px-3 py-2 rounded-lg inline-block ${s.benar === s.total ? 'bg-green-50 text-green-700' : s.benar > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                              Skor: {s.benar} / {s.total} benar{s.total > 0 ? ` (${Math.round((s.benar / s.total) * 100)}%)` : ''}
                            </div>
                          )
                        })()}

                        {isAnswered(a) && !locked && !isAutoGrade(a.tipe) && (
                          <p className="mt-3 text-[11px] text-green-600 font-medium flex items-center gap-1"><span>✓</span> Jawaban disimpan</p>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* ── Tombol Selesai & Periksa per FASE ── */}
                <div className="no-print mb-2">
                  {!locked ? (
                    <button onClick={() => {
                      let pesan = `Kunci semua jawaban Fase ${fase}?\n\nSetelah dikunci, jawaban TIDAK bisa diubah lagi`
                      if (gradeItems.length > 0) pesan += ` dan skor akan ditampilkan`
                      pesan += '.'
                      if (belumDijawab > 0) pesan += `\n\n⚠ Masih ada ${belumDijawab} aktivitas yang belum dijawab.`
                      if (confirm(pesan)) setFaseSelesai(p => ({ ...p, [fase]: true }))
                    }}
                      className="w-full bg-blue-950 hover:bg-blue-900 text-white py-3 rounded-2xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      Selesai Fase {fase} & Periksa Jawaban
                    </button>
                  ) : (
                    <div className={`rounded-2xl border p-4 flex items-center justify-between gap-3 flex-wrap ${gradeItems.length > 0 ? 'bg-blue-50/60 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔒</span>
                        <div>
                          <p className="text-sm font-bold text-gray-800">Fase {fase} selesai & terkunci</p>
                          {gradeItems.length > 0
                            ? <p className="text-xs text-gray-500">Skor objektif: <b className="text-blue-700">{totalBenar} / {totalSoal}</b> {totalSoal > 0 ? `(${Math.round((totalBenar / totalSoal) * 100)}%)` : ''} · {gradeItems.length} aktivitas dinilai otomatis</p>
                            : <p className="text-xs text-gray-500">Jawaban telah difinalisasi (tidak ada penilaian otomatis di fase ini)</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Footer */}
          <div className="no-print bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">{aktivitas.filter(isAnswered).length} dari {aktivitas.length} aktivitas selesai</p>
              <p className="text-xs text-gray-400 mt-0.5">Kunci tiap fase untuk melihat skor, lalu cetak PDF di akhir</p>
            </div>
            <button onClick={generatePDF} disabled={generating} className="bg-blue-950 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-900 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" /></svg>
              {generating ? 'Generating...' : 'Cetak / Download PDF'}
            </button>
          </div>
        </div>
      </div>

      {fullscreenMapId !== null && (
        <div className="fixed inset-0 z-[9999] flex flex-col">
          <div className="flex items-center justify-between bg-blue-950 px-4 py-2.5 flex-shrink-0">
            <p className="text-white text-sm font-semibold">Peta Bencana Interaktif</p>
            <button onClick={() => setFullscreenMapId(null)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              Tutup
            </button>
          </div>
          <div className="flex-1"><MapComponent mapId={`map-lkpd-${fullscreenMapId}-full`} height="100%" /></div>
        </div>
      )}
    </div>
  )
}