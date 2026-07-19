import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default async function LkpdPage() {
  const { data: lkpd } = await supabase
    .from('e_lkpd')
    .select('*, kabupaten(nama), jenis_bencana(nama)')
    .eq('published', true)
    .order('created_at', { ascending: false })

  const TIPE_LABEL: Record<string, string> = {
    esai: 'Esai', pilihan_ganda: 'Pilihan Ganda',
    tabel: 'Tabel', diagram: 'Diagram', peta: 'Peta'
  }
  const FASE_COUNT = (pertanyaan: any[]) => {
    const fases = new Set((pertanyaan || []).map((a: any) => a.fase || 'Memahami'))
    return fases.size
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-950 to-blue-900 py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 text-teal-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4 border border-white/10">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            Lembar Kerja Peserta Didik Elektronik
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">E-LKPD Kebencanaan</h1>
          <p className="text-blue-200/70 text-sm max-w-xl leading-relaxed">
            Kerjakan lembar kerja interaktif berbasis peta bencana Lampung. Setiap LKPD mencakup tiga fase pembelajaran: Memahami, Mengaplikasi, dan Merefleksi.
          </p>
          <div className="flex gap-4 mt-6 flex-wrap">
            {[
              { label: 'Total E-LKPD', value: lkpd?.length || 0 },
              { label: '3 Fase per LKPD', value: 'Memahami · Mengaplikasi · Merefleksi' },
              { label: 'Dimensi SDL', value: 'SML · SPL · SRL · SRcL' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl px-4 py-3 border border-white/10">
                <p className="text-base font-bold text-white">{s.value}</p>
                <p className="text-[11px] text-blue-300/70 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {!lkpd || lkpd.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-gray-400 text-sm">Belum ada E-LKPD yang tersedia</p>
            <p className="text-gray-300 text-xs mt-1">Guru sedang menyiapkan lembar kerja</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {lkpd.map((l: any) => {
              const pertanyaan = l.pertanyaan || []
              const tipeList = [...new Set(pertanyaan.map((a: any) => a.tipe))] as string[]
              const fasesAda = [...new Set(pertanyaan.map((a: any) => a.fase || 'Memahami'))]
              const hasPeta = pertanyaan.some((a: any) => a.tipe === 'peta' || a.ada_peta)

              return (
                <Link key={l.id} href={`/lkpd/${l.id}`}
                  className="bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50/50 transition-all group overflow-hidden">
                  {/* Fase bar */}
                  <div className="flex h-1.5">
                    {fasesAda.includes('Memahami') && <div className="flex-1 bg-blue-500" />}
                    {fasesAda.includes('Mengaplikasi') && <div className="flex-1 bg-green-500" />}
                    {fasesAda.includes('Merefleksi') && <div className="flex-1 bg-amber-500" />}
                  </div>

                  <div className="p-5">
                    {/* Jenis bencana + kabupaten */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full font-medium">
                        {l.jenis_bencana?.nama}
                      </span>
                      <span className="text-[10px] text-gray-400">{l.kabupaten?.nama}</span>
                    </div>

                    {/* Judul */}
                    <h3 className="font-bold text-gray-800 text-sm mb-3 group-hover:text-blue-700 transition-colors line-clamp-2 leading-snug">
                      {l.judul}
                    </h3>

                    {/* Fase badges */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {fasesAda.includes('Memahami') && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">📖 Memahami</span>
                      )}
                      {fasesAda.includes('Mengaplikasi') && (
                        <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">🔬 Mengaplikasi</span>
                      )}
                      {fasesAda.includes('Merefleksi') && (
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">💭 Merefleksi</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <span className="text-[10px] bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                        {pertanyaan.length} aktivitas
                      </span>
                      {tipeList.slice(0, 3).map((t: string) => (
                        <span key={t} className="text-[10px] bg-gray-50 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                          {TIPE_LABEL[t] || t}
                        </span>
                      ))}
                      {hasPeta && (
                        <span className="text-[10px] bg-blue-950 text-white px-2 py-0.5 rounded-full">🗺 Peta</span>
                      )}
                    </div>

                    {/* CTA */}
                    <div className="flex items-center gap-1 text-blue-600 text-xs font-semibold group-hover:translate-x-1 transition-transform">
                      Mulai Kerjakan
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Info SDL */}
        <div className="mt-12 bg-white rounded-2xl border border-gray-100 p-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Alur Pembelajaran dalam E-LKPD</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Memahami', desc: 'Baca & analisis peta', color: 'bg-blue-50 border-blue-200 text-blue-800' },
              { label: 'Mengaplikasi', desc: 'Gambar & eksplorasi', color: 'bg-green-50 border-green-200 text-green-800' },
              { label: 'Merefleksi', desc: 'Sintesis & solusi', color: 'bg-amber-50 border-amber-200 text-amber-800' },
            ].map((f, i) => (
              <div key={f.label} className="flex items-center gap-2">
                <div className={`${f.color} border rounded-xl px-4 py-3 text-center min-w-[120px]`}>
                  <p className="font-bold text-sm">{f.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{f.desc}</p>
                </div>
                {i < 2 && <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}