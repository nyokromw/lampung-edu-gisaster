'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ── Ikon bencana sederhana (SVG inline agar tidak perlu dependensi) ──
const ikonBencana: Record<string, string> = {
  'banjir': '🌊',
  'gempa bumi': '🔴',
  'tsunami': '🌊',
  'longsor': '⛰️',
  'tanah longsor': '⛰️',
  'banjir bandang': '💧',
  'gunung berapi': '🌋',
  'erupsi': '🌋',
  'kebakaran': '🔥',
  'kekeringan': '☀️',
  'angin puting beliung': '🌪️',
  'puting beliung': '🌪️',
  'rob': '🌊',
}

function getIkon(nama: string) {
  const lower = nama.toLowerCase()
  for (const [key, ikon] of Object.entries(ikonBencana)) {
    if (lower.includes(key)) return ikon
  }
  return '⚠️'
}

// ── Warna unik per kategori (rotasi) ──
const kategoriWarna = [
  { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', hoverBg: 'hover:bg-sky-100', accent: 'bg-sky-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', hoverBg: 'hover:bg-rose-100', accent: 'bg-rose-500' },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', hoverBg: 'hover:bg-amber-100', accent: 'bg-amber-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', hoverBg: 'hover:bg-emerald-100', accent: 'bg-emerald-500' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', hoverBg: 'hover:bg-violet-100', accent: 'bg-violet-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', hoverBg: 'hover:bg-orange-100', accent: 'bg-orange-500' },
]

function infoSegmen(m: any) {
  const seg = Array.isArray(m.segmen) ? m.segmen : []
  const adaKuis = seg.some((s: any) => s.kuis)
  const totalBlok = seg.reduce((t: number, s: any) => t + (Array.isArray(s.blok) ? s.blok.length : 0), 0)
  return { jml: seg.length, adaKuis, totalBlok }
}

export default function MateriPage() {
  const [materi, setMateri] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('semua')

  useEffect(() => {
    supabase
      .from('materi_bencana')
      .select('*, jenis_bencana(nama)')
      .eq('published', true)
      .order('is_konsep_dasar', { ascending: false })
      .then(({ data }) => {
        if (data) setMateri(data)
        setLoading(false)
      })
  }, [])

  // Bangun daftar filter dari data
  const filters = useMemo(() => {
    const set = new Set<string>()
    materi.forEach(m => {
      if (m.is_konsep_dasar) set.add('Konsep Dasar')
      else if (m.jenis_bencana?.nama) set.add(m.jenis_bencana.nama)
    })
    return ['semua', ...Array.from(set)]
  }, [materi])

  // Ambil angka di awal judul, mis. "5. Mitigasi" → 5
  const nomorJudul = (judul: string) => {
    const m = judul.match(/^(\d+)/)
    return m ? parseInt(m[1], 10) : Infinity
  }

  // Filter, search, lalu sort berdasarkan nomor judul
  const filtered = useMemo(() => {
    let result = materi
    if (activeFilter !== 'semua') {
      if (activeFilter === 'Konsep Dasar') {
        result = result.filter(m => m.is_konsep_dasar)
      } else {
        result = result.filter(m => m.jenis_bencana?.nama === activeFilter)
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(m =>
        m.judul.toLowerCase().includes(q) ||
        (m.jenis_bencana?.nama || '').toLowerCase().includes(q)
      )
    }
    return [...result].sort((a, b) => nomorJudul(a.judul) - nomorJudul(b.judul))
  }, [materi, activeFilter, search])

  // Mapping warna per kategori
  const warnaMap = useMemo(() => {
    const map: Record<string, typeof kategoriWarna[0]> = {}
    let idx = 0
    materi.forEach(m => {
      const key = m.is_konsep_dasar ? 'Konsep Dasar' : (m.jenis_bencana?.nama || 'Lainnya')
      if (!map[key]) {
        if (key === 'Konsep Dasar') {
          map[key] = { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', hoverBg: 'hover:bg-purple-100', accent: 'bg-purple-500' }
        } else {
          map[key] = kategoriWarna[idx % kategoriWarna.length]
          idx++
        }
      }
    })
    return map
  }, [materi])

  const getKategori = (m: any) => m.is_konsep_dasar ? 'Konsep Dasar' : (m.jenis_bencana?.nama || 'Lainnya')

  return (
    <main className="min-h-screen bg-gradient-to-b from-teal-50/60 via-white to-gray-50">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-100/50 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-6 pt-10 pb-6 md:pt-14 md:pb-8">
          <p className="text-teal-600 font-semibold text-sm tracking-wide uppercase mb-2">Lampung Edu-Gisaster</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight mb-3">
            Materi Kebencanaan
          </h1>
          <p className="text-gray-500 text-[15px] leading-relaxed max-w-lg">
            Pelajari konsep kebencanaan secara bertahap dalam porsi kecil. Setiap segmen dilengkapi kuis singkat untuk menguji pemahamanmu.
          </p>

          {/* Search */}
          <div className="mt-6 relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari materi..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent shadow-sm placeholder:text-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter chips ── */}
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {filters.map(f => {
            const isActive = activeFilter === f
            const label = f === 'semua' ? 'Semua' : f
            const ikon = f === 'semua' ? '📋' : f === 'Konsep Dasar' ? '📐' : getIkon(f)
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all
                  ${isActive
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-teal-300 hover:text-teal-700'
                  }`}
              >
                <span className="text-base leading-none">{ikon}</span>
                {label}
                {f !== 'semua' && (
                  <span className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center
                    ${isActive ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {materi.filter(m => f === 'Konsep Dasar' ? m.is_konsep_dasar : m.jenis_bencana?.nama === f).length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Memuat materi...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-500 text-sm">
              {search ? `Tidak ada materi yang cocok dengan "${search}"` : 'Belum ada materi yang tersedia.'}
            </p>
            {search && (
              <button onClick={() => { setSearch(''); setActiveFilter('semua') }}
                className="mt-3 text-sm text-teal-600 hover:text-teal-800 font-medium">
                Reset pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(m => {
              const { jml, adaKuis, totalBlok } = infoSegmen(m)
              const kategori = getKategori(m)
              const warna = warnaMap[kategori] || kategoriWarna[0]

              return (
                <Link key={m.id} href={`/materi/${m.id}`}
                  className={`group relative flex flex-col rounded-2xl border bg-white ${warna.border} ${warna.hoverBg} transition-all duration-200 hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-0.5 overflow-hidden`}>
                  {/* Accent bar */}
                  <div className={`h-1 ${warna.accent}`} />

                  <div className="p-4 flex flex-col flex-1">
                    {/* Badge kategori */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${warna.bg} ${warna.text} ${warna.border} border`}>
                        {m.is_konsep_dasar ? '📐 Konsep Dasar' : `${getIkon(kategori)} ${kategori}`}
                      </span>
                    </div>

                    {/* Judul */}
                    <h3 className="font-semibold text-gray-800 group-hover:text-teal-700 transition-colors leading-snug mb-auto">
                      {m.judul}
                    </h3>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        {jml} segmen
                      </div>
                      {adaKuis && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Kuis
                        </span>
                      )}
                      <div className="flex-1" />
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-teal-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Jumlah hasil */}
        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-6">
            Menampilkan {filtered.length} dari {materi.length} materi
          </p>
        )}
      </div>
    </main>
  )
}