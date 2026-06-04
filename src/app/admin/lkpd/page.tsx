'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Kabupaten { id: number; nama: string }
interface JenisBencana { id: number; nama: string }
interface LkpdItem {
  id: string
  judul: string
  published: boolean
  kabupaten: { nama: string }
  jenis_bencana: { nama: string }
  kabupaten_id: number
  jenis_bencana_id: number
  pertanyaan: Aktivitas[]
}

interface Aktivitas {
  id: number
  judul: string
  instruksi: string
  tipe: 'esai' | 'pilihan_ganda' | 'tabel' | 'diagram'
  kode_sdl: string
  ada_peta: boolean
  peta_kabupaten_id?: number
  soal?: string
  pilihan?: string[]
  jawaban_benar?: number
  kolom_tabel?: string[]
  jumlah_baris?: number
  jenis_grafik?: 'bar' | 'pie' | 'line'
  kolom_diagram?: string[]
}

const SDL_OPTIONS = ['SML', 'SPL', 'SRL', 'SRcL']
const TIPE_OPTIONS = [
  { value: 'esai', label: 'Esai' },
  { value: 'pilihan_ganda', label: 'Pilihan Ganda' },
  { value: 'tabel', label: 'Isi Tabel' },
  { value: 'diagram', label: 'Diagram' },
]

const defaultAktivitas = (): Aktivitas => ({
  id: Date.now(),
  judul: '',
  instruksi: '',
  tipe: 'esai',
  kode_sdl: 'SML',
  ada_peta: false,
  soal: '',
  pilihan: ['', '', '', ''],
  jawaban_benar: 0,
  kolom_tabel: ['Kolom 1', 'Kolom 2'],
  jumlah_baris: 3,
  jenis_grafik: 'bar',
  kolom_diagram: ['Label', 'Nilai'],
})

function FormAktivitas({ aktivitasList, setAktivitasList, kabupatenList }: {
  aktivitasList: Aktivitas[]
  setAktivitasList: (a: Aktivitas[]) => void
  kabupatenList: Kabupaten[]
}) {
  const updateAktivitas = (id: number, field: string, value: any) => {
    setAktivitasList(aktivitasList.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  const hapusAktivitas = (id: number) => {
    setAktivitasList(aktivitasList.filter(a => a.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      {aktivitasList.map((a, index) => (
        <div key={a.id} className="border rounded p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-sm">Aktivitas {index + 1}</span>
            <button className="text-xs text-red-500" onClick={() => hapusAktivitas(a.id)}>Hapus</button>
          </div>

          <div className="flex flex-col gap-2">
            <input
              className="border p-2 rounded text-sm"
              placeholder="Judul aktivitas"
              value={a.judul}
              onChange={(e) => updateAktivitas(a.id, 'judul', e.target.value)}
            />
            <div className="flex gap-2">
              <select
                className="border p-1 rounded text-sm flex-1"
                value={a.tipe}
                onChange={(e) => updateAktivitas(a.id, 'tipe', e.target.value)}
              >
                {TIPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select
                className="border p-1 rounded text-sm"
                value={a.kode_sdl}
                onChange={(e) => updateAktivitas(a.id, 'kode_sdl', e.target.value)}
              >
                {SDL_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <textarea
              className="border p-2 rounded text-sm"
              placeholder="Instruksi untuk siswa"
              rows={2}
              value={a.instruksi}
              onChange={(e) => updateAktivitas(a.id, 'instruksi', e.target.value)}
            />

            {a.tipe === 'esai' && (
              <textarea
                className="border p-2 rounded text-sm"
                placeholder="Tulis pertanyaan esai"
                rows={2}
                value={a.soal}
                onChange={(e) => updateAktivitas(a.id, 'soal', e.target.value)}
              />
            )}

            {a.tipe === 'pilihan_ganda' && (
              <div className="flex flex-col gap-2">
                <textarea
                  className="border p-2 rounded text-sm"
                  placeholder="Tulis pertanyaan"
                  rows={2}
                  value={a.soal}
                  onChange={(e) => updateAktivitas(a.id, 'soal', e.target.value)}
                />
                {a.pilihan?.map((p, pi) => (
                  <div key={pi} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`jawaban-${a.id}`}
                      checked={a.jawaban_benar === pi}
                      onChange={() => updateAktivitas(a.id, 'jawaban_benar', pi)}
                    />
                    <input
                      className="border p-1 rounded text-sm flex-1"
                      placeholder={`Pilihan ${pi + 1}`}
                      value={p}
                      onChange={(e) => {
                        const newPilihan = [...(a.pilihan || [])]
                        newPilihan[pi] = e.target.value
                        updateAktivitas(a.id, 'pilihan', newPilihan)
                      }}
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-400">Pilih radio button untuk tandai jawaban benar</p>
              </div>
            )}

            {a.tipe === 'tabel' && (
              <div className="flex flex-col gap-2">
                <textarea
                  className="border p-2 rounded text-sm"
                  placeholder="Instruksi pengisian tabel"
                  rows={2}
                  value={a.soal}
                  onChange={(e) => updateAktivitas(a.id, 'soal', e.target.value)}
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Nama kolom (pisah dengan koma):</p>
                    <input
                      className="border p-1 rounded text-sm w-full"
                      placeholder="Kecamatan, Jumlah Korban"
                      value={a.kolom_tabel?.join(', ')}
                      onChange={(e) => updateAktivitas(a.id, 'kolom_tabel', e.target.value.split(',').map(s => s.trim()))}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Jumlah baris:</p>
                    <input
                      type="number"
                      className="border p-1 rounded text-sm w-16"
                      value={a.jumlah_baris}
                      min={1}
                      max={20}
                      onChange={(e) => updateAktivitas(a.id, 'jumlah_baris', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            {a.tipe === 'diagram' && (
              <div className="flex flex-col gap-2">
                <textarea
                  className="border p-2 rounded text-sm"
                  placeholder="Instruksi pembuatan diagram"
                  rows={2}
                  value={a.soal}
                  onChange={(e) => updateAktivitas(a.id, 'soal', e.target.value)}
                />
                <select
                  className="border p-1 rounded text-sm"
                  value={a.jenis_grafik}
                  onChange={(e) => updateAktivitas(a.id, 'jenis_grafik', e.target.value as any)}
                >
                  <option value="bar">Bar Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="line">Line Chart</option>
                </select>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Nama kolom (pisah dengan koma):</p>
                  <input
                    className="border p-1 rounded text-sm w-full"
                    placeholder="Kecamatan, Jumlah Korban"
                    value={a.kolom_diagram?.join(', ')}
                    onChange={(e) => updateAktivitas(a.id, 'kolom_diagram', e.target.value.split(',').map(s => s.trim()))}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 mt-1 pt-2 border-t">
              <input
                type="checkbox"
                id={`peta-${a.id}`}
                checked={a.ada_peta}
                onChange={(e) => updateAktivitas(a.id, 'ada_peta', e.target.checked)}
              />
              <label htmlFor={`peta-${a.id}`} className="text-xs">Sertakan peta interaktif</label>
              {a.ada_peta && (
                <select
                  className="border p-1 rounded text-xs ml-2"
                  value={a.peta_kabupaten_id || ''}
                  onChange={(e) => updateAktivitas(a.id, 'peta_kabupaten_id', Number(e.target.value))}
                >
                  <option value="">Pilih kabupaten</option>
                  {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>
      ))}

      <button
        className="w-full border-2 border-dashed border-gray-300 text-gray-500 py-3 rounded text-sm hover:border-blue-400 hover:text-blue-500"
        onClick={() => setAktivitasList([...aktivitasList, defaultAktivitas()])}
      >
        + Tambah Aktivitas
      </button>
    </div>
  )
}

export default function AdminLkpdPage() {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [lkpdList, setLkpdList] = useState<LkpdItem[]>([])
  const [mode, setMode] = useState<'list' | 'buat' | 'edit'>('list')
  const [editTarget, setEditTarget] = useState<LkpdItem | null>(null)
  const [judul, setJudul] = useState('')
  const [selectedKabupaten, setSelectedKabupaten] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [aktivitasList, setAktivitasList] = useState<Aktivitas[]>([])
  const [pesan, setPesan] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchLkpd = async () => {
    const { data } = await supabase
      .from('e_lkpd')
      .select('*, kabupaten(nama), jenis_bencana(nama)')
      .order('created_at', { ascending: false })
    if (data) setLkpdList(data)
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data: kab } = await supabase.from('kabupaten').select('*')
      const { data: ben } = await supabase.from('jenis_bencana').select('*')
      if (kab) setKabupatenList(kab)
      if (ben) setBencanaList(ben)
    }
    fetchData()
    fetchLkpd()
  }, [])

  const resetForm = () => {
    setJudul('')
    setSelectedKabupaten('')
    setSelectedBencana('')
    setAktivitasList([])
    setEditTarget(null)
    setPesan('')
  }

  const handleEdit = (lkpd: LkpdItem) => {
    setEditTarget(lkpd)
    setJudul(lkpd.judul)
    setSelectedKabupaten(String(lkpd.kabupaten_id))
    setSelectedBencana(String(lkpd.jenis_bencana_id))
    setAktivitasList(lkpd.pertanyaan || [])
    setMode('edit')
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Yakin hapus E-LKPD ini?')) return
    await supabase.from('e_lkpd').delete().eq('id', id)
    fetchLkpd()
  }

  const handleTogglePublish = async (id: string, current: boolean) => {
    await supabase.from('e_lkpd').update({ published: !current }).eq('id', id)
    fetchLkpd()
  }

  const handleSimpan = async (published: boolean) => {
    if (!judul || !selectedKabupaten || !selectedBencana) {
      setPesan('Lengkapi judul, kabupaten, dan jenis bencana!')
      return
    }
    if (aktivitasList.length === 0) {
      setPesan('Tambah minimal 1 aktivitas!')
      return
    }

    setLoading(true)
    const payload = {
      judul,
      kabupaten_id: Number(selectedKabupaten),
      jenis_bencana_id: Number(selectedBencana),
      pertanyaan: aktivitasList,
      published
    }

    let error
    if (mode === 'edit' && editTarget) {
      const res = await supabase.from('e_lkpd').update(payload).eq('id', editTarget.id)
      error = res.error
    } else {
      const res = await supabase.from('e_lkpd').insert(payload)
      error = res.error
    }

    if (error) {
      setPesan('Gagal simpan: ' + error.message)
    } else {
      setPesan(published ? 'Berhasil dipublish!' : 'Tersimpan sebagai draft!')
      resetForm()
      setMode('list')
      fetchLkpd()
    }
    setLoading(false)
  }

  if (mode === 'list') {
    return (
      <main className="p-8 max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Kelola E-LKPD</h1>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
            onClick={() => { resetForm(); setMode('buat') }}
          >
            + Buat E-LKPD
          </button>
        </div>

        {lkpdList.length === 0 && <p className="text-gray-400 text-sm">Belum ada E-LKPD</p>}

        <div className="flex flex-col gap-3">
          {lkpdList.map(l => (
            <div key={l.id} className="border rounded p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{l.judul}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${l.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {l.published ? 'Published' : 'Draft'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {l.kabupaten?.nama} — {l.jenis_bencana?.nama} — {l.pertanyaan?.length || 0} aktivitas
              </p>
              <div className="flex gap-2">
                <button
                  className="text-xs bg-yellow-500 text-white px-2 py-1 rounded"
                  onClick={() => handleEdit(l)}
                >
                  Edit
                </button>
                <button
                  className="text-xs bg-blue-500 text-white px-2 py-1 rounded"
                  onClick={() => handleTogglePublish(l.id, l.published)}
                >
                  {l.published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  className="text-xs bg-red-500 text-white px-2 py-1 rounded"
                  onClick={() => handleHapus(l.id)}
                >
                  Hapus
                </button>
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
        <button
          className="text-sm text-blue-600"
          onClick={() => { resetForm(); setMode('list') }}
        >
          ← Kembali
        </button>
        <h1 className="text-2xl font-bold">
          {mode === 'edit' ? 'Edit E-LKPD' : 'Buat E-LKPD'}
        </h1>
      </div>

      <div className="border rounded p-4 mb-6 flex flex-col gap-3">
        <h2 className="font-bold">Informasi Dasar</h2>
        <input
          className="border p-2 rounded"
          placeholder="Judul E-LKPD"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
        />
        <select className="border p-2 rounded" value={selectedKabupaten} onChange={(e) => setSelectedKabupaten(e.target.value)}>
          <option value="">Pilih Kabupaten/Kota</option>
          {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
        </select>
        <select className="border p-2 rounded" value={selectedBencana} onChange={(e) => setSelectedBencana(e.target.value)}>
          <option value="">Pilih Jenis Bencana</option>
          {bencanaList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
        </select>
      </div>

      <FormAktivitas
        aktivitasList={aktivitasList}
        setAktivitasList={setAktivitasList}
        kabupatenList={kabupatenList}
      />

      {pesan && <p className="text-sm text-green-600 mt-4 mb-2">{pesan}</p>}

      <div className="flex gap-3 mt-4">
        <button
          className="flex-1 bg-gray-200 text-gray-700 p-2 rounded hover:bg-gray-300"
          onClick={() => handleSimpan(false)}
          disabled={loading}
        >
          Simpan Draft
        </button>
        <button
          className="flex-1 bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          onClick={() => handleSimpan(true)}
          disabled={loading}
        >
          {loading ? 'Menyimpan...' : 'Publish'}
        </button>
      </div>
    </main>
  )
}