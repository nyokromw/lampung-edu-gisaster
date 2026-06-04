'use client'

import { useEffect, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'

interface Kabupaten {
  id: number
  nama: string
}

interface LayerPeta {
  id: string
  nama: string
  file_url: string
  warna: string
  jenis_bencana: { nama: string }
}

interface LayerState {
  info: LayerPeta
  layer: L.GeoJSON
  visible: boolean
}

export default function Map() {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [selectedKabupaten, setSelectedKabupaten] = useState<number | null>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const [layers, setLayers] = useState<LayerState[]>([])

  useEffect(() => {
    const fetchKabupaten = async () => {
      const { data } = await supabase.from('kabupaten').select('*')
      if (data) setKabupatenList(data)
    }
    fetchKabupaten()
  }, [])

  useEffect(() => {
    const m = L.map('map').setView([-5.4, 105.2], 9)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(m)
    setMap(m)
    return () => { m.remove() }
  }, [])

  useEffect(() => {
    if (!map || !selectedKabupaten) return

    layers.forEach(l => map.removeLayer(l.layer))
    setLayers([])

    const fetchLayers = async () => {
      const { data } = await supabase
        .from('layer_peta')
        .select('*, jenis_bencana(nama)')
        .eq('kabupaten_id', selectedKabupaten)
        .eq('published', true)

      if (!data) return

      const newLayers: LayerState[] = []

      for (const layerData of data) {
        const res = await fetch(layerData.file_url)
        const geojson = await res.json()

        const layer = L.geoJSON(geojson, {
          style: { color: layerData.warna || '#FF0000', weight: 2, fillOpacity: 0.8 },
          onEachFeature: (feature, layer) => {
            if (feature.properties?.nama) {
              layer.bindPopup(`<b>${feature.properties.nama}</b><br/>${feature.properties.keterangan || ''}`)
            }
          },
          pointToLayer: (feature, latlng) => {
            const getRadius = (zoom: number) => Math.max(0.2, zoom - 9)
            const marker = L.circleMarker(latlng, {
              radius: getRadius(map!.getZoom()),
              fillColor: layerData.warna || '#FF0000',
              color: '#fff',
              weight: 1,
              fillOpacity: 0.8
            })
            map!.on('zoomend', () => {
              marker.setRadius(getRadius(map!.getZoom()))
            })
            return marker
          }
        }).addTo(map)

        newLayers.push({ info: layerData, layer, visible: true })
      }

      setLayers(newLayers)
    }

    fetchLayers()
  }, [selectedKabupaten, map])

  const toggleLayer = (index: number) => {
    if (!map) return
    const updated = [...layers]
    if (updated[index].visible) {
      map.removeLayer(updated[index].layer)
    } else {
      map.addLayer(updated[index].layer)
    }
    updated[index].visible = !updated[index].visible
    setLayers(updated)
  }

  const changeOpacity = (index: number, opacity: number) => {
    const updated = [...layers]
    updated[index].layer.setStyle({ fillOpacity: opacity, opacity: opacity })
    setLayers(updated)
  }

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-4 left-4 z-[1000] bg-white p-3 rounded shadow min-w-[220px]">
        <select
          className="text-sm border p-1 rounded w-full mb-3"
          onChange={(e) => setSelectedKabupaten(Number(e.target.value))}
        >
          <option value="">Pilih Kabupaten/Kota</option>
          {kabupatenList.map((kab) => (
            <option key={kab.id} value={kab.id}>{kab.nama}</option>
          ))}
        </select>

        {layers.length > 0 && (
          <div>
            <p className="text-xs font-bold mb-2 text-gray-600">Layer Tersedia:</p>
            {layers.map((l, i) => (
              <div key={l.info.id} className="mb-3 border-b pb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={l.visible}
                    onChange={() => toggleLayer(i)}
                    id={`layer-${i}`}
                  />
                  <label htmlFor={`layer-${i}`} className="text-xs cursor-pointer font-medium">
                    {l.info.nama}
                  </label>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400">Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    defaultValue="0.8"
                    className="flex-1"
                    onChange={(e) => changeOpacity(i, Number(e.target.value))}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div id="map" style={{ width: '100%', height: '100vh' }} />
    </div>
  )
}