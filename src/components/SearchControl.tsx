'use client'

import { useState } from 'react'
import L from 'leaflet'

interface Props {
  map: L.Map | null
}

export default function SearchControl({ map }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async () => {
    if (!query || !map) return
    setLoading(true)
    setError('')

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=id`
    )
    const data = await res.json()

    if (data.length === 0) {
      setError('Lokasi tidak ditemukan')
      setLoading(false)
      return
    }

    const { lat, lon, display_name } = data[0]
    map.setView([parseFloat(lat), parseFloat(lon)], 13)
    L.marker([parseFloat(lat), parseFloat(lon)])
      .addTo(map)
      .bindPopup(display_name)
      .openPopup()

    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-bold text-gray-600">Cari Lokasi:</p>
      <div className="flex gap-1">
        <input
          type="text"
          className="text-xs border p-1 rounded flex-1"
          placeholder="Ketik nama lokasi..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button
          className="text-xs bg-blue-600 text-white px-2 rounded"
          onClick={handleSearch}
        >
          {loading ? '...' : 'Cari'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}