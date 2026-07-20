'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

// ── Tipe data (samakan dengan editor admin) ──
type Blok =
  | { id: string; tipe: 'teks'; isi: string }
  | { id: string; tipe: 'gambar'; url: string; caption: string }
  | { id: string; tipe: 'video'; youtubeUrl: string }
  | { id: string; tipe: 'html'; kode: string }

interface Kuis { pertanyaan: string; pilihan: string[]; jawaban_benar: number; pembahasan: string }
interface Segmen { id: string; judul: string; blok: Blok[]; kuis: Kuis | null }

interface Materi {
  id: string; judul: string; is_konsep_dasar: boolean
  jenis_bencana: { nama: string } | null
  segmen: Segmen[] | null
}

function ytId(url: string): string | null {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : (url.length === 11 ? url : null)
}

function RenderBlok({ b }: { b: Blok }) {
  if (b.tipe === 'teks') return <p className="text-[15px] leading-relaxed text-gray-700 whitespace-pre-wrap">{b.isi}</p>
  if (b.tipe === 'gambar') return b.url ? (
    <figure className="my-1">
      <img src={b.url} alt={b.caption || ''} className="rounded-xl w-full object-contain max-h-[420px] bg-gray-50" />
      {b.caption && <figcaption className="text-xs text-gray-400 mt-1.5 text-center">{b.caption}</figcaption>}
    </figure>
  ) : null
  if (b.tipe === 'video') {
    const id = ytId(b.youtubeUrl)
    return id ? (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${id}`} allowFullScreen title="video" />
      </div>
    ) : null
  }
  if (b.tipe === 'html') return b.kode ? (
    <div className="rounded-xl overflow-hidden border border-gray-100" dangerouslySetInnerHTML={{ __html: b.kode }} />
  ) : null
  return null
}

function KuisView({ kuis, jawaban, onJawab }: { kuis: Kuis; jawaban: number | null; onJawab: (i: number) => void }) {
  const sudah = jawaban !== null
  const benar = sudah && jawaban === kuis.jawaban_benar
  return (
    <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" /></svg>
        </span>
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Kuis Singkat</span>
        <span className="text-[11px] text-amber-500 ml-auto">Cek pemahaman — tidak menghambat lanjut</span>
      </div>
      <p className="text-[15px] font-medium text-gray-800 mb-3">{kuis.pertanyaan}</p>
      <div className="flex flex-col gap-2">
        {kuis.pilihan.map((p, i) => {
          const isBenar = i === kuis.jawaban_benar
          const isPilihan = jawaban === i
          let cls = 'bg-white border-gray-200 text-gray-700 hover:border-amber-300'
          if (sudah) {
            if (isBenar) cls = 'bg-green-50 border-green-400 text-green-800'
            else if (isPilihan) cls = 'bg-red-50 border-red-400 text-red-700'
            else cls = 'bg-white border-gray-200 text-gray-400'
          }
          return (
            <button key={i} disabled={sudah} onClick={() => onJawab(i)}
              className={`text-left text-sm px-4 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2 ${cls} disabled:cursor-default`}>
              <span className="font-bold text-xs opacity-60">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{p}</span>
              {sudah && isBenar && <span className="text-green-600 font-bold">✓</span>}
              {sudah && isPilihan && !isBenar && <span className="text-red-500 font-bold">✗</span>}
            </button>
          )
        })}
      </div>
      {sudah && (
        <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${benar ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
          <p className="font-semibold mb-0.5">{benar ? 'Tepat! 🎉' : 'Belum tepat — tidak apa-apa.'}</p>
          {kuis.pembahasan && <p className="text-[13px] opacity-90">{kuis.pembahasan}</p>}
        </div>
      )}
    </div>
  )
}

export default function MateriReader({ materi }: { materi: Materi }) {
  const segmen = useMemo(() => Array.isArray(materi.segmen) ? materi.segmen : [], [materi])
  const [idx, setIdx] = useState(0)
  const [jawaban, setJawaban] = useState<Record<string, number>>({})
  const [selesai, setSelesai] = useState(false)

  const total = segmen.length
  const sg = segmen[idx]
  const jmlKuis = segmen.filter(s => s.kuis).length
  const jmlBenar = segmen.filter(s => s.kuis && jawaban[s.id] === s.kuis!.jawaban_benar).length

  // Materi tanpa segmen (mis. materi lama) — jangan kosong
  if (total === 0) {
    return (
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 text-center text-gray-400 text-sm">
        Materi ini belum memiliki isi segmen.
      </div>
    )
  }

  if (selesai) {
    return (
      <div>
        <div className="bg-gradient-to-b from-teal-600 to-teal-700 rounded-3xl p-8 text-center text-white mb-6">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-9 h-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
          </div>
          <h2 className="text-2xl font-bold mb-1">Materi Selesai!</h2>
          <p className="text-white/80 text-sm">{materi.judul}</p>
        </div>
        {jmlKuis > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center mb-6">
            <p className="text-sm text-gray-500 mb-1">Hasil kuis kamu</p>
            <p className="text-4xl font-bold text-teal-600">{jmlBenar}<span className="text-xl text-gray-300">/{jmlKuis}</span></p>
            <p className="text-xs text-gray-400 mt-1">{Math.round((jmlBenar / jmlKuis) * 100)}% benar</p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={() => { setIdx(0); setSelesai(false); setJawaban({}) }} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200">Ulangi</button>
          <Link href="/materi" className="flex-1 bg-teal-600 text-white py-3 rounded-xl font-medium hover:bg-teal-700 text-center">Materi Lain</Link>
        </div>
      </div>
    )
  }

  const kuisSegIni = sg.kuis
  const sudahJawabKuis = kuisSegIni ? jawaban[sg.id] !== undefined : true

  return (
    <div>
      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-6">
        {segmen.map((s, i) => (
          <button key={s.id} onClick={() => i <= idx && setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'flex-[2] bg-teal-600' : i < idx ? 'flex-1 bg-teal-300' : 'flex-1 bg-gray-200'}`}
            title={s.judul} />
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <div className="px-6 pt-6 pb-2">
          <p className="text-[11px] font-semibold text-teal-600 uppercase tracking-wider mb-1">Segmen {idx + 1} / {total}</p>
          <h3 className="text-xl font-bold text-gray-800">{sg.judul || `Bagian ${idx + 1}`}</h3>
        </div>
        <div className="px-6 py-4 flex flex-col gap-4">
          {sg.blok.map(b => <RenderBlok key={b.id} b={b} />)}
          {kuisSegIni && (
            <KuisView kuis={kuisSegIni} jawaban={jawaban[sg.id] ?? null}
              onJawab={i => setJawaban(prev => ({ ...prev, [sg.id]: i }))} />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
          className="px-5 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 disabled:opacity-40">← Sebelumnya</button>
        <div className="flex-1" />
        {kuisSegIni && !sudahJawabKuis && <span className="text-[11px] text-amber-600 mr-1">Jawab kuisnya dulu, atau lewati</span>}
        {idx < total - 1 ? (
          <button onClick={() => setIdx(i => i + 1)} className="px-6 py-3 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">Lanjut →</button>
        ) : (
          <button onClick={() => setSelesai(true)} className="px-6 py-3 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">Selesai ✓</button>
        )}
      </div>
    </div>
  )
}