import Link from 'next/link'
import { supabase } from '@/lib/supabase'

async function getStats() {
  const [{ count: layerCount }, { count: lkpdCount }, { count: materiCount }] = await Promise.all([
    supabase.from('layer_peta').select('*', { count: 'exact', head: true }).eq('published', true),
    supabase.from('e_lkpd').select('*', { count: 'exact', head: true }).eq('published', true),
    supabase.from('materi_bencana').select('*', { count: 'exact', head: true }).eq('published', true),
  ])
  return { layerCount: layerCount || 0, lkpdCount: lkpdCount || 0, materiCount: materiCount || 0 }
}

export default async function HomePage() {
  const stats = await getStats()

  return (
    <main className="min-h-screen bg-white">
{/* HERO — full dark */}
      <section className="pt-16 min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 flex flex-col">
        {/* Decoration */}
        <div className="absolute top-16 right-0 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-32 right-24 opacity-[0.04]">
          <svg viewBox="0 0 200 200" className="w-96 h-96 text-white fill-current">
            <path d="M100,10 L190,190 L10,190 Z" />
          </svg>
        </div>

        {/* Top bar inside hero */}
        <div className="max-w-6xl mx-auto w-full px-6 pt-10">
          <div className="inline-flex items-center gap-2 bg-amber-400 text-blue-950 text-xs font-bold px-4 py-1.5 rounded">
            PORTAL GEOGRAFI KEBENCANAAN LAMPUNG
          </div>
        </div>

        {/* Hero content */}
        <div className="max-w-6xl mx-auto w-full px-6 pt-8 pb-16 flex-1 flex flex-col justify-between">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-[1.1] mb-6 max-w-2xl">
              Belajar Mitigasi Spasial Berbasis Realita Daerah Lampung
            </h1>
            <p className="text-blue-200/70 text-sm leading-relaxed mb-8 max-w-xl">
              Platform interaktif inovatif untuk Guru Geografi dan Siswa dalam menguasai analisis spasial
              mitigasi bencana Lampung menggunakan kerangka berpikir Spatial Disaster Literacy (SDL).
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/peta"
                className="flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-blue-950 px-6 py-3 rounded-lg font-bold text-sm transition-all shadow-lg shadow-amber-900/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                </svg>
                Mulai Analisis Peta
              </Link>
              <Link href="/lkpd"
                className="flex items-center gap-2 bg-indigo-700/60 hover:bg-indigo-700 border border-indigo-500/50 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                </svg>
                Kerjakan E-LKPD
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-950 mb-2">{stats.layerCount}</p>
              <p className="text-gray-600">Layer Peta Interaktif</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-950 mb-2">{stats.lkpdCount}</p>
              <p className="text-gray-600">E-LKPD Tersedia</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold text-blue-950 mb-2">{stats.materiCount}</p>
              <p className="text-gray-600">Materi Bencana</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xs">G</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Lampung Edu Gisaster</p>
              <p className="text-xs text-gray-400">FKIP Universitas Lampung</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">© 2025 — Platform GIS Edukasi Kebencanaan</p>
        </div>
      </footer>

    </main>
  )
}