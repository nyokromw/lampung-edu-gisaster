import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default async function MateriPage() {
  const { data: materi } = await supabase
    .from('materi_bencana')
    .select('*, jenis_bencana(nama)')
    .eq('published', true)
    .order('is_konsep_dasar', { ascending: false })

  const konsepDasar = materi?.filter(m => m.is_konsep_dasar)
  const perBencana = materi?.filter(m => !m.is_konsep_dasar)

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Materi Kebencanaan</h1>
      <p className="text-gray-500 mb-8">Pelajari materi kebencanaan sesuai kurikulum SMA</p>

      {konsepDasar && konsepDasar.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-3 text-purple-700">Konsep Dasar Bencana</h2>
          <div className="flex flex-col gap-3">
            {konsepDasar.map(m => (
              <Link
                key={m.id}
                href={`/materi/${m.id}`}
                className="border-l-4 border-purple-500 pl-4 py-2 hover:bg-purple-50 transition rounded-r"
              >
                <h3 className="font-medium">{m.judul}</h3>
                <p className="text-xs text-gray-400 mt-1">Konsep Dasar → Klik untuk membaca</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {perBencana && perBencana.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3 text-blue-700">Materi Per Jenis Bencana</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {perBencana.map(m => (
              <Link
                key={m.id}
                href={`/materi/${m.id}`}
                className="border rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 transition"
              >
                <h3 className="font-medium text-sm">{m.judul}</h3>
                <p className="text-xs text-gray-400 mt-1">{m.jenis_bencana?.nama}</p>
                <p className="text-xs text-blue-500 mt-2">Klik untuk membaca →</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {materi?.length === 0 && (
        <p className="text-gray-400">Belum ada materi yang tersedia</p>
      )}
    </main>
  )
}