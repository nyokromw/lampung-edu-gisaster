import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function infoSegmen(m: any) {
  const seg = Array.isArray(m.segmen) ? m.segmen : []
  const adaKuis = seg.some((s: any) => s.kuis)
  return { jml: seg.length, adaKuis }
}

export default async function MateriPage() {
  const { data: materi } = await supabase
    .from('materi_bencana')
    .select('*, jenis_bencana(nama)')
    .eq('published', true)
    .order('is_konsep_dasar', { ascending: false })

  const konsepDasar = materi?.filter(m => m.is_konsep_dasar) || []
  const perBencana = materi?.filter(m => !m.is_konsep_dasar) || []

  // Kelompokkan Bagian B per jenis bencana
  const grup: Record<string, any[]> = {}
  perBencana.forEach(m => {
    const nama = m.jenis_bencana?.nama || 'Lainnya'
    ;(grup[nama] ||= []).push(m)
  })

  return (
    <main className="p-6 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-gray-800">Materi Kebencanaan</h1>
      <p className="text-gray-500 mb-8 text-sm">Belajar bertahap dalam porsi kecil, lengkap dengan kuis singkat di tiap segmen.</p>

      {/* BAGIAN A — Konsep Dasar */}
      {konsepDasar.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-bold mb-3 text-purple-700">Konsep Kebencanaan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {konsepDasar.map(m => {
              const { jml, adaKuis } = infoSegmen(m)
              return (
                <Link key={m.id} href={`/materi/${m.id}`}
                  className="border-l-4 border-purple-500 bg-white rounded-r-xl pl-4 pr-3 py-3 hover:bg-purple-50 transition group">
                  <h3 className="font-medium text-gray-800 group-hover:text-purple-700">{m.judul}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">{jml} segmen</span>
                    {adaKuis && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">ada kuis</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* BAGIAN B — Per Jenis Bencana */}
      {perBencana.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3 text-blue-700">Jenis-Jenis Bencana</h2>
          <div className="flex flex-col gap-6">
            {Object.entries(grup).map(([nama, list]) => (
              <div key={nama}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{nama}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {list.map(m => {
                    const { jml, adaKuis } = infoSegmen(m)
                    return (
                      <Link key={m.id} href={`/materi/${m.id}`}
                        className="border border-gray-200 bg-white rounded-xl p-4 hover:bg-blue-50 hover:border-blue-300 transition group">
                        <h3 className="font-medium text-sm text-gray-800 group-hover:text-blue-700 leading-snug">{m.judul}</h3>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-400">{jml} segmen</span>
                          {adaKuis && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">kuis</span>}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {materi?.length === 0 && (
        <p className="text-gray-400 text-sm">Belum ada materi yang tersedia.</p>
      )}
    </main>
  )
}