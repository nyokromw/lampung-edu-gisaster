'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface SdlQuestion {
  id: string; pertanyaan: string; opsi_a: string; opsi_b: string; opsi_c: string; opsi_d: string
  jawaban_benar: string; dimensi: string; fase: string; published: boolean
}

const DIMENSI = ['SML', 'SPL', 'SRL', 'SRcL']
const FASE = ['Mitigasi', 'Kesiapsiagaan', 'Respons', 'Pemulihan']
const inp = "w-full border border-gray-200 bg-white px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"

export default function AdminSdlTestPage() {
  const [questions, setQuestions] = useState<SdlQuestion[]>([])
  const [filterDimensi, setFilterDimensi] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState('')

  const [form, setForm] = useState({
    pertanyaan: '', opsi_a: '', opsi_b: '', opsi_c: '', opsi_d: '',
    jawaban_benar: 'a', dimensi: 'SML', fase: 'Mitigasi', published: true
  })

  const fetchQuestions = async () => {
    const { data } = await supabase.from('sdl_questions').select('*').order('created_at', { ascending: false })
    if (data) setQuestions(data)
  }

  useEffect(() => { fetchQuestions() }, [])

  const handleSave = async () => {
    if (!form.pertanyaan || !form.opsi_a || !form.opsi_b || !form.opsi_c || !form.opsi_d) {
      setPesan('Lengkapi semua field!'); return
    }
    setLoading(true)
    const { error } = await supabase.from('sdl_questions').insert(form)
    if (error) setPesan('Gagal: ' + error.message)
    else {
      setPesan('Soal berhasil disimpan!')
      setForm({ pertanyaan: '', opsi_a: '', opsi_b: '', opsi_c: '', opsi_d: '', jawaban_benar: 'a', dimensi: 'SML', fase: 'Mitigasi', published: true })
      setShowForm(false); fetchQuestions()
    }
    setLoading(false)
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Hapus soal ini?')) return
    await supabase.from('sdl_questions').delete().eq('id', id)
    fetchQuestions()
  }

  const filtered = questions.filter(q => !filterDimensi || q.dimensi === filterDimensi)

  return (
    <div className="p-6 max-w-[1000px]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">SDL Test</h1>
          <p className="text-sm text-gray-400 mt-0.5">Kelola soal ujian Spatial Disaster Literacy</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-950 text-white text-sm px-4 py-2 rounded-xl font-medium hover:bg-blue-900 transition-all">
          {showForm ? 'Tutup Form' : '+ Tambah Soal'}
        </button>
      </div>

      {/* Stat */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {DIMENSI.map(d => (
          <div key={d} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xl font-bold text-blue-950">{questions.filter(q => q.dimensi === d).length}</p>
            <p className="text-xs text-gray-400 mt-0.5">{d}</p>
          </div>
        ))}
      </div>

      {/* Form tambah soal */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5">
          <h3 className="font-semibold text-sm text-gray-800 mb-4">Tambah Soal Baru</h3>
          <div className="flex flex-col gap-3">
            <textarea className={inp} rows={3} placeholder="Pertanyaan..." value={form.pertanyaan} onChange={e => setForm(p => ({ ...p, pertanyaan: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              {(['a', 'b', 'c', 'd'] as const).map(opt => (
                <input key={opt} className={inp} placeholder={`Opsi ${opt.toUpperCase()}`}
                  value={form[`opsi_${opt}` as keyof typeof form] as string}
                  onChange={e => setForm(p => ({ ...p, [`opsi_${opt}`]: e.target.value }))} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Jawaban Benar</label>
                <select className={inp} value={form.jawaban_benar} onChange={e => setForm(p => ({ ...p, jawaban_benar: e.target.value }))}>
                  {['a', 'b', 'c', 'd'].map(o => <option key={o} value={o}>Opsi {o.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Dimensi SDL</label>
                <select className={inp} value={form.dimensi} onChange={e => setForm(p => ({ ...p, dimensi: e.target.value }))}>
                  {DIMENSI.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Fase Bencana</label>
                <select className={inp} value={form.fase} onChange={e => setForm(p => ({ ...p, fase: e.target.value }))}>
                  {FASE.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            {pesan && <p className={`text-sm px-3 py-2 rounded-lg ${pesan.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{pesan}</p>}
            <button onClick={handleSave} disabled={loading}
              className="bg-blue-950 text-white text-sm py-2.5 rounded-xl font-medium hover:bg-blue-900 disabled:opacity-50 transition-all">
              {loading ? 'Menyimpan...' : 'Simpan Soal'}
            </button>
          </div>
        </div>
      )}

      {/* Filter + list */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button onClick={() => setFilterDimensi('')}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-all ${!filterDimensi ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
              Semua ({questions.length})
            </button>
            {DIMENSI.map(d => (
              <button key={d} onClick={() => setFilterDimensi(d)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-all ${filterDimensi === d ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                {d}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">{filtered.length} soal</span>
        </div>

        <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Belum ada soal</p>}
          {filtered.map((q, i) => (
            <div key={q.id} className="border border-gray-100 rounded-xl p-3.5 group hover:border-blue-200 transition-all">
              <div className="flex items-start gap-3">
                <span className="text-xs text-gray-400 w-6 flex-shrink-0 pt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 mb-1.5">{q.pertanyaan}</p>
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {(['a', 'b', 'c', 'd'] as const).map(opt => (
                      <p key={opt} className={`text-xs px-2 py-1 rounded-lg ${q.jawaban_benar === opt ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-500'}`}>
                        {opt.toUpperCase()}. {q[`opsi_${opt}` as keyof typeof q]}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium">{q.dimensi}</span>
                    <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">{q.fase}</span>
                  </div>
                </div>
                <button onClick={() => handleHapus(q.id)}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-400 hover:text-red-600 transition-all flex-shrink-0">
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}