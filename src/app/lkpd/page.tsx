import { supabase } from '@/lib/supabase'
import LkpdContent from '@/components/LkpdContent'

export default async function LkpdPage() {
  const [{ data: lkpd }, { data: kabupaten }, { data: jenisBencana }] = await Promise.all([
    supabase
      .from('e_lkpd')
      .select('*, kabupaten(nama), jenis_bencana(nama)')
      .eq('published', true)
      .order('created_at', { ascending: false }),
    supabase.from('kabupaten').select('*').order('nama'),
    supabase.from('jenis_bencana').select('*').order('nama'),
  ])

  return (
    <div className="min-h-screen bg-gray-50/80">
      {/* ═══ HERO ═══ */}
      <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-950 pt-10 pb-10 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 text-teal-300/80 text-[11px] font-medium mb-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                Lembar Kerja Peserta Didik Elektronik
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-1.5">
                E-LKPD Kebencanaan
              </h1>
              <p className="text-blue-200/50 text-sm max-w-md leading-relaxed">
                Lembar kerja interaktif berbasis peta bencana Lampung dengan tiga fase pembelajaran.
              </p>
            </div>

            {/* Phase legend */}
            <div className="flex gap-2">
              {[
                { fase: 'Memahami', color: 'bg-blue-500' },
                { fase: 'Mengaplikasi', color: 'bg-emerald-500' },
                { fase: 'Merefleksi', color: 'bg-amber-500' },
              ].map((f, i) => (
                <div key={f.fase} className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 bg-white/[0.07] border border-white/10 rounded-lg px-3 py-2">
                    <span className={`w-2 h-2 rounded-full ${f.color}`} />
                    <span className="text-white/70 text-[11px] font-medium">{f.fase}</span>
                  </div>
                  {i < 2 && (
                    <svg className="w-3 h-3 text-white/20 hidden md:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CONTENT ═══ */}
      <LkpdContent
        lkpd={lkpd || []}
        allKabupaten={(kabupaten || []).map((k: any) => k.nama)}
        allBencana={(jenisBencana || []).map((b: any) => b.nama)}
      />
    </div>
  )
}