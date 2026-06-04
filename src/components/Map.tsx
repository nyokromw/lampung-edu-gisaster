'use client'

import { useEffect, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'

interface Kabupaten {
  id: number
  nama: string
  kode: string
}

export default function Map() {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [selectedKabupaten, setSelectedKabupaten] = useState<number | null>(null)

  useEffect(() => {
    const fetchKabupaten = async () => {
      const { data } = await supabase.from('kabupaten').select('*')
      if (data) setKabupatenList(data)
    }
    fetchKabupaten()
  }, [])

  useEffect(() => {
    const map = L.map('map').setView([-5.4, 105.2], 9)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)

    return () => {
      map.remove()
    }
  }, [])

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-4 left-4 z-[1000] bg-white p-3 rounded shadow">
        <select
          className="text-sm border p-1 rounded"
          onChange={(e) => setSelectedKabupaten(Number(e.target.value))}
        >
          <option value="">Pilih Kabupaten/Kota</option>
          {kabupatenList.map((kab) => (
            <option key={kab.id} value={kab.id}>{kab.nama}</option>
          ))}
        </select>
      </div>
      <div id="map" style={{ width: '100%', height: '100vh' }} />
    </div>
  )
}