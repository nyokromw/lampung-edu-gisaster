'use client'

import { useState } from 'react'
import * as turf from '@turf/turf'

interface LayerState {
  info: {
    id: string
    nama: string
    file_url: string
    has_tingkat: boolean
    field_tingkat: string
    jenis_bencana: { nama: string }
  }
  visible: boolean
}

interface Props {
  layers: LayerState[]
}

interface HasilTerdampak {
  nama: string
  keterangan: string
}

export default function OverlayControl({ layers }: Props) {
  const [selectedBencana, setSelectedBencana] = useState('')
  const [selectedFasilitas, setSelectedFasilitas] = useState('')
  const [selectedTingkat, setSelectedTingkat] = useState('semua')
  const [tingkatOptions, setTingkatOptions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [hasil, setHasil] = useState<HasilTerdampak[]>([])
  const [sudahAnalisis, setSudahAnalisis] = useState(false)

  const handlePilihBencana = async (id: string) => {
    setSelectedBencana(id)
    setSelectedTingkat('semua')
    setTingkatOptions([])

    const layer = layers.find(l => l.info.id === id)
    if (!layer || !layer.info.has_tingkat) return

    const res = await fetch(layer.info.file_url)
    const geojson = await res.json()
    const field = layer.info.field_tingkat || 'tingkat'

    const nilaiTingkat = [...new Set(
      geojson.features.map((f: any) => f.properties?.[field]).filter(Boolean)
    )] as string[]

    setTingkatOptions(nilaiTingkat)
  }

  const analisis = async () => {
    if (!selectedBencana || !selectedFasilitas) return
    setLoading(true)
    setSudahAnalisis(false)
    setHasil([])

    const bencanaLayer = layers.find(l => l.info.id === selectedBencana)
    const fasilitasLayer = layers.find(l => l.info.id === selectedFasilitas)
    if (!bencanaLayer || !fasilitasLayer) { setLoading(false); return }

    const [resBencana, resFasilitas] = await Promise.all([
      fetch(bencanaLayer.info.file_url).then(r => r.json()),
      fetch(fasilitasLayer.info.file_url).then(r => r.json())
    ])

    const field = bencanaLayer.info.field_tingkat || 'tingkat'
    const polygons = resBencana.features.filter((f: any) => {
      if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') return false
      if (selectedTingkat === 'semua') return true
      return f.properties?.[field] === selectedTingkat
    })

    const terdampak: HasilTerdampak[] = []
    for (const polygon of polygons) {
      for (const titik of resFasilitas.features) {
        if (titik.geometry.type !== 'Point') continue
        if (turf.booleanPointInPolygon(titik, polygon)) {
          terdampak.push({
            nama: titik.properties?.nama || 'Tanpa nama',
            keterangan: titik.properties?.keterangan || ''
          })
        }
      }
    }

    setHasil(terdampak)
    setSudahAnalisis(true)
    setLoading(false)
  }

  const selectedBencanaInfo = layers.find(l => l.info.id === selectedBencana)?.info

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-gray-600">Analisis Overlay:</p>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Layer Bencana (Poligon):</label>
        <select
          className="text-xs border p-1 rounded"
          onChange={(e) => handlePilihBencana(e.target.value)}
        >
          <option value="">Pilih layer bencana</option>
          {layers.map(l => (
            <option key={l.info.id} value={l.info.id}>{l.info.nama}</option>
          ))}
        </select>
      </div>

      {selectedBencanaInfo?.has_tingkat && tingkatOptions.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">Filter Tingkat:</label>
          <select
            className="text-xs border p-1 rounded"
            value={selectedTingkat}
            onChange={(e) => setSelectedTingkat(e.target.value)}
          >
            <option value="semua">Semua tingkat</option>
            {tingkatOptions.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Layer Fasilitas (Titik):</label>
        <select
          className="text-xs border p-1 rounded"
          onChange={(e) => setSelectedFasilitas(e.target.value)}
        >
          <option value="">Pilih layer fasilitas</option>
          {layers.map(l => (
            <option key={l.info.id} value={l.info.id}>{l.info.nama}</option>
          ))}
        </select>
      </div>

      <button
        className="text-xs bg-purple-600 text-white px-2 py-1 rounded disabled:opacity-50"
        onClick={analisis}
        disabled={loading || !selectedBencana || !selectedFasilitas}
      >
        {loading ? 'Menganalisis...' : 'Analisis Dampak'}
      </button>

      {sudahAnalisis && (
        <div className="mt-1">
          <p className="text-xs font-bold text-gray-600">
            {hasil.length === 0
              ? 'Tidak ada fasilitas terdampak'
              : `${hasil.length} fasilitas terdampak:`}
          </p>
          <ul className="mt-1 max-h-32 overflow-y-auto">
            {hasil.map((h, i) => (
              <li key={i} className="text-xs text-gray-700 border-b py-1">
                {h.nama} {h.keterangan && `— ${h.keterangan}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}