'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Props {
  aktivitasId: number
  mode: 'titik' | 'polygon' | 'keduanya'
  onDataChange?: (data: any[]) => void
}

interface GambarItem {
  id: number
  tipe: 'titik' | 'polygon'
  label: string
  warna: string
  warnaStroke: string
  opacity: number
  layer: L.Layer
  latlngs: any
}

const DEFAULT_TITIK_COLOR = '#1d4ed8'
const DEFAULT_POLYGON_COLOR = '#ef4444'

function makeMarkerIcon(warna: string, nomor: number) {
  return L.divIcon({
    html: `<div style="background:${warna};color:white;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${nomor}</div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

export default function MapDraw({ aktivitasId, mode, onDataChange }: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [items, setItems] = useState<GambarItem[]>([])
  const [drawMode, setDrawMode] = useState<'titik' | 'polygon' | null>(null)
  const [polygonPoints, setPolygonPoints] = useState<L.LatLng[]>([])
  const polylinePreviewRef = useRef<L.Polyline | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const itemsRef = useRef<GambarItem[]>([])

  // Warna baru saat edit
  const [editWarna, setEditWarna] = useState(DEFAULT_TITIK_COLOR)
  const [editWarnaStroke, setEditWarnaStroke] = useState('#ffffff')
  const [editLabel, setEditLabel] = useState('')
  const [editOpacity, setEditOpacity] = useState(0.3)

  useEffect(() => { itemsRef.current = items }, [items])

  // Notify parent
  useEffect(() => {
    onDataChange?.(items.map(i => ({ tipe: i.tipe, label: i.label, warna: i.warna, latlngs: i.latlngs })))
  }, [items])

  // Init map
  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const m = L.map(divRef.current, { zoomControl: true }).setView([-5.4, 105.2], 9)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' }).addTo(m)
    mapRef.current = m
    return () => { m.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    setTimeout(() => mapRef.current?.invalidateSize(), 300)
  }, [fullscreen])

  // ESC
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setFullscreen(false); setSelectedId(null) } }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  // Click handler
  useEffect(() => {
    const map = mapRef.current
    if (!map || !drawMode) return

    const onClick = (e: L.LeafletMouseEvent) => {
      if (drawMode === 'titik') {
        const id = Date.now()
        const nomor = itemsRef.current.filter(i => i.tipe === 'titik').length + 1
        const label = `Titik ${nomor}`
        const warna = DEFAULT_TITIK_COLOR
        const marker = L.marker(e.latlng, { icon: makeMarkerIcon(warna, nomor) }).addTo(map)
        marker.on('click', () => {
          const item = itemsRef.current.find(i => i.id === id)
          if (!item) return
          setSelectedId(id)
          setEditLabel(item.label)
          setEditWarna(item.warna)
          setEditWarnaStroke(item.warnaStroke)
          setEditOpacity(item.opacity)
        })
        const newItem: GambarItem = { id, tipe: 'titik', label, warna, warnaStroke: '#ffffff', opacity: 1, layer: marker, latlngs: [e.latlng.lat, e.latlng.lng] }
        setItems(prev => [...prev, newItem])
      }

      if (drawMode === 'polygon') {
        setPolygonPoints(prev => {
          const newPts = [...prev, e.latlng]
          if (polylinePreviewRef.current) map.removeLayer(polylinePreviewRef.current)
          if (newPts.length > 1) {
            polylinePreviewRef.current = L.polyline(newPts, { color: DEFAULT_POLYGON_COLOR, weight: 2, dashArray: '6,4' }).addTo(map)
          }
          return newPts
        })
      }
    }

    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [drawMode])

  const selesaiPolygon = () => {
    if (polygonPoints.length < 3 || !mapRef.current) return
    const map = mapRef.current
    if (polylinePreviewRef.current) { map.removeLayer(polylinePreviewRef.current); polylinePreviewRef.current = null }
    const id = Date.now()
    const nomor = itemsRef.current.filter(i => i.tipe === 'polygon').length + 1
    const label = `Area ${nomor}`
    const warna = DEFAULT_POLYGON_COLOR
    const polygon = L.polygon(polygonPoints, { color: '#991b1b', fillColor: warna, fillOpacity: 0.3, weight: 2 }).addTo(map)
    polygon.on('click', () => {
      const item = itemsRef.current.find(i => i.id === id)
      if (!item) return
      setSelectedId(id)
      setEditLabel(item.label)
      setEditWarna(item.warna)
      setEditWarnaStroke(item.warnaStroke)
      setEditOpacity(item.opacity)
    })
    const newItem: GambarItem = {
      id, tipe: 'polygon', label, warna, warnaStroke: '#991b1b', opacity: 0.3, layer: polygon,
      latlngs: polygonPoints.map(p => [p.lat, p.lng])
    }
    setItems(prev => [...prev, newItem])
    setPolygonPoints([])
    setDrawMode(null)
  }

  const hapusItem = (id: number) => {
    const item = items.find(i => i.id === id)
    if (item && mapRef.current) mapRef.current.removeLayer(item.layer)
    setItems(prev => prev.filter(i => i.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const applyEdit = () => {
    if (selectedId === null) return
    setItems(prev => prev.map(item => {
      if (item.id !== selectedId) return item
      const updated = { ...item, label: editLabel, warna: editWarna, warnaStroke: editWarnaStroke, opacity: editOpacity }
      if (item.tipe === 'titik') {
        const nomor = prev.filter((i, idx) => i.tipe === 'titik' && i.id <= item.id).length
        ;(item.layer as L.Marker).setIcon(makeMarkerIcon(editWarna, nomor))
        ;(item.layer as L.Marker).bindTooltip(editLabel)
      } else {
        ;(item.layer as L.Polygon).setStyle({ fillColor: editWarna, color: editWarnaStroke, fillOpacity: editOpacity })
      }
      return updated
    }))
    setSelectedId(null)
  }

  const batalEdit = () => setSelectedId(null)

  const selectedItem = items.find(i => i.id === selectedId)

  const mapContent = (
    <div className="relative w-full h-full">
      <div ref={divRef} className="w-full h-full" />

      {/* Toolbar kiri */}
      <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-1.5">
        {(mode === 'titik' || mode === 'keduanya') && (
          <button onClick={() => { setDrawMode(drawMode === 'titik' ? null : 'titik'); setSelectedId(null) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border transition-all
              ${drawMode === 'titik' ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            {drawMode === 'titik' ? 'Klik peta...' : 'Tambah Titik'}
          </button>
        )}
        {(mode === 'polygon' || mode === 'keduanya') && drawMode !== 'polygon' && (
          <button onClick={() => { setDrawMode('polygon'); setSelectedId(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md border bg-white text-gray-700 border-gray-200 hover:border-red-300 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
            </svg>
            Gambar Area
          </button>
        )}
        {drawMode === 'polygon' && (
          <div className="flex flex-col gap-1">
            <div className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-md">
              {polygonPoints.length} titik — klik peta
            </div>
            {polygonPoints.length >= 3 && (
              <button onClick={selesaiPolygon} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-md hover:bg-green-700">
                ✓ Selesai Area
              </button>
            )}
            <button onClick={() => { if (polylinePreviewRef.current && mapRef.current) { mapRef.current.removeLayer(polylinePreviewRef.current); polylinePreviewRef.current = null } setPolygonPoints([]); setDrawMode(null) }}
              className="bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-medium shadow-md">
              Batal
            </button>
          </div>
        )}
      </div>

      {/* Hint klik untuk edit */}
      {items.length > 0 && !drawMode && !selectedId && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-black/50 text-white text-[10px] px-3 py-1.5 rounded-full pointer-events-none">
          Klik titik/area di peta untuk edit
        </div>
      )}

      {/* Tombol fullscreen */}
      <button onClick={() => setFullscreen(f => !f)}
        className="absolute top-2 right-2 z-[1000] w-8 h-8 bg-white rounded-lg border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 transition-all">
        {fullscreen ? (
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        )}
      </button>

      {/* Panel edit — muncul saat ada yang dipilih */}
      {selectedItem && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1001] bg-white rounded-2xl shadow-xl border border-gray-200 p-4 w-72">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-700">Edit {selectedItem.tipe === 'titik' ? 'Titik' : 'Area'}</p>
            <button onClick={batalEdit} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
          </div>
          <div className="flex flex-col gap-2.5">
            <div>
              <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">Label</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-blue-400"
                value={editLabel} onChange={e => setEditLabel(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                  {selectedItem.tipe === 'titik' ? 'Warna Titik' : 'Warna Isi'}
                </label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5">
                  <input type="color" value={editWarna} onChange={e => setEditWarna(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                  <span className="text-[11px] font-mono text-gray-500">{editWarna}</span>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                  {selectedItem.tipe === 'titik' ? 'Warna Border' : 'Warna Stroke'}
                </label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2 py-1.5">
                  <input type="color" value={editWarnaStroke} onChange={e => setEditWarnaStroke(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent" />
                  <span className="text-[11px] font-mono text-gray-500">{editWarnaStroke}</span>
                </div>
              </div>
            </div>
            {selectedItem.tipe === 'polygon' && (
              <div>
                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
                  Opacity Isi ({Math.round(editOpacity * 100)}%)
                </label>
                <input type="range" min={0} max={100} step={5} value={Math.round(editOpacity * 100)}
                  onChange={e => setEditOpacity(Number(e.target.value) / 100)}
                  className="w-full accent-blue-700" />
              </div>
            )}
            <div className="flex gap-2 mt-1">
              <button onClick={applyEdit}
                className="flex-1 bg-blue-950 text-white text-xs py-2 rounded-lg font-medium hover:bg-blue-900 transition-all">
                Simpan
              </button>
              <button onClick={() => { hapusItem(selectedItem.id) }}
                className="text-xs bg-red-50 text-red-500 border border-red-100 px-3 py-2 rounded-lg hover:bg-red-100 transition-all">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {!fullscreen ? (
        <div className="rounded-xl overflow-hidden border border-gray-200" style={{ height: '350px' }}>
          {mapContent}
        </div>
      ) : (
        <div className="fixed inset-0 z-[9999] flex flex-col">
          <div className="bg-blue-950 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
            <p className="text-white text-sm font-semibold">Mode Menggambar — Peta Penuh</p>
            <button onClick={() => setFullscreen(false)}
              className="text-white/70 hover:text-white text-xs px-3 py-1.5 bg-white/10 rounded-lg transition-all">
              Tutup (ESC)
            </button>
          </div>
          <div className="flex-1">{mapContent}</div>
        </div>
      )}

      {/* Daftar gambar */}
      {items.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Gambar di Peta ({items.length})</p>
          <div className="flex flex-col gap-1.5">
            {items.map(item => (
              <div key={item.id}
                className={`flex items-center gap-2 bg-white rounded-lg px-3 py-2 border transition-all
                  ${selectedId === item.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}`}>
                <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/80" style={{ background: item.warna, boxShadow: '0 0 0 1px rgba(0,0,0,0.15)' }} />
                <span className="text-xs text-gray-700 flex-1 font-medium">{item.label}</span>
                <span className="text-[10px] text-gray-400 capitalize">{item.tipe}</span>
                <button
                  onClick={() => { setSelectedId(item.id); setEditLabel(item.label); setEditWarna(item.warna); setEditWarnaStroke(item.warnaStroke); setEditOpacity(item.opacity) }}
                  className="text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-all">
                  Edit
                </button>
                <button onClick={e => { e.stopPropagation(); hapusItem(item.id) }}
                  className="text-[10px] text-red-400 hover:text-red-600 px-1">✕</button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Klik tombol Edit atau langsung klik titik/area di peta untuk mengubah tampilan</p>
        </div>
      )}
    </div>
  )
}