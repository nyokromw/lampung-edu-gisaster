'use client'

import { useEffect, useState, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'
import SearchControl from './SearchControl'
import MeasureControl from './MeasureControl'
import CrossSection from './CrossSection'
import OverlayControl from './OverlayControl'

interface Kabupaten {
  id: number
  nama: string
}

interface LayerPeta {
  id: string
  nama: string
  file_url: string
  warna: string
  has_tingkat: boolean
  field_tingkat: string
  jenis_bencana: { nama: string }
}

interface SubLayer {
  tingkat: string
  layer: L.GeoJSON
  visible: boolean
  warna: string
}

interface LayerState {
  info: LayerPeta
  layer: L.GeoJSON | null
  visible: boolean
  subLayers: SubLayer[]
}

const WARNA_TINGKAT: Record<string, string> = {
  tinggi: '#FF0000',
  sedang: '#FFA500',
  rendah: '#FFFF00',
}

export default function Map() {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [selectedKabupaten, setSelectedKabupaten] = useState<number | null>(null)
  const [layers, setLayers] = useState<LayerState[]>([])
  const [activeMenu, setActiveMenu] = useState<'layer' | 'ukur' | 'crosssection' | 'search' | 'overlay'>('layer')
  const mapRef = useRef<L.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    const fetchKabupaten = async () => {
      const { data } = await supabase.from('kabupaten').select('*')
      if (data) setKabupatenList(data)
    }
    fetchKabupaten()
  }, [])

  useEffect(() => {
    if (mapRef.current) return
    const m = L.map('map').setView([-5.4, 105.2], 9)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(m)
    mapRef.current = m
    setMapReady(true)
    return () => {
      m.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedKabupaten) return
    const map = mapRef.current

    layers.forEach(l => {
  if (l.layer) { try { map.removeLayer(l.layer) } catch (_) {} }
  l.subLayers.forEach(sl => { try { map.removeLayer(sl.layer) } catch (_) {} })
})
    setLayers([])

    const fetchLayers = async () => {
      const { data } = await supabase
        .from('layer_peta')
        .select('*, jenis_bencana(nama)')
        .eq('kabupaten_id', selectedKabupaten)
        .eq('published', true)

      if (!data || !mapRef.current) return

      const newLayers: LayerState[] = []

      for (const layerData of data) {
        try {
          const res = await fetch(layerData.file_url)
          const geojson = await res.json()
          if (!mapRef.current) return

          if (layerData.has_tingkat && layerData.field_tingkat) {
            const field = layerData.field_tingkat
            const nilaiTingkat = [...new Set(
              geojson.features.map((f: any) => f.properties?.[field]).filter(Boolean)
            )] as string[]

            const subLayers: SubLayer[] = []

            for (const tingkat of nilaiTingkat) {
              const warna = WARNA_TINGKAT[tingkat.toLowerCase()] || layerData.warna || '#FF0000'
              const filtered = {
                type: 'FeatureCollection',
                features: geojson.features.filter((f: any) => f.properties?.[field] === tingkat)
              }

              const subLayer = L.geoJSON(filtered as any, {
                style: { color: warna, weight: 2, fillOpacity: 0.6 },
                onEachFeature: (feature, layer) => {
                  layer.bindPopup(`<b>${feature.properties?.nama || tingkat}</b><br/>Tingkat: ${tingkat}<br/>${feature.properties?.keterangan || ''}`)
                },
                pointToLayer: (feature, latlng) => {
                  const getRadius = (zoom: number) => Math.max(0.2, zoom - 9)
                  const marker = L.circleMarker(latlng, {
                    radius: getRadius(map.getZoom()),
                    fillColor: warna,
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.8
                  })
                  map.on('zoomend', () => marker.setRadius(getRadius(map.getZoom())))
                  return marker
                }
              }).addTo(map)

              subLayers.push({ tingkat, layer: subLayer, visible: true, warna })
            }

            newLayers.push({ info: layerData, layer: null, visible: true, subLayers })
          } else {
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
                  radius: getRadius(map.getZoom()),
                  fillColor: layerData.warna || '#FF0000',
                  color: '#fff',
                  weight: 1,
                  fillOpacity: 0.8
                })
                map.on('zoomend', () => marker.setRadius(getRadius(map.getZoom())))
                return marker
              }
            }).addTo(map)

            newLayers.push({ info: layerData, layer, visible: true, subLayers: [] })
          }
        } catch (e) {
          console.error('Gagal load layer:', e)
        }
      }

      setLayers(newLayers)
    }

    fetchLayers()
  }, [selectedKabupaten, mapReady])

  const toggleLayer = (index: number) => {
    if (!mapRef.current) return
    const map = mapRef.current
    const updated = [...layers]
    const l = updated[index]

    if (l.layer) {
      l.visible ? map.removeLayer(l.layer) : map.addLayer(l.layer)
      l.visible = !l.visible
    } else {
      l.subLayers.forEach(sl => {
        l.visible ? map.removeLayer(sl.layer) : map.addLayer(sl.layer)
      })
      l.visible = !l.visible
    }
    setLayers(updated)
  }

  const toggleSubLayer = (layerIndex: number, subIndex: number) => {
    if (!mapRef.current) return
    const map = mapRef.current
    const updated = [...layers]
    const sl = updated[layerIndex].subLayers[subIndex]
    sl.visible ? map.removeLayer(sl.layer) : map.addLayer(sl.layer)
    sl.visible = !sl.visible
    setLayers(updated)
  }

  const changeOpacity = (index: number, opacity: number) => {
    const updated = [...layers]
    const l = updated[index]
    if (l.layer) {
      l.layer.setStyle({ fillOpacity: opacity, opacity })
    } else {
      l.subLayers.forEach(sl => sl.layer.setStyle({ fillOpacity: opacity, opacity }))
    }
    setLayers(updated)
  }

  const menuList = [
    { key: 'layer', label: 'Layer' },
    { key: 'ukur', label: 'Ukur' },
    { key: 'crosssection', label: 'Topografi' },
    { key: 'search', label: 'Cari' },
    { key: 'overlay', label: 'Overlay' },
  ] as const

  return (
    <div className="relative w-full h-screen">
      <div className="absolute top-4 left-4 z-[1000] bg-white p-3 rounded shadow w-[240px] max-h-[90vh] overflow-y-auto">

        <select
          className="text-sm border p-1 rounded w-full mb-3"
          onChange={(e) => setSelectedKabupaten(Number(e.target.value))}
        >
          <option value="">Pilih Kabupaten/Kota</option>
          {kabupatenList.map((kab) => (
            <option key={kab.id} value={kab.id}>{kab.nama}</option>
          ))}
        </select>

        <div className="flex gap-1 mb-3 flex-wrap">
          {menuList.map((menu) => (
            <button
              key={menu.key}
              className={`text-xs px-2 py-1 rounded border ${activeMenu === menu.key ? 'bg-blue-600 text-white' : 'bg-white'}`}
              onClick={() => setActiveMenu(menu.key)}
            >
              {menu.label}
            </button>
          ))}
        </div>

        {activeMenu === 'layer' && (
          <div>
            {layers.length === 0 && (
              <p className="text-xs text-gray-400">Pilih kabupaten dulu</p>
            )}
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

                {l.subLayers.length > 0 && (
                  <div className="ml-4 mt-1 flex flex-col gap-1">
                    {l.subLayers.map((sl, si) => (
                      <div key={sl.tingkat} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sl.visible}
                          onChange={() => toggleSubLayer(i, si)}
                          id={`sublayer-${i}-${si}`}
                        />
                        <div className="w-3 h-3 rounded" style={{ background: sl.warna }}></div>
                        <label htmlFor={`sublayer-${i}-${si}`} className="text-xs cursor-pointer capitalize">
                          {sl.tingkat}
                        </label>
                      </div>
                    ))}
                  </div>
                )}

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

        {activeMenu === 'ukur' && <MeasureControl map={mapRef.current} />}
        {activeMenu === 'crosssection' && <CrossSection map={mapRef.current} />}
        {activeMenu === 'search' && <SearchControl map={mapRef.current} />}
        {activeMenu === 'overlay' && <OverlayControl layers={layers} />}

      </div>
      <div id="map" style={{ width: '100%', height: '100vh' }} />
    </div>
  )
}