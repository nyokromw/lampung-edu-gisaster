'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Soal {
  id: string; pertanyaan: string; opsi_a: string; opsi_b: string; opsi_c: string; opsi_d: string
  jawaban_benar: string; dimensi: string; fase: string
}

const DIMENSI_INFO = {
  SML: { label: 'Spatial Mitigation Literacy', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  SPL: { label: 'Spatial Preparedness Literacy', color: 'bg-green-50 border-green-200 text-green-700' },
  SRL: { label: 'Spatial Response Literacy', color: 'bg-red-50 border-red-200 text-red-700' },
  SRcL: { label: 'Spatial Recovery Literacy', color: 'bg-amber-50 border-amber-200 text-amber-700' },
}

export default function SdlTestPage() {
  const [soals, setSoals] = useState<Soal[]>([])
  const [loading, setLoading] = useState(true)
  const [started, setStarted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [jawaban, setJawaban] = useState<Record<string, string>>({})
  const [finished, setFinished] = useState(false)
  const [filterDimensi, setFilterDimensi] = useState('Semua')

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('sdl_questions').select('*').eq('published', true)
      if (data) setSoals(data.sort(() => Math.random() - 0.5))
      setLoading(false)
    }
    fetch()
  }, [])

  const filtered = filterDimensi === 'Semua' ? soals : soals.filter(s => s.dimensi === filterDimensi)
  const soal = filtered[current]

  const handleJawab = (opt: string) => {
    setJawaban(p => ({ ...p, [soal.id]: opt }))
    if (current < filtered.length - 1) {
      setTimeout(() => setCurrent(c => c + 1), 400)
    } else {
      setTimeout(() => setFinished(true), 400)
    }
  }

  const skor = () => {
    const benar = filtered.filter(s => jawaban[s.id] === s.jawaban_benar).length
    return { benar, total: filtered.length, persen: Math.round(benar / filtered.length * 100) }
  }

  const skorPerDimensi = () => {
    const dims = ['SML', 'SPL', 'SRL', 'SRcL']
    return dims.map(d => {
      const soalDim = filtered.filter(s => s.dimensi === d)
      if (soalDim.length === 0) return null
      const benar = soalDim.filter(s => jawaban[s.id] === s.jawaban_benar).length
      return { dimensi: d, benar, total: soalDim.length, persen: Math.round(benar / soalDim.length * 100) }
    }).filter(Boolean)
  }

  const reset = () => {
    setStarted(false); setFinished(false); setCurrent(0); setJawaban({})
    setSoals(s => [...s].sort(() => Math.random() - 0.5))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // Halaman hasil
  if (finished) {
    const { benar, total, persen } = skor()
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center mb-5">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${persen >= 80 ? 'bg-green-100' : persen >= 60 ? 'bg-amber-100' : 'bg-red-100'}`}>
              <span className={`text-2xl font-extrabold ${persen >= 80 ? 'text-green-700' : persen >= 60 ? 'text-amber-700' : 'text-red-700'}`}>{persen}%</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-1">{persen >= 80 ? 'Luar Biasa!' : persen >= 60 ? 'Cukup Baik' : 'Perlu Belajar Lebih'}</h2>
            <p className="text-gray-500 text-sm">Kamu menjawab {benar} dari {total} soal dengan benar</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
            <h3 className="font-bold text-sm text-gray-700 mb-4">Skor per Dimensi SDL</h3>
            <div className="flex flex-col gap-3">
              {skorPerDimensi().map((s: any) => (
                <div key={s.dimensi}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">{s.dimensi} — {DIMENSI_INFO[s.dimensi as keyof typeof DIMENSI_INFO]?.label}</span>
                    <span className="text-xs text-gray-500">{s.benar}/{s.total}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${s.persen}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={reset} className="w-full bg-blue-950 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-900 transition-all">
            Ulangi Test
          </button>
        </div>
      </div>
    )
  }

  // Halaman mulai
  if (!started) return (
    <div className="min-h-screen bg-gray-50 py-12 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-r from-blue-950 to-blue-900 rounded-2xl p-8 text-white mb-6">
          <h1 className="text-2xl font-extrabold mb-2">SDL Test</h1>
          <p className="text-blue-200/70 text-sm">Uji kemampuan Spatial Disaster Literacy kamu dengan soal pilihan ganda berbasis kasus bencana Lampung.</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
          <h3 className="font-bold text-sm text-gray-700 mb-3">Pilih Dimensi</h3>
          <div className="flex flex-wrap gap-2">
            {['Semua', 'SML', 'SPL', 'SRL', 'SRcL'].map(d => (
              <button key={d} onClick={() => setFilterDimensi(d)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${filterDimensi === d ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
                {d} {d !== 'Semua' && `(${soals.filter(s => s.dimensi === d).length})`}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">{filterDimensi === 'Semua' ? soals.length : soals.filter(s => s.dimensi === filterDimensi).length} soal tersedia</p>
        </div>

        {soals.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Soal belum tersedia</p>
        ) : (
          <button onClick={() => setStarted(true)}
            className="w-full bg-blue-950 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-900 transition-all">
            Mulai Test ({filterDimensi === 'Semua' ? soals.length : soals.filter(s => s.dimensi === filterDimensi).length} Soal)
          </button>
        )}
      </div>
    </div>
  )

  // Halaman soal
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Soal {current + 1} dari {filtered.length}</span>
            <span className={`font-medium px-2 py-0.5 rounded-full border text-[10px] ${DIMENSI_INFO[soal.dimensi as keyof typeof DIMENSI_INFO]?.color}`}>
              {soal.dimensi}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${((current) / filtered.length) * 100}%` }} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <p className="text-sm font-semibold text-gray-800 leading-relaxed mb-6">{soal.pertanyaan}</p>
          <div className="flex flex-col gap-2.5">
            {(['a', 'b', 'c', 'd'] as const).map(opt => {
              const val = soal[`opsi_${opt}` as keyof Soal] as string
              const isSelected = jawaban[soal.id] === opt
              return (
                <button key={opt} onClick={() => handleJawab(opt)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all
                    ${isSelected ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
                  <span className="font-bold mr-2">{opt.toUpperCase()}.</span>{val}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-2">
          {current > 0 && (
            <button onClick={() => setCurrent(c => c - 1)} className="px-4 py-2 text-xs bg-white border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50">← Kembali</button>
          )}
          <button onClick={reset} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Keluar</button>
        </div>
      </div>
    </div>
  )
}