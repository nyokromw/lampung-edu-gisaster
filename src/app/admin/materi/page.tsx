'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import KuisInteraktif, { buatKisi, tipeKuis, validasiKuis, type Kuis, type TipeKuis, type PilihanGanda, type Matching, type PetaDragDrop, type TTS, type KataTTS, type CariKata, type PosisiCari } from '../../materi/KuisInteraktif'

const BUCKET = 'pembelajaran-assets'
const FOLDER = 'materi'

interface JenisBencana { id: number; nama: string }

type Blok =
  | { id: string; tipe: 'teks'; isi: string }
  | { id: string; tipe: 'gambar'; url: string; caption: string; sumberGambar: 'link' | 'upload'; storagePath?: string }
  | { id: string; tipe: 'video'; youtubeUrl: string }
  | { id: string; tipe: 'html'; kode: string }

type TahapId = 'memahami' | 'mengaplikasi' | 'merefleksi'
const TAHAP: { id: TahapId; judul: string; panduan: string }[] = [
  { id: 'memahami', judul: 'Memahami', panduan: 'Bangun konsep, amati fenomena, dan ajukan pertanyaan.' },
  { id: 'mengaplikasi', judul: 'Mengaplikasi', panduan: 'Gunakan pengetahuan untuk membaca data, peta, atau kasus nyata.' },
  { id: 'merefleksi', judul: 'Merefleksi', panduan: 'Tinjau kembali proses, temuan, dan keputusan yang dibuat.' },
]
interface Segmen {
  id: string; judul: string; blok: Blok[]; kuis: Kuis | null
  tahap?: TahapId; jenis?: 'tahap' | 'subbab' | 'kuis'; deskripsi?: string
}

// Tetap disimpan pada kolom JSON `segmen`; data lama dipindahkan ke tahap Memahami.
function normalisasiSegmen(raw: Segmen[] | null): Segmen[] {
  const asal = Array.isArray(raw) ? raw : []
  const hasil: Segmen[] = []
  for (const tahap of TAHAP) {
    const meta = asal.find(s => s.jenis === 'tahap' && s.tahap === tahap.id)
    hasil.push(meta ? { ...meta, judul: tahap.judul, blok: [], kuis: null } :
      { id: `tahap-${tahap.id}`, tahap: tahap.id, jenis: 'tahap', judul: tahap.judul, deskripsi: '', blok: [], kuis: null })
    for (const sg of asal.filter(s => s.jenis !== 'tahap' && (s.tahap || 'memahami') === tahap.id)) {
      if (sg.jenis === 'kuis') {
        hasil.push({ ...sg, tahap: tahap.id, jenis: 'kuis', blok: [], kuis: sg.kuis })
      } else {
        hasil.push({ ...sg, tahap: tahap.id, jenis: 'subbab', blok: Array.isArray(sg.blok) ? sg.blok : [], kuis: null })
        if (sg.kuis) hasil.push({ id: `${sg.id}-kuis`, tahap: tahap.id, jenis: 'kuis', judul: '', blok: [], kuis: sg.kuis })
      }
    }
  }
  return hasil
}

interface MateriItem {
  id: string; judul: string; published: boolean; is_konsep_dasar: boolean
  jenis_bencana_id: number | null; jenis_bencana: { nama: string } | null
  segmen: Segmen[] | null
}

const uid = () => Math.random().toString(36).slice(2, 10)

function ytId(url: string): string | null {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : (url.length === 11 ? url : null)
}

function HtmlEmbed({ kode }: { kode: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [tinggi, setTinggi] = useState(720)
  const dokumen = /<!doctype\s+html|<(?:html|head|body|script|style)(?:\s|>)/i.test(kode)
  useEffect(() => {
    if (!dokumen) return
    setTinggi(720)
    const resize = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.tipe !== 'tinggi-embed-materi') return
      const n = event.data.tinggi
      if (typeof n === 'number' && Number.isFinite(n)) setTinggi(Math.max(200, Math.min(6000, Math.ceil(n))))
    }
    window.addEventListener('message', resize)
    return () => window.removeEventListener('message', resize)
  }, [kode, dokumen])
  if (!dokumen) return <div dangerouslySetInnerHTML={{ __html: kode }} />

  const pengukur = `<script>(function(){var kirim=function(){parent.postMessage({tipe:'tinggi-embed-materi',tinggi:document.body.scrollHeight+4},'*')};addEventListener('load',kirim);new ResizeObserver(kirim).observe(document.body);setTimeout(kirim,100);setTimeout(kirim,800)})();<\/script>`
  const srcDoc = /<\/body\s*>/i.test(kode) ? kode.replace(/<\/body\s*>/i, `${pengukur}</body>`) : `${kode}\n${pengukur}`
  return <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
    <div className="flex justify-end border-b border-gray-100 px-3 py-2"><button type="button" onClick={() => iframeRef.current?.requestFullscreen()}
      className="text-xs font-medium text-teal-700 hover:underline">Lihat layar penuh ↗</button></div>
    <iframe ref={iframeRef} title="Pratinjau aktivitas HTML" srcDoc={srcDoc} sandbox="allow-scripts" allowFullScreen
      className="block w-full border-0" style={{ height: tinggi }} />
  </div>
}

// ── Upload helper ──
async function uploadGambar(file: File): Promise<{ url: string; path: string } | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const fileName = `${FOLDER}/${Date.now()}_${uid()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { upsert: false })
  if (error) { alert('Upload gagal: ' + error.message); return null }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
  return { url: pub.publicUrl, path: fileName }
}

async function hapusGambarStorage(path: string) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}

const blokMeta: Record<Blok['tipe'], { label: string; warna: string; ikon: string }> = {
  teks: { label: 'Teks', warna: 'bg-blue-50 text-blue-700 border-blue-200', ikon: '¶' },
  gambar: { label: 'Gambar', warna: 'bg-green-50 text-green-700 border-green-200', ikon: '🖼' },
  video: { label: 'Video YouTube', warna: 'bg-red-50 text-red-700 border-red-200', ikon: '▶' },
  html: { label: 'Embed HTML', warna: 'bg-purple-50 text-purple-700 border-purple-200', ikon: '</>' },
}

// ── Komponen upload gambar (reusable) ──
function GambarUploader({ url, storagePath, onUploaded, onRemove, label }: {
  url?: string; storagePath?: string
  onUploaded: (url: string, path: string) => void
  onRemove: () => void
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('File harus berupa gambar (JPG, PNG, GIF, WebP).'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Ukuran file maksimum 10 MB.'); return }
    setUploading(true)
    // Hapus file lama kalau ada (ganti gambar)
    if (storagePath) await hapusGambarStorage(storagePath)
    const result = await uploadGambar(file)
    if (result) onUploaded(result.url, result.path)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleRemove = async () => {
    if (storagePath) await hapusGambarStorage(storagePath)
    onRemove()
  }

  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-[11px] font-medium text-gray-500">{label}</p>}
      {url ? (
        <div className="relative group">
          <img src={url} alt="" className="max-h-44 rounded-lg border border-gray-100 object-contain bg-gray-50" />
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button onClick={() => inputRef.current?.click()} title="Ganti gambar"
              className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-xs hover:bg-blue-50 hover:border-blue-300 text-blue-600">⟳</button>
            <button onClick={handleRemove} title="Hapus gambar"
              className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-xs hover:bg-red-50 hover:border-red-300 text-red-500">✕</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-teal-300 hover:bg-teal-50/30 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploading
            ? <span className="text-sm text-teal-600 font-medium animate-pulse">Mengupload...</span>
            : (
              <span className="flex flex-col items-center gap-1">
                <span className="text-2xl">📁</span>
                <span className="text-sm text-gray-500">Klik untuk upload gambar</span>
                <span className="text-[10px] text-gray-400">JPG, PNG, GIF, WebP — maks 10 MB</span>
              </span>
            )}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ── Editor per blok ──
function BlokEditor({ blok, onChange, onHapus, onNaik, onTurun, bisaNaik, bisaTurun }: {
  blok: Blok; onChange: (b: Blok) => void; onHapus: () => void
  onNaik: () => void; onTurun: () => void; bisaNaik: boolean; bisaTurun: boolean
}) {
  const meta = blokMeta[blok.tipe]
  const ta = "border border-gray-200 bg-white p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"

  // Tab state untuk blok gambar: 'upload' atau 'link'
  const [tabGambar, setTabGambar] = useState<'upload' | 'link'>(
    blok.tipe === 'gambar' ? (blok.sumberGambar || (blok.storagePath ? 'upload' : 'link')) : 'upload'
  )

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.warna}`}>{meta.label}</span>
        <div className="flex-1" />
        <button onClick={onNaik} disabled={!bisaNaik} title="Naik"
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30">↑</button>
        <button onClick={onTurun} disabled={!bisaTurun} title="Turun"
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30">↓</button>
        <button onClick={onHapus} title="Hapus blok"
          className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:bg-red-50">✕</button>
      </div>
      <div className="p-3">
        {blok.tipe === 'teks' && (
          <textarea className={ta} rows={4} placeholder="Tulis teks materi..."
            value={blok.isi} onChange={e => onChange({ ...blok, isi: e.target.value })} />
        )}

        {blok.tipe === 'gambar' && (
          <div className="flex flex-col gap-3">
            {/* Tab selector */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 self-start">
              <button onClick={() => setTabGambar('upload')}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-md transition-colors ${tabGambar === 'upload' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
                📁 Upload File
              </button>
              <button onClick={() => setTabGambar('link')}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-md transition-colors ${tabGambar === 'link' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
                🔗 Link URL
              </button>
            </div>

            {tabGambar === 'upload' ? (
              <GambarUploader
                url={blok.sumberGambar === 'upload' ? blok.url : undefined}
                storagePath={blok.storagePath}
                onUploaded={(url, path) => onChange({ ...blok, url, sumberGambar: 'upload', storagePath: path })}
                onRemove={() => onChange({ ...blok, url: '', sumberGambar: 'upload', storagePath: undefined })}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <input className={ta} placeholder="URL gambar (https://...)"
                  value={blok.sumberGambar === 'link' ? blok.url : ''}
                  onChange={e => onChange({ ...blok, url: e.target.value, sumberGambar: 'link', storagePath: undefined })} />
                {blok.sumberGambar === 'link' && blok.url && (
                  <img src={blok.url} alt="" className="max-h-40 rounded-lg border border-gray-100 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
              </div>
            )}

            <input className={ta} placeholder="Keterangan gambar (opsional)"
              value={blok.caption} onChange={e => onChange({ ...blok, caption: e.target.value })} />
          </div>
        )}

        {blok.tipe === 'video' && (
          <div className="flex flex-col gap-2">
            <input className={ta} placeholder="Link YouTube (https://youtube.com/watch?v=... atau youtu.be/...)"
              value={blok.youtubeUrl} onChange={e => onChange({ ...blok, youtubeUrl: e.target.value })} />
            {ytId(blok.youtubeUrl)
              ? <div className="aspect-video rounded-lg overflow-hidden border border-gray-100">
                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId(blok.youtubeUrl)}`} allowFullScreen title="preview" />
                </div>
              : blok.youtubeUrl && <p className="text-[11px] text-amber-600">Link YouTube belum dikenali. Pastikan formatnya benar.</p>}
          </div>
        )}
        {blok.tipe === 'html' && (
          <div className="flex flex-col gap-2">
            <textarea className={`${ta} font-mono text-xs`} rows={4} placeholder='Tempel kode embed, mis. <iframe src="..."></iframe> atau embed peta WebGIS'
              value={blok.kode} onChange={e => onChange({ ...blok, kode: e.target.value })} />
            <p className="text-[10px] text-gray-400">Embed HTML hanya untuk admin. Cocok untuk sisipan peta WebGIS, infografis, atau widget interaktif.</p>
          </div>
        )}
      </div>
    </div>
  )
}

type EntriTTS = { id: string; jawaban: string; petunjuk: string }
type TTSEditor = TTS & { entri?: EntriTTS[] }

// Mengikuti penyusun TTS di editor LKPD: beberapa urutan kata dicoba,
// kata berikutnya ditempatkan pada huruf silang yang cocok, lalu kisi dipangkas.
function susunTTS(entries: EntriTTS[]) {
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

// Huruf acak hanya disusun saat admin menekan tombol; hasilnya disimpan bersama kuis.
function susunCariKata(kata: CariKata['kata'], ukuran: number): { grid: string[]; posisi: PosisiCari[] } | null {
  const arah = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]] as const
  for (let percobaan = 0; percobaan < 100; percobaan++) {
    const grid = Array.from({ length: ukuran }, () => Array<string>(ukuran).fill(''))
    const posisi: PosisiCari[] = []
    for (const w of [...kata].sort((a, b) => b.jawaban.length - a.jawaban.length)) {
      const calon: { baris: number; kolom: number; dr: number; dc: number; silang: number }[] = []
      for (const [dr, dc] of arah) for (let r = 0; r < ukuran; r++) for (let c = 0; c < ukuran; c++) {
        let silang = 0, cocok = true
        for (let i = 0; i < w.jawaban.length; i++) {
          const rr = r + dr * i, cc = c + dc * i
          if (rr < 0 || rr >= ukuran || cc < 0 || cc >= ukuran || (grid[rr][cc] && grid[rr][cc] !== w.jawaban[i])) { cocok = false; break }
          if (grid[rr][cc] === w.jawaban[i]) silang++
        }
        if (cocok) calon.push({ baris: r, kolom: c, dr, dc, silang })
      }
      if (!calon.length) break
      // Sedikit silang lebih mudah dibaca, tetapi tetap beri kesempatan pada susunan lain.
      const sedikit = calon.filter(p => p.silang <= 2)
      const pilihan = (sedikit.length ? sedikit : calon)[Math.floor(Math.random() * (sedikit.length || calon.length))]
      posisi.push({ id: w.id, baris: pilihan.baris, kolom: pilihan.kolom, dr: pilihan.dr, dc: pilihan.dc })
      for (let i = 0; i < w.jawaban.length; i++) grid[pilihan.baris + pilihan.dr * i][pilihan.kolom + pilihan.dc * i] = w.jawaban[i]
    }
    if (posisi.length === kata.length) return {
      grid: grid.map(row => row.map(h => h || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]).join('')),
      posisi,
    }
  }
  return null
}

// ── Editor lima tipe kuis; format lama tanpa `tipe` tetap pilihan ganda ──
function KuisEditor({ kuis, onChange, onHapus }: { kuis: Kuis; onChange: (k: Kuis) => void; onHapus: () => void }) {
  const inp = 'border border-gray-200 bg-white p-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-400'
  const tipe = tipeKuis(kuis)
  const [ttsGagal, setTtsGagal] = useState<string[]>([])
  const [cariGagal, setCariGagal] = useState('')
  const [entriKosongTTS] = useState<EntriTTS[]>(() => [
    { id: uid(), jawaban: '', petunjuk: '' },
    { id: uid(), jawaban: '', petunjuk: '' },
  ])
  const gantiTipe = (v: TipeKuis) => {
    if (!confirm('Mengganti tipe kuis akan menghapus isi kuis sebelumnya. Lanjutkan?')) return
    if (v === 'pilihan_ganda') onChange({ tipe: v, pertanyaan: '', pilihan: ['', ''], jawaban_benar: 0, pembahasan: '' })
    if (v === 'matching') onChange({ tipe: v, pertanyaan: 'Cocokkan istilah dan penjelasannya', pasangan: [{ id: uid(), kiri: '', kanan: '' }, { id: uid(), kiri: '', kanan: '' }], pembahasan: '' })
    if (v === 'peta') onChange({ tipe: v, pertanyaan: 'Seret label ke lokasi yang tepat pada peta', gambar_url: '', titik: [], pembahasan: '' })
    if (v === 'tts') onChange({ tipe: v, pertanyaan: 'Isi teka-teki silang berikut', baris: 0, kolom: 0, kata: [], entri: [{ id: uid(), jawaban: '', petunjuk: '' }, { id: uid(), jawaban: '', petunjuk: '' }], pembahasan: '' } as TTSEditor)
    if (v === 'cari_kata') onChange({ tipe: v, pertanyaan: 'Temukan semua kata tersembunyi pada kotak huruf', ukuran: 10, kata: [{ id: uid(), jawaban: '' }, { id: uid(), jawaban: '' }], grid: [], posisi: [], pembahasan: '' })
  }
  return (
    <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Kuis Interaktif</span>
        <div className="flex-1" />
        <button type="button" onClick={onHapus} className="text-[11px] text-red-500 hover:underline">Hapus kuis</button>
      </div>
      <label className="text-xs font-medium text-gray-600">Tipe soal
        <select className={`${inp} mt-1`} value={tipe} onChange={e => gantiTipe(e.target.value as TipeKuis)}>
          <option value="pilihan_ganda">Pilihan ganda</option><option value="tts">Teka-teki silang (TTS)</option>
          <option value="matching">Matching word / menjodohkan</option><option value="peta">Drag and drop ke gambar/peta</option>
          <option value="cari_kata">Cari kata (word search)</option>
        </select>
      </label>
      <input className={inp} placeholder="Pertanyaan atau instruksi kuis..." value={kuis.pertanyaan}
        onChange={e => onChange({ ...kuis, pertanyaan: e.target.value } as Kuis)} />
      {tipe === 'pilihan_ganda' && (() => { const q = kuis as PilihanGanda; return <>
        <div className="rounded-lg border border-amber-100 bg-white p-2.5"><GambarUploader label="Gambar soal (opsional)"
          url={q.gambar_url} storagePath={q.gambar_storage_path}
          onUploaded={(url, path) => onChange({ ...q, gambar_url: url, gambar_storage_path: path })}
          onRemove={() => onChange({ ...q, gambar_url: undefined, gambar_storage_path: undefined })} /></div>
        <div className="flex flex-col gap-1.5">{q.pilihan.map((p, i) => <div key={i} className="flex items-center gap-2">
          <button type="button" onClick={() => onChange({ ...q, jawaban_benar: i })} title="Jawaban benar" aria-label={`Tandai pilihan ${i + 1} benar`}
            className={`w-6 h-6 flex-shrink-0 rounded-full border-2 text-xs ${q.jawaban_benar === i ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'}`}>✓</button>
          <input className={inp} placeholder={`Pilihan ${String.fromCharCode(65 + i)}`} value={p}
            onChange={e => onChange({ ...q, pilihan: q.pilihan.map((x, n) => n === i ? e.target.value : x) })} />
          {q.pilihan.length > 2 && <button type="button" className="text-red-500" onClick={() => onChange({ ...q, pilihan: q.pilihan.filter((_, n) => n !== i), jawaban_benar: q.jawaban_benar === i ? 0 : q.jawaban_benar > i ? q.jawaban_benar - 1 : q.jawaban_benar })}>✕</button>}
        </div>)}
          {q.pilihan.length < 5 && <button type="button" className="self-start text-xs text-teal-700" onClick={() => onChange({ ...q, pilihan: [...q.pilihan, ''] })}>+ Tambah pilihan</button>}
        </div>
      </> })()}
      {tipe === 'matching' && (() => { const q = kuis as Matching; return <div className="space-y-2">
        <p className="text-xs text-gray-500">Isi pasangan yang tepat. Urutan jawaban di halaman siswa akan dibalik.</p>
        {q.pasangan.map((p, i) => <div key={p.id} className="flex items-center gap-2">
          <span className="w-5 text-xs text-gray-500">{i + 1}</span>
          <input className={inp} value={p.kiri} placeholder="Istilah (contoh: tsunami)" onChange={e => onChange({ ...q, pasangan: q.pasangan.map(x => x.id === p.id ? { ...x, kiri: e.target.value } : x) })} />
          <span>↔</span><input className={inp} value={p.kanan} placeholder="Pasangan (contoh: Aceh 2004)" onChange={e => onChange({ ...q, pasangan: q.pasangan.map(x => x.id === p.id ? { ...x, kanan: e.target.value } : x) })} />
          {q.pasangan.length > 2 && <button type="button" className="text-red-500" onClick={() => onChange({ ...q, pasangan: q.pasangan.filter(x => x.id !== p.id) })}>✕</button>}
        </div>)}
        <button type="button" className="text-xs text-teal-700" onClick={() => onChange({ ...q, pasangan: [...q.pasangan, { id: uid(), kiri: '', kanan: '' }] })}>+ Tambah pasangan</button>
      </div> })()}
      {tipe === 'peta' && (() => { const q = kuis as PetaDragDrop; return <div className="space-y-3">
        <p className="text-xs text-gray-500">Unggah peta, lalu klik titik lokasi pada gambar dan isi label jawaban untuk tiap titik.</p>
        <GambarUploader label="Gambar peta/ilustrasi" url={q.gambar_url} storagePath={q.gambar_storage_path}
          onUploaded={(url, path) => onChange({ ...q, gambar_url: url, gambar_storage_path: path, titik: [] })}
          onRemove={() => onChange({ ...q, gambar_url: '', gambar_storage_path: undefined, titik: [] })} />
        <input className={inp} placeholder="Atau tempel URL gambar https://..." value={q.gambar_storage_path ? '' : q.gambar_url}
          onChange={e => onChange({ ...q, gambar_url: e.target.value, gambar_storage_path: undefined, titik: [] })} />
        {q.gambar_url && <div className="relative inline-block max-w-full cursor-crosshair" title="Klik untuk menambah titik"
          onClick={e => { const rect = e.currentTarget.getBoundingClientRect(); const x = Math.round((e.clientX - rect.left) / rect.width * 1000) / 10; const y = Math.round((e.clientY - rect.top) / rect.height * 1000) / 10; onChange({ ...q, titik: [...q.titik, { id: uid(), label: '', x, y }] }) }}>
          <img src={q.gambar_url} alt="Peta untuk memasang titik" className="block max-h-96 max-w-full rounded-lg border border-gray-200" />
          {q.titik.map((p, i) => <span key={p.id} style={{ left: `${p.x}%`, top: `${p.y}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-700 px-2 py-1 text-xs text-white shadow pointer-events-none">{i + 1}</span>)}
        </div>}
        {q.titik.map((p, i) => <div className="flex items-center gap-2" key={p.id}>
          <span className="w-14 shrink-0 text-xs text-gray-600">Titik {i + 1}</span><input className={inp} placeholder="Label jawaban, mis. Tsunami Aceh" value={p.label}
            onChange={e => onChange({ ...q, titik: q.titik.map(x => x.id === p.id ? { ...x, label: e.target.value } : x) })} />
          <button type="button" className="text-xs text-red-500" onClick={() => onChange({ ...q, titik: q.titik.filter(x => x.id !== p.id) })}>Hapus</button>
        </div>)}
      </div> })()}
      {tipe === 'tts' && (() => {
        const q = kuis as TTSEditor
        const entri = q.entri || (q.kata.length
          ? q.kata.map(w => ({ id: w.id, jawaban: w.jawaban, petunjuk: w.petunjuk }))
          : entriKosongTTS)
        const kisi = q.kata.length ? buatKisi(q) : null
        const ubahEntri = (next: EntriTTS[]) => {
          setTtsGagal([])
          onChange({ ...q, entri: next, kata: [], baris: 0, kolom: 0 } as TTSEditor)
        }
        const susun = () => {
          const normal = entri.map(e => e.jawaban.trim().toUpperCase())
          if (entri.length < 2 || entri.some(e => !e.jawaban.trim() || !e.petunjuk.trim())) {
            setTtsGagal(['Isi minimal dua kata beserta petunjuknya.']); return
          }
          if (normal.some(w => !/^[A-Z]{2,30}$/.test(w)) || new Set(normal).size !== normal.length) {
            setTtsGagal(['Gunakan satu kata berisi 2–30 huruf A–Z tanpa spasi, tanda baca, atau jawaban yang sama.']); return
          }
          const hasil = susunTTS(entri)
          if (hasil.baris > 20 || hasil.kolom > 20) {
            setTtsGagal(['Kisi melebihi batas 20 × 20 kotak pada kuis materi. Kurangi jumlah atau panjang kata.']); return
          }
          setTtsGagal(hasil.gagal.length ? [`Kata belum terhubung ke kisi: ${hasil.gagal.join(', ')}. Coba kata yang berbagi huruf.`] : [])
          onChange({ ...q, entri, kata: hasil.kata, baris: Math.max(3, hasil.baris), kolom: Math.max(3, hasil.kolom) } as TTSEditor)
        }
        return <div className="space-y-3">
          <p className="text-xs text-gray-500">Seperti LKPD: isi jawaban dan petunjuk, lalu klik Susun Grid TTS. Jawaban satu kata, 2–30 huruf.</p>
          <div className="space-y-2">{entri.map((w, i) => <div key={w.id} className="flex items-start gap-2">
            <span className="mt-2 w-5 shrink-0 text-xs text-gray-500">{i + 1}</span>
            <input className={`${inp} max-w-[160px] uppercase`} placeholder="JAWABAN" value={w.jawaban}
              onChange={e => ubahEntri(entri.map(x => x.id === w.id ? { ...x, jawaban: e.target.value.toUpperCase() } : x))} />
            <input className={inp} placeholder="Pertanyaan / petunjuk" value={w.petunjuk}
              onChange={e => ubahEntri(entri.map(x => x.id === w.id ? { ...x, petunjuk: e.target.value } : x))} />
            {entri.length > 2 && <button type="button" className="mt-2 text-xs text-red-500" onClick={() => ubahEntri(entri.filter(x => x.id !== w.id))}>✕</button>}
          </div>)}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg border border-dashed border-teal-300 px-3 py-1.5 text-xs font-medium text-teal-700"
              onClick={() => ubahEntri([...entri, { id: uid(), jawaban: '', petunjuk: '' }])}>+ Tambah Kata</button>
            <button type="button" className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white"
              onClick={susun}>Susun Grid TTS</button>
          </div>
          {ttsGagal.map((pesan, i) => <p key={i} role="alert" className="text-xs text-red-600">{pesan}</p>)}
          {kisi && <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs text-gray-600">Pratinjau kisi ({q.kata.length}/{entri.length} kata tersusun)</p>
            <div className="max-w-full overflow-auto"><div className="grid w-max gap-px bg-gray-300 p-px" style={{ gridTemplateColumns: `repeat(${q.kolom}, 1.75rem)` }}>
              {Array.from({ length: q.baris * q.kolom }, (_, i) => {
                const pos = `${Math.floor(i / q.kolom)}-${i % q.kolom}`
                const cell = kisi.cells[pos]
                return <span key={pos} className={`relative flex h-7 w-7 items-center justify-center text-xs font-semibold ${cell ? 'bg-white' : 'bg-gray-700'}`}>
                  {cell?.nomor && <small className="absolute left-0.5 top-0 text-[8px] leading-none text-teal-700">{cell.nomor}</small>}{cell?.huruf}
                </span>
              })}
            </div></div>
            {kisi.errors.map((err, i) => <p key={i} className="mt-1 text-xs text-red-600">{err}</p>)}
          </div>}
        </div>
      })()}
      {tipe === 'cari_kata' && (() => {
        const q = kuis as CariKata
        const ubahKata = (kata: CariKata['kata']) => { setCariGagal(''); onChange({ ...q, kata, grid: [], posisi: [] }) }
        const susun = () => {
          const normal = q.kata.map(w => ({ ...w, jawaban: w.jawaban.trim().toUpperCase() }))
          if (normal.length < 2 || normal.length > 12 || normal.some(w => !/^[A-Z]{3,16}$/.test(w.jawaban) || w.jawaban.length > q.ukuran) ||
              new Set(normal.map(w => w.jawaban)).size !== normal.length) {
            setCariGagal(`Isi 2–12 kata yang berbeda, masing-masing 3–${q.ukuran} huruf A–Z tanpa spasi.`); return
          }
          const hasil = susunCariKata(normal, q.ukuran)
          if (!hasil) { setCariGagal('Semua kata belum muat. Pilih kotak lebih besar atau kurangi kata.'); return }
          setCariGagal('')
          onChange({ ...q, kata: normal, ...hasil })
        }
        const terisi = q.grid.length === q.ukuran && q.posisi.length === q.kata.length
        const lokasi = new Set(q.posisi.flatMap(p => {
          const len = q.kata.find(w => w.id === p.id)?.jawaban.length || 0
          return Array.from({ length: len }, (_, i) => `${p.baris + p.dr * i}-${p.kolom + p.dc * i}`)
        }))
        return <div className="space-y-3 rounded-lg border border-amber-100 bg-white p-3">
          <p className="text-xs text-gray-600">Masukkan kata yang harus ditemukan siswa. Setelah itu klik Susun Kotak Kata; huruf lain akan diisi otomatis.</p>
          <label className="block text-xs font-medium text-gray-600">Ukuran kotak
            <select className={`${inp} mt-1 max-w-[130px]`} value={q.ukuran} onChange={e => { setCariGagal(''); onChange({ ...q, ukuran: Number(e.target.value), grid: [], posisi: [] }) }}>
              {[10, 12, 14, 16].map(n => <option key={n} value={n}>{n} × {n}</option>)}
            </select>
          </label>
          <div className="space-y-2">{q.kata.map((w, i) => <div key={w.id} className="flex items-center gap-2">
            <span className="w-5 text-xs text-gray-500">{i + 1}</span>
            <input className={`${inp} max-w-xs uppercase`} value={w.jawaban} placeholder="Contoh: TSUNAMI"
              onChange={e => ubahKata(q.kata.map(x => x.id === w.id ? { ...x, jawaban: e.target.value.toUpperCase() } : x))} />
            {q.kata.length > 2 && <button type="button" className="text-xs text-red-600" onClick={() => ubahKata(q.kata.filter(x => x.id !== w.id))}>Hapus</button>}
          </div>)}</div>
          <div className="flex flex-wrap gap-2">
            {q.kata.length < 12 && <button type="button" className="rounded-lg border border-dashed border-teal-300 px-3 py-1.5 text-xs font-medium text-teal-700" onClick={() => ubahKata([...q.kata, { id: uid(), jawaban: '' }])}>+ Tambah Kata</button>}
            <button type="button" className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white" onClick={susun}>{terisi ? 'Acak Ulang Kotak Kata' : 'Susun Kotak Kata'}</button>
          </div>
          {cariGagal && <p role="alert" className="text-xs text-red-600">{cariGagal}</p>}
          {terisi && <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs text-gray-600">Pratinjau {q.ukuran} × {q.ukuran}; sel hijau menunjukkan kata tersembunyi. Gunakan tombol Pratinjau kuis untuk mencoba sebagai siswa.</p>
            <div className="max-w-full overflow-auto"><div className="grid w-max gap-px bg-gray-300 p-px" style={{ gridTemplateColumns: `repeat(${q.ukuran}, 1.75rem)` }}>
              {q.grid.map((row, r) => row.split('').map((huruf, c) => <span key={`${r}-${c}`} className={`flex h-7 w-7 items-center justify-center text-xs font-bold ${lokasi.has(`${r}-${c}`) ? 'bg-emerald-200 text-emerald-950' : 'bg-white text-gray-700'}`}>{huruf}</span>))}
            </div></div>
          </div>}
        </div>
      })()}
      <textarea className={inp} rows={2} placeholder="Pembahasan setelah siswa menjawab (opsional)..." value={kuis.pembahasan}
        onChange={e => onChange({ ...kuis, pembahasan: e.target.value } as Kuis)} />
    </div>
  )
}

export default function AdminMateriPage() {
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [materiList, setMateriList] = useState<MateriItem[]>([])
  const [mode, setMode] = useState<'list' | 'buat' | 'edit'>('list')
  const [editTarget, setEditTarget] = useState<MateriItem | null>(null)
  const [isKonsepDasar, setIsKonsepDasar] = useState(false)
  const [judul, setJudul] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [segmen, setSegmen] = useState<Segmen[]>([])
  const [tahapAktif, setTahapAktif] = useState<TahapId>('memahami')
  const [terbukaId, setTerbukaId] = useState<string | null>(null)
  const [pesan, setPesan] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const fetchMateri = async () => {
    const { data } = await supabase.from('materi_bencana').select('*, jenis_bencana(nama)').order('created_at', { ascending: false })
    if (data) setMateriList(data as any)
  }

  useEffect(() => {
    supabase.from('jenis_bencana').select('*').eq('kategori', 'bencana').then(({ data }) => { if (data) setBencanaList(data) })
    fetchMateri()
  }, [])

  const resetForm = () => {
    setJudul(''); setSelectedBencana(''); setIsKonsepDasar(false); setSegmen(normalisasiSegmen([])); setTahapAktif('memahami'); setTerbukaId(null); setEditTarget(null); setPesan('')
  }

  const handleEdit = (m: MateriItem) => {
    setEditTarget(m); setJudul(m.judul); setSelectedBencana(m.jenis_bencana_id ? String(m.jenis_bencana_id) : '')
    setIsKonsepDasar(m.is_konsep_dasar)
    // Migrasi data lama: blok gambar tanpa sumberGambar dianggap 'link'
    const migratedSegmen = (Array.isArray(m.segmen) ? m.segmen : []).map(sg => ({
      ...sg,
      blok: sg.blok.map(b => {
        if (b.tipe === 'gambar' && !b.sumberGambar) {
          return { ...b, sumberGambar: 'link' as const }
        }
        return b
      })
    }))
    setSegmen(normalisasiSegmen(migratedSegmen))
    setTahapAktif('memahami'); setTerbukaId(null)
    setMode('edit')
  }

  // ── Tahap, subbab dan kuis berdiri sendiri dalam satu urutan JSON ──
  const tambahItem = (tahap: TahapId, jenis: 'subbab' | 'kuis') => {
    const item: Segmen = { id: uid(), tahap, jenis, judul: '', blok: [],
      kuis: jenis === 'kuis' ? { pertanyaan: '', pilihan: ['', ''], jawaban_benar: 0, pembahasan: '' } : null }
    setSegmen(sebelumnya => {
      const s = normalisasiSegmen(sebelumnya)
      let pos = s.findIndex(x => x.jenis === 'tahap' && x.tahap === tahap) + 1
      while (pos < s.length && s[pos].jenis !== 'tahap') pos++
      return [...s.slice(0, pos), item, ...s.slice(pos)]
    })
    setTahapAktif(tahap); setTerbukaId(item.id); setPreviewId(null)
  }
  const ubahSegmen = (id: string, patch: Partial<Segmen>) =>
    setSegmen(s => s.map(sg => sg.id === id ? { ...sg, ...patch } : sg))
  const hapusSegmen = (id: string) => setSegmen(s => s.filter(sg => sg.id !== id))
  const geserSegmen = (id: string, arah: -1 | 1) => setSegmen(s => {
    const i = s.findIndex(x => x.id === id)
    if (i < 0) return s
    const posisi = s.map((x, n) => x.jenis !== 'tahap' && x.tahap === s[i].tahap ? n : -1).filter(n => n >= 0)
    const j = posisi[posisi.indexOf(i) + arah]
    if (j === undefined) return s
    const copy = [...s];[copy[i], copy[j]] = [copy[j], copy[i]]; return copy
  })
  const pindahTahap = (id: string, tahap: TahapId) => setSegmen(sebelumnya => {
    const s = normalisasiSegmen(sebelumnya)
    const item = s.find(x => x.id === id)
    if (!item || item.jenis === 'tahap') return s
    const tanpa = s.filter(x => x.id !== id)
    let pos = tanpa.findIndex(x => x.jenis === 'tahap' && x.tahap === tahap) + 1
    while (pos < tanpa.length && tanpa[pos].jenis !== 'tahap') pos++
    tanpa.splice(pos, 0, { ...item, tahap })
    return tanpa
  })
  const taruhSebelum = (dari: string, target: string) => setSegmen(s => {
    const asal = s.find(x => x.id === dari), tujuan = s.find(x => x.id === target)
    if (!asal || !tujuan || asal.jenis === 'tahap' || tujuan.jenis === 'tahap' || asal.id === tujuan.id) return s
    const copy = s.filter(x => x.id !== dari)
    const pos = copy.findIndex(x => x.id === target)
    copy.splice(pos, 0, { ...asal, tahap: tujuan.tahap })
    return copy
  })

  // ── Operasi blok ──
  const blokBaru = (tipe: Blok['tipe']): Blok => {
    if (tipe === 'teks') return { id: uid(), tipe, isi: '' }
    if (tipe === 'gambar') return { id: uid(), tipe, url: '', caption: '', sumberGambar: 'upload' }
    if (tipe === 'video') return { id: uid(), tipe, youtubeUrl: '' }
    return { id: uid(), tipe: 'html', kode: '' }
  }
  const tambahBlok = (segId: string, tipe: Blok['tipe']) =>
    setSegmen(s => s.map(sg => sg.id === segId ? { ...sg, blok: [...sg.blok, blokBaru(tipe)] } : sg))
  const ubahBlok = (segId: string, blokId: string, b: Blok) =>
    setSegmen(s => s.map(sg => sg.id === segId ? { ...sg, blok: sg.blok.map(x => x.id === blokId ? b : x) } : sg))
  const hapusBlok = (segId: string, blokId: string) =>
    setSegmen(s => s.map(sg => sg.id === segId ? { ...sg, blok: sg.blok.filter(x => x.id !== blokId) } : sg))
  const geserBlok = (segId: string, i: number, arah: -1 | 1) =>
    setSegmen(s => s.map(sg => {
      if (sg.id !== segId) return sg
      const j = i + arah; if (j < 0 || j >= sg.blok.length) return sg
      const c = [...sg.blok];[c[i], c[j]] = [c[j], c[i]]; return { ...sg, blok: c }
    }))

  const handleSimpan = async (published: boolean) => {
    if (!judul) { setPesan('Judul wajib diisi!'); return }
    if (!isKonsepDasar && !selectedBencana) { setPesan('Pilih jenis bencana!'); return }
    for (const [i, sg] of segmen.entries()) {
      if (published && sg.jenis === 'kuis' && sg.kuis) {
        if (tipeKuis(sg.kuis) === 'tts') {
          const tts = sg.kuis as TTSEditor
          if (tts.entri) {
            const jawaban = tts.entri.map(e => e.jawaban.trim().toUpperCase())
            if (tts.entri.length < 2 || tts.entri.some(e => !e.petunjuk.trim()) ||
                jawaban.some(w => !/^[A-Z]{2,30}$/.test(w)) || new Set(jawaban).size !== jawaban.length ||
                tts.kata.length !== tts.entri.length) {
              setPesan(`Kuis ${i + 1}: Lengkapi jawaban dan petunjuk TTS, lalu klik Susun Grid TTS sampai semua kata tersusun.`)
              return
            }
          }
        }
        const err = validasiKuis(sg.kuis)
        if (err) { setPesan(`Kuis ${i + 1}: ${err}`); return }
      }
    }
    setLoading(true)
    const payload: any = {
      judul, published, is_konsep_dasar: isKonsepDasar,
      jenis_bencana_id: isKonsepDasar ? null : Number(selectedBencana),
      segmen,
    }
    let error
    if (mode === 'edit' && editTarget) {
      const res = await supabase.from('materi_bencana').update(payload).eq('id', editTarget.id); error = res.error
    } else {
      const res = await supabase.from('materi_bencana').insert(payload); error = res.error
    }
    if (error) setPesan('Gagal: ' + error.message)
    else { setPesan(published ? 'Berhasil dipublish!' : 'Tersimpan sebagai draft!'); resetForm(); setMode('list'); fetchMateri() }
    setLoading(false)
  }

  const inputCls = "border border-gray-200 p-2.5 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-400"

  // ══════════════ MODE LIST ══════════════
  if (mode === 'list') {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Materi Bencana</h1>
            <p className="text-gray-500 text-sm mt-1">Materi microlearning — belajar bertahap dengan kuis singkat</p>
          </div>
          <button className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
            onClick={() => { resetForm(); setMode('buat') }}>+ Buat Materi</button>
        </div>

        {materiList.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">Belum ada materi</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materiList.map(m => {
            const jmlSeg = Array.isArray(m.segmen) ? m.segmen.filter(s => s.jenis !== 'tahap' && s.jenis !== 'kuis').length : 0
            const jmlKuis = Array.isArray(m.segmen) ? m.segmen.filter(s => s.jenis === 'kuis' || (s.jenis !== 'tahap' && s.kuis)).length : 0
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-teal-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 text-sm">{m.judul}</h3>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                      {m.is_konsep_dasar && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Konsep Dasar</span>}
                      {m.jenis_bencana && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{m.jenis_bencana.nama}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{m.published ? 'Live' : 'Draft'}</span>
                      <span className="text-xs text-gray-400">· {jmlSeg} subbab · {jmlKuis} kuis</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100" onClick={() => handleEdit(m)}>Edit</button>
                  <button className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100"
                    onClick={() => { supabase.from('materi_bencana').update({ published: !m.published }).eq('id', m.id).then(fetchMateri) }}>
                    {m.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-100"
                    onClick={async () => { if (!confirm('Yakin hapus?')) return; await supabase.from('materi_bencana').delete().eq('id', m.id); fetchMateri() }}>Hapus</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ══════════════ MODE BUAT / EDIT ══════════════
  return (
    <div className="max-w-5xl p-4 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <button className="text-sm text-teal-600 hover:text-teal-800" onClick={() => { resetForm(); setMode('list') }}>← Kembali</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{mode === 'edit' ? 'Edit Materi' : 'Buat Materi Baru'}</h1>
          <p className="text-gray-500 text-sm">Susun tiga tahap pembelajaran. Tambahkan subbab dan kuis secara bebas, lalu atur urutannya.</p>
        </div>
      </div>

      {/* Info dasar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-700">Informasi Dasar</h2>
        <input className={inputCls} placeholder="Judul materi" value={judul} onChange={e => setJudul(e.target.value)} />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isKonsepDasar} onChange={e => setIsKonsepDasar(e.target.checked)} className="accent-teal-600" />
          Materi Konsep Dasar (tematik, lintas-bencana)
        </label>
        {!isKonsepDasar && (
          <select className={inputCls} value={selectedBencana} onChange={e => setSelectedBencana(e.target.value)}>
            <option value="">Pilih Jenis Bencana</option>
            {bencanaList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
          </select>
        )}
      </div>

      {/* Tiga tahap pembelajaran mendalam. Item dalam setiap tahap dapat diurutkan. */}
      <div className="mb-4 rounded-2xl border border-teal-100 bg-teal-50/50 p-3">
        <p className="mb-2 text-xs font-semibold text-teal-900">Tahap pembelajaran</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {TAHAP.map((t, i) => {
            const jumlah = segmen.filter(s => s.jenis !== 'tahap' && s.tahap === t.id).length
            return <button key={t.id} type="button" onClick={() => { setTahapAktif(t.id); setTerbukaId(null); setPreviewId(null) }}
              className={`rounded-xl border p-3 text-left transition ${tahapAktif === t.id ? 'border-teal-500 bg-white text-teal-900 shadow-sm' : 'border-gray-200 bg-white/70 text-gray-600 hover:border-teal-300'}`}>
              <span className="text-xs font-bold">{i + 1}. {t.judul}</span>
              <span className="mt-1 block text-[11px]">{jumlah} item</span>
            </button>
          })}
        </div>
      </div>
      {TAHAP.filter(t => t.id === tahapAktif).map(t => {
        const info = segmen.find(s => s.jenis === 'tahap' && s.tahap === t.id)
        const items = segmen.filter(s => s.jenis !== 'tahap' && s.tahap === t.id)
        return <section key={t.id} className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="text-lg font-bold text-gray-800">Tahap {t.judul}</h2>
              <p className="text-xs text-gray-500">{t.panduan}</p></div>
            <span className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-700">{items.length} item berurutan</span>
          </div>
          <label className="mb-4 block text-xs font-medium text-gray-600">Edit pengantar tahap (opsional)
            <textarea className={`${inputCls} mt-1`} rows={2} value={info?.deskripsi || ''}
              placeholder={`Petunjuk kegiatan pada tahap ${t.judul.toLowerCase()}...`}
              onChange={e => { if (info) ubahSegmen(info.id, { deskripsi: e.target.value }) }} />
          </label>
          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => tambahItem(t.id, 'subbab')} className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700">+ Tambah Subbab</button>
            <button type="button" onClick={() => tambahItem(t.id, 'kuis')} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">+ Tambah Kuis</button>
          </div>
          <p className="mb-3 text-[11px] text-gray-500">Seret pegangan ↕ untuk mengurutkan, atau gunakan tombol ↑ ↓. Kuis dapat ditambah berkali-kali tanpa membuat subbab.</p>
          <div className="space-y-3">
            {items.length === 0 && <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">Tahap ini masih kosong. Tambahkan subbab atau kuis.</div>}
            {items.map((sg, si) => {
              const terbuka = terbukaId === sg.id
              return <div key={sg.id} onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) taruhSebelum(id, sg.id) }}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="flex flex-wrap items-center gap-2 bg-gray-50 px-3 py-2.5">
                  <span draggable onDragStart={e => e.dataTransfer.setData('text/plain', sg.id)}
                    title="Seret untuk mengurutkan" className="cursor-grab rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-500">↕</span>
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-bold text-teal-800">{si + 1}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sg.jenis === 'kuis' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{sg.jenis === 'kuis' ? 'Kuis' : 'Subbab'}</span>
                  <button type="button" className="min-w-[120px] flex-1 truncate text-left text-sm font-medium text-gray-800 hover:text-teal-700"
                    onClick={() => setTerbukaId(terbuka ? null : sg.id)}>{sg.jenis === 'kuis' ? sg.kuis?.pertanyaan || 'Kuis baru' : sg.judul || 'Subbab baru'} {terbuka ? '▴' : '▾'}</button>
                  <button type="button" disabled={si === 0} onClick={() => geserSegmen(sg.id, -1)} title="Naik" className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30">↑</button>
                  <button type="button" disabled={si === items.length - 1} onClick={() => geserSegmen(sg.id, 1)} title="Turun" className="rounded p-1 text-gray-500 hover:bg-gray-200 disabled:opacity-30">↓</button>
                  <select aria-label="Pindahkan ke tahap" className="max-w-[130px] rounded border border-gray-200 bg-white px-1 py-1 text-[11px]" value={t.id}
                    onChange={e => { pindahTahap(sg.id, e.target.value as TahapId); setTahapAktif(e.target.value as TahapId) }}>
                    {TAHAP.map(p => <option key={p.id} value={p.id}>{p.judul}</option>)}
                  </select>
                  <button type="button" onClick={() => { if (confirm(`Hapus ${sg.jenis === 'kuis' ? 'kuis' : 'subbab'} ini?`)) hapusSegmen(sg.id) }}
                    title="Hapus item" className="rounded p-1 text-red-500 hover:bg-red-50">✕</button>
                </div>
                {terbuka && <div className="space-y-3 p-4">
                  {sg.jenis === 'kuis' && sg.kuis && <>
                    <KuisEditor key={sg.id} kuis={sg.kuis}
                      onChange={k => ubahSegmen(sg.id, { kuis: k })} onHapus={() => hapusSegmen(sg.id)} />
                    <button type="button" onClick={() => setPreviewId(previewId === sg.id ? null : sg.id)}
                      className="text-xs font-medium text-teal-700">{previewId === sg.id ? 'Tutup pratinjau kuis' : 'Pratinjau kuis'}</button>
                    {previewId === sg.id && <KuisInteraktif key={`${sg.id}-${tipeKuis(sg.kuis)}`} kuis={sg.kuis} />}
                  </>}
                  {sg.jenis !== 'kuis' && <>
                    <input className={inputCls} placeholder="Judul subbab (mis. Ancaman banjir)" value={sg.judul}
                      onChange={e => ubahSegmen(sg.id, { judul: e.target.value })} />
                    {sg.blok.map((b, bi) => <BlokEditor key={b.id} blok={b}
                      onChange={nb => ubahBlok(sg.id, b.id, nb)} onHapus={() => hapusBlok(sg.id, b.id)}
                      onNaik={() => geserBlok(sg.id, bi, -1)} onTurun={() => geserBlok(sg.id, bi, 1)}
                      bisaNaik={bi > 0} bisaTurun={bi < sg.blok.length - 1} />)}
                    <div className="flex flex-wrap gap-2">
                      {(['teks', 'gambar', 'video', 'html'] as Blok['tipe'][]).map(k => <button key={k} type="button"
                        onClick={() => tambahBlok(sg.id, k)} className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${blokMeta[k].warna}`}>+ {blokMeta[k].label}</button>)}
                    </div>
                    <button type="button" onClick={() => setPreviewId(previewId === sg.id ? null : sg.id)}
                      className="text-xs font-medium text-teal-700">{previewId === sg.id ? 'Tutup pratinjau' : 'Pratinjau subbab'}</button>
                    {previewId === sg.id && <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                      <h4 className="font-semibold text-gray-800">{sg.judul || `Subbab ${si + 1}`}</h4>
                      {sg.blok.map(b => <div key={b.id}>
                        {b.tipe === 'teks' && <p className="whitespace-pre-wrap text-sm text-gray-700">{b.isi}</p>}
                        {b.tipe === 'gambar' && b.url && <figure><img src={b.url} alt={b.caption || ''} className="max-h-56 rounded-lg object-contain" />{b.caption && <figcaption className="text-xs">{b.caption}</figcaption>}</figure>}
                        {b.tipe === 'video' && ytId(b.youtubeUrl) && <iframe src={`https://www.youtube.com/embed/${ytId(b.youtubeUrl)}`} title="Pratinjau video" className="aspect-video w-full rounded-lg" allowFullScreen />}
                        {b.tipe === 'html' && b.kode && <HtmlEmbed kode={b.kode} />}
                      </div>)}
                    </div>}
                  </>}
                </div>}
              </div>
            })}
          </div>
        </section>
      })}

      {pesan && <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 ${pesan.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{pesan}</div>}

      <div className="flex gap-3 sticky bottom-4">
        <button className="flex-1 bg-gray-100 text-gray-700 p-2.5 rounded-xl font-medium hover:bg-gray-200 shadow-sm" onClick={() => handleSimpan(false)} disabled={loading}>Simpan Draft</button>
        <button className="flex-1 bg-teal-600 text-white p-2.5 rounded-xl font-medium hover:bg-teal-700 shadow-sm" onClick={() => handleSimpan(true)} disabled={loading}>
          {loading ? 'Menyimpan...' : 'Publish'}
        </button>
      </div>
    </div>
  )
}
