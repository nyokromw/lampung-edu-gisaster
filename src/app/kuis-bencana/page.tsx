'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Paket = { id: string; nama: string; deskripsi: string | null; durasi_menit: number | null }
type Soal = { id: string; urutan: number; pertanyaan: string; gambar_url: string | null; opsi_a: string; opsi_b: string; opsi_c: string; opsi_d: string }
type Hasil = { benar: number; total: number; persen: number; rincian: { id: string; jawaban: string | null; kunci: string; benar: boolean; pembahasan: string | null }[] }
const pilihan = ['a', 'b', 'c', 'd'] as const

export default function KuisBencanaPage() {
  const [pakets, setPakets] = useState<Paket[]>([])
  const [aktif, setAktif] = useState<Paket | null>(null)
  const [soal, setSoal] = useState<Soal[]>([])
  const [jawaban, setJawaban] = useState<Record<string, string>>({})
  const [nomor, setNomor] = useState(0)
  const [mulaiPada, setMulaiPada] = useState<number | null>(null)
  const [sisa, setSisa] = useState<number | null>(null)
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [pesan, setPesan] = useState('')
  const submitting = useRef(false)
  const deadline = useRef<number | null>(null)
  const jawabanRef = useRef<Record<string, string>>({})
  useEffect(() => { jawabanRef.current = jawaban }, [jawaban])

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from('quiz_pakets').select('id,nama,deskripsi,durasi_menit').eq('published', true).order('urutan').order('created_at')
      if (error) setPesan(error.message)
      else setPakets((data || []) as Paket[])
      setLoading(false)
    })()
  }, [])

  async function mulai(p: Paket) {
    setLoading(true); setPesan('')
    const { data, error } = await supabase.rpc('get_quiz_questions', { p_paket: p.id })
    setLoading(false)
    if (error) return setPesan(`Tidak bisa memuat soal: ${error.message}`)
    const list = (data || []) as Soal[]
    if (!list.length) return setPesan('Paket belum memiliki soal aktif.')
    setSoal(list); setAktif(p); setJawaban({}); jawabanRef.current = {}; setNomor(0); setHasil(null)
    const now = Date.now(); setMulaiPada(now)
    deadline.current = p.durasi_menit ? now + p.durasi_menit * 60_000 : null
    setSisa(deadline.current ? Math.max(0, Math.ceil((deadline.current - now) / 1000)) : null)
  }
  async function kumpulkan(auto = false) {
    if (!aktif || submitting.current || hasil) return
    if (!auto && soal.some(s => !jawabanRef.current[s.id]) && !confirm('Masih ada soal yang belum dijawab. Kumpulkan sekarang?')) return
    submitting.current = true; setSending(true); setPesan('')
    const { data, error } = await supabase.rpc('submit_quiz_attempt', { p_paket: aktif.id, p_jawaban: jawabanRef.current })
    submitting.current = false; setSending(false)
    if (error) return setPesan(`Gagal mengirim jawaban: ${error.message}. Masuk ke akun siswa dan coba kembali.`)
    const result = data as Hasil
    setHasil(result)
    deadline.current = null
  }
  useEffect(() => {
    if (!aktif || hasil || deadline.current === null) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline.current! - Date.now()) / 1000))
      setSisa(remaining)
      if (remaining <= 0) { clearInterval(interval); void kumpulkan(true) }
    }, 1000)
    return () => clearInterval(interval)
  }, [aktif, hasil])

  function keluar() {
    if (!hasil && !confirm('Keluar dari kuis? Jawaban yang belum dikumpulkan akan hilang.')) return
    setAktif(null); setSoal([]); setJawaban({}); setHasil(null); setMulaiPada(null); setSisa(null); deadline.current = null; setPesan('')
  }
  const terisi = soal.filter(s => !!jawaban[s.id]).length
  const current = soal[nomor]
  return <div className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12"><div className="mx-auto max-w-3xl space-y-5">
    {!aktif ? <><header className="rounded-2xl bg-gradient-to-r from-slate-950 to-teal-900 p-7 text-white"><p className="text-xs font-semibold uppercase tracking-widest text-teal-200">Lampung Edu-GISaster</p><h1 className="mt-2 text-3xl font-extrabold">Kuis Bencana</h1><p className="mt-2 text-sm leading-6 text-teal-100">Uji pengetahuan kebencanaan dari berbagai materi melalui paket soal komprehensif. Pilih paket untuk memulai.</p></header>
    {pesan && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{pesan}</p>}
    <h2 className="text-lg font-bold text-slate-800">Pilih Paket Kuis</h2>{loading ? <p className="text-sm text-slate-500">Memuat paket...</p> : pakets.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Belum ada paket yang dipublikasikan.</p> : <div className="grid gap-4 sm:grid-cols-2">{pakets.map((p, i) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={p.id}><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-lg font-extrabold text-teal-800">{i + 1}</div><h3 className="font-bold text-slate-900">{p.nama}</h3><p className="mt-2 min-h-10 text-sm text-slate-500">{p.deskripsi || 'Evaluasi komprehensif pengetahuan kebencanaan.'}</p><p className="my-4 text-xs font-medium text-slate-500">{p.durasi_menit ? `Batas waktu ${p.durasi_menit} menit` : 'Tanpa batas waktu'}</p><button disabled={loading} onClick={() => mulai(p)} className="w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">Mulai Kuis →</button></article>)}</div>}</>
    : hasil ? <><section className="rounded-2xl border border-slate-200 bg-white p-7 text-center"><p className="text-sm text-slate-500">Hasil {aktif.nama}</p><p className="mt-3 text-5xl font-extrabold text-teal-800">{hasil.persen}</p><p className="mt-2 font-semibold text-slate-800">{hasil.benar} jawaban benar dari {hasil.total} soal</p><p className="mt-2 text-xs text-slate-500">Skor 0–100. Hasil disimpan dalam riwayat akun siswa.</p></section><section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Pembahasan Jawaban</h2>{soal.map((s, i) => { const r = hasil.rincian?.find(x => x.id === s.id); return <div key={s.id} className="border-t border-slate-100 py-3"><p className="text-sm font-semibold">{i + 1}. {s.pertanyaan}</p><p className={`mt-1 text-xs font-semibold ${r?.benar ? 'text-emerald-700' : 'text-rose-700'}`}>{r?.benar ? 'Benar' : 'Belum tepat'} · Jawabanmu: {r?.jawaban?.toUpperCase() || 'Kosong'} · Kunci: {r?.kunci?.toUpperCase() || '—'}</p>{r?.pembahasan && <p className="mt-1 text-sm text-slate-600">{r.pembahasan}</p>}</div> })}</section><button onClick={keluar} className="w-full rounded-xl bg-slate-900 p-3 text-sm font-semibold text-white">Kembali ke Daftar Paket</button></>
    : <><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-slate-500">{aktif.nama}</p><h1 className="text-lg font-extrabold text-slate-900">Soal {nomor + 1} dari {soal.length}</h1></div><div className="text-right text-xs text-slate-500"><p>{terisi}/{soal.length} dijawab</p>{sisa !== null && <p className={`mt-1 text-sm font-bold ${sisa < 60 ? 'text-red-600' : 'text-teal-700'}`}>Sisa {Math.floor(sisa / 60)}:{String(sisa % 60).padStart(2, '0')}</p>}</div></div><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${(terisi / soal.length) * 100}%` }} /></div>
    {pesan && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{pesan}</p>}
    {current && <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><p className="text-base font-bold leading-relaxed text-slate-900">{current.pertanyaan}</p>{current.gambar_url && <img alt="Gambar pendukung soal" src={current.gambar_url} className="mx-auto max-h-[400px] max-w-full rounded-xl border border-slate-200 object-contain" />}<div className="space-y-2">{pilihan.map(k => <button key={k} disabled={sending} onClick={() => { setJawaban(p => { const next = { ...p, [current.id]: k }; jawabanRef.current = next; return next }) }} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${jawaban[current.id] === k ? 'border-teal-600 bg-teal-50 font-semibold text-teal-900' : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300'}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-current text-xs">{k.toUpperCase()}</span>{current[`opsi_${k}`]}</button>)}</div></section>}
    <div className="flex flex-wrap justify-center gap-2">{soal.map((s, i) => <button key={s.id} onClick={() => setNomor(i)} aria-label={`Ke soal ${i + 1}`} className={`h-9 w-9 rounded-lg border text-xs font-bold ${nomor === i ? 'border-teal-700 bg-teal-700 text-white' : jawaban[s.id] ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-slate-200 bg-white text-slate-500'}`}>{i + 1}</button>)}</div>
    <div className="flex gap-2"><button disabled={nomor === 0 || sending} onClick={() => setNomor(n => n - 1)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm disabled:opacity-40">← Sebelumnya</button>{nomor < soal.length - 1 ? <button onClick={() => setNomor(n => n + 1)} className="ml-auto rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Selanjutnya →</button> : <button disabled={sending} onClick={() => kumpulkan()} className="ml-auto rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{sending ? 'Mengirim...' : 'Kumpulkan Jawaban'}</button>}</div><button onClick={keluar} className="text-xs text-slate-400">Keluar dari kuis</button></>}
  </div></div>
}
