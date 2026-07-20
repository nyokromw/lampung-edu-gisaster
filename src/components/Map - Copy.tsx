'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '@/lib/supabase'
import SearchControl from './SearchControl'
import MeasureControl from './MeasureControl'
import CrossSection from './CrossSection'
import OverlayControl from './OverlayControl'
import * as turf from '@turf/turf'

interface Kabupaten { id: number; nama: string }
interface LayerPeta { id: string; nama: string; file_url: string; warna: string; has_tingkat: boolean; field_tingkat: string; jenis_bencana: { nama: string; kategori: string } }
interface SubLayer { tingkat: string; layer: L.GeoJSON; visible: boolean; warna: string }
interface LayerStyle {
  fillOpacity: number; strokeColor: string; strokeWidth: number
  dashArray: string; showLabels: boolean; iconShape: 'circle' | 'square' | 'diamond' | 'triangle' | 'star'
}
interface HasilFasilitasRow { nama: string; keterangan: string; tingkat?: string; layerNama: string; wilayah?: string }
interface HasilFaktorRow { label: string; skor: string; warna: string; total_ha: number; rawan_ha: number; persen: number }
interface HasilAdminRow { namaWilayah: string; luas_wilayah_ha: number; total_bencana_ha: number; breakdown: { tingkat: string; luas_ha: number; persen: number; warna: string }[] }
interface HasilMeta {
  mode: 'fasilitas' | 'administrasi' | 'faktor'
  fasilitasRows?: HasilFasilitasRow[]
  faktorRows?: HasilFaktorRow[]
  adminRows?: HasilAdminRow[]
}
interface LayerState {
  info: LayerPeta; layer: L.GeoJSON | null; visible: boolean
  subLayers: SubLayer[]; style: LayerStyle; showStylePanel: boolean
  meta?: HasilMeta
}
interface IntersectResult {
  type: 'fasilitas' | 'administrasi' | 'faktor'
  geojson: any
}

const WARNA_TINGKAT: Record<string, string> = {
  // Label teks
  'sangat rawan': '#C0392B', 'rawan': '#E67E22', 'agak rawan': '#F4D03F',
  'aman': '#A8D86E', 'sangat aman': '#27AE60',
  'tinggi': '#C0392B', 'sedang': '#E67E22', 'rendah': '#F4D03F', 'tidak rawan': '#A8D86E',
  // Skor numerik 1-5 (untuk layer faktor)
  '1': '#27AE60', '2': '#A8D86E', '3': '#F4D03F', '4': '#E67E22', '5': '#C0392B',
  'sangat rendah': '#27AE60', 'rendah pengaruh': '#A8D86E',
}

const LABEL_SKOR: Record<string, string> = {
  '1': 'Sangat Rendah', '2': 'Rendah', '3': 'Sedang', '4': 'Tinggi', '5': 'Sangat Tinggi',
}

const DASH_OPTIONS = [
  { id: '', label: 'Solid' },
  { id: '8,6', label: 'Dashed' },
  { id: '2,4', label: 'Dotted' },
  { id: '12,4,2,4', label: 'Dash-Dot' },
]

const BASEMAPS = [
  { id: 'terrain', label: 'Terrain', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  { id: 'osm', label: 'OSM', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OSM' },
  { id: 'topo', label: 'Topografi', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '© OpenTopoMap' },
  { id: 'satelit', label: 'Satelit', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  { id: 'hillshade', label: 'Hillshade', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  { id: 'light', label: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
  { id: 'dark', label: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
  { id: 'google-labels', label: 'Google Labels', url: 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', attr: '© Google' },
]

type MenuKey = 'layer' | 'ukur' | 'crosssection' | 'search' | 'overlay' | 'swipe'

// Create shaped marker using DivIcon
function createPointMarker(latlng: L.LatLng, warna: string, shape: LayerStyle['iconShape'], size: number): L.Marker {
  const s = Math.max(8, size * 2)
  let html = ''
  const c = warna
  if (shape === 'circle') {
    html = `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${c};border:2px solid rgba(255,255,255,0.8);box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`
  } else if (shape === 'square') {
    html = `<div style="width:${s}px;height:${s}px;background:${c};border:2px solid rgba(255,255,255,0.8);box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`
  } else if (shape === 'diamond') {
    html = `<div style="width:${s}px;height:${s}px;background:${c};border:2px solid rgba(255,255,255,0.8);transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`
  } else if (shape === 'triangle') {
    html = `<div style="width:0;height:0;border-left:${s/2}px solid transparent;border-right:${s/2}px solid transparent;border-bottom:${s}px solid ${c};filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3))"></div>`
  } else if (shape === 'star') {
    const r = s / 2
    // 5-pointed star SVG
    const pts = Array.from({length: 5}, (_, i) => {
      const angle = (i * 4 * Math.PI / 5) - Math.PI / 2
      const innerAngle = angle + (2 * Math.PI / 10)
      const outer = `${r + r * Math.cos(angle)},${r + r * Math.sin(angle)}`
      const inner = `${r + r * 0.4 * Math.cos(innerAngle)},${r + r * 0.4 * Math.sin(innerAngle)}`
      return `${outer} ${inner}`
    }).join(' ')
    html = `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><polygon points="${pts}" fill="${c}" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5"/></svg>`
  }
  return L.marker(latlng, {
    icon: L.divIcon({
      html: `<div style="display:flex;align-items:center;justify-content:center">${html}</div>`,
      className: '',
      iconSize: [s + 4, s + 4],
      iconAnchor: [(s + 4) / 2, (s + 4) / 2],
    }),
    interactive: true,
  })
}

function defaultStyle(kategori: string, warna: string): LayerStyle {
  if (kategori === 'administrasi') return { fillOpacity: 0, strokeColor: '#000000', strokeWidth: 0.5, dashArray: '8,6', showLabels: false, iconShape: 'circle' as const }
  if (kategori === 'fasilitas') return { fillOpacity: 1, strokeColor: warna || '#3388ff', strokeWidth: 0, dashArray: '', showLabels: false, iconShape: 'circle' as const }
  if (kategori === 'faktor') return { fillOpacity: 1, strokeColor: '#ffffff', strokeWidth: 0.3, dashArray: '', showLabels: false, iconShape: 'circle' as const }
  return { fillOpacity: 1, strokeColor: '#ffffff', strokeWidth: 0.3, dashArray: '', showLabels: false, iconShape: 'circle' as const }
}

function detectLabelField(properties: Record<string, any>): string | null {
  const keys = Object.keys(properties || {})
  const nameKeys = ['nama', 'name', 'NAMA', 'NAME', 'nama_kec', 'NAMA_KEC', 'nama_kel', 'NAMA_KEL', 'NAMOBJ', 'WADMKC', 'WADMKD', 'KECAMATAN', 'KELURAHAN', 'kecamatan', 'kelurahan']
  for (const nk of nameKeys) { if (keys.includes(nk)) return nk }
  const strKey = keys.find(k => typeof properties[k] === 'string' && properties[k].length > 1 && properties[k].length < 50)
  return strKey || null
}

interface LegendEntry { label: string; warna: string; type: 'polygon' | 'point'; shape?: LayerStyle['iconShape'] }
interface LegendGroup {
  kategori: string; judulKategori: string
  subGroups: { judulJenis: string; entries: LegendEntry[] }[]
}

function buildLegendGroups(layers: LayerState[]): LegendGroup[] {
  const katOrder = ['hasil', 'administrasi', 'fasilitas', 'faktor', 'bencana']
  const katLabel: Record<string, string> = { hasil: 'Hasil Analisis', administrasi: 'Administrasi', fasilitas: 'Fasilitas', faktor: 'Faktor Bencana', bencana: 'Rawan Bencana' }
  const grouped: Record<string, Record<string, LegendEntry[]>> = {}

  for (const l of layers) {
    if (!l.visible) continue
    const kat = l.info.jenis_bencana?.kategori || 'bencana'
    const jenis = l.info.jenis_bencana?.nama || l.info.nama
    if (!grouped[kat]) grouped[kat] = {}

    if (l.subLayers.length > 0) {
      // has_tingkat: ambil warna dari subLayer.warna (sudah dari WARNA_TINGKAT)
      if (!grouped[kat][jenis]) grouped[kat][jenis] = []
      const seen = new Set(grouped[kat][jenis].map(e => e.label))
      for (const sl of l.subLayers) {
        if (!sl.visible || seen.has(sl.tingkat)) continue
        seen.add(sl.tingkat)
        grouped[kat][jenis].push({ label: sl.tingkat, warna: sl.warna, type: 'polygon' })
      }
    } else if (l.layer) {
      if (!grouped[kat][jenis]) grouped[kat][jenis] = []
      const type: 'polygon' | 'point' = kat === 'fasilitas' ? 'point' : 'polygon'
      // Ambil warna real dari style.strokeColor (yang dipakai sebagai fillColor untuk marker)
      // strokeColor di fasilitas = warna icon aktual (bisa diubah user)
      const warnaAktual = l.style.strokeColor || l.info.warna || '#3388ff'
      grouped[kat][jenis].push({ label: l.info.nama, warna: warnaAktual, type, shape: l.style.iconShape })
    }
  }

  return katOrder
    .filter(kat => grouped[kat] && Object.keys(grouped[kat]).length > 0)
    .map(kat => ({
      kategori: kat, judulKategori: katLabel[kat],
      subGroups: Object.entries(grouped[kat]).map(([jenis, entries]) => ({ judulJenis: jenis, entries }))
    }))
}

// ScaleBar — custom, tengah bawah, update saat zoom
function StatusBar({ map, hoverCoord, clickCoord, elevation, onCopy, copied, onClear, bottomOffset = 12 }: {
  map: L.Map | null
  hoverCoord: { lat: number; lng: number } | null
  clickCoord: { lat: number; lng: number } | null
  elevation: number | null
  onCopy: () => void
  copied: boolean
  onClear: () => void
  bottomOffset?: number
}) {
  const [scaleText, setScaleText] = useState('')
  const [scaleWidth, setScaleWidth] = useState(0)

  useEffect(() => {
    if (!map) return
    const update = () => {
      try {
        const y = map.getSize().y / 2
        const maxPx = 80
        const left = map.containerPointToLatLng([0, y])
        const right = map.containerPointToLatLng([maxPx, y])
        const meters = left.distanceTo(right)
        const exp = Math.floor(Math.log10(meters))
        const base = Math.pow(10, exp)
        const nice = [1, 2, 5, 10].map(n => n * base).find(n => n <= meters) || base
        const px = Math.round(maxPx * (nice / meters))
        setScaleWidth(px)
        setScaleText(nice >= 1000 ? `${nice / 1000} km` : `${nice} m`)
      } catch (_) {}
    }
    update()
    map.on('zoomend moveend', update)
    return () => { map.off('zoomend moveend', update) }
  }, [map])

  const coord = clickCoord || hoverCoord

  return (
    <div className="absolute left-1/2 -translate-x-1/2 z-[1000] pointer-events-none flex justify-center transition-all duration-300"
      style={{ bottom: bottomOffset }}>
      <div className="flex items-center gap-0 bg-white/95 backdrop-blur border border-gray-200 rounded-full shadow-lg text-gray-600 select-none overflow-hidden">
        {/* Koordinat */}
        <div className={`flex items-center gap-1.5 px-3.5 py-1.5 border-r border-gray-200 min-w-[168px] ${clickCoord ? 'pointer-events-auto' : ''}`}>
          {clickCoord && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" title="Koordinat terkunci" />}
          <span className="text-[10px] font-mono tabular-nums whitespace-nowrap">
            {coord ? `${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}` : '—'}
          </span>
          {clickCoord && (
            <>
              <button onClick={onCopy} className="text-[9px] font-sans text-blue-600 hover:text-blue-800 font-semibold ml-auto">
                {copied ? '✓' : 'Salin'}
              </button>
              <button onClick={onClear} className="text-[10px] text-gray-300 hover:text-gray-500 leading-none">✕</button>
            </>
          )}
        </div>
        {/* Elevasi */}
        {elevation !== null && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-r border-gray-200">
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 18 6.75-9 4.5 6 3-4 5.25 7H2.25Z" />
            </svg>
            <span className="text-[10px] font-mono tabular-nums whitespace-nowrap">{elevation} mdpl</span>
          </div>
        )}
        {/* Skala */}
        {scaleText && (
          <div className="flex items-center gap-1.5 px-3.5 py-1.5">
            <div className="flex flex-col justify-center">
              <div className="border-b-2 border-l-2 border-r-2 border-gray-500 h-[5px]" style={{ width: scaleWidth }} />
            </div>
            <span className="text-[10px] font-medium tabular-nums whitespace-nowrap">{scaleText}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function SimpleLayerRow({ l, mapRef, onToggle }: { l: LayerState; mapRef: React.MutableRefObject<L.Map | null>; onToggle: () => void }) {
  const [showKelas, setShowKelas] = useState(false)
  const zoomTo = () => {
    const map = mapRef.current
    if (!map) return
    try {
      if (l.layer) map.fitBounds((l.layer as any).getBounds(), { padding: [40, 40] })
      else if (l.subLayers[0]) map.fitBounds((l.subLayers[0].layer as any).getBounds(), { padding: [40, 40] })
    } catch (_) {}
  }
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-2.5 py-2 bg-white">
        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: l.info.warna || '#3388ff' }} />
        <span className="text-[11px] font-medium text-gray-700 flex-1 truncate">{l.info.nama}</span>
        <button onClick={zoomTo} title="Zoom ke layer"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-all text-gray-400 hover:text-blue-600">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
        </button>
        {l.subLayers.length > 0 && (
          <button onClick={() => setShowKelas(s => !s)} title="Pengaturan kelas"
            className={`w-6 h-6 flex items-center justify-center rounded transition-all ${showKelas ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        )}
        <button onClick={onToggle} title="Hapus layer"
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Kelas — tampil hanya setelah klik ⚙️ */}
      {showKelas && l.subLayers.length > 0 && (
        <div className="px-2.5 py-2 bg-gray-50 border-t border-gray-100 flex flex-col gap-1">
          {l.subLayers.map((sl, si) => (
            <div key={si} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: sl.warna }} />
              <span className="text-[10px] text-gray-600 flex-1">{sl.tingkat}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Map({ mapId = 'map', compact = false, height }: { mapId?: string; compact?: boolean; height?: string }) {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [selectedKabupaten, setSelectedKabupaten] = useState<number | null>(null)
  const [layers, setLayers] = useState<LayerState[]>([])
  const [activeMenu, setActiveMenu] = useState<MenuKey>('layer')
  // Swipe state
  const [swipeLayerA, setSwipeLayerA] = useState<string>('')
  const [swipeLayerB, setSwipeLayerB] = useState<string>('')
  const [swipePos, setSwipePos] = useState(50) // percent
  const [swipeActive, setSwipeActive] = useState(false)
  const swipeDragging = useRef(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  // Admin layer: sembunyikan wilayah tertentu + pengaturan garis
  const [hiddenWilayah, setHiddenWilayah] = useState<Record<string, string[]>>({})
  const [adminStrokeStyle, setAdminStrokeStyle] = useState<Record<string, { fill: string; noFill: boolean; stroke: string; noStroke: boolean; weight: number; dash: string }>>({})
  // Bottom sheet hasil analisis
  const [hasilSheetOpen, setHasilSheetOpen] = useState(true)
  const [hasilExpand, setHasilExpand] = useState<Record<string, boolean>>({})
  const hasilSheetRef = useRef<HTMLDivElement>(null)
  const [hasilSheetHeight, setHasilSheetHeight] = useState(0)

  const detectNamaFieldMap = (props: Record<string, any>): string | null => {
    const kandidat = ['nama', 'NAMA', 'Nama', 'name', 'NAME', 'NAMOBJ', 'WADMKC', 'KECAMATAN', 'kecamatan', 'WADMKD', 'DESA', 'KELURAHAN']
    for (const k of kandidat) if (props[k] !== undefined) return k
    const strKey = Object.keys(props).find(k => typeof props[k] === 'string')
    return strKey || null
  }

  const getWilayahNames = (l: LayerState): string[] => {
    try {
      const gj = (l.layer as any)?.toGeoJSON?.()
      if (!gj?.features?.length) return []
      const nf = detectNamaFieldMap(gj.features[0].properties || {})
      if (!nf) return []
      const names = [...new Set(gj.features.map((f: any) => String(f.properties?.[nf] || '')).filter(Boolean))] as string[]
      return names.sort()
    } catch (_) { return [] }
  }

  const toggleWilayahVisibility = (l: LayerState, nama: string) => {
    const id = l.info.id
    const current = hiddenWilayah[id] || []
    const newHidden = current.includes(nama) ? current.filter(n => n !== nama) : [...current, nama]
    setHiddenWilayah(prev => ({ ...prev, [id]: newHidden }))
    // Apply ke DOM
    const gjLayer = l.layer as any
    if (!gjLayer?.eachLayer) return
    gjLayer.eachLayer((child: any) => {
      const props = child.feature?.properties || {}
      const nf = detectNamaFieldMap(props)
      const childNama = nf ? String(props[nf]) : ''
      const hide = newHidden.includes(childNama)
      const el = child._path
      if (el) el.style.display = hide ? 'none' : ''
      if (child._icon) child._icon.style.display = hide ? 'none' : ''
    })
    // Sembunyikan label wilayah tsb juga
    const lblGroup = labelLayersRef.current.get(id)
    if (lblGroup) lblGroup.eachLayer((lbl: any) => {
      const t = lbl.getTooltip?.()?.getContent?.() || lbl.options?.title || ''
      // fallback: tidak bisa match, skip
    })
  }

  const applyAdminStyle = (l: LayerState, s: { fill: string; noFill: boolean; stroke: string; noStroke: boolean; weight: number; dash: string }) => {
    setAdminStrokeStyle(prev => ({ ...prev, [l.info.id]: s }))
    const style: any = {
      fillColor: s.fill,
      fillOpacity: s.noFill ? 0 : (l.style.fillOpacity ?? 0.3),
      color: s.stroke,
      opacity: s.noStroke ? 0 : 1,
      weight: s.weight,
      dashArray: s.dash || undefined,
    }
    if (l.layer) (l.layer as any).setStyle?.(style)
    l.subLayers.forEach(sl => (sl.layer as any).setStyle?.(style))
  }
  const [panelOpen, setPanelOpen] = useState(true)
  const [legendOpen, setLegendOpen] = useState(true)
  const [toolActive, setToolActive] = useState(false)
  const [activeBasemap, setActiveBasemap] = useState('terrain')
  const [showGoogleLabels, setShowGoogleLabels] = useState(false)
  const [googleLabelsVisible, setGoogleLabelsVisible] = useState(true)
  const [intersectLayer, setIntersectLayer] = useState<L.GeoJSON | null>(null)
  const [hoverCoord, setHoverCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [hoverElevation, setHoverElevation] = useState<number | null>(null)
  // Cache tile elevasi (AWS Terrarium) — decode mdpl dari pixel, instant
  const elevTileCache = useRef<globalThis.Map<string, ImageData | 'loading'>>(new globalThis.Map())

  const readElevationAt = useCallback((lat: number, lng: number) => {
    const z = 12
    const n = Math.pow(2, z)
    const xf = ((lng + 180) / 360) * n
    const latRad = (lat * Math.PI) / 180
    const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    const tx = Math.floor(xf), ty = Math.floor(yf)
    if (tx < 0 || ty < 0 || tx >= n || ty >= n) { setHoverElevation(null); return }
    const px = Math.min(255, Math.floor((xf - tx) * 256))
    const py = Math.min(255, Math.floor((yf - ty) * 256))
    const key = `${z}/${tx}/${ty}`
    const decode = (data: ImageData) => {
      const i = (py * 256 + px) * 4
      const elev = (data.data[i] * 256 + data.data[i + 1] + data.data[i + 2] / 256) - 32768
      setHoverElevation(Math.round(elev))
    }
    const cached = elevTileCache.current.get(key)
    if (cached && cached !== 'loading') { decode(cached); return }
    if (cached === 'loading') return
    elevTileCache.current.set(key, 'loading')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 256; canvas.height = 256
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const data = ctx.getImageData(0, 0, 256, 256)
        elevTileCache.current.set(key, data)
        decode(data)
      } catch (_) { elevTileCache.current.delete(key) }
    }
    img.onerror = () => elevTileCache.current.delete(key)
    img.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`
  }, [])
  const [clickCoord, setClickCoord] = useState<{ lat: number; lng: number } | null>(null)
  const [coordCopied, setCoordCopied] = useState(false)
  const mapRef = useRef<L.Map | null>(null)
  const basemapRef = useRef<L.TileLayer | null>(null)
  const googleLabelsRef = useRef<L.TileLayer | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const layersRef = useRef<LayerState[]>([])
  const labelLayersRef = useRef(new window.Map<string, L.LayerGroup>())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ administrasi: true, fasilitas: true, bencana: true })
  const [activeToolKey, setActiveToolKey] = useState<MenuKey | null>(null)
  const [panelTab, setPanelTab] = useState<'layer' | 'analisis'>('layer')
  const [popupInfo, setPopupInfo] = useState<{ latlng: L.LatLng; items: { layerNama: string; props: Record<string, any> }[] } | null>(null)
  const toolActiveRef = useRef(false)
  const popupRef = useRef<L.Popup | null>(null)

  useEffect(() => { layersRef.current = layers }, [layers])
  useEffect(() => { toolActiveRef.current = toolActive }, [toolActive])

  // Ukur tinggi bottom sheet hasil → status bar naik pas di atasnya (tanpa gap/tumpang tindih)
  useEffect(() => {
    if (hasilSheetRef.current) setHasilSheetHeight(hasilSheetRef.current.offsetHeight)
    else setHasilSheetHeight(0)
  }, [layers, hasilSheetOpen, hasilExpand, panelOpen])

  const setLayersInteractive = useCallback((interactive: boolean) => {
    layersRef.current.forEach(l => {
      const setPointer = (sub: any) => {
        const el = sub._path || sub._container
        if (el) el.style.pointerEvents = interactive ? 'auto' : 'none'
      }
      if (l.layer) l.layer.eachLayer(setPointer)
      l.subLayers.forEach(sl => sl.layer.eachLayer(setPointer))
    })
  }, [])


  const handleToolStateChange = useCallback((active: boolean) => {
    setToolActive(active)
    setLayersInteractive(!active)
  }, [setLayersInteractive])

  // ── SWIPE: clone layers ke panes terpisah + clip rect ──
  const swipeClonesA = useRef<L.Layer[]>([])
  const swipeClonesB = useRef<L.Layer[]>([])
  const swipePosRef = useRef(50)
  useEffect(() => { swipePosRef.current = swipePos }, [swipePos])

  const updateSwipeClip = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const paneA = map.getPane('swipeA')
    const paneB = map.getPane('swipeB')
    if (!paneA || !paneB) return
    const nw = map.containerPointToLayerPoint([0, 0])
    const se = map.containerPointToLayerPoint(map.getSize())
    const clipX = nw.x + (se.x - nw.x) * (swipePosRef.current / 100)
    paneA.style.clip = `rect(${nw.y}px, ${clipX}px, ${se.y}px, ${nw.x}px)`
    paneB.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${clipX}px)`
  }, [])

  const setLayerDomVisible = (l: LayerState, show: boolean) => {
    const apply = (layer: L.Layer) => {
      const ly = layer as any
      if (ly.setStyle) ly.setStyle({ opacity: show ? 1 : 0, fillOpacity: show ? (l.style.fillOpacity ?? 1) : 0 })
      if (ly._icon) ly._icon.style.display = show ? '' : 'none'
      if (ly.eachLayer) ly.eachLayer((c: any) => {
        if (c._icon) c._icon.style.display = show ? '' : 'none'
        if (c.setStyle) c.setStyle({ opacity: show ? 1 : 0, fillOpacity: show ? (l.style.fillOpacity ?? 1) : 0 })
      })
    }
    if (l.layer) apply(l.layer)
    l.subLayers.forEach(sl => apply(sl.layer))
  }

  const cloneLayerToPane = (l: LayerState, pane: string, store: React.MutableRefObject<L.Layer[]>) => {
    const map = mapRef.current
    if (!map) return
    const renderer = L.svg({ pane })
    const addClone = (srcLayer: L.Layer, fillColor: string) => {
      try {
        const gj = (srcLayer as any).toGeoJSON?.()
        if (!gj) return
        const clone = L.geoJSON(gj, {
          pane, renderer,
          style: { color: '#ffffff', weight: 0.3, fillColor, fillOpacity: l.style.fillOpacity ?? 1 },
          pointToLayer: (_f: any, latlng: L.LatLng) => L.circleMarker(latlng, { pane, renderer, radius: 6, fillColor, fillOpacity: 1, color: '#fff', weight: 1.5 })
        } as any).addTo(map)
        store.current.push(clone)
      } catch (_) {}
    }
    if (l.subLayers.length > 0) {
      l.subLayers.forEach(sl => addClone(sl.layer, sl.warna))
    } else if (l.layer) {
      addClone(l.layer, l.info.warna || '#3388ff')
    }
  }

  const activateSwipe = useCallback((idA: string, idB: string) => {
    const map = mapRef.current
    if (!map) return
    const lA = layers.find(l => l.info.id === idA)
    const lB = layers.find(l => l.info.id === idB)
    if (!lA || !lB) return

    // Create panes
    if (!map.getPane('swipeA')) { map.createPane('swipeA'); map.getPane('swipeA')!.style.zIndex = '440' }
    if (!map.getPane('swipeB')) { map.createPane('swipeB'); map.getPane('swipeB')!.style.zIndex = '441' }

    // Hide originals
    setLayerDomVisible(lA, false)
    setLayerDomVisible(lB, false)

    // Clone to panes
    cloneLayerToPane(lA, 'swipeA', swipeClonesA)
    cloneLayerToPane(lB, 'swipeB', swipeClonesB)

    setSwipeLayerA(idA)
    setSwipeLayerB(idB)
    setSwipePos(50)
    swipePosRef.current = 50
    setSwipeActive(true)

    setTimeout(updateSwipeClip, 50)
    map.on('move zoom moveend zoomend', updateSwipeClip)
  }, [layers, updateSwipeClip])

  const deactivateSwipe = useCallback(() => {
    const map = mapRef.current
    if (map) {
      map.off('move zoom moveend zoomend', updateSwipeClip)
      swipeClonesA.current.forEach(c => { try { map.removeLayer(c) } catch (_) {} })
      swipeClonesB.current.forEach(c => { try { map.removeLayer(c) } catch (_) {} })
      const paneA = map.getPane('swipeA'); if (paneA) paneA.style.clip = ''
      const paneB = map.getPane('swipeB'); if (paneB) paneB.style.clip = ''
    }
    swipeClonesA.current = []
    swipeClonesB.current = []
    // Restore originals
    const lA = layers.find(l => l.info.id === swipeLayerA)
    const lB = layers.find(l => l.info.id === swipeLayerB)
    if (lA && lA.visible) setLayerDomVisible(lA, true)
    if (lB && lB.visible) setLayerDomVisible(lB, true)
    setSwipeActive(false)
    setSwipeLayerA('')
    setSwipeLayerB('')
  }, [layers, swipeLayerA, swipeLayerB, updateSwipeClip])

  // Update clip saat posisi berubah
  useEffect(() => {
    if (swipeActive) updateSwipeClip()
  }, [swipePos, swipeActive, updateSwipeClip])

  const startSwipe = () => {}  // legacy noop
  const stopSwipe = deactivateSwipe

  const handleSwipeDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!swipeActive || !swipeDragging.current || !mapContainerRef.current) return
    const rect = mapContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pos = Math.max(5, Math.min(95, (x / rect.width) * 100))
    setSwipePos(pos)
  }

  const handleIntersectResult = useCallback((result: IntersectResult | null) => {
    if (!mapRef.current) return
    if (intersectLayer) { try { mapRef.current.removeLayer(intersectLayer) } catch (_) {} }
    if (!result) { setIntersectLayer(null); return }
    const newLayer = L.geoJSON(result.geojson, {
      style: () => ({ color: '#E53E3E', weight: 2, fillColor: '#FEFB00', fillOpacity: 0.65 }),
      pointToLayer: (_f, latlng) => L.circleMarker(latlng, { radius: 8, fillColor: '#FEFB00', color: '#E53E3E', weight: 2, fillOpacity: 1 }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties
        layer.bindPopup(result.type === 'administrasi'
          ? `<div style="font-family:system-ui;font-size:12px"><b>${p._namaWilayah}</b><br/><span style="color:#555">Tingkat: <b>${p._tingkat}</b></span><br/><span style="color:#555">Luas: ${p._luas_ha} ha</span></div>`
          : `<div style="font-family:system-ui;font-size:12px"><b>${p.nama || 'Fasilitas'}</b><br/><span style="color:#555">Tingkat: <b>${p._tingkat}</b></span></div>`)
      }
    }).addTo(mapRef.current)
    newLayer.bringToFront()
    setIntersectLayer(newLayer)
  }, [intersectLayer])

  // ── HASIL ANALISIS sebagai LayerState — masuk sistem layers[] biasa ──
  const addHasilLayer = useCallback((hasil: LayerState) => {
    const map = mapRef.current
    if (!map) return
    // Tambahkan semua subLayer ke peta (OverlayControl membuat L.geoJSON tanpa addTo)
    hasil.subLayers.forEach(sl => { try { map.addLayer(sl.layer) } catch (_) {} })
    if (hasil.layer) { try { map.addLayer(hasil.layer) } catch (_) {} }
    setLayers(prev => {
      const updated = sortLayersByKategori([hasil, ...prev])
      setTimeout(() => applyZOrder(updated), 50)
      return updated
    })
    setHasilSheetOpen(true)
  }, [])

  const clearHasilLayer = useCallback(() => {
    const map = mapRef.current
    setLayers(prev => {
      prev.filter(l => l.info.jenis_bencana?.kategori === 'hasil').forEach(l => {
        if (map) {
          l.subLayers.forEach(sl => { try { map.removeLayer(sl.layer) } catch (_) {} })
          if (l.layer) { try { map.removeLayer(l.layer) } catch (_) {} }
        }
        removeLabels(l.info.id)
      })
      return prev.filter(l => l.info.jenis_bencana?.kategori !== 'hasil')
    })
  }, [])

  // Manage Google Labels overlay — pane khusus di ATAS semua layer vektor
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    if (showGoogleLabels) {
      if (!m.getPane('gLabels')) {
        m.createPane('gLabels')
        const pane = m.getPane('gLabels')!
        pane.style.zIndex = '625'          // di atas overlayPane(400) & markerPane(600)
        pane.style.pointerEvents = 'none'  // tidak menghalangi klik/hover ke layer di bawahnya
      }
      if (!googleLabelsRef.current) {
        googleLabelsRef.current = L.tileLayer('https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
          attribution: '© Google',
          maxZoom: 20,
          pane: 'gLabels'
        }).addTo(m)
      }
      googleLabelsRef.current.setOpacity(googleLabelsVisible ? 1 : 0)
    } else {
      if (googleLabelsRef.current) {
        m.removeLayer(googleLabelsRef.current)
        googleLabelsRef.current = null
      }
    }
  }, [showGoogleLabels, googleLabelsVisible])

  const switchBasemap = (id: string) => {
    if (!mapRef.current) return
    const bm = BASEMAPS.find(b => b.id === id)
    if (!bm) return
    if (basemapRef.current) mapRef.current.removeLayer(basemapRef.current)
    basemapRef.current = L.tileLayer(bm.url, { attribution: bm.attr }).addTo(mapRef.current)
    basemapRef.current.bringToBack()
    setActiveBasemap(id)
  }

  useEffect(() => {
    supabase.from('kabupaten').select('*').then(({ data }) => { if (data) setKabupatenList(data) })
  }, [])

  useEffect(() => {
    if (mapRef.current) return
    const m = L.map(mapId, { zoomControl: false }).setView([-5.4, 105.2], 9)
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    
    const defaultBm = BASEMAPS.find(b => b.id === 'terrain')!
    basemapRef.current = L.tileLayer(defaultBm.url, { attribution: defaultBm.attr }).addTo(m)
    mapRef.current = m
    setMapReady(true)

    // Koordinat hover & klik
    m.on('mousemove', (e: L.LeafletMouseEvent) => {
      setHoverCoord({ lat: e.latlng.lat, lng: e.latlng.lng })
      readElevationAt(e.latlng.lat, e.latlng.lng)
    })
    m.on('mouseout', () => { setHoverCoord(null); setHoverElevation(null) })
    m.on('click', (e: L.LeafletMouseEvent) => {
      setClickCoord({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    return () => { m.remove(); mapRef.current = null }
  }, [])

  const addLabels = (layerId: string, geoLayer: L.GeoJSON, geojson: any) => {
    if (!mapRef.current) return
    const labelField = detectLabelField(geojson.features?.[0]?.properties)
    if (!labelField) return
    const group = L.layerGroup().addTo(mapRef.current)
    geoLayer.eachLayer((sub: any) => {
      const props = sub.feature?.properties
      if (!props?.[labelField]) return
      const center = sub.getBounds ? sub.getBounds().getCenter() : sub.getLatLng?.()
      if (!center) return
      L.marker(center, {
        icon: L.divIcon({
          className: 'label-icon',
          html: `<span style="font-size:10px;font-weight:600;color:#1f2937;text-shadow:0 0 3px #fff,0 0 3px #fff;white-space:nowrap;pointer-events:none">${props[labelField]}</span>`,
          iconSize: [0, 0], iconAnchor: [0, 0]
        }), interactive: false
      }).addTo(group)
    })
    labelLayersRef.current.set(layerId, group)
  }

  const removeLabels = (layerId: string) => {
    const group = labelLayersRef.current.get(layerId)
    if (group && mapRef.current) { mapRef.current.removeLayer(group); labelLayersRef.current.delete(layerId) }
  }

  const applyZOrder = (layerList: LayerState[]) => {
    for (let i = layerList.length - 1; i >= 0; i--) {
      const l = layerList[i]
      if (!l.visible) continue
      if (l.layer) l.layer.bringToFront()
      l.subLayers.forEach(sl => { if (sl.visible) sl.layer.bringToFront() })
      const group = labelLayersRef.current.get(l.info.id)
      if (group) group.eachLayer(lyr => (lyr as any).bringToFront?.())
    }
    if (intersectLayer) intersectLayer.bringToFront()
  }

  // Urutan tetap: hasil (paling atas) → administrasi → fasilitas → faktor → bencana (bawah)
  const KATEGORI_ORDER: Record<string, number> = { hasil: -1, administrasi: 0, fasilitas: 1, faktor: 2, bencana: 3 }
  const sortLayersByKategori = (list: LayerState[]) =>
    [...list].sort((a, b) => {
      const ka = a.info.jenis_bencana?.kategori || 'bencana'
      const kb = b.info.jenis_bencana?.kategori || 'bencana'
      return (KATEGORI_ORDER[ka] ?? 3) - (KATEGORI_ORDER[kb] ?? 3)
    })

  const [availableLayers, setAvailableLayers] = useState<LayerPeta[]>([])
  const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set())
  const [loadingLayerIds, setLoadingLayerIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedKabupaten) return
    const map = mapRef.current
    layers.forEach(l => {
      if (l.layer) { try { map.removeLayer(l.layer) } catch (_) {} }
      l.subLayers.forEach(sl => { try { map.removeLayer(sl.layer) } catch (_) {} })
      removeLabels(l.info.id)
    })
    if (intersectLayer) { try { map.removeLayer(intersectLayer) } catch (_) {}; setIntersectLayer(null) }
    setLayers([])
    setAvailableLayers([])
    setSelectedLayerIds(new Set())

    // Fetch metadata only — tidak download GeoJSON
    const fetchMeta = async () => {
      const { data } = await supabase.from('layer_peta')
        .select('*, jenis_bencana(nama, kategori)')
        .eq('kabupaten_id', selectedKabupaten)
        .eq('published', true)
      if (data) setAvailableLayers(data)
    }
    fetchMeta()
  }, [selectedKabupaten, mapReady])


  const toggleLayer = (index: number) => {
    if (!mapRef.current) return
    const map = mapRef.current; const updated = [...layers]; const l = updated[index]
    if (l.layer) { l.visible ? map.removeLayer(l.layer) : map.addLayer(l.layer); l.visible = !l.visible }
    else { l.subLayers.forEach(sl => { l.visible ? map.removeLayer(sl.layer) : map.addLayer(sl.layer) }); l.visible = !l.visible }
    if (!l.visible) removeLabels(l.info.id)
    applyZOrder(updated); setLayers(updated)
  }

  const toggleSubLayer = (li: number, si: number) => {
    if (!mapRef.current) return
    const map = mapRef.current; const updated = [...layers]; const sl = updated[li].subLayers[si]
    sl.visible ? map.removeLayer(sl.layer) : map.addLayer(sl.layer); sl.visible = !sl.visible
    applyZOrder(updated); setLayers(updated)
  }

  const toggleStylePanel = (index: number) => {
    const updated = [...layers]; updated[index].showStylePanel = !updated[index].showStylePanel; setLayers(updated)
  }

  const applyStyle = async (index: number, newStyle: Partial<LayerStyle>) => {
    const updated = [...layers]; const l = updated[index]
    l.style = { ...l.style, ...newStyle }
    const styleObj: L.PathOptions = { color: l.style.strokeColor, weight: l.style.strokeWidth, fillOpacity: l.style.fillOpacity, dashArray: l.style.dashArray || undefined }
    if (l.layer) l.layer.setStyle(styleObj)
    l.subLayers.forEach(sl => sl.layer.setStyle({ ...styleObj, fillColor: sl.warna }))
    if (newStyle.showLabels !== undefined) {
      removeLabels(l.info.id)
      if (l.style.showLabels && l.visible) {
        const geoLayer = l.layer || l.subLayers[0]?.layer
        if (geoLayer) {
          try { const res = await fetch(l.info.file_url); const geojson = await res.json(); addLabels(l.info.id, geoLayer, geojson) } catch (_) {}
        }
      }
    }
    // Redraw point markers if fill color or icon shape changed
    if ((newStyle.strokeColor !== undefined || newStyle.iconShape !== undefined) && l.layer && mapRef.current) {
      const map = mapRef.current
      const zoom = map.getZoom()
      const getSize = (z: number) => Math.max(4, z - 7)
      l.layer.eachLayer((sub: any) => {
        if (sub.setIcon && sub.getLatLng) {
          const newMarker = createPointMarker(sub.getLatLng(), l.style.strokeColor, l.style.iconShape, getSize(zoom))
          sub.setIcon(newMarker.options.icon as L.Icon)
        }
      })
    }
    setLayers(updated)
  }

  const reorderLayers = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || !mapRef.current) return
    const updated = [...layers]; const [moved] = updated.splice(fromIndex, 1); updated.splice(toIndex, 0, moved)
    applyZOrder(updated); setLayers(updated); setDragIndex(null); setDragOverIndex(null)
  }

  const zoomToLayer = (index: number) => {
    if (!mapRef.current) return
    const l = layers[index]; let b: L.LatLngBounds | null = null
    if (l.layer) b = l.layer.getBounds()
    else if (l.subLayers.length > 0) { b = L.latLngBounds([]); l.subLayers.forEach(sl => { try { b!.extend(sl.layer.getBounds()) } catch (_) {} }) }
    if (b && b.isValid()) mapRef.current.fitBounds(b, { padding: [30, 30], maxZoom: 14 })
  }

  const zoomToAll = () => {
    if (!mapRef.current || layers.length === 0) return
    const all = L.latLngBounds([])
    layers.forEach(l => {
      if (!l.visible) return
      if (l.layer) { try { all.extend(l.layer.getBounds()) } catch (_) {} }
      else l.subLayers.forEach(sl => { if (sl.visible) try { all.extend(sl.layer.getBounds()) } catch (_) {} })
    })
    if (all.isValid()) mapRef.current.fitBounds(all, { padding: [40, 40], maxZoom: 13 })
  }

  const handleMenuChange = (key: MenuKey) => {
    if (activeMenu === 'ukur' || activeMenu === 'crosssection') { setLayersInteractive(true); setToolActive(false) }
    setActiveMenu(key)
  }

  const menuItems: { key: MenuKey; label: string }[] = [
    { key: 'layer', label: 'Layer' },
    { key: 'ukur', label: 'Ukur' },
    { key: 'crosssection', label: 'Elevasi' },
    { key: 'overlay', label: 'Overlay' },
  ]

  // Unified click handler — collect info from ALL visible layers at clicked point
  const handleLayerClick = useCallback((latlng: L.LatLng) => {
    if (!mapRef.current) return
    setClickCoord({ lat: latlng.lat, lng: latlng.lng })
    const map = mapRef.current
    const items: { layerNama: string; props: Record<string, any> }[] = []
    const clickPoint = turf.point([latlng.lng, latlng.lat])

    // Pixel tolerance: radius of circleMarker is zoom-based (getRadius = zoom - 9)
    // Convert pixel tolerance to meters at current zoom
    const zoom = map.getZoom()
    const markerRadiusPx = Math.max(2, zoom - 9)
    const clickPx = map.latLngToContainerPoint(latlng)

    layersRef.current.forEach(l => {
      if (!l.visible) return
      const checkFeature = (feat: any) => {
        if (!feat?.geometry) return
        try {
          const geom = feat.geometry
          if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
            if (turf.booleanPointInPolygon(clickPoint, feat)) {
              items.push({ layerNama: l.info.nama, props: feat.properties || {} })
            }
          } else if (geom.type === 'Point') {
            // Use pixel distance for accurate point hit detection
            const markerPx = map.latLngToContainerPoint([geom.coordinates[1], geom.coordinates[0]])
            const dx = clickPx.x - markerPx.x
            const dy = clickPx.y - markerPx.y
            const distPx = Math.sqrt(dx * dx + dy * dy)
            if (distPx <= markerRadiusPx + 4) { // +4px tolerance
              items.push({ layerNama: l.info.nama, props: feat.properties || {} })
            }
          }
        } catch (_) {}
      }

      if (l.subLayers.length > 0) {
        l.subLayers.forEach(sl => {
          if (!sl.visible) return
          sl.layer.eachLayer((sub: any) => checkFeature(sub.feature))
        })
      } else if (l.layer) {
        l.layer.eachLayer((sub: any) => checkFeature(sub.feature))
      }
    })

    if (items.length === 0) return

    // Build popup HTML
    const html = items.map(item => {
      const skipKeys = ['_tingkat', '_warna', '_luas_ha', '_namaWilayah']
      const rows = Object.entries(item.props)
        .filter(([k]) => !skipKeys.includes(k) && !k.startsWith('_'))
        .slice(0, 6)
        .map(([k, v]) => `<tr><td style="color:#888;padding:1px 6px 1px 0;font-size:11px">${k}</td><td style="font-size:11px;font-weight:500">${v ?? '-'}</td></tr>`)
        .join('')
      return `<div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:#1e3a8a;margin-bottom:3px;padding-bottom:3px;border-bottom:1px solid #e5e7eb">${item.layerNama}</div>
        <table>${rows || '<tr><td style="color:#aaa;font-size:11px">Tidak ada atribut</td></tr>'}</table>
      </div>`
    }).join('')

    if (popupRef.current) { try { mapRef.current.removeLayer(popupRef.current) } catch (_) {} }
    popupRef.current = L.popup({ maxWidth: 280, className: 'unified-popup' })
      .setLatLng(latlng)
      .setContent(`<div style="font-family:system-ui;max-height:300px;overflow-y:auto">${html}</div>`)
      .openOn(mapRef.current)
  }, [])

  // Load satu layer saat user centang
  const loadSingleLayer = useCallback(async (layerData: LayerPeta) => {
    if (!mapRef.current) return
    const map = mapRef.current
    setLoadingLayerIds(prev => new Set(prev).add(layerData.id))
    try {
      const res = await fetch(layerData.file_url)
      const geojson = await res.json()
      if (!mapRef.current) return
      const kat = layerData.jenis_bencana?.kategori || 'bencana'
      const style = defaultStyle(kat, layerData.warna)
      let ls: LayerState

      if (layerData.has_tingkat) {
        // Untuk faktor: auto-detect field Skor atau Keterangan
        const props0 = geojson.features[0]?.properties || {}
        const skorField = ['skor', 'Skor', 'SKOR', 'score', 'Score'].find(k => props0[k] !== undefined)
        const keteranganField = ['Keterangan', 'keterangan', 'KETERANGAN', 'label', 'Label'].find(k => props0[k] !== undefined)
        // Selalu gunakan skorField untuk grouping jika ada, bukan field_tingkat default
        const field = skorField || (layerData.field_tingkat && layerData.field_tingkat !== 'tingkat' ? layerData.field_tingkat : null) || Object.keys(props0)[0] || 'skor'
        // Konversi ke string untuk konsistensi, sort numerik
        const nilaiTingkat = [...new Set(geojson.features.map((f: any) => String(f.properties?.[field])).filter((v: string) => v && v !== 'undefined'))] as string[]
        // Sort skor numerik
        nilaiTingkat.sort((a, b) => {
          const na = parseFloat(a), nb = parseFloat(b)
          return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb
        })
        const subLayers: SubLayer[] = []
        for (const tingkat of nilaiTingkat) {
          const warna = WARNA_TINGKAT[String(tingkat)] || WARNA_TINGKAT[tingkat.toLowerCase()] || layerData.warna || '#8b5cf6'
          const filtered = { type: 'FeatureCollection', features: geojson.features.filter((f: any) => String(f.properties?.[field]) === String(tingkat)) }
          // Ambil Keterangan dari fitur pertama di kelas ini untuk label legenda
          const contohFitur = filtered.features[0]
          const keteranganLabel = keteranganField && contohFitur?.properties?.[keteranganField]
            ? String(contohFitur.properties[keteranganField])
            : LABEL_SKOR[String(tingkat)] || tingkat
          const subLayer = L.geoJSON(filtered as any, {
            style: { color: '#ffffff', weight: 0.3, fillColor: warna, fillOpacity: style.fillOpacity, dashArray: style.dashArray || undefined },
            onEachFeature: (_feature, layer) => { layer.on('click', (e) => { if (!toolActiveRef.current) handleLayerClick(e.latlng) }) },
          }).addTo(map)
          subLayers.push({ tingkat: keteranganLabel, layer: subLayer, visible: true, warna })
        }
        ls = { info: layerData, layer: null, visible: true, subLayers, style, showStylePanel: false }
      } else {
        const layer = L.geoJSON(geojson, {
          style: { color: style.strokeColor, weight: style.strokeWidth, fillColor: layerData.warna || '#3388ff', fillOpacity: style.fillOpacity, dashArray: style.dashArray || undefined },
          onEachFeature: (_feature, layer) => { layer.on('click', (e) => { if (!toolActiveRef.current) handleLayerClick(e.latlng) }) },
          pointToLayer: (_feature, latlng) => {
            const getSize = (zoom: number) => Math.max(4, zoom - 7)
            const marker = createPointMarker(latlng, layerData.warna || '#3388ff', style.iconShape, getSize(map.getZoom()))
            map.on('zoomend', () => { const newM = createPointMarker(latlng, layerData.warna || '#3388ff', style.iconShape, getSize(map.getZoom())); marker.setIcon(newM.options.icon as L.Icon) })
            return marker
          }
        }).addTo(map)
        ls = { info: layerData, layer, visible: true, subLayers: [], style, showStylePanel: false }
        if (style.showLabels) addLabels(layerData.id, layer, geojson)
        // Zoom ke layer pertama yang diload
        try {
          const b = layer.getBounds()
          if (b.isValid() && layers.length === 0) map.fitBounds(b, { padding: [40, 40], maxZoom: 13 })
        } catch (_) {}
      }

      setLayers(prev => {
        const updated = sortLayersByKategori([...prev, ls])
        setTimeout(() => applyZOrder(updated), 50)
        return updated
      })
    } catch (e) { console.error('Gagal load layer:', e) }
    setLoadingLayerIds(prev => { const s = new Set(prev); s.delete(layerData.id); return s })
  }, [layers, handleLayerClick])

  const toggleAvailableLayer = useCallback((layerData: LayerPeta) => {
    const isSelected = selectedLayerIds.has(layerData.id)
    if (isSelected) {
      // Unload — hapus dari peta
      setLayers(prev => {
        const l = prev.find(x => x.info.id === layerData.id)
        if (l && mapRef.current) {
          if (l.layer) { try { mapRef.current.removeLayer(l.layer) } catch (_) {} }
          l.subLayers.forEach(sl => { try { mapRef.current!.removeLayer(sl.layer) } catch (_) {} })
          removeLabels(layerData.id)
        }
        return prev.filter(x => x.info.id !== layerData.id)
      })
      setSelectedLayerIds(prev => { const s = new Set(prev); s.delete(layerData.id); return s })
    } else {
      // Load GeoJSON
      setSelectedLayerIds(prev => new Set(prev).add(layerData.id))
      loadSingleLayer(layerData)
    }
  }, [selectedLayerIds, loadSingleLayer])

  const legendGroups = buildLegendGroups(layers)
  const hasilLayers = layers.filter(l => l.info.jenis_bencana?.kategori === 'hasil')
  const groupedLayers = {
    hasil: hasilLayers,
    administrasi: layers.filter(l => l.info.jenis_bencana?.kategori === 'administrasi'),
    fasilitas: layers.filter(l => l.info.jenis_bencana?.kategori === 'fasilitas'),
    faktor: layers.filter(l => l.info.jenis_bencana?.kategori === 'faktor'),
    bencana: layers.filter(l => !['hasil', 'administrasi', 'fasilitas', 'faktor'].includes(l.info.jenis_bencana?.kategori || '')),
  }
  const groupLabels: Record<string, string> = { hasil: 'Hasil Analisis', administrasi: 'Administrasi', fasilitas: 'Fasilitas', faktor: 'Faktor Bencana', bencana: 'Rawan Bencana' }

  const renderLayerCard = (l: LayerState) => {
    const globalIndex = layers.indexOf(l)
    return (
      <div key={l.info.id} draggable
        onDragStart={() => setDragIndex(globalIndex)}
        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(globalIndex) }}
        onDragEnd={() => { if (dragIndex !== null && dragOverIndex !== null) reorderLayers(dragIndex, dragOverIndex); setDragIndex(null); setDragOverIndex(null) }}
        className={`rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none
          ${dragOverIndex === globalIndex && dragIndex !== globalIndex ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}
          ${dragIndex === globalIndex ? 'opacity-40' : ''}`}>
        <div className="flex items-center gap-2 px-2.5 py-2">
          <span className="text-gray-300 text-[10px] leading-none flex-shrink-0">⠿</span>
          <button onClick={() => toggleLayer(globalIndex)}
            className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all
              ${l.visible ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'}`}>
            {l.visible && <span className="text-white text-[8px]">✓</span>}
          </button>
          <p className="text-[11px] font-medium text-gray-700 flex-1 truncate">{l.info.nama}</p>
          <button onClick={() => toggleStylePanel(globalIndex)}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-all
              ${l.showStylePanel ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'}`}>
            ⚙
          </button>
          <button onClick={() => zoomToLayer(globalIndex)}
            className="text-[10px] px-1.5 py-0.5 rounded border bg-white border-gray-200 text-gray-400 hover:border-gray-400 transition-all">
            ⊕
          </button>
        </div>

        {l.showStylePanel && l.visible && (() => {
          const isFasilitas = l.info.jenis_bencana?.kategori === 'fasilitas'
          const isPoint = l.subLayers.length === 0 && isFasilitas
          return (
          <div className="mx-2.5 mb-2.5 pt-2 border-t border-gray-100 flex flex-col gap-2">
            {isPoint ? (
              // Point/Fasilitas: warna icon + bentuk icon
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-14">Warna Icon</span>
                  <input type="color" value={l.style.strokeColor} className="w-6 h-6 rounded cursor-pointer border border-gray-200"
                    onChange={(e) => applyStyle(globalIndex, { strokeColor: e.target.value })} />
                  <span className="text-[10px] text-gray-400 ml-1">Isi</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-14">Ukuran</span>
                  <input type="range" min="0" max="100" step="5" value={Math.round(l.style.fillOpacity * 100)}
                    className="flex-1 h-1 accent-blue-600"
                    onChange={(e) => applyStyle(globalIndex, { fillOpacity: Number(e.target.value) / 100 })} />
                  <span className="text-[10px] text-gray-500 w-8 text-right">{Math.round(l.style.fillOpacity * 100)}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 w-14">Bentuk</span>
                  <div className="flex gap-1 flex-1">
                    {([
                      { shape: 'circle' as const, preview: <div className="w-3 h-3 rounded-full bg-current" /> },
                      { shape: 'square' as const, preview: <div className="w-3 h-3 bg-current" /> },
                      { shape: 'diamond' as const, preview: <div className="w-2.5 h-2.5 rotate-45 bg-current" /> },
                      { shape: 'triangle' as const, preview: <svg viewBox="0 0 10 10" className="w-3 h-3"><polygon points="5,1 9,9 1,9" fill="currentColor" /></svg> },
                      { shape: 'star' as const, preview: <svg viewBox="0 0 24 24" className="w-3 h-3"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
                    ]).map(({shape, preview}) => (
                      <button key={shape} onClick={() => applyStyle(globalIndex, { iconShape: shape })}
                        className={`w-7 h-7 rounded border flex items-center justify-center transition-all
                          ${l.style.iconShape === shape ? 'bg-blue-900 border-blue-900 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'}`}>
                        {preview}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-14">Label</span>
                  <button onClick={() => applyStyle(globalIndex, { showLabels: !l.style.showLabels })}
                    className={`text-[10px] px-2 py-0.5 rounded border font-medium transition-all
                      ${l.style.showLabels ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                    {l.style.showLabels ? 'ON' : 'OFF'}
                  </button>
                </div>
              </>
            ) : (
              // Polygon/Administrasi/Bencana
              <>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-12">Opacity</span>
                  <input type="range" min="0" max="100" step="5" value={Math.round(l.style.fillOpacity * 100)}
                    className="flex-1 h-1 accent-blue-600"
                    onChange={(e) => applyStyle(globalIndex, { fillOpacity: Number(e.target.value) / 100 })} />
                  <span className="text-[10px] text-gray-500 w-8 text-right">{Math.round(l.style.fillOpacity * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-12">Garis</span>
                  <input type="color" value={l.style.strokeColor} className="w-5 h-5 rounded cursor-pointer border-0"
                    onChange={(e) => applyStyle(globalIndex, { strokeColor: e.target.value })} />
                  <input type="range" min="0" max="5" step="0.5" value={l.style.strokeWidth}
                    className="flex-1 h-1 accent-gray-500"
                    onChange={(e) => applyStyle(globalIndex, { strokeWidth: Number(e.target.value) })} />
                  <span className="text-[10px] text-gray-500 w-5 text-right">{l.style.strokeWidth}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-400 w-12">Style</span>
                  <div className="flex gap-1 flex-1">
                    {DASH_OPTIONS.map(d => (
                      <button key={d.id} onClick={() => applyStyle(globalIndex, { dashArray: d.id })}
                        className={`text-[9px] px-1.5 py-0.5 rounded border font-medium transition-all
                          ${l.style.dashArray === d.id ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 w-12">Label</span>
                  <button onClick={() => applyStyle(globalIndex, { showLabels: !l.style.showLabels })}
                    className={`text-[10px] px-2 py-0.5 rounded border font-medium transition-all
                      ${l.style.showLabels ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                    {l.style.showLabels ? 'ON' : 'OFF'}
                  </button>
                </div>
              </>
            )}
          </div>
          )
        })()}

        {l.subLayers.length > 0 && l.visible && !l.showStylePanel && (
          <div className="mx-2.5 mb-2.5 pt-1.5 border-t border-gray-100 flex flex-col gap-1">
            {l.subLayers.map((sl, si) => (
              <div key={sl.tingkat} className="flex items-center gap-2 pl-2">
                <button onClick={() => toggleSubLayer(globalIndex, si)}
                  className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-all
                    ${sl.visible ? 'border-gray-400 bg-gray-400' : 'border-gray-300 bg-white'}`}>
                  {sl.visible && <span className="text-white text-[7px]">✓</span>}
                </button>
                <div className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10" style={{ background: sl.warna }} />
                <span className="text-[10px] text-gray-600 capitalize flex-1 truncate">{sl.tingkat}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }


  const ANALISIS_TOOLS: { key: MenuKey; label: string; desc: string; icon: React.ReactNode }[] = [
    { key: 'ukur', label: 'Ukur Jarak & Luas', desc: 'Hitung jarak dan luas di peta',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg> },
    { key: 'crosssection', label: 'Profil Topografi', desc: 'Tampilkan penampang elevasi',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" /></svg> },
    { key: 'overlay', label: 'Analisis Overlay', desc: 'Tumpang tindih layer bencana',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" /></svg> },

  ]

  return (
    <div className="relative w-full overflow-hidden" style={{ height: height || 'calc(100vh - 64px)' }}
      ref={mapContainerRef}
      onMouseMove={handleSwipeDrag}
      onMouseUp={() => { swipeDragging.current = false }}
      onMouseLeave={() => { swipeDragging.current = false }}>

      {/* Toggle panel */}
      <button onClick={() => setPanelOpen(!panelOpen)}
        className="absolute top-3 z-[1001] w-7 h-7 bg-white rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 shadow-md transition-all"
        style={{ left: panelOpen ? '308px' : '12px' }}>
        <span className="text-[10px] text-gray-400">{panelOpen ? '‹' : '›'}</span>
      </button>

      {/* Tool active indicator */}
      {toolActive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] bg-amber-500 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          {activeMenu === 'ukur' ? 'Mode Ukur — klik di peta' : 'Mode Elevasi — klik di peta'}
        </div>
      )}

      {/* ── LEFT PANEL ── */}
      <div className="absolute top-0 left-0 z-[1000] h-full transition-transform duration-300 ease-in-out"
        style={{ transform: panelOpen ? 'translateX(0)' : 'translateX(-100%)' }}>
        <div className="w-[300px] h-full flex flex-col bg-white border-r border-gray-200 shadow-sm">

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5 flex-shrink-0">
            {/* Icon Layers — berbeda dari logo navbar */}
            <div className="w-8 h-8 rounded-lg bg-blue-950 flex items-center justify-center flex-shrink-0">
              <svg className="w-4.5 h-4.5 text-white" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" />
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-bold text-gray-800 leading-tight">Layer & Analisis Spasial</p>
              <p className="text-[10px] text-gray-400">Lampung Edu Gisaster</p>
            </div>
          </div>

          {/* Wilayah */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Wilayah</p>
            <select className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/20 appearance-none cursor-pointer"
              onChange={(e) => setSelectedKabupaten(Number(e.target.value))} value={selectedKabupaten || ''}>
              <option value="">Pilih Kabupaten / Kota</option>
              {kabupatenList.map(kab => <option key={kab.id} value={kab.id}>{kab.nama}</option>)}
            </select>
          </div>

          {/* Basemap thumbnails */}
          <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Basemap</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'terrain', label: 'Terrain', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/5/16/26' },
                { id: 'osm', label: 'OSM', thumb: 'https://tile.openstreetmap.org/5/26/16.png' },
                { id: 'topo', label: 'Topo', thumb: 'https://tile.opentopomap.org/5/26/16.png' },
                { id: 'satelit', label: 'Satelit', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/16/26' },
                { id: 'hillshade', label: 'Hillshade', thumb: 'https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/5/16/26' },
                { id: 'light', label: 'Light', thumb: 'https://a.basemaps.cartocdn.com/light_all/5/26/16.png' },
                { id: 'dark', label: 'Dark', thumb: 'https://a.basemaps.cartocdn.com/dark_all/5/26/16.png' },
              ].map(bm => (
                <button key={bm.id} onClick={() => switchBasemap(bm.id)}
                  className={`relative rounded-lg overflow-hidden transition-all ${activeBasemap === bm.id ? 'ring-2 ring-blue-500 ring-offset-1' : 'opacity-70 hover:opacity-100'}`}>
                  <img src={bm.thumb} alt={bm.label} className="w-full h-10 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <div className={`absolute inset-0 flex items-end justify-center pb-0.5 ${activeBasemap === bm.id ? 'bg-blue-600/30' : 'bg-black/25'}`}>
                    <span className="text-white text-[8px] font-bold drop-shadow">{bm.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex border-b border-gray-100 flex-shrink-0">
            <button onClick={() => setPanelTab('layer')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-all border-b-2
                ${panelTab === 'layer' ? 'border-blue-950 text-blue-950' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              Layer
            </button>
            <button onClick={() => setPanelTab('analisis')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-all border-b-2
                ${panelTab === 'analisis' ? 'border-blue-950 text-blue-950' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              Analisis Spasial
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* ── LAYER TAB ── */}
            {panelTab === 'layer' && (
              <div className="px-4 py-3 flex flex-col gap-3">

                {/* Tambah Layer */}
                {availableLayers.length > 0 && (
                  <div>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tambah Layer</p>
                    {/* Layer Label (Google) — pseudo-layer tetap */}
                    <div className="mb-2">
                      <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">Label</p>
                      <button onClick={() => { setShowGoogleLabels(!showGoogleLabels); setGoogleLabelsVisible(true) }}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-0.5 text-left transition-all
                          ${showGoogleLabels ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                          ${showGoogleLabels ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                          {showGoogleLabels && <span className="text-white text-[8px]">✓</span>}
                        </div>
                        <div className="w-3 h-3 rounded-sm flex-shrink-0 bg-gray-700 flex items-center justify-center">
                          <span className="text-white text-[6px] font-bold">A</span>
                        </div>
                        <span className="text-[11px] text-gray-700 flex-1 truncate">Label Jalan & POI</span>
                      </button>
                    </div>
                    {(['administrasi', 'fasilitas', 'faktor', 'bencana'] as const).map(kat => {
                      const group = availableLayers.filter((l: any) => {
                        const k = l.jenis_bencana?.kategori || 'bencana'
                        return kat === 'bencana' ? !['administrasi','fasilitas','faktor'].includes(k) : k === kat
                      })
                      if (!group.length) return null
                      return (
                        <div key={kat} className="mb-2">
                          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-1">{groupLabels[kat]}</p>
                          {group.map((l: any) => {
                            const isOn = selectedLayerIds.has(l.id)
                            const isLoading = loadingLayerIds.has(l.id)
                            return (
                              <button key={l.id} onClick={() => toggleAvailableLayer(l as LayerPeta)}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-0.5 text-left transition-all
                                  ${isOn ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                                  ${isOn ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                                  {isOn && !isLoading && <span className="text-white text-[8px]">✓</span>}
                                  {isLoading && <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />}
                                </div>
                                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: l.warna || '#3388ff' }} />
                                <span className="text-[11px] text-gray-700 flex-1 truncate">{l.nama}</span>
                              </button>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}

                {!selectedKabupaten && availableLayers.length === 0 && layers.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-[11px] text-gray-400">Pilih kabupaten untuk melihat layer</p>
                  </div>
                )}


              </div>
            )}

            {/* ── ANALISIS SPASIAL TAB ── */}
            {panelTab === 'analisis' && (
              <div className="divide-y divide-gray-100">
                {ANALISIS_TOOLS.map(item => (
                  <div key={item.key}>
                    <button
                      onClick={() => {
                        if (activeToolKey === item.key) { setActiveToolKey(null); handleMenuChange('layer') }
                        else { setActiveToolKey(item.key); handleMenuChange(item.key) }
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                        ${activeToolKey === item.key ? 'bg-blue-950 text-white' : 'hover:bg-gray-50'}`}>
                      <span className={activeToolKey === item.key ? 'text-white' : 'text-blue-800'}>{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[12px] font-semibold leading-tight ${activeToolKey === item.key ? 'text-white' : 'text-gray-800'}`}>{item.label}</p>
                        <p className={`text-[10px] mt-0.5 ${activeToolKey === item.key ? 'text-blue-200' : 'text-gray-400'}`}>{item.desc}</p>
                      </div>
                      <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${activeToolKey === item.key ? 'rotate-180 text-blue-300' : 'text-gray-300'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {activeToolKey === item.key && (
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
                        {item.key === 'ukur' && <MeasureControl map={mapRef.current} onToolStateChange={handleToolStateChange} />}
                        {item.key === 'crosssection' && <CrossSection map={mapRef.current} onToolStateChange={handleToolStateChange} />}
                        {item.key === 'overlay' && (
                          <OverlayControl
                            layers={layers}
                            onIntersectResult={handleIntersectResult}
                            onHasilLayer={addHasilLayer}
                            onClearHasilLayer={clearHasilLayer}
                            onRequestActivateLayer={() => setPanelTab('layer')}
                          />
                        )}
                        {item.key === 'swipe' && (
                          <div className="flex flex-col gap-3">
                            <p className="text-[10px] text-gray-500">Pilih dua layer untuk dibandingkan secara visual dengan geser pembatas.</p>
                            <div>
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Layer Kiri (A)</label>
                              <select className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
                                value={swipeLayerA} onChange={e => { setSwipeLayerA(e.target.value); stopSwipe() }}>
                                <option value="">Pilih layer...</option>
                                {layers.map(l => <option key={l.info.id} value={l.info.id}>{l.info.nama}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Layer Kanan (B)</label>
                              <select className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
                                value={swipeLayerB} onChange={e => { setSwipeLayerB(e.target.value); stopSwipe() }}>
                                <option value="">Pilih layer...</option>
                                {layers.map(l => <option key={l.info.id} value={l.info.id}>{l.info.nama}</option>)}
                              </select>
                            </div>
                            {swipeLayerA && swipeLayerB && swipeLayerA !== swipeLayerB && (
                              !swipeActive ? (
                                <button onClick={startSwipe}
                                  className="w-full bg-blue-950 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-900 transition-all flex items-center justify-center gap-2">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                  </svg>
                                  Aktifkan Swipe
                                </button>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-center">
                                    <p className="text-[11px] font-semibold text-blue-700">Swipe Aktif</p>
                                    <p className="text-[10px] text-blue-500 mt-0.5">Geser garis di peta untuk membandingkan</p>
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1 block">Posisi: {Math.round(swipePos)}%</label>
                                    <input type="range" min={5} max={95} value={swipePos}
                                      onChange={e => setSwipePos(Number(e.target.value))}
                                      className="w-full accent-blue-700" />
                                  </div>
                                  <button onClick={stopSwipe}
                                    className="w-full bg-gray-100 text-gray-700 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">
                                    Matikan Swipe
                                  </button>
                                </div>
                              )
                            )}
                            {swipeLayerA && swipeLayerB && swipeLayerA === swipeLayerB && (
                              <p className="text-[10px] text-red-500">Layer A dan B harus berbeda.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 flex-shrink-0">
            <p className="text-[9px] text-gray-300 text-center">FKIP Universitas Lampung · WGS84</p>
          </div>
        </div>
      </div>

      {/* Swipe divider */}
      {swipeActive && (
        <div className="absolute inset-0 z-[1500] pointer-events-none">
          {/* Garis vertikal */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
            style={{ left: `${swipePos}%` }} />
          {/* Handle drag */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full shadow-xl border-2 border-blue-500 flex items-center justify-center cursor-ew-resize pointer-events-auto z-[1600]"
            style={{ left: `${swipePos}%` }}
            onMouseDown={() => { swipeDragging.current = true }}>
            <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          </div>
          {/* Label kiri */}
          <div className="absolute top-4 bg-blue-950/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ left: `calc(${swipePos}% - 16px)`, transform: 'translateX(-100%)' }}>
            {layers.find(l => l.info.id === swipeLayerA)?.info.nama || 'Layer A'}
          </div>
          {/* Label kanan */}
          <div className="absolute top-4 bg-red-700/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ left: `calc(${swipePos}% + 16px)` }}>
            {layers.find(l => l.info.id === swipeLayerB)?.info.nama || 'Layer B'}
          </div>
        </div>
      )}

      {/* Status bar profesional: koordinat + skala — naik saat bottom sheet hasil tampil */}
      <StatusBar map={mapRef.current}
        hoverCoord={hoverCoord} clickCoord={clickCoord}
        elevation={hoverElevation}
        copied={coordCopied}
        bottomOffset={hasilLayers.length > 0 ? (hasilSheetOpen ? hasilSheetHeight + 16 : 52) : 12}
        onCopy={() => {
          if (!clickCoord) return
          navigator.clipboard.writeText(`${clickCoord.lat.toFixed(6)}, ${clickCoord.lng.toFixed(6)}`)
          setCoordCopied(true); setTimeout(() => setCoordCopied(false), 2000)
        }}
        onClear={() => setClickCoord(null)} />

      {/* ── BOTTOM SHEET HASIL ANALISIS ── */}
      {hasilLayers.length > 0 && (
        <div className="absolute bottom-0 right-0 z-[999] transition-all duration-300 ease-in-out"
          style={{ left: panelOpen ? '300px' : '0px' }}>
          <div ref={hasilSheetRef} className="mx-3 bg-white border border-gray-200 border-b-0 rounded-t-xl shadow-lg overflow-hidden">
            {hasilLayers.map(hl => {
              const mode = hl.meta?.mode
              const jumlahKelas = hl.subLayers.length
              return (
                <div key={hl.info.id}>
                  {/* Header */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-amber-50/50">
                    <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <p className="text-[11px] font-bold text-gray-800 flex-1 truncate">{hl.info.nama}</p>
                    <span className="text-[9px] text-gray-400 flex-shrink-0">{jumlahKelas} kelas</span>
                    <button onClick={() => setHasilSheetOpen(o => !o)} title={hasilSheetOpen ? 'Tutup ringkasan' : 'Buka ringkasan'}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all flex-shrink-0">
                      <svg className={`w-3.5 h-3.5 transition-transform ${hasilSheetOpen ? '' : 'rotate-180'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    <button onClick={clearHasilLayer} title="Hapus hasil analisis"
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all flex-shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {hasilSheetOpen && (
                    <div className="px-4 py-3 max-h-[230px] overflow-y-auto">

                      {/* ═══ MODE FASILITAS: daftar nama sekolah per layer, bisa di-expand ═══ */}
                      {mode === 'fasilitas' && (() => {
                        const rows = hl.meta?.fasilitasRows || []
                        if (rows.length === 0) return <p className="text-[11px] text-gray-400 italic">Tidak ada fasilitas terdampak.</p>
                        const perLayer = [...new Set(rows.map(r => r.layerNama))].map(nama => ({
                          layerNama: nama, items: rows.filter(r => r.layerNama === nama)
                        }))
                        return (
                          <div className="flex flex-col gap-2">
                            {perLayer.map(grp => {
                              const key = `${hl.info.id}_${grp.layerNama}`
                              const isOpen = hasilExpand[key] !== false // default terbuka
                              return (
                                <div key={grp.layerNama} className="border border-gray-100 rounded-lg overflow-hidden">
                                  <button onClick={() => setHasilExpand(p => ({ ...p, [key]: !isOpen }))}
                                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50/70 hover:bg-gray-100 transition-all text-left">
                                    <svg className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                    </svg>
                                    <span className="text-[11px] font-bold text-gray-700 flex-1">{grp.layerNama}</span>
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{grp.items.length} terdampak</span>
                                  </button>
                                  {isOpen && (
                                    <div className="divide-y divide-gray-50">
                                      {grp.items.map((it, i) => (
                                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
                                          <span className="text-[9px] text-gray-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                                          <span className="text-[11px] text-gray-700 flex-1 min-w-0 truncate">{it.nama}</span>
                                          {it.tingkat && (
                                            <span className="text-[8px] px-1.5 py-0.5 rounded font-semibold capitalize flex-shrink-0"
                                              style={{ background: (WARNA_TINGKAT[it.tingkat.toLowerCase()] || '#94a3b8') + '25', color: WARNA_TINGKAT[it.tingkat.toLowerCase()] || '#64748b' }}>
                                              {it.tingkat}
                                            </span>
                                          )}
                                          {it.wilayah && <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 flex-shrink-0">{it.wilayah}</span>}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}

                      {/* ═══ MODE FAKTOR: bar chart % + tabel 3 kolom + catatan netral ═══ */}
                      {mode === 'faktor' && (() => {
                        const rows = hl.meta?.faktorRows || []
                        if (rows.length === 0) return <p className="text-[11px] text-gray-400 italic">Tidak ada data faktor.</p>
                        const top = [...rows].sort((a, b) => b.persen - a.persen)[0]
                        return (
                          <div className="flex flex-col gap-3">
                            {/* Bar chart */}
                            <div>
                              <p className="text-[10px] font-semibold text-gray-500 mb-2">Proporsi area tiap kelas yang berada di zona bahaya (Rawan + Sangat Rawan)</p>
                              <div className="flex flex-col gap-1.5">
                                {rows.map(r => (
                                  <div key={r.skor} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10" style={{ background: r.warna }} />
                                    <span className="text-[10px] text-gray-600 w-32 flex-shrink-0 truncate" title={r.label}>{r.label}</span>
                                    <div className="flex-1 h-3.5 bg-gray-100 rounded overflow-hidden min-w-[60px]">
                                      <div className="h-full rounded transition-all duration-500"
                                        style={{ width: `${Math.min(r.persen, 100)}%`, background: r.warna }} />
                                    </div>
                                    <span className="text-[10px] font-bold tabular-nums w-11 text-right flex-shrink-0"
                                      style={{ color: r.persen >= 50 ? '#C0392B' : r.persen >= 25 ? '#E67E22' : '#64748b' }}>
                                      {r.persen}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Tabel 3 kolom */}
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left text-[9px] font-bold text-gray-400 uppercase tracking-wide py-1.5 pr-2">Kelas Faktor</th>
                                    <th className="text-right text-[9px] font-bold text-gray-400 uppercase tracking-wide py-1.5 px-2">Luas Total</th>
                                    <th className="text-right text-[9px] font-bold text-gray-400 uppercase tracking-wide py-1.5 px-2">Di Zona Bahaya</th>
                                    <th className="text-right text-[9px] font-bold text-gray-400 uppercase tracking-wide py-1.5 pl-2">%</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map(r => (
                                    <tr key={r.skor} className="border-b border-gray-50">
                                      <td className="py-1.5 pr-2">
                                        <span className="flex items-center gap-1.5">
                                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: r.warna }} />
                                          <span className="text-[10px] text-gray-700 truncate">{r.label}</span>
                                        </span>
                                      </td>
                                      <td className="text-right text-[10px] text-gray-600 tabular-nums py-1.5 px-2">{r.total_ha.toLocaleString('id')} ha</td>
                                      <td className="text-right text-[10px] text-gray-600 tabular-nums py-1.5 px-2">{r.rawan_ha.toLocaleString('id')} ha</td>
                                      <td className="text-right text-[10px] font-semibold tabular-nums py-1.5 pl-2">{r.persen}%</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Catatan netral — tidak menyimpulkan sebab-akibat */}
                            {top && top.persen > 0 && (
                              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                <p className="text-[10px] text-slate-600 leading-relaxed">
                                  Kelas <b>{top.label}</b> memiliki proporsi tumpang-tindih tertinggi
                                  dengan zona bahaya ({top.persen}% dari luasnya).
                                  <span className="text-slate-400"> Catatan: proporsi tinggi belum tentu berarti penyebab —
                                  perhatikan juga luas absolutnya di kolom "Di Zona Bahaya".</span>
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })()}

                      {/* ═══ MODE ADMINISTRASI / DEFAULT: grid ringkas per kelas ═══ */}
                      {mode !== 'fasilitas' && mode !== 'faktor' && (() => {
                        const kelasStats = hl.subLayers.map(sl => {
                          let count = 0, luas = 0
                          try {
                            const gj = (sl.layer as any).toGeoJSON?.()
                            count = gj?.features?.length ?? 0
                            for (const f of (gj?.features || [])) {
                              const v = parseFloat(f.properties?._luas_ha)
                              if (!isNaN(v)) luas += v
                            }
                          } catch (_) {}
                          return { tingkat: sl.tingkat, warna: sl.warna, visible: sl.visible, count, luas: Math.round(luas * 10) / 10 }
                        })
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                            {kelasStats.map(k => (
                              <div key={k.tingkat} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 bg-gray-50/60 min-w-0 ${!k.visible ? 'opacity-40' : ''}`}>
                                <div className="w-3 h-3 rounded-sm flex-shrink-0 border border-black/10" style={{ background: k.warna }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-semibold text-gray-700 capitalize truncate leading-tight">{k.tingkat}</p>
                                  <p className="text-[9px] text-gray-400 leading-tight">
                                    {k.luas > 0 ? `${k.luas.toLocaleString('id')} ha` : `${k.count} fitur`}
                                  </p>
                                </div>
                              </div>
                            ))}
                            <p className="col-span-full text-[8px] text-gray-300 pt-0.5">
                              Atur warna, kelas, dan opacity hasil di panel Legenda kanan
                            </p>
                          </div>
                        )
                      })()}

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── SEARCH — pojok kanan atas ── */}
      <div className="absolute top-3 right-3 z-[1001] w-[260px]">
        <SearchControl map={mapRef.current} layers={layers} />
      </div>

      {/* ── LEGENDA KANAN ── */}
      {(layers.length > 0 || showGoogleLabels) && (
        <div className="absolute right-3 z-[1000] w-[230px]" style={{ top: '56px' }}>
          <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden select-none">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Legenda</span>
              <div className="flex items-center gap-1">
                {layers.length > 1 && (
                  <button onClick={zoomToAll} title="Zoom ke semua"
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-all">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  </button>
                )}
                <button onClick={() => setLegendOpen(!legendOpen)}
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-300 transition-all">
                  <svg className={`w-3 h-3 transition-transform ${legendOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>

            {legendOpen && (() => {
              // Urutan legenda = urutan layers (sudah auto-sorted: hasil → adm → fasilitas → faktor → bencana)
              const sorted = layers

              const URUTAN_KELAS = ['sangat aman','aman','tidak rawan','agak rawan','rendah','sangat rendah','sedang','tinggi','rawan','sangat rawan','sangat tinggi']
              const KAT_COLOR: Record<string,string> = { hasil:'text-amber-700', administrasi:'text-green-700', fasilitas:'text-blue-700', faktor:'text-purple-700', bencana:'text-red-700' }

              return (
                <div className="flex flex-col max-h-[70vh] overflow-y-auto">
                  {/* Baris Label Google — selalu paling atas */}
                  {showGoogleLabels && (
                    <div className="border-b border-gray-50">
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        <div className={`flex-1 min-w-0 ${!googleLabelsVisible ? 'opacity-40' : ''}`}>
                          <p className="text-[10px] font-bold truncate text-gray-700">Label Jalan & POI</p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {/* Eye */}
                          <button title={googleLabelsVisible ? 'Sembunyikan' : 'Tampilkan'}
                            onClick={() => setGoogleLabelsVisible(!googleLabelsVisible)}
                            className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-all ${googleLabelsVisible ? 'text-gray-400 hover:text-gray-600' : 'text-gray-200 hover:text-gray-400'}`}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              {googleLabelsVisible
                                ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                              }
                            </svg>
                          </button>
                          {/* Hapus */}
                          <button title="Hapus layer label" onClick={() => setShowGoogleLabels(false)}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {sorted.map((l, sortedIndex) => {
                    const realIndex = layers.indexOf(l)
                    const kat = l.info.jenis_bencana?.kategori || 'bencana'
                    const isExpanded = expandedGroups[`legend_${l.info.id}`] !== false
                    const opacity = l.style.fillOpacity ?? 1
                    const showOpacity = !!expandedGroups[`opacity_${l.info.id}`]
                    const isFasilitas = kat === 'fasilitas'
                    const isHasil = kat === 'hasil'
                    const swipeActive2 = swipeActive && swipeLayerA === l.info.id

                    // Sort kelas
                    const sortedSubs = [...l.subLayers].sort((a, b) => {
                      const ia = URUTAN_KELAS.findIndex(u => a.tingkat.toLowerCase().includes(u))
                      const ib = URUTAN_KELAS.findIndex(u => b.tingkat.toLowerCase().includes(u))
                      if (ia !== -1 && ib !== -1) return ia - ib
                      const na = parseFloat(a.tingkat), nb = parseFloat(b.tingkat)
                      if (!isNaN(na) && !isNaN(nb)) return na - nb
                      return 0
                    })

                    // Toggle visibility — handle fasilitas (markers) vs polygon
                    const toggleVis = () => {
                      const newVis = !l.visible
                      const updated = [...layers]; updated[realIndex] = { ...l, visible: newVis }
                      const applyVis = (layer: L.Layer, show: boolean) => {
                        const ly = layer as any
                        if (ly.setStyle) {
                          ly.setStyle({ opacity: show ? 1 : 0, fillOpacity: show ? opacity : 0 })
                        }
                        if (ly._icon) ly._icon.style.opacity = show ? '1' : '0'
                        if (ly.eachLayer) {
                          ly.eachLayer((child: L.Layer) => {
                            const c = child as any
                            if (c._icon) c._icon.style.opacity = show ? '1' : '0'
                            if (c.setStyle) c.setStyle({ opacity: show ? 1 : 0, fillOpacity: show ? opacity : 0 })
                          })
                        }
                      }
                      if (l.layer) applyVis(l.layer, newVis)
                      l.subLayers.forEach(sl => applyVis(sl.layer, newVis))
                      setLayers(updated)
                    }

                    // Toggle label — for all layer types
                    const toggleLabelFn = () => {
                      const newShow = !l.style.showLabels
                      const updated = [...layers]; updated[realIndex] = { ...l, style: { ...l.style, showLabels: newShow } }
                      if (newShow && l.layer) {
                        try { addLabels(l.info.id, l.layer as L.GeoJSON, (l.layer as any).toGeoJSON?.()) } catch(_) {}
                      } else { removeLabels(l.info.id) }
                      setLayers(updated)
                    }

                    // Swipe: this layer = kiri (A), layer below = kanan (B)
                    const handleSwipeLegend = () => {
                      if (swipeActive) { deactivateSwipe(); if (swipeLayerA === l.info.id) return }
                      const layerBelow = sortedIndex < sorted.length - 1 ? sorted[sortedIndex + 1] : null
                      if (!layerBelow) return
                      activateSwipe(l.info.id, layerBelow.info.id)
                    }

                    const hasBelowLayer = sorted.findIndex((_, i) => i > sortedIndex) !== -1

                    // Hapus layer — layer hasil analisis punya jalur sendiri
                    const handleHapusLayer = () => {
                      if (isHasil) clearHasilLayer()
                      else toggleAvailableLayer(l.info)
                    }

                    return (
                      <div key={l.info.id}
                        className={`border-b border-gray-50 last:border-0 ${swipeActive2 ? 'bg-blue-950/5' : ''} ${isHasil ? 'bg-amber-50/40' : ''}`}>

                        {/* Header row */}
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          {/* Nama — expand toggle */}
                          <button onClick={() => setExpandedGroups(p => ({ ...p, [`legend_${l.info.id}`]: !isExpanded }))}
                            className={`flex-1 text-left min-w-0 ${!l.visible ? 'opacity-40' : ''}`}>
                            <p className={`text-[10px] font-bold truncate ${KAT_COLOR[kat] || 'text-gray-700'}`}>{l.info.nama}</p>
                          </button>

                          {/* Kontrol */}
                          <div className="flex items-center gap-0.5 flex-shrink-0"
                            onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>

                            {/* Zoom */}
                            <button title="Zoom ke layer" onClick={() => {
                              try {
                                const map = mapRef.current; if (!map) return
                                if (l.subLayers[0]) map.fitBounds((l.subLayers[0].layer as any).getBounds(), { padding: [40,40] })
                                else if (l.layer) map.fitBounds((l.layer as any).getBounds(), { padding: [40,40] })
                              } catch(_) {}
                            }} className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-all">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                              </svg>
                            </button>

                            {/* Show/hide */}
                            <button title={l.visible ? 'Sembunyikan' : 'Tampilkan'} onClick={toggleVis}
                              className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-all ${l.visible ? 'text-gray-400 hover:text-gray-600' : 'text-gray-200 hover:text-gray-400'}`}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                {l.visible
                                  ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>
                                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                }
                              </svg>
                            </button>

                            {/* Label */}
                            <button title={l.style.showLabels ? 'Sembunyikan label' : 'Tampilkan label'} onClick={toggleLabelFn}
                              className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-all ${l.style.showLabels ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                              </svg>
                            </button>

                            {/* Opacity */}
                            <button title="Opacity" onClick={() => setExpandedGroups(p => ({ ...p, [`opacity_${l.info.id}`]: !showOpacity }))}
                              className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-all ${showOpacity ? 'bg-gray-100 text-gray-600' : 'text-gray-400 hover:text-gray-600'}`}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                              </svg>
                            </button>

                            {/* Swipe — hanya tampil kalau ada layer di bawahnya */}
                            {hasBelowLayer && (
                              <button title={swipeActive2 ? 'Matikan swipe' : 'Swipe dengan layer di bawah'} onClick={handleSwipeLegend}
                                className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-all ${swipeActive2 ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                </svg>
                              </button>
                            )}

                            {/* Hapus */}
                            <button title={isHasil ? 'Hapus hasil analisis' : 'Hapus layer'} onClick={handleHapusLayer}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Opacity slider — isolated dari drag */}
                        {showOpacity && (
                          <div className="px-3 pb-2 flex items-center gap-2"
                            draggable={false}
                            onPointerDown={e => e.stopPropagation()}
                            onMouseDown={e => e.stopPropagation()}
                            onDragStart={e => e.preventDefault()}>
                            <span className="text-[9px] text-gray-400 w-6">Ops</span>
                            <input type="range" min={0} max={100} step={5}
                              value={Math.round(opacity * 100)}
                              onPointerDown={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                              onChange={e => {
                                e.stopPropagation()
                                const op = Number(e.target.value) / 100
                                const updated = [...layers]; updated[realIndex] = { ...l, style: { ...l.style, fillOpacity: op } }
                                const applyOp = (layer: L.Layer) => {
                                  const ly = layer as any
                                  if (ly.setStyle) ly.setStyle({ fillOpacity: op })
                                  if (ly.setOpacity) ly.setOpacity(op)
                                  if (ly.eachLayer) ly.eachLayer((c: L.Layer) => {
                                    const ch = c as any
                                    if (ch.setStyle) ch.setStyle({ fillOpacity: op })
                                    if (ch.setOpacity) ch.setOpacity(op)
                                  })
                                }
                                if (l.layer) applyOp(l.layer)
                                l.subLayers.forEach(sl => applyOp(sl.layer))
                                setLayers(updated)
                              }}
                              className="flex-1 accent-blue-700 h-1.5 cursor-pointer" />
                            <span className="text-[9px] text-gray-400 w-6 text-right">{Math.round(opacity * 100)}%</span>
                          </div>
                        )}

                        {/* Kelas legenda */}
                        {isExpanded && (
                          <div className="px-3 pb-2 flex flex-col gap-1">
                            {sortedSubs.length > 0
                              ? sortedSubs.map((sl, si) => (
                                <div key={si} className={`flex items-center gap-2 group ${!sl.visible ? 'opacity-40' : ''}`}>
                                  <label title="Klik ganti warna" className="cursor-pointer flex-shrink-0">
                                    <div className="w-3 h-3 rounded-sm border border-black/10 hover:ring-1 hover:ring-blue-400 transition-all" style={{ background: sl.warna }} />
                                    <input type="color" value={sl.warna} className="sr-only"
                                      onChange={e => {
                                        const w = e.target.value
                                        const updated = [...layers]
                                        updated[realIndex] = { ...l, subLayers: l.subLayers.map(s => s.tingkat === sl.tingkat ? { ...s, warna: w } : s) }
                                        ;(sl.layer as any).setStyle?.({ fillColor: w })
                                        // Recolor juga marker divIcon (untuk hasil analisis fasilitas / layer titik)
                                        ;(sl.layer as any).eachLayer?.((c: any) => {
                                          if (c._icon) {
                                            c._icon.querySelectorAll('div').forEach((d: any) => {
                                              if (d.style.background) d.style.background = w
                                            })
                                            c._icon.querySelectorAll('polygon, path, circle, rect').forEach((p: any) => p.setAttribute('fill', w))
                                          }
                                        })
                                        setLayers(updated)
                                      }} />
                                  </label>
                                  <span className="text-[10px] text-gray-600 leading-tight flex-1">{sl.tingkat}</span>
                                  {/* Eye per kelas */}
                                  <button title={sl.visible ? 'Sembunyikan kelas' : 'Tampilkan kelas'}
                                    onClick={() => {
                                      const newVis = !sl.visible
                                      const updated = [...layers]
                                      updated[realIndex] = {
                                        ...l, subLayers: l.subLayers.map(s => s.tingkat === sl.tingkat ? { ...s, visible: newVis } : s)
                                      }
                                      const ly = sl.layer as any
                                      if (ly.setStyle) ly.setStyle({ opacity: newVis ? 1 : 0, fillOpacity: newVis ? (l.style.fillOpacity ?? 1) : 0 })
                                      if (ly.eachLayer) ly.eachLayer((c: any) => {
                                        if (c.setStyle) c.setStyle({ opacity: newVis ? 1 : 0, fillOpacity: newVis ? (l.style.fillOpacity ?? 1) : 0 })
                                        if (c._icon) c._icon.style.display = newVis ? '' : 'none'
                                      })
                                      setLayers(updated)
                                    }}
                                    className="w-4 h-4 flex items-center justify-center rounded text-gray-300 hover:text-gray-600 transition-all flex-shrink-0">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      {sl.visible
                                        ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>
                                        : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                      }
                                    </svg>
                                  </button>
                                </div>
                              ))
                              : isFasilitas
                                ? (
                                  <div className="flex items-center gap-2">
                                    <label title="Klik ganti warna" className="cursor-pointer flex-shrink-0">
                                      <div className="w-3 h-3 rounded-full border border-black/10 hover:ring-1 hover:ring-blue-400 transition-all" style={{ background: l.info.warna || '#3388ff' }} />
                                      <input type="color" value={l.info.warna || '#3388ff'} className="sr-only"
                                        onChange={e => {
                                          const w = e.target.value
                                          // Mutate info.warna agar zoomend handler pakai warna baru
                                          l.info.warna = w
                                          const applyMarkerColor = (icon: HTMLElement) => {
                                            icon.querySelectorAll('div').forEach((d: any) => {
                                              if (d.style.background) d.style.background = w
                                              if (d.style.borderBottomColor) d.style.borderBottomColor = w
                                              if (d.style.borderBottom && d.style.borderBottom.includes('solid')) {
                                                const parts = d.style.borderBottom.split('solid')
                                                d.style.borderBottom = parts[0] + 'solid ' + w
                                              }
                                            })
                                            icon.querySelectorAll('polygon, path, circle, rect').forEach((p: any) => p.setAttribute('fill', w))
                                          }
                                          const applyColor = (layer: L.Layer) => {
                                            const ly = layer as any
                                            if (ly.setStyle) try { ly.setStyle({ color: w, fillColor: w }) } catch(_) {}
                                            if (ly._icon) applyMarkerColor(ly._icon)
                                            if (ly.eachLayer) ly.eachLayer((c: any) => {
                                              if (c.setStyle) try { c.setStyle({ color: w, fillColor: w }) } catch(_) {}
                                              if (c._icon) applyMarkerColor(c._icon)
                                            })
                                          }
                                          if (l.layer) applyColor(l.layer)
                                          l.subLayers.forEach(sl => applyColor(sl.layer))
                                          setLayers(prev => [...prev])
                                        }} />
                                    </label>
                                    <span className="text-[10px] text-gray-600">{l.info.nama}</span>
                                  </div>
                                )
                                : kat === 'administrasi' ? (
                                  <div className="flex flex-col gap-2">
                                    {(() => {
                                      const st = adminStrokeStyle[l.info.id] || { fill: '#cccccc', noFill: true, stroke: '#000000', noStroke: false, weight: 1, dash: '8,6' }
                                      return (
                                        <div className="bg-gray-50 rounded-lg p-2 flex flex-col gap-2">
                                          {/* Fill */}
                                          <div className="flex items-center gap-2">
                                            <label className="cursor-pointer flex-shrink-0" title="Warna fill">
                                              <div className="w-4 h-4 rounded border border-black/15" style={{ background: st.noFill ? 'repeating-conic-gradient(#e5e7eb 0 25%, white 0 50%) 0 0/8px 8px' : st.fill }} />
                                              <input type="color" value={st.fill} className="sr-only"
                                                onChange={e => applyAdminStyle(l, { ...st, fill: e.target.value, noFill: false })} />
                                            </label>
                                            <span className="text-[9px] text-gray-500 flex-1">Fill</span>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                              <input type="checkbox" checked={st.noFill} onChange={e => applyAdminStyle(l, { ...st, noFill: e.target.checked })} className="w-3 h-3 accent-blue-700" />
                                              <span className="text-[9px] text-gray-500">Tanpa fill</span>
                                            </label>
                                          </div>
                                          {/* Stroke */}
                                          <div className="flex items-center gap-2">
                                            <label className="cursor-pointer flex-shrink-0" title="Warna garis">
                                              <div className="w-4 h-4 rounded border border-black/15" style={{ background: st.noStroke ? 'repeating-conic-gradient(#e5e7eb 0 25%, white 0 50%) 0 0/8px 8px' : st.stroke }} />
                                              <input type="color" value={st.stroke} className="sr-only"
                                                onChange={e => applyAdminStyle(l, { ...st, stroke: e.target.value, noStroke: false })} />
                                            </label>
                                            <span className="text-[9px] text-gray-500 flex-1">Garis</span>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                              <input type="checkbox" checked={st.noStroke} onChange={e => applyAdminStyle(l, { ...st, noStroke: e.target.checked })} className="w-3 h-3 accent-blue-700" />
                                              <span className="text-[9px] text-gray-500">Tanpa garis</span>
                                            </label>
                                          </div>
                                          {/* Tebal + jenis */}
                                          <div className="flex items-center gap-2">
                                            <input type="range" min={0.5} max={5} step={0.5} value={st.weight}
                                              onChange={e => applyAdminStyle(l, { ...st, weight: Number(e.target.value) })}
                                              onMouseDown={e => e.stopPropagation()}
                                              className="flex-1 accent-blue-700 h-1" title="Tebal garis" />
                                            <span className="text-[9px] text-gray-400 w-5">{st.weight}</span>
                                            <select value={st.dash}
                                              onChange={e => applyAdminStyle(l, { ...st, dash: e.target.value })}
                                              className="text-[9px] border border-gray-200 rounded px-1 py-0.5 bg-white">
                                              <option value="">Solid</option>
                                              <option value="8,6">Dash</option>
                                              <option value="2,4">Dot</option>
                                              <option value="12,4,2,4">Dash-Dot</option>
                                            </select>
                                          </div>
                                        </div>
                                      )
                                    })()}
                                    {/* Daftar wilayah dengan checkbox */}
                                    {(() => {
                                      const names = getWilayahNames(l)
                                      if (!names.length) return null
                                      const hidden = hiddenWilayah[l.info.id] || []
                                      return (
                                        <div className="flex flex-col gap-0.5 max-h-44 overflow-y-auto border border-gray-100 rounded-lg p-1.5">
                                          <div className="flex items-center justify-between px-1 pb-1">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase">Wilayah ({names.length})</span>
                                            <button onClick={() => {
                                              const allHidden = hidden.length >= names.length
                                              const target = allHidden ? [] : [...names]
                                              setHiddenWilayah(prev => ({ ...prev, [l.info.id]: target }))
                                              const gjl = l.layer as any
                                              if (gjl?.eachLayer) gjl.eachLayer((child: any) => {
                                                const el = child._path
                                                if (el) el.style.display = allHidden ? '' : 'none'
                                              })
                                            }} className="text-[9px] text-blue-600 hover:underline">
                                              {hidden.length >= names.length ? 'Tampilkan semua' : 'Sembunyikan semua'}
                                            </button>
                                          </div>
                                          {names.map(nama => (
                                            <label key={nama} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-gray-50 cursor-pointer">
                                              <input type="checkbox" checked={!hidden.includes(nama)}
                                                onChange={() => toggleWilayahVisibility(l, nama)}
                                                className="w-3 h-3 accent-blue-700 flex-shrink-0" />
                                              <span className="text-[10px] text-gray-600 truncate">{nama}</span>
                                            </label>
                                          ))}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <label title="Klik ganti warna" className="cursor-pointer flex-shrink-0">
                                      <div className="w-3 h-3 rounded-sm border border-black/10 hover:ring-1 hover:ring-blue-400 transition-all" style={{ background: l.info.warna || '#3388ff' }} />
                                      <input type="color" value={l.info.warna || '#3388ff'} className="sr-only"
                                        onChange={e => {
                                          const w = e.target.value
                                          if (l.layer) (l.layer as any).setStyle?.({ fillColor: w, color: w })
                                        }} />
                                    </label>
                                    <span className="text-[10px] text-gray-600">{l.info.nama}</span>
                                  </div>
                                )
                            }
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {intersectLayer && (
                    <div className="border-t border-gray-100 px-3 py-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Hasil Overlay</p>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0 border-2 border-red-500" style={{ background: '#FEFB00' }} />
                        <span className="text-[11px] text-gray-600">Area terdampak</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

            <div id={mapId} className="w-full" style={{ height: height || 'calc(100vh - 64px)' }} />
    </div>
  )
}