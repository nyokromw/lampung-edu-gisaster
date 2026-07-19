'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface JenisBencana { id: number; nama: string }
interface MateriItem {
  id: string; judul: string; published: boolean; is_konsep_dasar: boolean
  jenis_bencana_id: number | null; jenis_bencana: { nama: string } | null
  pengertian: string; penyebab: string; dampak: string; sebaran_lampung: string
  mitigasi: string; komponen_bencana: string; jenis_bencana_umum: string; siklus_penanggulangan: string
}

export default function AdminMateriPage() {
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [materiList, setMateriList] = useState<MateriItem[]>([])
  const [mode, setMode] = useState<'list' | 'buat' | 'edit'>('list')
  const [editTarget, setEditTarget] = useState<MateriItem | null>(null)
  const [isKonsepDasar, setIsKonsepDasar] = useState(false)
  const [judul, setJudul] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [form, setForm] = useState({ pengertian: '', penyebab: '', dampak: '', sebaran_lampung: '', mitigasi: '', komponen_bencana: '', jenis_bencana_umum: '', siklus_penanggulangan: '' })
  const [pesan, setPesan] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchMateri = async () => {
    const { data } = await supabase.from('materi_bencana').select('*, jenis_bencana(nama)').order('created_at', { ascending: false })
    if (data) setMateriList(data)
  }

  useEffect(() => {
    supabase.from('jenis_bencana').select('*').eq('kategori', 'bencana').then(({ data }) => { if (data) setBencanaList(data) })
    fetchMateri()
  }, [])

  const resetForm = () => {
    setJudul(''); setSelectedBencana(''); setIsKonsepDasar(false)
    setForm({ pengertian: '', penyebab: '', dampak: '', sebaran_lampung: '', mitigasi: '', komponen_bencana: '', jenis_bencana_umum: '', siklus_penanggulangan: '' })
    setEditTarget(null); setPesan('')
  }

  const handleEdit = (m: MateriItem) => {
    setEditTarget(m); setJudul(m.judul); setSelectedBencana(m.jenis_bencana_id ? String(m.jenis_bencana_id) : '')
    setIsKonsepDasar(m.is_konsep_dasar)
    setForm({ pengertian: m.pengertian || '', penyebab: m.penyebab || '', dampak: m.dampak || '', sebaran_lampung: m.sebaran_lampung || '', mitigasi: m.mitigasi || '', komponen_bencana: m.komponen_bencana || '', jenis_bencana_umum: m.jenis_bencana_umum || '', siklus_penanggulangan: m.siklus_penanggulangan || '' })
    setMode('edit')
  }

  const handleSimpan = async (published: boolean) => {
    if (!judul) { setPesan('Judul wajib diisi!'); return }
    if (!isKonsepDasar && !selectedBencana) { setPesan('Pilih jenis bencana!'); return }
    setLoading(true)
    const payload = { judul, published, is_konsep_dasar: isKonsepDasar, jenis_bencana_id: isKonsepDasar ? null : Number(selectedBencana), konten: '', ...form }
    let error
    if (mode === 'edit' && editTarget) {
      const res = await supabase.from('materi_bencana').update(payload).eq('id', editTarget.id); error = res.error
    } else {
      const res = await supabase.from('materi_bencana').insert(payload); error = res.error
    }
    if (error) { setPesan('Gagal: ' + error.message) }
    else { setPesan(published ? 'Berhasil dipublish!' : 'Tersimpan sebagai draft!'); resetForm(); setMode('list'); fetchMateri() }
    setLoading(false)
  }

  const inputCls = "border border-gray-200 p-2.5 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-400"

  const sectionColors: Record<string, string> = {
    pengertian: 'border-l-blue-400 bg-blue-50',
    penyebab: 'border-l-orange-400 bg-orange-50',
    dampak: 'border-l-red-400 bg-red-50',
    sebaran_lampung: 'border-l-green-400 bg-green-50',
    mitigasi: 'border-l-teal-400 bg-teal-50',
    komponen_bencana: 'border-l-purple-400 bg-purple-50',
    jenis_bencana_umum: 'border-l-indigo-400 bg-indigo-50',
    siklus_penanggulangan: 'border-l-cyan-400 bg-cyan-50',
  }

  const Field = ({ label, field, rows = 4 }: { label: string; field: string; rows?: number }) => (
    <div className={`border-l-4 rounded-r-lg p-4 ${sectionColors[field]}`}>
      <label className="text-sm font-semibold text-gray-700 block mb-2">{label}</label>
      <textarea
        className="border border-white/80 bg-white p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        rows={rows}
        placeholder={`Isi ${label.toLowerCase()}...`}
        value={form[field as keyof typeof form]}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
      />
    </div>
  )

  if (mode === 'list') {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Materi Bencana</h1>
            <p className="text-gray-500 text-sm mt-1">Kelola konten materi pembelajaran</p>
          </div>
          <button
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2"
            onClick={() => { resetForm(); setMode('buat') }}
          >
            + Buat Materi
          </button>
        </div>

        {materiList.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">Belum ada materi</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materiList.map(m => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-teal-200 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 text-sm">{m.judul}</h3>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {m.is_konsep_dasar && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Konsep Dasar</span>}
                    {m.jenis_bencana && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{m.jenis_bencana.nama}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.published ? 'Live' : 'Draft'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100" onClick={() => handleEdit(m)}>Edit</button>
                <button className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100"
                  onClick={() => { supabase.from('materi_bencana').update({ published: !m.published }).eq('id', m.id).then(fetchMateri) }}>
                  {m.published ? 'Unpublish' : 'Publish'}
                </button>
                <button className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-100"
                  onClick={async () => { if (!confirm('Yakin hapus?')) return; await supabase.from('materi_bencana').delete().eq('id', m.id); fetchMateri() }}>
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-8">
        <button className="text-sm text-teal-600 hover:text-teal-800 flex items-center gap-1" onClick={() => { resetForm(); setMode('list') }}>
          ← Kembali
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{mode === 'edit' ? 'Edit Materi' : 'Buat Materi Baru'}</h1>
          <p className="text-gray-500 text-sm">Isi semua bagian materi pembelajaran</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-700">Informasi Dasar</h2>
        <input className={inputCls} placeholder="Judul materi" value={judul} onChange={(e) => setJudul(e.target.value)} />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isKonsepDasar} onChange={(e) => setIsKonsepDasar(e.target.checked)} className="accent-teal-600" />
          Ini adalah materi Konsep Dasar Bencana
        </label>
        {!isKonsepDasar && (
          <select className={inputCls} value={selectedBencana} onChange={(e) => setSelectedBencana(e.target.value)}>
            <option value="">Pilih Jenis Bencana</option>
            {bencanaList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {isKonsepDasar ? (
          <>
            <Field label="Pengertian Bencana" field="pengertian" rows={5} />
            <Field label="Komponen Bencana (Ancaman, Kerentanan, Kapasitas)" field="komponen_bencana" rows={5} />
            <Field label="Jenis-jenis Bencana (Alam, Non-Alam, Sosial)" field="jenis_bencana_umum" rows={5} />
            <Field label="Siklus Penanggulangan Bencana" field="siklus_penanggulangan" rows={5} />
          </>
        ) : (
          <>
            <Field label="Pengertian" field="pengertian" />
            <Field label="Penyebab" field="penyebab" />
            <Field label="Dampak" field="dampak" />
            <Field label="Sebaran di Lampung" field="sebaran_lampung" />
            <Field label="Mitigasi (Sebelum, Saat, Sesudah)" field="mitigasi" rows={5} />
          </>
        )}
      </div>

      {pesan && <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 ${pesan.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{pesan}</div>}

      <div className="flex gap-3">
        <button className="flex-1 bg-gray-100 text-gray-700 p-2.5 rounded-xl font-medium hover:bg-gray-200" onClick={() => handleSimpan(false)} disabled={loading}>Simpan Draft</button>
        <button className="flex-1 bg-teal-600 text-white p-2.5 rounded-xl font-medium hover:bg-teal-700" onClick={() => handleSimpan(true)} disabled={loading}>
          {loading ? 'Menyimpan...' : 'Publish'}
        </button>
      </div>
    </div>
  )
}