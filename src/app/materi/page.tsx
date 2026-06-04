import { supabase } from '@/lib/supabase'

export default async function MateriPage() {
  const { data: bencana } = await supabase
    .from('jenis_bencana')
    .select('*')
    .eq('kategori', 'bencana')

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Materi Kebencanaan</h1>
      <p className="text-gray-500 mb-6">Pilih jenis bencana untuk mempelajari materinya</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {bencana?.map((b) => (
          <a
            key={b.id}
            href={`/materi/${b.id}`}
            className="border rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 transition cursor-pointer"
          >
            <h2 className="font-medium text-sm">{b.nama}</h2>
            <p className="text-xs text-gray-400 mt-1">Klik untuk belajar</p>
          </a>
        ))}
      </div>
    </main>
  )
}