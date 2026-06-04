import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: kabupaten } = await supabase.from('kabupaten').select('*')

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Lampung Edu Gisaster</h1>
      <ul>
        {kabupaten?.map((item) => (
          <li key={item.id}>{item.nama}</li>
        ))}
      </ul>
    </main>
  )
}