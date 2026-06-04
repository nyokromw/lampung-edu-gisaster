'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Kabupaten { id: number; nama: string }
interface JenisBencana { id: number; nama: string; kategori: string }
interface LayerPeta {
  id: string
  nama: string
  file_url: string
  warna: string
  published: boolean
  has_tingkat: boolean
  field_tingkat: string
  kabupaten_id: number
  jenis_bencana_id: number
  kabupaten: { nama: string }
  jenis_bencana: { nama: string }
}

export default function AdminPage() {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [layerList, setLayerList] = useState<LayerPeta[]>([])
  const [selectedKabupaten, setSelectedKabupaten] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [namaLayer, setNamaLayer] = useState('')
  const [warna, setWarna] = useState('#FF0000')
  const [file, setFile] = useState<File | null>(null)
  const [hasTingkat, setHasTingkat] = useState(false)
  const [fieldTingkat, setFieldTingkat] = useState('tingkat')
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editWarna, setEditWarna] = useState('')
  const [editKabupaten, setEditKabupaten] = useState('')
  const [editBencana, setEditBencana] = useState('')
  const [editHasTingkat, setEditHasTingkat] = useState(false)
  const [editFieldTingkat, setEditFieldTingkat] = useState('tingkat')

  const fetchLayers = async () => {
    const { data } = await supabase
      .from('layer_peta')
      .select('*, kabupaten(nama), jenis_bencana(nama)')
      .order('created_at', { ascending: false })
    if (data) setLayerList(data)
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data: kab } = await supabase.from('kabupaten').select('*')
      const { data: ben } = await supabase.from('jenis_bencana').select('*')
      if (kab) setKabupatenList(kab)
      if (ben) setBencanaList(ben)
    }
    fetchData()
    fetchLayers()
  }, [])

  const handleUpload = async () => {
    if (!file || !selectedKabupaten || !selectedBencana || !namaLayer) {
      setPesan('Lengkapi semua field dulu!')
      return
    }
    setLoading(true)
    setPesan('')
    const fileName = `${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('layer-peta')
      .upload(fileName, file)

    if (uploadError) {
      setPesan('Gagal upload: ' + uploadError.message)
      setLoading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('layer-peta').getPublicUrl(fileName)
    const { error: dbError } = await supabase.from('layer_peta').insert({
      kabupaten_id: Number(selectedKabupaten),
      jenis_bencana_id: Number(selectedBencana),
      nama: namaLayer,
      file_url: urlData.publicUrl,
      warna,
      published: true,
      has_tingkat: hasTingkat,
      field_tingkat: hasTingkat ? fieldTingkat : null
    })

    if (dbError) {
      setPesan('Gagal simpan: ' + dbError.message)
    } else {
      setPesan('Layer berhasil diupload!')
      setNamaLayer('')
      setFile(null)
      setHasTingkat(false)
      setFieldTingkat('tingkat')
      fetchLayers()
    }
    setLoading(false)
  }

  const handleHapus = async (id: string, fileUrl: string) => {
    if (!confirm('Yakin hapus layer ini?')) return
    const fileName = fileUrl.split('/').pop()
    if (fileName) await supabase.storage.from('layer-peta').remove([fileName])
    await supabase.from('layer_peta').delete().eq('id', id)
    fetchLayers()
  }

  const handleTogglePublish = async (id: string, current: boolean) => {
    await supabase.from('layer_peta').update({ published: !current }).eq('id', id)
    fetchLayers()
  }

  const handleEdit = async (id: string) => {
    const updateData: any = {
      nama: editNama,
      warna: editWarna,
      has_tingkat: editHasTingkat,
      field_tingkat: editHasTingkat ? editFieldTingkat : null
    }
    if (editKabupaten) updateData.kabupaten_id = Number(editKabupaten)
    if (editBencana) updateData.jenis_bencana_id = Number(editBencana)
    await supabase.from('layer_peta').update(updateData).eq('id', id)
    setEditId(null)
    fetchLayers()
  }

  return (
    <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Panel Admin — Lampung Edu Gisaster</h1>

      {/* Form Upload */}
      <div className="border rounded p-4 mb-8">
        <h2 className="font-bold mb-4">Upload Layer Peta</h2>
        <div className="flex flex-col gap-3">
          <select className="border p-2 rounded" onChange={(e) => setSelectedKabupaten(e.target.value)}>
            <option value="">Pilih Kabupaten/Kota</option>
            {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
          <select className="border p-2 rounded" onChange={(e) => setSelectedBencana(e.target.value)}>
            <option value="">Pilih Jenis Bencana/Fasilitas</option>
            {bencanaList.map(b => <option key={b.id} value={b.id}>{b.nama} ({b.kategori})</option>)}
          </select>
          <input
            className="border p-2 rounded"
            placeholder="Nama layer"
            value={namaLayer}
            onChange={(e) => setNamaLayer(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Warna layer:</label>
            <input
              type="color"
              value={warna}
              onChange={(e) => setWarna(e.target.value)}
              className="w-10 h-8 cursor-pointer"
            />
            <span className="text-sm text-gray-500">{warna}</span>
          </div>
          <input
            type="file"
            accept=".geojson,.kml,.json"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hasTingkat"
              checked={hasTingkat}
              onChange={(e) => setHasTingkat(e.target.checked)}
            />
            <label htmlFor="hasTingkat" className="text-sm">Layer punya atribut tingkat bahaya</label>
          </div>
          {hasTingkat && (
            <input
              className="border p-2 rounded text-sm"
              placeholder="Nama field tingkat (default: tingkat)"
              value={fieldTingkat}
              onChange={(e) => setFieldTingkat(e.target.value)}
            />
          )}
          <button
            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? 'Mengupload...' : 'Upload Layer'}
          </button>
          {pesan && <p className="text-sm text-green-600">{pesan}</p>}
        </div>
      </div>

      {/* Daftar Layer */}
      <div className="border rounded p-4">
        <h2 className="font-bold mb-4">Daftar Layer ({layerList.length})</h2>
        {layerList.length === 0 && <p className="text-sm text-gray-400">Belum ada layer</p>}
        <div className="flex flex-col gap-3">
          {layerList.map(l => (
            <div key={l.id} className="border rounded p-3">
              {editId === l.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    className="border p-1 rounded text-sm"
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    placeholder="Nama layer"
                  />
                  <select
                    className="border p-1 rounded text-sm"
                    value={editKabupaten}
                    onChange={(e) => setEditKabupaten(e.target.value)}
                  >
                    <option value="">Kabupaten tidak diubah</option>
                    {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                  </select>
                  <select
                    className="border p-1 rounded text-sm"
                    value={editBencana}
                    onChange={(e) => setEditBencana(e.target.value)}
                  >
                    <option value="">Jenis bencana tidak diubah</option>
                    {bencanaList.map(b => <option key={b.id} value={b.id}>{b.nama} ({b.kategori})</option>)}
                  </select>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Warna:</label>
                    <input
                      type="color"
                      value={editWarna}
                      onChange={(e) => setEditWarna(e.target.value)}
                      className="w-8 h-6"
                    />
                    <span className="text-xs text-gray-500">{editWarna}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="editHasTingkat"
                      checked={editHasTingkat}
                      onChange={(e) => setEditHasTingkat(e.target.checked)}
                    />
                    <label htmlFor="editHasTingkat" className="text-sm">Punya atribut tingkat bahaya</label>
                  </div>
                  {editHasTingkat && (
                    <input
                      className="border p-1 rounded text-sm"
                      placeholder="Nama field tingkat"
                      value={editFieldTingkat}
                      onChange={(e) => setEditFieldTingkat(e.target.value)}
                    />
                  )}
                  <div className="flex gap-2">
                    <button className="text-xs bg-green-600 text-white px-2 py-1 rounded" onClick={() => handleEdit(l.id)}>Simpan</button>
                    <button className="text-xs bg-gray-300 px-2 py-1 rounded" onClick={() => setEditId(null)}>Batal</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-4 rounded" style={{ background: l.warna }}></div>
                    <span className="font-medium text-sm">{l.nama}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${l.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {l.published ? 'Published' : 'Draft'}
                    </span>
                    {l.has_tingkat && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Multi-tingkat</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    {l.kabupaten?.nama} — {l.jenis_bencana?.nama}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="text-xs bg-yellow-500 text-white px-2 py-1 rounded"
                      onClick={() => {
                        setEditId(l.id)
                        setEditNama(l.nama)
                        setEditWarna(l.warna)
                        setEditKabupaten(String(l.kabupaten_id))
                        setEditBencana(String(l.jenis_bencana_id))
                        setEditHasTingkat(l.has_tingkat || false)
                        setEditFieldTingkat(l.field_tingkat || 'tingkat')
                      }}
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
                      onClick={() => handleHapus(l.id, l.file_url)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}