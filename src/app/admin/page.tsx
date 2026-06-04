'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Kabupaten {
  id: number
  nama: string
}

interface JenisBencana {
  id: number
  nama: string
  kategori: string
}

export default function AdminPage() {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [selectedKabupaten, setSelectedKabupaten] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [namaLayer, setNamaLayer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const { data: kab } = await supabase.from('kabupaten').select('*')
      const { data: ben } = await supabase.from('jenis_bencana').select('*')
      if (kab) setKabupatenList(kab)
      if (ben) setBencanaList(ben)
    }
    fetchData()
  }, [])

  const handleUpload = async () => {
    if (!file || !selectedKabupaten || !selectedBencana || !namaLayer) {
      setPesan('Lengkapi semua field dulu!')
      return
    }

    setLoading(true)
    const fileName = `${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('layer-peta')
      .upload(fileName, file)

    if (uploadError) {
      setPesan('Gagal upload file: ' + uploadError.message)
      setLoading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('layer-peta')
      .getPublicUrl(fileName)

    const { error: dbError } = await supabase.from('layer_peta').insert({
      kabupaten_id: Number(selectedKabupaten),
      jenis_bencana_id: Number(selectedBencana),
      nama: namaLayer,
      file_url: urlData.publicUrl,
      published: true
    })

    if (dbError) {
      setPesan('Gagal simpan ke database: ' + dbError.message)
    } else {
      setPesan('Layer berhasil diupload!')
      setNamaLayer('')
      setFile(null)
    }

    setLoading(false)
  }

  return (
    <main className="p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Panel Admin — Upload Layer Peta</h1>

      <div className="flex flex-col gap-4">
        <select className="border p-2 rounded" onChange={(e) => setSelectedKabupaten(e.target.value)}>
          <option value="">Pilih Kabupaten/Kota</option>
          {kabupatenList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
        </select>

        <select className="border p-2 rounded" onChange={(e) => setSelectedBencana(e.target.value)}>
          <option value="">Pilih Jenis Bencana/Fasilitas</option>
          {bencanaList.map((b) => <option key={b.id} value={b.id}>{b.nama} ({b.kategori})</option>)}
        </select>

        <input
          className="border p-2 rounded"
          placeholder="Nama layer"
          value={namaLayer}
          onChange={(e) => setNamaLayer(e.target.value)}
        />

        <input
          type="file"
          accept=".geojson,.kml,.json"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <button
          className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          onClick={handleUpload}
          disabled={loading}
        >
          {loading ? 'Mengupload...' : 'Upload Layer'}
        </button>

        {pesan && <p className="text-sm text-green-600">{pesan}</p>}
      </div>
    </main>
  )
}