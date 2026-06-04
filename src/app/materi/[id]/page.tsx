import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default async function MateriDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: materi } = await supabase
    .from('materi_bencana')
    .select('*, jenis_bencana(nama)')
    .eq('id', id)
    .single()

  if (!materi) return <div className="p-8">Materi tidak ditemukan</div>

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <Link href="/materi" className="text-sm text-blue-600 mb-4 block">← Kembali ke Materi</Link>

      <div className="mb-6">
        {materi.is_konsep_dasar && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded mr-2">Konsep Dasar</span>
        )}
        {materi.jenis_bencana && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{materi.jenis_bencana.nama}</span>
        )}
        <h1 className="text-2xl font-bold mt-3">{materi.judul}</h1>
      </div>

      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: materi.konten }}
      />
    </main>
  )
}