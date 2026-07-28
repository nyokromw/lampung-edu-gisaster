'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

interface LkpdItem {
  id: string
  judul: string
  pertanyaan: any[]
  kabupaten: { nama: string } | null
  jenis_bencana: { nama: string } | null
}

interface Props {
  lkpd: LkpdItem[]
  allKabupaten: string[]
  allBencana: string[]
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

const selectClass = "w-full border border-gray-200 bg-white px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all appearance-none cursor-pointer"

export default function LkpdContent({ lkpd, allKabupaten, allBencana }: Props) {
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
    <div className="max-w-6xl mx-auto px-6 py-6">

      {/* ═══ FILTER BAR ═══ */}
      <div className="bg-white rounded-xl border border-gray-200/80 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Kabupaten / Kota
            </p>
            <select
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
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Jenis Bencana
            </p>
            <select
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
              onClick={clearFilters}
              className="text-[11px] text-red-500 hover:text-red-700 font-medium cursor-pointer transition-colors whitespace-nowrap px-3 py-2.5"
            >
              Reset ×
            </button>
          )}
        </div>

        {hasFilter && (
          <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
            Menampilkan {filtered.length} dari {lkpd.length} E-LKPD
          </p>
        )}
      </div>

      {/* ═══ CONTENT ═══ */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
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
                  <h2 className="text-sm font-bold text-gray-800">{kabName}</h2>
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                    {items.length} LKPD
                  </span>
                </div>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((l) => {
                  const pertanyaan = l.pertanyaan || []
                  const tipeList = [...new Set(pertanyaan.map((a: any) => a.tipe))] as string[]
                  const fasesAda = [...new Set(pertanyaan.map((a: any) => a.fase || 'Memahami'))] as string[]
                  const hasPeta = pertanyaan.some((a: any) => a.tipe === 'peta' || a.ada_peta)

                  return (
                    <Link
                      key={l.id}
                      href={`/lkpd/${l.id}`}
                      className="group bg-white rounded-xl border border-gray-200/80 hover:border-blue-300 hover:shadow-md hover:shadow-blue-100/40 transition-all overflow-hidden"
                    >
                      <div className="flex h-1">
                        {fasesAda.includes('Memahami') && <div className="flex-1 bg-blue-500" />}
                        {fasesAda.includes('Mengaplikasi') && <div className="flex-1 bg-emerald-500" />}
                        {fasesAda.includes('Merefleksi') && <div className="flex-1 bg-amber-500" />}
                      </div>

                      <div className="p-4">
                        <span className="text-[10px] font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-md inline-block mb-2">
                          {l.jenis_bencana?.nama}
                        </span>

                        <h3 className="font-bold text-gray-800 text-[13px] leading-snug mb-2.5 group-hover:text-blue-700 transition-colors line-clamp-2">
                          {l.judul}
                        </h3>

                        <div className="flex flex-wrap gap-1 mb-3">
                          {fasesAda.map((fase: string) => {
                            const s = FASE_STYLE[fase] || FASE_STYLE.Memahami
                            return (
                              <span
                                key={fase}
                                className={`text-[10px] font-medium ${s.bg} ${s.text} ${s.border} border px-2 py-0.5 rounded-md flex items-center gap-1`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                                {fase}
                              </span>
                            )
                          })}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-3">
                          <span>{pertanyaan.length} aktivitas</span>
                          {tipeList.slice(0, 2).map((t: string) => (
                            <span key={t}>· {TIPE_LABEL[t] || t}</span>
                          ))}
                          {hasPeta && (
                            <span className="bg-blue-950 text-white px-1.5 py-0.5 rounded text-[9px] font-medium">
                              🗺 Peta
                            </span>
                          )}
                        </div>

                        <span className="text-[12px] font-semibold text-blue-600 flex items-center gap-1 transition-all group-hover:gap-2">
                          Mulai Kerjakan
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                          </svg>
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