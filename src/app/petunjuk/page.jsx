'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PETUNJUK_FIELDS, petunjukError } from '@/lib/petunjuk'
import PetunjukContent from './PetunjukContent'

export default function PetunjukPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await supabase.from('petunjuk_web').select(PETUNJUK_FIELDS)
          .eq('published', true).order('sort_order').order('created_at').order('id')
        if (result.error) throw result.error
        if (alive) setItems(result.data || [])
      } catch (failure) { if (alive) setError(petunjukError(failure)) }
      finally { if (alive) setLoading(false) }
    }
    load()
    return () => { alive = false }
  }, [reload])
  return <main className="min-h-screen bg-slate-50 px-4 pb-16 pt-24 sm:px-6">
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-teal-700">Lampung Edu-GISaster</p>
        <h1 className="mb-3 text-3xl font-bold text-blue-950 sm:text-4xl">Petunjuk Web</h1>
        <p className="text-slate-600">Panduan penggunaan website, aktivitas pembelajaran, dan fitur yang tersedia.</p>
      </header>
      {loading ? <p role="status" className="rounded-2xl border bg-white p-8 text-slate-500">Memuat petunjuk…</p>
        : error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p>{error}</p><button onClick={() => setReload(value => value + 1)} className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-medium">Coba lagi</button>
        </div>
        : !items.length ? <div className="rounded-2xl border bg-white p-8 text-slate-600">Petunjuk penggunaan website akan segera tersedia.</div>
        : <>
          <nav aria-label="Daftar petunjuk" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-blue-950">Daftar petunjuk</h2>
            <ol className="space-y-2">{items.map((item, index) => <li key={item.id}>
              <a href={`#petunjuk-${item.id}`} className="flex gap-3 rounded-lg px-2 py-2 text-slate-700 hover:bg-teal-50 hover:text-teal-800">
                <span className="font-semibold text-teal-700">{String(index + 1).padStart(2, '0')}</span><span>{item.judul}</span>
              </a>
            </li>)}</ol>
          </nav>
          <div className="space-y-6">{items.map((item, index) => <article key={item.id} id={`petunjuk-${item.id}`}
            className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <h2 className="mb-5 flex items-start gap-3 text-xl font-bold text-blue-950">
              <span className="rounded-lg bg-teal-50 px-3 py-1 text-base text-teal-800">{index + 1}</span><span className="pt-1">{item.judul}</span>
            </h2>
            <PetunjukContent item={item} />
          </article>)}</div>
        </>}
    </div>
  </main>
}