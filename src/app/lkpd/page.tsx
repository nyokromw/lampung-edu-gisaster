import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default async function LkpdPage() {
  const { data: lkpd } = await supabase
    .from('e_lkpd')
    .select('*, kabupaten(nama), jenis_bencana(nama)')
    .eq('published', true)
    .order('created_at', { ascending: false })

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">E-LKPD Kebencanaan</h1>
      <p className="text-gray-500 mb-6">Pilih E-LKPD yang akan kamu kerjakan</p>

      <div className="flex flex-col gap-4">
        {lkpd?.map((l) => (
          <Link
            key={l.id}
            href={`/lkpd/${l.id}`}
            className="border rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 transition"
          >
            <h2 className="font-medium">{l.judul}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {l.kabupaten?.nama} — {l.jenis_bencana?.nama}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {l.pertanyaan?.length || 0} aktivitas
            </p>
          </Link>
        ))}
        {lkpd?.length === 0 && (
          <p className="text-gray-400">Belum ada E-LKPD yang tersedia</p>
        )}
      </div>
    </main>
  )
}