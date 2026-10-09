"use client";

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Materi = {
  id: string | number
  judul: string
  thumbnail_url?: string | null
  is_konsep_dasar?: boolean | null
  jenis_bencana?: { nama?: string | null } | null
  segmen?: Array<{ jenis?: string; kuis?: unknown; blok?: Array<{ tipe?: string; url?: string }> }> | null
}

const tones = [
  { icon: 'bg-sky-100 text-sky-700', tag: 'bg-sky-50 text-sky-700 border-sky-200', line: 'bg-sky-500' },
  { icon: 'bg-cyan-100 text-cyan-700', tag: 'bg-cyan-50 text-cyan-700 border-cyan-200', line: 'bg-cyan-500' },
  { icon: 'bg-amber-100 text-amber-700', tag: 'bg-amber-50 text-amber-700 border-amber-200', line: 'bg-amber-500' },
  { icon: 'bg-emerald-100 text-emerald-700', tag: 'bg-emerald-50 text-emerald-700 border-emerald-200', line: 'bg-emerald-500' },
  { icon: 'bg-violet-100 text-violet-700', tag: 'bg-violet-50 text-violet-700 border-violet-200', line: 'bg-violet-500' },
  { icon: 'bg-rose-100 text-rose-700', tag: 'bg-rose-50 text-rose-700 border-rose-200', line: 'bg-rose-500' },
]

function kategori(m: Materi) {
  return m.is_konsep_dasar ? 'Konsep Dasar' : (m.jenis_bencana?.nama || 'Lainnya')
}

function infoSegmen(m: Materi) {
  const segmen = Array.isArray(m.segmen) ? m.segmen : []
  return {
    jumlah: segmen.filter(s => s.jenis !== 'tahap' && s.jenis !== 'kuis').length,
    adaKuis: segmen.some(s => Boolean(s.kuis)),
  }
}

function gambarMateri(m: Materi): string[] {
  const urls = [m.thumbnail_url, ...(Array.isArray(m.segmen) ? m.segmen : [])
    .flatMap(s => Array.isArray(s.blok) ? s.blok : [])
    .filter(b => b.tipe === 'gambar').map(b => b.url)]
  return Array.from(new Set(urls.filter((url): url is string =>
    typeof url === 'string' && /^https?:\/\//i.test(url.trim())).map(url => url.trim())))
}

function SampulMateri({ materi, label, tone }: { materi: Materi; label: string; tone: typeof tones[number] }) {
  const [gagal, setGagal] = useState<string[]>([])
  const url = gambarMateri(materi).find(src => !gagal.includes(src))
  return <div className={'relative aspect-video overflow-hidden ' + tone.icon}>
    {url ? <img src={url} alt="" loading="lazy" decoding="async"
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      onError={() => setGagal(prev => [...prev, url])} />
      : <div className="flex h-full items-center justify-center" aria-hidden="true">
        <svg className="absolute inset-0 h-full w-full opacity-10" viewBox="0 0 320 180" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M-30 130C40 10 140 190 210 60S320 30 370 100M-30 150C40 30 140 210 210 80S320 50 370 120M-30 110C40-10 140 170 210 40S320 10 370 80" />
        </svg>
        <span className="relative grid h-16 w-16 place-items-center rounded-2xl bg-white/70"><TopicIcon name={label} /></span>
      </div>}
  </div>
}

function nomorJudul(judul: string) {
  const match = judul.match(/^(\d+)/)
  return match ? Number(match[1]) : Infinity
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
}

function TopicIcon({ name }: { name: string }) {
  const lower = name.toLowerCase()
  let symbol = <><path d="M12 5C9.5 3.5 6.5 3.5 3 4.5v15c3.5-1 6.5-1 9 .5 2.5-1.5 5.5-1.5 9-.5v-15c-3.5-1-6.5-1-9 .5Z" /><path d="M12 5v15" /></>
  if (/(banjir|tsunami|rob)/.test(lower)) symbol = <><path d="M2 9c2 0 2 2 5 2s3-2 5-2 2 2 5 2 3-2 5-2M2 15c2 0 2 2 5 2s3-2 5-2 2 2 5 2 3-2 5-2" /><path d="M4 5h16" /></>
  else if (/(longsor|gunung|erupsi)/.test(lower)) symbol = <><path d="m2 19 7-12 4 6 2-3 7 9H2Z" /><path d="m7 11 2 2 2-2" /></>
  else if (/(gempa)/.test(lower)) symbol = <><path d="M2 12h4l2-4 3 9 3-11 2 6h6" /><path d="M5 20h14" /></>
  else if (/(api|kebakaran|kering)/.test(lower)) symbol = <path d="M12 22c4.5 0 7-3 7-7 0-3-1-5-4-8 0 3-1 4-2 5C13 8 11 5 8 2c1 5-3 7-3 13 0 4 2.5 7 7 7Z" />
  else if (/(angin|puting)/.test(lower)) symbol = <><path d="M3 8h11c4 0 4-5 1-5-2 0-3 1-3 2M2 12h17c4 0 4 5 1 5-2 0-3-1-3-2M4 16h7c4 0 4 5 1 5-2 0-3-1-3-2" /></>
  return <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{symbol}</svg>
}

export default function MateriPage() {
  const [materi, setMateri] = useState<Materi[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('semua')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('materi_bencana')
          .select('*, jenis_bencana(nama)')
          .eq('published', true)
          .order('is_konsep_dasar', { ascending: false })
        if (!active) return
        setLoadError(Boolean(error))
        setMateri(error ? [] : (data ?? []) as Materi[])
        setLoading(false)
      } catch {
        if (active) { setLoadError(true); setLoading(false) }
      }
    }
    void load()
    return () => { active = false }
  }, [retry])

  const filters = useMemo(() => ['semua', ...Array.from(new Set(materi.map(kategori)))], [materi])
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    materi.forEach(m => { const key = kategori(m); result[key] = (result[key] || 0) + 1 })
    return result
  }, [materi])
  const toneMap = useMemo(() => {
    const result: Record<string, typeof tones[number]> = {}
    filters.slice(1).forEach((name, index) => { result[name] = name === 'Konsep Dasar' ? tones[4] : tones[index % tones.length] })
    return result
  }, [filters])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return materi
      .filter(m => activeFilter === 'semua' || kategori(m) === activeFilter)
      .filter(m => !query || m.judul.toLowerCase().includes(query) || kategori(m).toLowerCase().includes(query))
      .sort((a, b) => nomorJudul(a.judul) - nomorJudul(b.judul))
  }, [materi, activeFilter, search])

  return (
    <main className="min-h-screen bg-[#f6fbff] text-[#17345a]">
      <header className="border-b border-[#dcecf8] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
          <p className="text-xs font-semibold text-[#0b91a6]">Lampung Edu Gisaster</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#193458]">Materi Kebencanaan</h1>
          <p className="mt-2 text-sm text-[#617e9c]">Kenali bencana, pahami risikonya, dan pelajari langkah mitigasinya.</p>
          <div className="relative mt-5 max-w-xl">
            <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6987a8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
            <input aria-label="Cari materi kebencanaan" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari materi banjir, longsor, atau topik lainnya..." className="h-11 w-full rounded-xl border border-[#d9e7f4] bg-[#f6fbff] pl-11 pr-4 text-sm outline-none focus:border-[#2685d4] focus:ring-2 focus:ring-[#d6ecff]" />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-20 pt-9 sm:px-8 lg:px-10" aria-labelledby="daftar-materi">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div><h2 id="daftar-materi" className="mt-1 text-2xl font-bold tracking-tight text-[#193458] sm:text-[28px]">Jelajahi materi</h2></div>
          {!loading && !loadError && <p className="text-xs text-[#6a83a0]" aria-live="polite">Menampilkan <strong className="text-[#235fa7]">{filtered.length}</strong> dari {materi.length} materi</p>}
        </div>
        {!loading && !loadError && filters.length > 1 && <div className="-mx-1 mb-7 flex gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Filter kategori materi">
          {filters.map(filter => {
            const selected = activeFilter === filter
            return <button key={filter} type="button" onClick={() => setActiveFilter(filter)} aria-pressed={selected} className={selected
              ? 'flex shrink-0 items-center gap-2 rounded-full border border-[#236bd1] bg-[#236bd1] px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(35,107,209,.17)]'
              : 'flex shrink-0 items-center gap-2 rounded-full border border-[#d9e7f4] bg-white px-4 py-2 text-xs font-semibold text-[#54708f] transition-colors hover:border-[#7db8e6] hover:text-[#236bd1]'}>
              {filter === 'semua' ? 'Semua Materi' : filter}
              <span className={selected ? 'rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]' : 'rounded-full bg-[#eef5fb] px-1.5 py-0.5 text-[10px] text-[#6d87a1]'}>{filter === 'semua' ? materi.length : counts[filter]}</span>
            </button>
          })}
        </div>}

        {loading ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Memuat materi">
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-[#e1edf7] bg-white"><div className="aspect-video bg-[#e9f3fa]" /><div className="p-4"><div className="h-3 w-20 rounded bg-[#e9f3fa]" /><div className="mt-4 h-5 w-4/5 rounded bg-[#e9f3fa]" /><div className="mt-5 h-3 w-1/2 rounded bg-[#e9f3fa]" /></div></div>)}
        </div> : loadError ? <div className="rounded-[22px] border border-[#dce9f5] bg-white px-6 py-14 text-center shadow-sm">
          <p className="font-semibold text-[#25486b]">Materi belum dapat dimuat.</p><p className="mt-1 text-sm text-[#7089a1]">Periksa koneksi lalu coba kembali.</p>
          <button type="button" onClick={() => { setLoading(true); setLoadError(false); setRetry(value => value + 1) }} className="mt-5 rounded-full bg-[#236bd1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#195bb8]">Muat ulang</button>
        </div> : filtered.length === 0 ? <div className="rounded-[22px] border border-[#dce9f5] bg-white px-6 py-14 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eaf5fc] text-[#2476b4]"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg></span>
          <p className="mt-4 font-semibold text-[#25486b]">{materi.length ? 'Materi tidak ditemukan' : 'Belum ada materi tersedia'}</p>
          <p className="mt-1 text-sm text-[#7089a1]">{materi.length ? 'Coba kata kunci atau kategori lain.' : 'Silakan kembali lagi nanti.'}</p>
          {materi.length > 0 && <button type="button" onClick={() => { setSearch(''); setActiveFilter('semua') }} className="mt-5 text-sm font-semibold text-[#236bd1] hover:underline">Tampilkan semua materi</button>}
        </div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(m => {
            const label = kategori(m)
            const tone = toneMap[label] || tones[0]
            const info = infoSegmen(m)
            return <Link key={m.id} href={'/materi/' + m.id} className="group flex flex-col overflow-hidden rounded-2xl border border-[#dfebf5] bg-white shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-[#b2d3ee] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246bd0]">
              <SampulMateri materi={m} label={label} tone={tone} />
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                <p className="text-xs font-semibold text-[#0b91a6]">{label}</p>
                <h3 className="mt-2 text-base font-bold leading-snug text-[#19385e] group-hover:text-[#1d67c8]">{m.judul}</h3>
                <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-xs">
                  <span className="text-[#738aa2]">{info.jumlah} subbab{info.adaKuis ? ' · Kuis' : ''}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#236bd1]">Pelajari <span className="h-4 w-4"><ArrowIcon /></span></span>
                </div>
              </div>
            </Link>
          })}
        </div>}
      </section>
    </main>
  )
}