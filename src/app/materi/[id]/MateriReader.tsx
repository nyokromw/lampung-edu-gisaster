'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import KuisInteraktif, { type Kuis } from '../KuisInteraktif'

type TahapId = 'memahami' | 'mengaplikasi' | 'merefleksi'
const TAHAP: { id: TahapId; judul: string }[] = [
  { id: 'memahami', judul: 'Memahami' },
  { id: 'mengaplikasi', judul: 'Mengaplikasi' },
  { id: 'merefleksi', judul: 'Merefleksi' },
]
type Blok =
  | { id: string; tipe: 'teks'; isi: string }
  | { id: string; tipe: 'gambar'; url: string; caption: string }
  | { id: string; tipe: 'video'; youtubeUrl: string }
  | { id: string; tipe: 'html'; kode: string }
interface Segmen {
  id: string; judul: string; blok: Blok[]; kuis: Kuis | null
  tahap?: TahapId; jenis?: 'tahap' | 'subbab' | 'kuis'; deskripsi?: string
}
interface Materi {
  id: string; judul: string; is_konsep_dasar: boolean
  jenis_bencana: { nama: string } | null
  segmen: Segmen[] | null
}

function ytId(url: string): string | null {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : (url.length === 11 ? url : null)
}
function RenderBlok({ b }: { b: Blok }) {
  if (b.tipe === 'teks') return <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-gray-700">{b.isi}</p>
  if (b.tipe === 'gambar') return b.url ? <figure className="my-1">
    <img src={b.url} alt={b.caption || ''} className="max-h-[420px] w-full rounded-xl bg-gray-50 object-contain" />
    {b.caption && <figcaption className="mt-1.5 text-center text-xs text-gray-500">{b.caption}</figcaption>}
  </figure> : null
  if (b.tipe === 'video') {
    const id = ytId(b.youtubeUrl)
    return id ? <div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe className="h-full w-full" src={`https://www.youtube.com/embed/${id}`} allowFullScreen title="video" /></div> : null
  }
  if (b.tipe === 'html') return b.kode ? <div className="overflow-hidden rounded-xl border border-gray-100" dangerouslySetInnerHTML={{ __html: b.kode }} /> : null
  return null
}

function DaftarIsi({ items, aktif, hasilKuis, onPilih }: {
  items: Segmen[]; aktif: number; hasilKuis: Record<string, boolean>; onPilih: (index: number) => void
}) {
  return <nav aria-label="Daftar isi materi" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-4 border-b border-gray-100 pb-3">
      <h2 className="text-sm font-bold text-gray-900">Daftar isi</h2>
      <p className="mt-1 text-xs text-gray-500">Pilih subbab atau kuis untuk langsung membukanya.</p>
    </div>
    <div className="space-y-5">
      {TAHAP.map((t, tahapIndex) => {
        const daftar = items.map((item, index) => ({ item, index })).filter(({ item }) => item.tahap === t.id)
        return <section key={t.id} aria-label={`Tahap ${t.judul}`}>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-teal-800">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[10px]">{tahapIndex + 1}</span>
            {t.judul}
          </h3>
          {daftar.length === 0 ? <p className="pl-7 text-xs italic text-gray-400">Belum ada isi</p> :
            <ol className="space-y-1 border-l border-gray-200 pl-2.5 ml-2.5">
              {daftar.map(({ item, index }) => {
                const sekarang = index === aktif
                const kuis = item.jenis === 'kuis'
                const nomor = daftar.filter(({ item: s, index: n }) => n <= index && s.jenis === item.jenis).length
                const label = kuis ? item.kuis?.pertanyaan || `Kuis ${nomor}` : item.judul || `Subbab ${nomor}`
                return <li key={item.id}>
                  <button type="button" aria-current={sekarang ? 'step' : undefined} onClick={() => onPilih(index)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs leading-snug transition ${sekarang ? 'bg-teal-50 font-semibold text-teal-800 ring-1 ring-teal-200' : 'text-gray-600 hover:bg-gray-50 hover:text-teal-700'}`}>
                    <span aria-hidden="true" className="mt-px shrink-0">{kuis ? '◇' : '•'}</span>
                    <span className="min-w-0 flex-1 break-words">{label}</span>
                    {kuis && hasilKuis[item.id] !== undefined && <span className={`shrink-0 font-bold ${hasilKuis[item.id] ? 'text-green-600' : 'text-amber-600'}`} aria-label={hasilKuis[item.id] ? 'Benar' : 'Perlu dicoba lagi'}>{hasilKuis[item.id] ? '✓' : '↻'}</span>}
                  </button>
                </li>
              })}
            </ol>}
        </section>
      })}
    </div>
  </nav>
}

export default function MateriReader({ materi }: { materi: Materi }) {
  const { items, pengantar } = useMemo(() => {
    const raw = Array.isArray(materi.segmen) ? materi.segmen : []
    const hasil: Segmen[] = []
    const intro: Partial<Record<TahapId, string>> = {}
    for (const sg of raw) {
      const tahap = TAHAP.some(t => t.id === sg.tahap) ? sg.tahap! : 'memahami'
      if (sg.jenis === 'tahap') { intro[tahap] = sg.deskripsi || ''; continue }
      if (sg.jenis === 'kuis') {
        if (sg.kuis) hasil.push({ ...sg, tahap, jenis: 'kuis', blok: [] })
        continue
      }
      hasil.push({ ...sg, tahap, jenis: 'subbab', blok: Array.isArray(sg.blok) ? sg.blok : [], kuis: null })
      // Materi lama menyimpan satu kuis di dalam segmen. Jadikan langkah setelah subbab.
      if (sg.kuis) hasil.push({ id: `${sg.id}-kuis`, tahap, jenis: 'kuis', judul: '', blok: [], kuis: sg.kuis })
    }
    return { items: hasil, pengantar: intro }
  }, [materi.segmen])
  const [idx, setIdx] = useState(0)
  const [hasilKuis, setHasilKuis] = useState<Record<string, boolean>>({})
  const [selesai, setSelesai] = useState(false)
  const [menuTerbuka, setMenuTerbuka] = useState(false)
  const total = items.length
  const sg = items[idx]
  const kuis = items.filter(s => s.jenis === 'kuis' && s.kuis)
  const jmlBenar = kuis.filter(s => hasilKuis[s.id] === true).length
  const tahapSekarang = sg?.tahap || 'memahami'
  const bukaLangkah = (index: number) => { setIdx(index); setSelesai(false); setMenuTerbuka(false) }

  if (!total) return <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm text-gray-500">Materi ini belum memiliki subbab atau kuis.</div>

  if (selesai) return <div>
    <div className="mb-6 rounded-3xl bg-teal-700 p-8 text-center text-white">
      <h2 className="text-2xl font-bold">Materi Selesai!</h2><p className="mt-1 text-sm text-white/80">{materi.judul}</p>
    </div>
    {kuis.length > 0 && <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 text-center">
      <p className="mb-1 text-sm text-gray-500">Hasil kuis kamu</p>
      <p className="text-4xl font-bold text-teal-600">{jmlBenar}<span className="text-xl text-gray-400">/{kuis.length}</span></p>
      <p className="mt-1 text-xs text-gray-500">{Math.round(jmlBenar / kuis.length * 100)}% benar</p>
    </div>}
    <div className="flex gap-3">
      <button type="button" onClick={() => { setIdx(0); setSelesai(false); setHasilKuis({}) }} className="flex-1 rounded-xl bg-gray-100 py-3 font-medium text-gray-700">Ulangi</button>
      <Link href="/materi" className="flex-1 rounded-xl bg-teal-600 py-3 text-center font-medium text-white">Materi Lain</Link>
    </div>
  </div>

  return <div className="grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
    <aside className="sticky top-6 hidden max-h-[calc(100vh-3rem)] overflow-y-auto lg:block">
      <DaftarIsi items={items} aktif={idx} hasilKuis={hasilKuis} onPilih={bukaLangkah} />
    </aside>
    <div className="min-w-0">
    <div className="mb-4 lg:hidden">
      <button type="button" onClick={() => setMenuTerbuka(v => !v)} aria-expanded={menuTerbuka}
        className="flex w-full items-center justify-between rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-left text-sm font-semibold text-teal-800">
        <span>☰ Daftar isi · {idx + 1}/{total}</span><span>{menuTerbuka ? 'Tutup ↑' : 'Buka ↓'}</span>
      </button>
      {menuTerbuka && <div className="mt-2"><DaftarIsi items={items} aktif={idx} hasilKuis={hasilKuis} onPilih={bukaLangkah} /></div>}
    </div>
    <div className="mb-4 grid grid-cols-3 gap-2" aria-label="Tahap pembelajaran">
      {TAHAP.map((t, n) => {
        const pertama = items.findIndex(s => s.tahap === t.id)
        const aktif = tahapSekarang === t.id
        return <button key={t.id} type="button" disabled={pertama < 0}
          onClick={() => bukaLangkah(pertama)} title={t.judul}
          className={`rounded-xl border px-2 py-2 text-center text-[11px] font-semibold sm:text-sm ${aktif ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 bg-white text-gray-500'} disabled:opacity-50`}>
          {n + 1}. {t.judul}
        </button>
      })}
    </div>
    <div className="mb-5 flex gap-1.5">{items.map((s, i) => <button key={s.id} type="button"
      onClick={() => bukaLangkah(i)} title={s.judul || `Kuis ${i + 1}`}
      className={`h-1.5 rounded-full ${i === idx ? 'flex-[2] bg-teal-600' : i < idx ? 'flex-1 bg-teal-300' : 'flex-1 bg-gray-200'}`} />)}</div>
    <div className="mb-6 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-5 pb-4 pt-6 sm:px-7">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-teal-700">Tahap {TAHAP.find(t => t.id === tahapSekarang)?.judul} · Langkah {idx + 1}/{total}</p>
        {pengantar[tahapSekarang] && <p className="mb-2 text-sm text-gray-600">{pengantar[tahapSekarang]}</p>}
        <h3 className="text-xl font-bold text-gray-800">{sg.jenis === 'kuis' ? 'Kuis Pembelajaran' : sg.judul || `Subbab ${idx + 1}`}</h3>
      </div>
      <div className="flex flex-col gap-5 px-5 py-6 sm:px-7">
        {sg.jenis === 'kuis' && sg.kuis
          ? <KuisInteraktif key={sg.id} kuis={sg.kuis} onSelesai={benar => setHasilKuis(prev => ({ ...prev, [sg.id]: benar }))} />
          : sg.blok.map(b => <RenderBlok key={b.id} b={b} />)}
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
        className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-600 disabled:opacity-40">← Sebelumnya</button>
      <div className="flex-1" />
      {sg.jenis === 'kuis' && hasilKuis[sg.id] === undefined && <span className="hidden text-[11px] text-amber-700 sm:inline">Jawab kuis atau lanjutkan</span>}
      {idx < total - 1
        ? <button type="button" onClick={() => setIdx(i => i + 1)} className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-medium text-white">Lanjut →</button>
        : <button type="button" onClick={() => setSelesai(true)} className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-medium text-white">Selesai ✓</button>}
    </div>
    </div>
  </div>
}
