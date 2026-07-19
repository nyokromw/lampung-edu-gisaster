'use client'

import { useState, useRef, useEffect } from 'react'
import L from 'leaflet'

interface Props {
  map: L.Map | null
  layers?: any[]  // LayerState[] dari Map.tsx — untuk pencarian fitur lokal
}

interface LocalResult {
  nama: string
  layerNama: string
  kategori: string
  lat: number
  lng: number
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  class: string
  address?: Record<string, string>
}

const TYPE_LABEL: Record<string, string> = {
  school: 'Sekolah', university: 'Universitas', college: 'Kampus',
  hospital: 'Rumah Sakit', clinic: 'Klinik', pharmacy: 'Apotek',
  mosque: 'Masjid', church: 'Gereja', place_of_worship: 'Tempat Ibadah',
  supermarket: 'Supermarket', marketplace: 'Pasar', mall: 'Mall',
  restaurant: 'Restoran', cafe: 'Kafe', hotel: 'Hotel',
  bank: 'Bank', atm: 'ATM', fuel: 'SPBU',
  city: 'Kota', town: 'Kota', village: 'Desa', suburb: 'Kelurahan',
  quarter: 'Kecamatan', district: 'Kecamatan', administrative: 'Wilayah',
  road: 'Jalan', residential: 'Perumahan', office: 'Kantor',
  government: 'Pemerintahan', police: 'Polisi', post_office: 'Kantor Pos',
  park: 'Taman', stadium: 'Stadion', library: 'Perpustakaan',
}

function getLabel(type: string, cls: string) {
  return TYPE_LABEL[type] || TYPE_LABEL[cls] || 'Lokasi'
}

function shortName(display_name: string) {
  return display_name.split(', ').slice(0, 2).join(', ')
}

export default function SearchControl({ map, layers = [] }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [localResults, setLocalResults] = useState<LocalResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState('')
  const markerRef = useRef<L.Marker | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowResults(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Deteksi input koordinat desimal: -5.4297, 105.2610 atau -5.4297 105.2610
  const parseCoordinate = (q: string): [number, number] | null => {
    const clean = q.trim().replace(/\s+/g, ' ')
    // Format: -5.4297, 105.2610 atau -5.4297 105.2610
    const dec = clean.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/)
    if (dec) {
      const lat = parseFloat(dec[1]), lon = parseFloat(dec[2])
      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) return [lat, lon]
    }
    // Format DMS: 5°25'46"S 105°15'40"E
    const dms = clean.match(/(\d+)°(\d+)'([\d.]+)"([NS])\s+(\d+)°(\d+)'([\d.]+)"([EW])/i)
    if (dms) {
      const lat = (parseInt(dms[1]) + parseInt(dms[2])/60 + parseFloat(dms[3])/3600) * (dms[4].toUpperCase() === 'S' ? -1 : 1)
      const lon = (parseInt(dms[5]) + parseInt(dms[6])/60 + parseFloat(dms[7])/3600) * (dms[8].toUpperCase() === 'W' ? -1 : 1)
      return [lat, lon]
    }
    return null
  }

  // ── Pencarian fitur lokal dari layer aktif (fasilitas, admin, dll) ──
  const detectNama = (props: Record<string, any>): string | null => {
    const kandidat = ['nama', 'NAMA', 'Nama', 'name', 'NAME', 'NAMOBJ', 'WADMKC', 'KECAMATAN', 'SEKOLAH', 'FASILITAS']
    for (const k of kandidat) if (props?.[k]) return String(props[k])
    const strKey = Object.keys(props || {}).find(k => typeof props[k] === 'string' && props[k].length > 2)
    return strKey ? String(props[strKey]) : null
  }

  const getFeatureLatLng = (geom: any): [number, number] | null => {
    if (!geom) return null
    if (geom.type === 'Point') return [geom.coordinates[1], geom.coordinates[0]]
    if (geom.type === 'Polygon') {
      const ring = geom.coordinates[0]
      const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length
      const lng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length
      return [lat, lng]
    }
    if (geom.type === 'MultiPolygon') {
      const ring = geom.coordinates[0][0]
      const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length
      const lng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length
      return [lat, lng]
    }
    return null
  }

  const searchLocal = (q: string): LocalResult[] => {
    if (!q.trim() || q.length < 2) return []
    const needle = q.toLowerCase()
    const out: LocalResult[] = []
    for (const l of layers) {
      const kategori = l?.info?.jenis_bencana?.kategori || 'layer'
      const layerNama = l?.info?.nama || ''
      const collect = (leafletLayer: any) => {
        try {
          const gj = leafletLayer?.toGeoJSON?.()
          if (!gj?.features) return
          for (const f of gj.features) {
            const nama = detectNama(f.properties || {})
            if (!nama || !nama.toLowerCase().includes(needle)) continue
            const ll = getFeatureLatLng(f.geometry)
            if (!ll) continue
            out.push({ nama, layerNama, kategori, lat: ll[0], lng: ll[1] })
            if (out.length >= 8) return
          }
        } catch (_) {}
      }
      if (l?.layer) collect(l.layer)
      if (out.length >= 8) break
      for (const sl of (l?.subLayers || [])) { collect(sl.layer); if (out.length >= 8) break }
      if (out.length >= 8) break
    }
    return out
  }

  const handleSelectLocal = (r: LocalResult) => {
    if (!map) return
    if (markerRef.current) map.removeLayer(markerRef.current)
    markerRef.current = L.marker([r.lat, r.lng], {
      icon: L.divIcon({
        html: `<div style="background:#059669;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>`,
        className: '', iconSize: [12, 12], iconAnchor: [6, 6]
      })
    }).addTo(map)
      .bindPopup(`<div style="font-family:system-ui;font-size:12px"><b>${r.nama}</b><br/><span style="color:#666;font-size:11px">${r.layerNama}</span></div>`)
      .openPopup()
    map.setView([r.lat, r.lng], 16)
    setQuery(r.nama)
    setShowResults(false)
  }

  const search = async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); setShowResults(false); return }
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({
        q, format: 'json', limit: '10',
        countrycodes: 'id',
        addressdetails: '1',
        extratags: '1',
        namedetails: '1',
        'accept-language': 'id',
        viewbox: '103.5,-6.5,106.5,-3.5',
        bounded: '0',
      })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
      const data: NominatimResult[] = await res.json()
      setResults(data)
      const locals = searchLocal(q)
      setLocalResults(locals)
      setShowResults(data.length > 0 || locals.length > 0)
      if (data.length === 0 && locals.length === 0) setError('Lokasi tidak ditemukan')
    } catch {
      setError('Gagal terhubung ke server pencarian')
    }
    setLoading(false)
  }

  const handleChange = (val: string) => {
    setQuery(val); setError('')
    // Cek koordinat dulu
    const coord = parseCoordinate(val)
    if (coord) {
      setResults([]); setShowResults(false)
      return
    }
    // Pencarian lokal instant (tanpa debounce)
    const locals = searchLocal(val)
    setLocalResults(locals)
    if (locals.length > 0) setShowResults(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 500)
  }

  const handleEnter = () => {
    // Coba parse koordinat dulu
    const coord = parseCoordinate(query)
    if (coord) {
      goToCoordinate(coord[0], coord[1])
      return
    }
    if (localResults.length > 0) { handleSelectLocal(localResults[0]); return }
    if (results.length > 0) handleSelect(results[0])
  }

  const goToCoordinate = (lat: number, lon: number) => {
    if (!map) return
    if (markerRef.current) map.removeLayer(markerRef.current)
    markerRef.current = L.marker([lat, lon], {
      icon: L.divIcon({
        html: `<div style="background:#dc2626;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>`,
        className: '', iconSize: [12, 12], iconAnchor: [6, 6]
      })
    }).addTo(map)
      .bindPopup(`<div style="font-family:system-ui;font-size:12px"><b>Koordinat</b><br/><span style="color:#666;font-size:11px">Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}</span></div>`)
      .openPopup()
    map.setView([lat, lon], 17)
    setShowResults(false)
  }

  const handleSelect = (r: NominatimResult) => {
    if (!map) return
    const lat = parseFloat(r.lat), lon = parseFloat(r.lon)
    if (markerRef.current) map.removeLayer(markerRef.current)
    markerRef.current = L.marker([lat, lon], {
      icon: L.divIcon({
        html: `<div style="background:#1d4ed8;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.4)"></div>`,
        className: '', iconSize: [12, 12], iconAnchor: [6, 6]
      })
    }).addTo(map)
      .bindPopup(`<div style="font-family:system-ui;font-size:12px;max-width:220px"><b>${shortName(r.display_name)}</b><br/><span style="color:#666;font-size:11px">${r.display_name}</span></div>`)
      .openPopup()
    map.setView([lat, lon], 17)
    setQuery(shortName(r.display_name))
    setShowResults(false)
  }

  const handleClear = () => {
    setQuery(''); setResults([]); setLocalResults([]); setShowResults(false); setError('')
    if (markerRef.current && map) { map.removeLayer(markerRef.current); markerRef.current = null }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-md focus-within:border-blue-400 transition-all">
        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input type="text"
          className="flex-1 text-xs text-gray-700 bg-transparent outline-none placeholder-gray-400 min-w-0"
          placeholder="Nama lokasi atau -5.43, 105.26..."
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleEnter()}
          onFocus={() => results.length > 0 && setShowResults(true)}
        />
        {loading && <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
        {query && !loading && (
          <button onClick={handleClear} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {error && !showResults && <p className="text-[10px] text-red-500 mt-1 px-1">{error}</p>}

      {/* Hint kalau input terdeteksi sebagai koordinat */}
      {parseCoordinate(query) && (
        <button onClick={() => { const c = parseCoordinate(query); if (c) goToCoordinate(c[0], c[1]) }}
          className="mt-1 w-full flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition-all">
          <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
          <div className="text-left">
            <p className="text-[11px] font-semibold text-blue-800">Koordinat terdeteksi</p>
            <p className="text-[10px] text-blue-500">
              {(() => { const c = parseCoordinate(query); return c ? `Lat: ${c[0].toFixed(6)}, Lon: ${c[1].toFixed(6)}` : '' })()}
            </p>
          </div>
          <span className="text-[10px] text-blue-500 ml-auto">Tekan Enter ↵</span>
        </button>
      )}

      {showResults && (results.length > 0 || localResults.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-[2000] max-h-72 overflow-y-auto">
          {/* Hasil dari layer aktif */}
          {localResults.length > 0 && (
            <>
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest px-3 pt-2 pb-1 bg-emerald-50/50">Di Peta ({localResults.length})</p>
              {localResults.map((r, i) => (
                <button key={`local-${i}`} onClick={() => handleSelectLocal(r)}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-all flex items-start gap-2.5 border-b border-gray-50">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-gray-800 truncate">{r.nama}</p>
                    <p className="text-[9px] text-emerald-600 mt-0.5">{r.layerNama}</p>
                  </div>
                </button>
              ))}
              {results.length > 0 && (
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest px-3 pt-2 pb-1 bg-gray-50/50">Lokasi Umum</p>
              )}
            </>
          )}
          {results.map((r, i) => (
            <button key={r.place_id} onClick={() => handleSelect(r)}
              className={`w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-all flex items-start gap-2.5 ${i < results.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-gray-800 truncate">{shortName(r.display_name)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2 whitespace-normal">{r.display_name}</p>
                <p className="text-[9px] text-blue-500 mt-0.5">{getLabel(r.type, r.class)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}