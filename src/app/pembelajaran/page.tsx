import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface ModulPembelajaran {
  id: string
  judul: string
  deskripsi: string
  jenis_bencana: string
  fase: string
  thumbnail_url: string
  published: boolean
  created_at: string
}

async function getModul() {
  const { data } = await supabase
    .from('pembelajaran')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
  return data || []
}

const FASE_COLOR: Record<string, string> = {
  'Mitigasi': 'bg-blue-50 text-blue-700 border-blue-200',
  'Kesiapsiagaan': 'bg-green-50 text-green-700 border-green-200',
  'Respons': 'bg-red-50 text-red-700 border-red-200',
  'Pemulihan': 'bg-amber-50 text-amber-700 border-amber-200',
}

export default async function PembelajaranPage() {
  const moduls = await getModul()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-950 to-blue-900 py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 text-teal-300 text-xs font-medium px-3 py-1.5 rounded-full mb-4 border border-white/10">
            <span className="w-1.5 h-1.5 bg-teal-400 rounded-full" />
            Pembelajaran Mendalam Bencana
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
            Studi Kasus Kebencanaan Lampung
          </h1>
          <p className="text-blue-200/70 text-sm max-w-xl">
            Pelajari kasus nyata bencana di Lampung secara mendalam — dari analisis penyebab, dampak spasial, hingga strategi mitigasi berbasis data.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {moduls.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            <p className="text-gray-400 text-sm">Modul pembelajaran belum tersedia</p>
            <p className="text-gray-300 text-xs mt-1">Admin sedang menyiapkan konten</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {moduls.map((m: ModulPembelajaran) => (
              <Link key={m.id} href={`/pembelajaran/${m.id}`}
                className="bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50 transition-all group overflow-hidden">
                {m.thumbnail_url ? (
                  <img src={m.thumbnail_url} alt={m.judul} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-blue-950 to-teal-800 flex items-center justify-center">
                    <svg className="w-12 h-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                    </svg>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2.5">
                    {m.fase && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${FASE_COLOR[m.fase] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                        {m.fase}
                      </span>
                    )}
                    {m.jenis_bencana && (
                      <span className="text-[10px] text-gray-400">{m.jenis_bencana}</span>
                    )}
                  </div>
                  <h3 className="font-bold text-gray-800 text-sm mb-2 group-hover:text-blue-700 transition-colors line-clamp-2">{m.judul}</h3>
                  <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{m.deskripsi}</p>
                  <div className="mt-4 flex items-center gap-1 text-blue-600 text-xs font-semibold group-hover:translate-x-1 transition-transform">
                    Pelajari
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}