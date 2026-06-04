'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface JenisBencana { id: number; nama: string }
interface MateriItem {
  id: string
  judul: string
  published: boolean
  is_konsep_dasar: boolean
  jenis_bencana_id: number | null
  jenis_bencana: { nama: string } | null
  pengertian: string
  penyebab: string
  dampak: string
  sebaran_lampung: string
  mitigasi: string
  komponen_bencana: string
  jenis_bencana_umum: string
  siklus_penanggulangan: string
}

export default function AdminMateriPage() {
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [materiList, setMateriList] = useState<MateriItem[]>([])
  const [mode, setMode] = useState<'list' | 'buat' | 'edit'>('list')
  const [editTarget, setEditTarget] = useState<MateriItem | null>(null)
  const [isKonsepDasar, setIsKonsepDasar] = useState(false)
  const [judul, setJudul] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [form, setForm] = useState({
    pengertian: '',
    penyebab: '',
    dampak: '',
    sebaran_lampung: '',
    mitigasi: '',
    komponen_bencana: '',
    jenis_bencana_umum: '',
    siklus_penanggulangan: '',
  })
  const [pesan, setPesan] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchMateri = async () => {
    const { data } = await supabase
      .from('materi_bencana')
      .select('*, jenis_bencana(nama)')
      .order('created_at', { ascending: false })
    if (data) setMateriList(data)
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data: ben } = await supabase.from('jenis_bencana').select('*').eq('kategori', 'bencana')
      if (ben) setBencanaList(ben)
    }
    fetchData()
    fetchMateri()
  }, [])

  const resetForm = () => {
    setJudul('')
    setSelectedBencana('')
    setIsKonsepDasar(false)
    setForm({
      pengertian: '', penyebab: '', dampak: '',
      sebaran_lampung: '', mitigasi: '',
      komponen_bencana: '', jenis_bencana_umum: '', siklus_penanggulangan: ''
    })
    setEditTarget(null)
    setPesan('')
  }

  const handleEdit = (m: MateriItem) => {
    setEditTarget(m)
    setJudul(m.judul)
    setSelectedBencana(m.jenis_bencana_id ? String(m.jenis_bencana_id) : '')
    setIsKonsepDasar(m.is_konsep_dasar)
    setForm({
      pengertian: m.pengertian || '',
      penyebab: m.penyebab || '',
      dampak: m.dampak || '',
      sebaran_lampung: m.sebaran_lampung || '',
      mitigasi: m.mitigasi || '',
      komponen_bencana: m.komponen_bencana || '',
      jenis_bencana_umum: m.jenis_bencana_umum || '',
      siklus_penanggulangan: m.siklus_penanggulangan || '',
    })
    setMode('edit')
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Yakin hapus materi ini?')) return
    await supabase.from('materi_bencana').delete().eq('id', id)
    fetchMateri()
  }

  const handleTogglePublish = async (id: string, current: boolean) => {
    await supabase.from('materi_bencana').update({ published: !current }).eq('id', id)
    fetchMateri()
  }

  const handleSimpan = async (published: boolean) => {
    if (!judul) { setPesan('Judul wajib diisi!'); return }
    if (!isKonsepDasar && !selectedBencana) { setPesan('Pilih jenis bencana!'); return }

    setLoading(true)
    const payload = {
      judul,
      published,
      is_konsep_dasar: isKonsepDasar,
      jenis_bencana_id: isKonsepDasar ? null : Number(selectedBencana),
      konten: '',
      ...form
    }

    let error
    if (mode === 'edit' && editTarget) {
      const res = await supabase.from('materi_bencana').update(payload).eq('id', editTarget.id)
      error = res.error
    } else {
      const res = await supabase.from('materi_bencana').insert(payload)
      error = res.error
    }

    if (error) {
      setPesan('Gagal: ' + error.message)
    } else {
      setPesan(published ? 'Berhasil dipublish!' : 'Tersimpan sebagai draft!')
      resetForm()
      setMode('list')
      fetchMateri()
    }
    setLoading(false)
  }

  const Field = ({ label, field, rows = 4 }: { label: string; field: string; rows?: number }) => (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <textarea
        className="border p-2 rounded w-full text-sm"
        rows={rows}
        placeholder={`Isi ${label.toLowerCase()}...`}
        value={form[field as keyof typeof form]}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
      />
    </div>
  )

  if (mode === 'list') {
    return (
      <main className="p-8 max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Kelola Materi</h1>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
            onClick={() => { resetForm(); setMode('buat') }}
          >
            + Buat Materi
          </button>
        </div>

        {materiList.length === 0 && <p className="text-gray-400 text-sm">Belum ada materi</p>}

        <div className="flex flex-col gap-3">
          {materiList.map(m => (
            <div key={m.id} className="border rounded p-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium">{m.judul}</span>
                {m.is_konsep_dasar && (
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">Konsep Dasar</span>
                )}
                {m.jenis_bencana && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{m.jenis_bencana.nama}</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded ${m.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {m.published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <button className="text-xs bg-yellow-500 text-white px-2 py-1 rounded" onClick={() => handleEdit(m)}>Edit</button>
                <button className="text-xs bg-blue-500 text-white px-2 py-1 rounded" onClick={() => handleTogglePublish(m.id, m.published)}>
                  {m.published ? 'Unpublish' : 'Publish'}
                </button>
                <button className="text-xs bg-red-500 text-white px-2 py-1 rounded" onClick={() => handleHapus(m.id)}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button className="text-sm text-blue-600" onClick={() => { resetForm(); setMode('list') }}>← Kembali</button>
        <h1 className="text-2xl font-bold">{mode === 'edit' ? 'Edit Materi' : 'Buat Materi'}</h1>
      </div>

      <div className="flex flex-col gap-4">
        <input
          className="border p-2 rounded"
          placeholder="Judul materi"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="konsepDasar"
            checked={isKonsepDasar}
            onChange={(e) => setIsKonsepDasar(e.target.checked)}
          />
          <label htmlFor="konsepDasar" className="text-sm">Ini adalah materi Konsep Dasar Bencana</label>
        </div>

        {!isKonsepDasar && (
          <select className="border p-2 rounded" value={selectedBencana} onChange={(e) => setSelectedBencana(e.target.value)}>
            <option value="">Pilih Jenis Bencana</option>
            {bencanaList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
          </select>
        )}

        <div className="border rounded p-4 flex flex-col gap-4">
          {isKonsepDasar ? (
            <>
              <Field label="Pengertian Bencana" field="pengertian" rows={5} />
              <Field label="Komponen Bencana (Ancaman, Kerentanan, Kapasitas)" field="komponen_bencana" rows={5} />
              <Field label="Jenis-jenis Bencana (Alam, Non-Alam, Sosial)" field="jenis_bencana_umum" rows={5} />
              <Field label="Siklus Penanggulangan Bencana" field="siklus_penanggulangan" rows={5} />
            </>
          ) : (
            <>
              <Field label="Pengertian" field="pengertian" rows={4} />
              <Field label="Penyebab" field="penyebab" rows={4} />
              <Field label="Dampak" field="dampak" rows={4} />
              <Field label="Sebaran di Lampung" field="sebaran_lampung" rows={4} />
              <Field label="Mitigasi (Sebelum, Saat, Sesudah)" field="mitigasi" rows={5} />
            </>
          )}
        </div>

        {pesan && <p className="text-sm text-green-600">{pesan}</p>}

        <div className="flex gap-3">
          <button
            className="flex-1 bg-gray-200 text-gray-700 p-2 rounded"
            onClick={() => handleSimpan(false)}
            disabled={loading}
          >
            Simpan Draft
          </button>
          <button
            className="flex-1 bg-blue-600 text-white p-2 rounded"
            onClick={() => handleSimpan(true)}
            disabled={loading}
          >
            {loading ? 'Menyimpan...' : 'Publish'}
          </button>
        </div>
      </div>
    </main>
  )
}