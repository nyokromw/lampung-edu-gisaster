"use client";

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Materi = {
  id: string | number
  judul: string
  is_konsep_dasar?: boolean | null
  jenis_bencana?: { nama?: string | null } | null
  segmen?: Array<{ kuis?: unknown; blok?: unknown[] }> | null
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
    jumlah: segmen.length,
    adaKuis: segmen.some(s => Boolean(s.kuis)),
    aktivitas: segmen.reduce((total, s) => total + (Array.isArray(s.blok) ? s.blok.length : 0), 0),
  }
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
  const quizCount = useMemo(() => materi.filter(m => infoSegmen(m).adaKuis).length, [materi])

  return (
    <main className="min-h-screen bg-[#f6fbff] text-[#17345a]">
      <section className="relative overflow-hidden border-b border-[#dcecf8] bg-[linear-gradient(125deg,#e4f4ff_0%,#f8fcff_57%,#eaf7ff_100%)]">
        <svg className="pointer-events-none absolute -right-32 -top-28 h-[460px] w-[660px] opacity-40" viewBox="0 0 660 460" fill="none" stroke="#9cd3f1" strokeWidth="1" aria-hidden="true">
          <path d="M343 18C205 38 197 82 152 137 112 185 15 165 9 255c-5 65 62 77 143 67 82-10 142-12 175 52 40 78 182 100 237 31 57-70-3-141-5-191-1-64 95-110 60-160C585 5 451 2 343 18Z" />
          <path d="M343 47c-112 17-133 62-168 107-35 46-116 48-126 106-11 55 52 55 114 45 89-14 153-1 186 58 41 74 163 78 197 23 38-60-26-117-16-172 10-55 78-101 38-134-38-32-127-44-225-33Z" />
          <path d="M348 76c-88 12-110 51-147 94-36 41-100 55-102 92-3 35 42 31 81 27 92-10 156 12 191 66 43 66 135 57 153 18 21-47-30-109-20-165 10-53 48-78 25-101-30-28-105-41-181-31Z" />
          <path d="M354 107c-62 6-91 43-127 79-35 35-73 54-73 78 0 22 34 10 64 11 79 3 142 29 179 77 40 51 98 39 110 11 15-39-26-96-22-144 5-44 27-69 7-86-27-24-77-32-138-26Z" />
        </svg>
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-11 pt-10 sm:px-8 md:pb-14 md:pt-14 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)] lg:px-10">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#d7eafa] bg-white/90 px-3 py-1.5 text-[11px] font-bold text-[#1764a7] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#0c9dab]" /> LAMPUNG EDU GISASTER / MATERI
            </span>
            <h1 className="mt-5 max-w-2xl text-[clamp(36px,4.5vw,60px)] font-extrabold leading-[1.08] tracking-[-.055em] text-[#17274e]">
              Pahami bencana.<br /><span className="bg-gradient-to-r from-[#07969c] to-[#2168cb] bg-clip-text text-transparent">Kenali risikonya.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#5c7593] sm:text-[15px]">
              Materi kebencanaan disusun bertahap agar kamu dapat memahami fenomena, membaca kondisi sekitar, dan mengambil keputusan yang lebih tepat.
            </p>
            <div className="relative mt-7 max-w-xl">
              <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6987a8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></svg>
              <input aria-label="Cari materi kebencanaan" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari topik, misalnya banjir atau longsor..." className="h-12 w-full rounded-2xl border border-[#cbdff1] bg-white py-3 pl-12 pr-12 text-sm text-[#17345a] shadow-[0_8px_24px_rgba(24,89,151,.07)] outline-none placeholder:text-[#89a0b8] focus:border-[#2685d4] focus:ring-4 focus:ring-[#d6ecff]" />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Hapus pencarian" className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#7893ab] hover:bg-[#eaf4fc]"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 5 19 19M19 5 5 19" /></svg></button>}
            </div>
            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#617e9c]">
              <span><strong className="text-[#245da3]">{loading ? '—' : materi.length}</strong> materi tersedia</span>
              <span><strong className="text-[#245da3]">{loading ? '—' : filters.length - 1}</strong> kategori</span>
              <span><strong className="text-[#245da3]">{loading ? '—' : quizCount}</strong> materi dengan kuis</span>
            </div>
          </div>
          <div className="relative hidden rounded-[28px] border border-white bg-white/85 p-6 shadow-[0_20px_45px_rgba(29,91,148,.09)] lg:block">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#e0f4f8] text-[#0b91a6]"><svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16" /></svg></span>
              <div><p className="text-xs font-semibold uppercase tracking-wider text-[#0b91a6]">Alur belajar</p><p className="text-lg font-bold text-[#18365a]">Mulai dari pemahaman</p></div>
            </div>
            <div className="relative ml-4 border-l border-[#cfe4f4] pb-1 pl-7">
              <div className="relative pb-5"><span className="absolute -left-[39px] grid h-6 w-6 place-items-center rounded-full bg-[#246bd0] text-[10px] font-bold text-white">1</span><strong className="block text-sm text-[#23486d]">Pelajari konsep dasar</strong><span className="text-xs leading-5 text-[#7089a4]">Kenali istilah dan proses kebencanaan.</span></div>
              <div className="relative pb-5"><span className="absolute -left-[39px] grid h-6 w-6 place-items-center rounded-full bg-[#13a2a8] text-[10px] font-bold text-white">2</span><strong className="block text-sm text-[#23486d]">Jelajahi jenis bencana</strong><span className="text-xs leading-5 text-[#7089a4]">Pahami ciri dan dampaknya di sekitar kita.</span></div>
              <div className="relative"><span className="absolute -left-[39px] grid h-6 w-6 place-items-center rounded-full bg-[#e7a73e] text-[10px] font-bold text-white">3</span><strong className="block text-sm text-[#23486d]">Uji pemahaman</strong><span className="text-xs leading-5 text-[#7089a4]">Gunakan kuis pada materi yang tersedia.</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 pt-9 sm:px-8 lg:px-10" aria-labelledby="daftar-materi">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#0b9aa7]">Perpustakaan belajar</p><h2 id="daftar-materi" className="mt-1 text-2xl font-bold tracking-tight text-[#193458] sm:text-[28px]">Jelajahi materi</h2></div>
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
          {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[246px] animate-pulse rounded-[22px] border border-[#e1edf7] bg-white p-5"><div className="h-12 w-12 rounded-2xl bg-[#e9f3fa]" /><div className="mt-6 h-4 w-24 rounded bg-[#e9f3fa]" /><div className="mt-4 h-6 w-4/5 rounded bg-[#e9f3fa]" /><div className="mt-8 h-4 w-1/2 rounded bg-[#e9f3fa]" /></div>)}
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
            return <Link key={m.id} href={'/materi/' + m.id} className="group relative flex min-h-[248px] flex-col overflow-hidden rounded-[22px] border border-[#dfebf5] bg-white p-5 shadow-[0_6px_20px_rgba(30,83,133,.045)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#b2d3ee] hover:shadow-[0_18px_36px_rgba(30,83,133,.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246bd0]">
              <span className={'absolute inset-x-0 top-0 h-1 ' + tone.line} />
              <div className="flex items-start justify-between gap-3">
                <span className={'grid h-12 w-12 shrink-0 place-items-center rounded-2xl ' + tone.icon}><span className="h-6 w-6"><TopicIcon name={label} /></span></span>
                {info.adaKuis && <span className="rounded-full border border-[#f4dfb2] bg-[#fff8e8] px-2.5 py-1 text-[10px] font-semibold text-[#a66c0b]">Ada kuis</span>}
              </div>
              <div className="mt-5"><span className={'inline-flex max-w-full rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ' + tone.tag}>{label}</span><h3 className="mt-3 text-[17px] font-bold leading-snug text-[#19385e] transition-colors group-hover:text-[#1d67c8]">{m.judul}</h3></div>
              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-6 text-[11px] text-[#738aa2]">
                <span>{info.jumlah} segmen</span>
                {info.aktivitas > 0 && <><span className="h-1 w-1 rounded-full bg-[#a8bdd2]" /><span>{info.aktivitas} aktivitas</span></>}
                <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[#236bd1]">Buka materi <span className="h-4 w-4 transition-transform group-hover:translate-x-1"><ArrowIcon /></span></span>
              </div>
            </Link>
          })}
        </div>}
      </section>
    </main>
  )
}
