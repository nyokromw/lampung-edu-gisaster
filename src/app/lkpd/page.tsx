import { supabase } from '@/lib/supabase'
import LkpdContent from '@/components/LkpdContent'

export default async function LkpdPage() {
  const [{ data: lkpd, error: lkpdError }, { data: kabupaten, error: kabupatenError }, { data: jenisBencana, error: bencanaError }] = await Promise.all([
    supabase
      .from('e_lkpd')
      .select('*, kabupaten(nama), jenis_bencana(nama)')
      .eq('published', true)
      .order('created_at', { ascending: false }),
    supabase.from('kabupaten').select('*').order('nama'),
    supabase.from('jenis_bencana').select('*').order('nama'),
  ])

  const loadError = Boolean(lkpdError || kabupatenError || bencanaError)

  return (
    <main className="min-h-screen bg-[#f6fbff] text-[#17345a]">
      <header className="border-b border-[#dcecf8] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-7 sm:px-8 lg:px-10">
          <p className="text-xs font-semibold text-[#0b91a6]">Lampung Edu Gisaster</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#193458]">E-LKPD Kebencanaan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#617e9c]">Pilih wilayah dan jenis bencana, lalu mulai belajar melalui aktivitas berbasis peta.</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#617e9c]" aria-label="Tahap pembelajaran">
            {[
              { nama: 'Memahami', warna: 'bg-blue-500' },
              { nama: 'Mengaplikasi', warna: 'bg-emerald-500' },
              { nama: 'Merefleksi', warna: 'bg-amber-500' },
            ].map(tahap => <span key={tahap.nama} className="inline-flex items-center gap-1.5"><span className={'h-1.5 w-1.5 rounded-full ' + tahap.warna} aria-hidden="true" />{tahap.nama}</span>)}
          </div>
        </div>
      </header>
      <LkpdContent
        lkpd={lkpd || []}
        allKabupaten={(kabupaten || []).map((k: { nama: string }) => k.nama)}
        allBencana={(jenisBencana || []).map((b: { nama: string }) => b.nama)}
        loadError={loadError}
      />
    </main>
  )
}
