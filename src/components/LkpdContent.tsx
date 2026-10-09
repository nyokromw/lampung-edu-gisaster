'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

interface LkpdItem {
  id: string
  judul: string
  pertanyaan: Array<{ tipe?: string; fase?: string | null; ada_peta?: boolean }> | null
  kabupaten: { nama: string } | null
  jenis_bencana: { nama: string } | null
}

interface Props {
  lkpd: LkpdItem[]
  allKabupaten: string[]
  allBencana: string[]
  loadError?: boolean
}

const TIPE_LABEL: Record<string, string> = {
  esai: 'Esai',
  pilihan_ganda: 'Pilihan Ganda',
  tabel: 'Tabel',
  diagram: 'Diagram',
  peta: 'Peta',
}

const FASE_STYLE: Record<string, { dot: string; bg: string; text: string; border: string }> = {
  Memahami:     { dot: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200' },
  Mengaplikasi: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Merefleksi:   { dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
}

type IkonBencana = 'banjir' | 'bandang' | 'longsor' | 'gempa' | 'tsunami' | 'gunung' | 'api' | 'kering' | 'angin' | 'wabah' | 'teknologi' | 'multi' | 'dokumen'

function temaBencana(nama: string): { ikon: IkonBencana; warna: string } {
  const n = nama.toLowerCase()
  if (/tsunami/.test(n)) return { ikon: 'tsunami', warna: 'bg-indigo-50 text-indigo-600' }
  if (/banjir.*bandang|bandang/.test(n)) return { ikon: 'bandang', warna: 'bg-cyan-50 text-cyan-700' }
  if (/banjir|rob/.test(n)) return { ikon: 'banjir', warna: 'bg-sky-50 text-sky-600' }
  if (/longsor|gerakan tanah/.test(n)) return { ikon: 'longsor', warna: 'bg-amber-50 text-amber-700' }
  if (/gempa/.test(n)) return { ikon: 'gempa', warna: 'bg-violet-50 text-violet-600' }
  if (/gunung|erupsi|vulkan/.test(n)) return { ikon: 'gunung', warna: 'bg-orange-50 text-orange-600' }
  if (/kebakaran|karhutla/.test(n)) return { ikon: 'api', warna: 'bg-red-50 text-red-600' }
  if (/kering/.test(n)) return { ikon: 'kering', warna: 'bg-yellow-50 text-yellow-700' }
  if (/angin|puting|badai|siklon/.test(n)) return { ikon: 'angin', warna: 'bg-teal-50 text-teal-600' }
  if (/wabah|penyakit|epidemi|pandemi/.test(n)) return { ikon: 'wabah', warna: 'bg-emerald-50 text-emerald-600' }
  if (/teknologi|industri/.test(n)) return { ikon: 'teknologi', warna: 'bg-slate-100 text-slate-600' }
  if (/multi/.test(n)) return { ikon: 'multi', warna: 'bg-purple-50 text-purple-600' }
  return { ikon: 'dokumen', warna: 'bg-blue-50 text-blue-600' }
}

function DisasterIcon({ ikon }: { ikon: IkonBencana }) {
  // SVG lokal: ikon tetap terlihat tanpa mengunduh gambar atau paket tambahan.
  const paths: Record<IkonBencana, string[]> = {
    banjir: ['M4 13V8l5-4 5 4v5M7 11h4', 'M2 15c2-2 3 2 5 0s3 2 5 0 3 2 5 0 3 2 5 0M2 20c2-2 3 2 5 0s3 2 5 0 3 2 5 0 3 2 5 0'],
    bandang: ['M2 10 7 3l5 7 4-5 6 5', 'M2 14h13m-3-3 3 3-3 3M4 19h17m-3-3 3 3-3 3'],
    longsor: ['M2 20 10 4l6 9M2 20h20', 'm12 7 3 1-1 3-3-1 1-3Zm4 7 3 1-1 3-3-1 1-3Zm4-3 2 1-1 2-2-1 1-2Z'],
    gempa: ['M3 20V7l6-4 6 4v4M6 8h2m3 0h1M6 12h2', 'm13 12-3 4 4 1-3 5M17 8l-1 4 4 2-2 5M2 20h5m9 0h6'],
    tsunami: ['M2 17c3 0 3-8 8-11 5-3 12-1 11 4-.5 2-4 3-6 1 4 5 4 7 7 7', 'M2 21c2-2 3 2 5 0s3 2 5 0 3 2 5 0 3 2 5 0'],
    gunung: ['M2 21 9 9h6l7 12H2Zm7-12 3 4 3-4', 'M12 6V2M7 6 5 3m12 3 2-3M5 20l5-7m9 7-5-7'],
    api: ['M12 22c5 0 8-4 7-8-1-3-3-5-3-5 0 3-2 4-2 4 1-5-3-8-5-11 1 6-4 8-4 13 0 4 3 7 7 7Z', 'M12 21c-3 0-4-3-3-5l3-4c0 3 3 4 3 6 0 2-1 3-3 3Z'],
    kering: ['M12 3v2m0 12v2M3 12h2m12 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2', 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2 23h20m-13 0 2-3 3 3m3 0 2-3'],
    angin: ['M3 8h11c4 0 4-5 1-5-2 0-3 1-3 2M2 12h17c4 0 4 5 1 5-2 0-3-1-3-2M4 16h7c4 0 4 5 1 5-2 0-3-1-3-2'],
    wabah: ['M18 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0ZM12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3', 'M10 10h.01M14 11h.01M11 14h.01'],
    teknologi: ['M3 21V10l6 3V8l6 3V3h4v18H3ZM6 17h1m4 0h1m4 0h1'],
    multi: ['m12 3 10 18H2L12 3ZM12 9v5m0 3h.01'],
    dokumen: ['M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 12h8m-8 4h6'],
  }
  return <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths[ikon].map((d, i) => <path key={i} d={d} />)}
  </svg>
}

const selectClass = "w-full cursor-pointer rounded-xl border border-[#d9e7f4] bg-[#f6fbff] px-3 py-2.5 text-sm text-[#17345a] outline-none transition-colors focus:border-[#2685d4] focus:ring-2 focus:ring-[#d6ecff]"

export default function LkpdContent({ lkpd, allKabupaten, allBencana, loadError = false }: Props) {
  const [filterKab, setFilterKab] = useState<string>('all')
  const [filterBencana, setFilterBencana] = useState<string>('all')

  const kabCounts = useMemo(() => {
    const map: Record<string, number> = {}
    allKabupaten.forEach((k) => (map[k] = 0))
    lkpd.forEach((l) => {
      const name = l.kabupaten?.nama
      if (name && map[name] !== undefined) map[name]++
    })
    return map
  }, [lkpd, allKabupaten])

  const bencanaCounts = useMemo(() => {
    const map: Record<string, number> = {}
    allBencana.forEach((b) => (map[b] = 0))
    lkpd.forEach((l) => {
      const name = l.jenis_bencana?.nama
      if (name && map[name] !== undefined) map[name]++
    })
    return map
  }, [lkpd, allBencana])

  const filtered = useMemo(() => {
    return lkpd.filter((l) => {
      const kabMatch = filterKab === 'all' || l.kabupaten?.nama === filterKab
      const benMatch = filterBencana === 'all' || l.jenis_bencana?.nama === filterBencana
      return kabMatch && benMatch
    })
  }, [lkpd, filterKab, filterBencana])

  const grouped = useMemo(() => {
    const map = new Map<string, LkpdItem[]>()
    filtered.forEach((l) => {
      const key = l.kabupaten?.nama || 'Lainnya'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(l)
    })
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const clearFilters = () => {
    setFilterKab('all')
    setFilterBencana('all')
  }

  const hasFilter = filterKab !== 'all' || filterBencana !== 'all'

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 lg:px-10">

      {/* ═══ FILTER BAR ═══ */}
      <div className="mb-6 rounded-2xl border border-[#dfebf5] bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label htmlFor="lkpd-kabupaten" className="mb-1.5 block text-xs font-medium text-[#617e9c]">Kabupaten / Kota</label>
            <select
              id="lkpd-kabupaten"
              value={filterKab}
              onChange={(e) => setFilterKab(e.target.value)}
              className={selectClass}
            >
              <option value="all">Semua Kabupaten/Kota ({lkpd.length} LKPD)</option>
              {allKabupaten.map((name) => (
                <option key={name} value={name}>
                  {name} ({kabCounts[name] || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 w-full">
            <label htmlFor="lkpd-bencana" className="mb-1.5 block text-xs font-medium text-[#617e9c]">Jenis Bencana</label>
            <select
              id="lkpd-bencana"
              value={filterBencana}
              onChange={(e) => setFilterBencana(e.target.value)}
              className={selectClass}
            >
              <option value="all">Semua Jenis Bencana</option>
              {allBencana.map((name) => (
                <option key={name} value={name}>
                  {name} ({bencanaCounts[name] || 0})
                </option>
              ))}
            </select>
          </div>

          {hasFilter && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] text-red-500 hover:text-red-700 font-medium cursor-pointer transition-colors whitespace-nowrap px-3 py-2.5"
            >
              Reset ×
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-[#738aa2]" aria-live="polite" role="status">Menampilkan <strong className="font-semibold text-[#235fa7]">{filtered.length}</strong> dari {lkpd.length} E-LKPD</p>
      </div>

      {/* ═══ CONTENT ═══ */}
      {loadError ? <div className="rounded-2xl border border-[#dfebf5] bg-white px-5 py-12 text-center">
        <p className="font-semibold text-[#193458]">Daftar LKPD belum dapat dimuat.</p>
        <p className="mt-2 text-sm text-[#617e9c]">Periksa koneksi, lalu coba kembali.</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-[#236bd1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#195bb8]">Muat ulang</button>
      </div> : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#dfebf5] bg-white px-5 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          {hasFilter ? (
            <>
              <p className="text-gray-500 text-sm font-medium">Tidak ada E-LKPD untuk filter ini</p>
              <button
                onClick={clearFilters}
                className="text-blue-600 text-xs font-medium mt-2 hover:underline cursor-pointer"
              >
                Tampilkan semua
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm font-medium">Belum ada E-LKPD tersedia</p>
              <p className="text-gray-400 text-xs mt-1">Lembar kerja sedang dalam tahap penyusunan</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([kabName, items]) => (
            <div key={kabName}>
              {/* Group header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                  </svg>
                  <h2 className="text-base font-bold text-[#193458]">{kabName}</h2>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                    {items.length} LKPD
                  </span>
                </div>
                <div className="h-px flex-1 bg-[#dfebf5]" />
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((l) => {
                  const pertanyaan = Array.isArray(l.pertanyaan) ? l.pertanyaan.filter(Boolean) : []
                  const fasesAda = [...new Set(pertanyaan.map(a => a.fase || 'Memahami'))]
                  const hasPeta = pertanyaan.some(a => a.tipe === 'peta' || a.ada_peta)
                  const tipeList = [...new Set(pertanyaan.map(a => a.tipe).filter((tipe): tipe is string => Boolean(tipe)))]
                  const namaBencana = l.jenis_bencana?.nama || 'Kebencanaan'
                  const tema = temaBencana(namaBencana)

                  return (
                    <Link key={l.id} href={`/lkpd/${l.id}`}
                      className="group flex flex-col rounded-2xl border border-[#dfebf5] bg-white p-5 shadow-sm transition-[box-shadow,border-color] duration-200 hover:border-[#b2d3ee] hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#246bd0]">
                      <div className="mb-4 flex items-center gap-3">
                        <span className={'grid h-12 w-12 shrink-0 place-items-center rounded-xl ' + tema.warna}><DisasterIcon ikon={tema.ikon} /></span>
                        <p className="text-xs font-semibold leading-5 text-[#617e9c]">{namaBencana}</p>
                      </div>
                      <h3 className="text-base font-bold leading-snug text-[#19385e] transition-colors group-hover:text-[#1d67c8]">{l.judul}</h3>
                      {fasesAda.length > 0 && <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                        {fasesAda.map(fase => <span key={fase} className="inline-flex items-center gap-1.5 text-[11px] text-[#617e9c]">
                          <span className={'h-1.5 w-1.5 rounded-full ' + (FASE_STYLE[fase]?.dot || 'bg-slate-400')} aria-hidden="true" />{fase}
                        </span>)}
                      </div>}
                      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#738aa2]">
                        <span>{pertanyaan.length} aktivitas</span>
                        {tipeList.slice(0, 2).map(t => <span key={t}>· {TIPE_LABEL[t] || t}</span>)}
                        {hasPeta && <span className="rounded-md bg-[#eef6ff] px-2 py-0.5 font-medium text-[#236bd1]">Berbasis peta</span>}
                      </div>
                      <div className="mt-auto pt-5">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#236bd1]">Mulai kerjakan
                          <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}