import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import MateriReader from './MateriReader'

export default async function MateriDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: materi } = await supabase
    .from('materi_bencana')
    .select('*, jenis_bencana(nama)')
    .eq('id', id)
    .single()

  if (!materi) return <div className="p-8">Materi tidak ditemukan</div>

  const punyaSegmen = Array.isArray(materi.segmen) && materi.segmen.length > 0

  return (
    <main className="p-6 md:p-8 max-w-3xl mx-auto">
      <Link href="/materi" className="text-sm text-teal-600 hover:text-teal-800 mb-4 inline-block">← Kembali ke Materi</Link>

      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          {materi.is_konsep_dasar && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Konsep Dasar</span>
          )}
          {materi.jenis_bencana && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{materi.jenis_bencana.nama}</span>
          )}
        </div>
        <h1 className="text-2xl font-bold mt-3 text-gray-800">{materi.judul}</h1>
      </div>

      {punyaSegmen ? (
        // Materi microlearning baru (segmen + blok + kuis)
        <MateriReader materi={materi as any} />
      ) : materi.konten ? (
        // Fallback: materi lama yang masih pakai kolom "konten" (HTML)
        <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: materi.konten }} />
      ) : (
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center text-gray-400 text-sm">
          Materi ini belum memiliki isi.
        </div>
      )}
    </main>
  )
}