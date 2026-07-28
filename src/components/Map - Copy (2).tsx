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
interface LegendaItem { nilai: string; label: string; warna: string }
interface Legenda { field: string; items: LegendaItem[] }
interface LayerPeta {
  id: string; nama: string; file_url: string; warna: string
  has_tingkat: boolean; field_tingkat: string
  legenda?: Legenda | null; opacity?: number | null
  jenis_bencana: { nama: string; kategori: string }
}
interface SubLayer { tingkat: string; layer: L.GeoJSON; visible: boolean; warna: string; urutan?: number }
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

// Urutan kelas dari AMAN -> BAHAYA (dipakai konsisten di daftar layer & legenda)
const URUTAN_KELAS = ['sangat aman', 'aman', 'tidak rawan', 'sangat rendah', 'rendah', 'agak rawan', 'sedang', 'rawan', 'tinggi', 'sangat rawan', 'sangat tinggi']
function rankKelas(tingkat: string): number {
  const t = tingkat.toLowerCase().trim()
  // Cari kata kunci yang cocok PALING SPESIFIK (terpanjang) agar
  // "sangat rawan" tidak keliru cocok ke "rawan", "sangat aman" tidak ke "aman", dst.
  let bestIdx = -1, bestLen = -1
  URUTAN_KELAS.forEach((u, idx) => {
    if (t.includes(u) && u.length > bestLen) { bestLen = u.length; bestIdx = idx }
  })
  return bestIdx
}
function sortSubLayers<T extends { tingkat: string; urutan?: number }>(subs: T[]): T[] {
  return [...subs].sort((a, b) => {
    // Urutan eksplisit dari legenda admin menang di atas segalanya
    if (a.urutan !== undefined && b.urutan !== undefined) return a.urutan - b.urutan
    const ia = rankKelas(a.tingkat)
    const ib = rankKelas(b.tingkat)
    if (ia !== -1 && ib !== -1) return ia - ib
    if (ia !== -1) return -1
    if (ib !== -1) return 1
    const na = parseFloat(a.tingkat), nb = parseFloat(b.tingkat)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return 0
  })
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
  if (kategori === 'faktor') return { fillOpacity: 1, strokeColor: '#ffffff', strokeWidth: 0, dashArray: '', showLabels: false, iconShape: 'circle' as const }
  return { fillOpacity: 1, strokeColor: '#ffffff', strokeWidth: 0, dashArray: '', showLabels: false, iconShape: 'circle' as const }
}

function detectLabelField(properties: Record<string, any>): string | null {
  const keys = Object.keys(properties || {})
  const nameKeys = ['nama', 'name', 'NAMA', 'NAME', 'nama_kec', 'NAMA_KEC', 'nama_kel', 'NAMA_KEL', 'NAMOBJ', 'WADMKC', 'WADMKD', 'KECAMATAN', 'KELURAHAN', 'kecamatan', 'kelurahan']
  for (const nk of nameKeys) { if (keys.includes(nk)) return nk }
  const strKey = keys.find(k => typeof properties[k] === 'string' && properties[k].length > 1 && properties[k].length < 50)
  return strKey || null
}

function esc(v: any): string {
  return String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

// Tentukan apa yang ditampilkan popup untuk satu fitur.
// Prioritas: field dari legenda admin → field_tingkat lama → nama objek → properti pertama.
function nilaiUntukPopup(info: LayerPeta, props: Record<string, any>): { label: string; utama: string; tambahan?: string } {
  const leg = info?.legenda
  if (leg?.field && props?.[leg.field] !== undefined && props[leg.field] !== null && props[leg.field] !== '') {
    const raw = String(props[leg.field])
    const cocok = leg.items?.find(i => String(i.nilai) === raw)
    // Label dari legenda menang: itu teks yang sama dengan yang dibaca siswa di legenda peta
    return { label: leg.field, utama: cocok?.label || raw }
  }
  if (info?.field_tingkat && props?.[info.field_tingkat] !== undefined && props[info.field_tingkat] !== '') {
    return { label: info.field_tingkat, utama: String(props[info.field_tingkat]) }
  }
  // Layer titik (fasilitas): nama objek lebih berguna daripada tipe
  const namaKey = ['Nama', 'nama', 'NAMA', 'NAMOBJ', 'name', 'NAME', 'Name'].find(k => props?.[k])
  if (namaKey) {
    const tipeKey = ['Tipe', 'tipe', 'TIPE', 'REMARK', 'Keterangan', 'keterangan'].find(k => props?.[k] && k !== namaKey)
    return { label: 'Nama', utama: String(props[namaKey]), tambahan: tipeKey ? String(props[tipeKey]) : undefined }
  }
  const skip = ['_tingkat', '_warna', '_luas_ha', '_namaWilayah', 'geometry', 'geometry_name', 'id', 'ID', 'fid', 'FID']
  const pertama = Object.entries(props || {}).find(([k, v]) => !skip.includes(k) && !k.startsWith('_') && v !== null && v !== '')
  return { label: pertama ? pertama[0] : 'Info', utama: pertama ? String(pertama[1]) : '-' }
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
function StatusBar({ map, hoverCoord, clickCoord, elevation, onCopy, copied, onClear, bottomOffset = 12, compact = false }: {
  map: L.Map | null
  hoverCoord: { lat: number; lng: number } | null
  clickCoord: { lat: number; lng: number } | null
  elevation: number | null
  onCopy: () => void
  copied: boolean
  onClear: () => void
  bottomOffset?: number
  compact?: boolean
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
      style={{ bottom: bottomOffset, zoom: compact ? 0.8 : 1 }}>
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
  const [wilayahCari, setWilayahCari] = useState<Record<string, string>>({})
  const [adminStrokeStyle, setAdminStrokeStyle] = useState<Record<string, { fill: string; noFill: boolean; stroke: string; noStroke: boolean; weight: number; dash: string }>>({})
  // Bottom sheet hasil analisis
  const [hasilSheetOpen, setHasilSheetOpen] = useState(false)
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
  // Icon-rail flyout: panel mana yang sedang terbuka (null = peta penuh)
  const [activeFlyout, setActiveFlyout] = useState<'layer' | 'basemap' | 'analisis' | null>(compact ? null : 'layer')
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
  const [layerTab, setLayerTab] = useState<'aktif' | 'pilih'>('pilih')
  const [peekBasemap, setPeekBasemap] = useState(false)
  const [popupInfo, setPopupInfo] = useState<{ latlng: L.LatLng; items: { layerNama: string; props: Record<string, any> }[] } | null>(null)
  const toolActiveRef = useRef(false)
  const popupRef = useRef<L.Popup | null>(null)

  const hoverElevationRef = useRef<number | null>(null)

  useEffect(() => { layersRef.current = layers }, [layers])
  useEffect(() => { toolActiveRef.current = toolActive }, [toolActive])
  useEffect(() => { hoverElevationRef.current = hoverElevation }, [hoverElevation])

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
      const updated = sisipkanLayer(prev, hasil)
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

  const urutanKat = (l: LayerState) => KATEGORI_ORDER[l.info.jenis_bencana?.kategori || 'bencana'] ?? 3
  // Sisipkan layer baru di akhir blok kategorinya, tanpa mengacak urutan manual layer lama
  const sisipkanLayer = (list: LayerState[], baru: LayerState) => {
    const o = urutanKat(baru)
    let idx = list.findIndex(l => urutanKat(l) > o)
    if (idx === -1) idx = list.length
    const out = [...list]
    out.splice(idx, 0, baru)
    return out
  }

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

  // Intip Peta Dasar: sembunyikan sementara SEMUA layer dari peta tanpa mengubah status visible-nya,
  // lalu kembalikan persis seperti semula. Hanya menyentuh peta, bukan state layer.
  const togglePeekBasemap = () => {
    const map = mapRef.current
    if (!map) return
    if (!peekBasemap) {
      // Sembunyikan semua yang sedang tampil
      layers.forEach(l => {
        if (l.layer && map.hasLayer(l.layer)) map.removeLayer(l.layer)
        l.subLayers.forEach(sl => { if (map.hasLayer(sl.layer)) map.removeLayer(sl.layer) })
        removeLabels(l.info.id)
      })
      setPeekBasemap(true)
    } else {
      // Kembalikan sesuai status visible masing-masing
      layers.forEach(l => {
        if (!l.visible) return
        if (l.layer) { if (!map.hasLayer(l.layer)) map.addLayer(l.layer) }
        else l.subLayers.forEach(sl => { if (sl.visible && !map.hasLayer(sl.layer)) map.addLayer(sl.layer) })
      })
      applyZOrder(layers)
      setPeekBasemap(false)
    }
  }

  // Set visibilitas SEMUA layer sekaligus (untuk aksi cepat di tab Layer Aktif)
  const setSemuaLayerVisible = (target: boolean) => {
    const map = mapRef.current
    if (!map) return
    const updated = layers.map(l => {
      if (l.visible === target) return l
      if (l.layer) { target ? map.addLayer(l.layer) : map.removeLayer(l.layer) }
      else l.subLayers.forEach(sl => { target ? (sl.visible && map.addLayer(sl.layer)) : map.removeLayer(sl.layer) })
      if (!target) removeLabels(l.info.id)
      return { ...l, visible: target }
    })
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
    const items: { layerNama: string; info: LayerPeta; props: Record<string, any> }[] = []
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
              items.push({ layerNama: l.info.nama, info: l.info, props: feat.properties || {} })
            }
          } else if (geom.type === 'Point') {
            // Use pixel distance for accurate point hit detection
            const markerPx = map.latLngToContainerPoint([geom.coordinates[1], geom.coordinates[0]])
            const dx = clickPx.x - markerPx.x
            const dy = clickPx.y - markerPx.y
            const distPx = Math.sqrt(dx * dx + dy * dy)
            if (distPx <= markerRadiusPx + 4) { // +4px tolerance
              items.push({ layerNama: l.info.nama, info: l.info, props: feat.properties || {} })
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

    // Build popup HTML — nilai dibaca dari field yang ditetapkan di legenda
    const html = items.map((item, idx) => {
      const { label, utama, tambahan } = nilaiUntukPopup(item.info, item.props)
      // Warna kotak kecil diambil dari legenda agar cocok dengan yang tampil di peta
      const leg = item.info?.legenda
      const raw = leg?.field ? String(item.props?.[leg.field] ?? '') : ''
      const warnaKelas = leg?.items?.find(i => String(i.nilai) === raw)?.warna || item.info?.warna || '#94a3b8'

      const barisTambahan = tambahan
        ? `<div style="display:flex;font-size:11px;margin-top:4px">
             <span style="color:#9ca3af;font-weight:600;width:72px;flex-shrink:0">Jenis</span>
             <span style="color:#334155;flex:1">${esc(tambahan)}</span>
           </div>`
        : ''

      return `<div style="${idx > 0 ? 'border-top:1px solid #e2e8f0;' : ''}margin-bottom:${idx === items.length - 1 ? '0' : '6'}px;padding-top:${idx > 0 ? '6' : '0'}px;padding-bottom:6px">
        <div style="display:flex;align-items:center;font-size:11px;margin-bottom:4px">
          <span style="width:9px;height:9px;border-radius:2px;background:${warnaKelas};flex-shrink:0;margin-right:6px;border:1px solid rgba(0,0,0,0.12)"></span>
          <span style="color:#1e293b;font-weight:600;flex:1">${esc(item.layerNama)}</span>
        </div>
        <div style="display:flex;font-size:11px">
          <span style="color:#9ca3af;font-weight:600;width:72px;flex-shrink:0">${esc(label)}</span>
          <span style="color:#334155;flex:1">${esc(utama)}</span>
        </div>
        ${barisTambahan}
      </div>`
    }).join('')

    // Header dengan Lat/Lng + Elevasi (hanya 1x, tidak redundant)
    const headerHtml = `<div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;margin:-6px -10px 8px -10px;padding:8px 10px">
      <div style="display:flex;font-size:11px;margin-bottom:4px">
        <span style="color:#9ca3af;font-weight:600;width:55px;flex-shrink:0">Lat/Lng</span>
        <span style="color:#334155;flex:1;font-family:monospace;font-size:10px">${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</span>
      </div>
      <div style="display:flex;font-size:11px">
        <span style="color:#9ca3af;font-weight:600;width:55px;flex-shrink:0">Elevasi</span>
        <span style="color:#334155;flex:1">${hoverElevationRef.current !== null ? `${hoverElevationRef.current} mdpl` : '—'}</span>
      </div>
    </div>`

    const fullHtml = headerHtml + html

    if (popupRef.current) { try { mapRef.current.removeLayer(popupRef.current) } catch (_) {} }
    popupRef.current = L.popup({ 
      maxWidth: 280,
      minWidth: 220,
      className: 'unified-popup leaflet-popup-table',
      closeButton: true,
      autoPan: true,
      autoPanPaddingTopLeft: [40, 40],
      autoPanPaddingBottomRight: [40, 40]
    })
      .setLatLng(latlng)
      .setContent(`<div style="font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;padding:6px 10px;margin:0">${fullHtml}</div>`)
      .openOn(mapRef.current)
    
    // Fetch elevation
    readElevationAt(latlng.lat, latlng.lng)
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
      const base = defaultStyle(kat, layerData.warna)
      // Opasitas dari panel admin. Administrasi sengaja tetap tanpa isi.
      const style = kat === 'administrasi' ? base : { ...base, fillOpacity: layerData.opacity ?? base.fillOpacity }
      const leg = layerData.legenda
      let ls: LayerState

      if (leg?.items?.length || layerData.has_tingkat) {
        const props0 = geojson.features[0]?.properties || {}
        let field: string
        let kelas: { nilai: string; label: string; warna: string }[]

        if (leg?.items?.length) {
          // Legenda dari panel admin — sumber kebenaran untuk field, label, warna, dan urutan
          field = leg.field
          kelas = leg.items
        } else {
          // Layer lama yang belum punya legenda: pertahankan perilaku auto-detect
          const skorField = ['skor', 'Skor', 'SKOR', 'score', 'Score'].find(k => props0[k] !== undefined)
          const keteranganField = ['Keterangan', 'keterangan', 'KETERANGAN', 'label', 'Label'].find(k => props0[k] !== undefined)
          field = skorField || (layerData.field_tingkat && layerData.field_tingkat !== 'tingkat' ? layerData.field_tingkat : null) || Object.keys(props0)[0] || 'skor'
          const nilai = [...new Set(geojson.features.map((f: any) => String(f.properties?.[field])).filter((v: string) => v && v !== 'undefined'))] as string[]
          nilai.sort((a, b) => {
            const na = parseFloat(a), nb = parseFloat(b)
            return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb
          })
          kelas = nilai.map(n => {
            const contoh = geojson.features.find((f: any) => String(f.properties?.[field]) === n)
            const label = keteranganField && contoh?.properties?.[keteranganField]
              ? String(contoh.properties[keteranganField]) : LABEL_SKOR[n] || n
            return { nilai: n, label, warna: WARNA_TINGKAT[n] || WARNA_TINGKAT[n.toLowerCase()] || layerData.warna || '#8b5cf6' }
          })
        }

        const subLayers: SubLayer[] = []
        kelas.forEach((k, idx) => {
          const features = geojson.features.filter((f: any) => String(f.properties?.[field]) === String(k.nilai))
          if (!features.length) return
          const subLayer = L.geoJSON({ type: 'FeatureCollection', features } as any, {
            style: { color: style.strokeColor, weight: style.strokeWidth, fillColor: k.warna, fillOpacity: style.fillOpacity, dashArray: style.dashArray || undefined },
            onEachFeature: (_feature, layer) => { layer.on('click', (e) => { if (!toolActiveRef.current) handleLayerClick(e.latlng) }) },
            pointToLayer: (_f, latlng) => createPointMarker(latlng, k.warna, style.iconShape, Math.max(4, map.getZoom() - 7)),
          }).addTo(map)
          subLayers.push({ tingkat: k.label || k.nilai, layer: subLayer, visible: true, warna: k.warna, urutan: idx })
        })
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
        const updated = sisipkanLayer(prev, ls)
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

  // ── KARTU LAYER SERAGAM — satu-satunya pusat kontrol ──
  // Kerangka sama untuk semua: [mata] Nama [gear][zoom][hapus] + pengaturan seragam + daftar isi (kelas/wilayah)
  const setOpacityFor = (index: number, op: number) => {
    const clamped = Math.max(0, Math.min(1, Math.round(op * 100) / 100))
    applyStyle(index, { fillOpacity: clamped })
  }

  // Naik/turun satu langkah. Administrasi & hasil terkunci di blok atas:
  // layer biasa tidak bisa melewatinya, dan sebaliknya.
  const bolehTukar = (a: LayerState, b: LayerState) => {
    const terkunci = (l: LayerState) => ['administrasi', 'hasil'].includes(l.info.jenis_bencana?.kategori || '')
    return terkunci(a) === terkunci(b)
  }
  const pindahLayer = (index: number, arah: -1 | 1) => {
    const target = index + arah
    if (target < 0 || target >= layers.length) return
    if (!bolehTukar(layers[index], layers[target])) return
    const updated = [...layers]
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    applyZOrder(updated)
    setLayers(updated)
  }
  const renderLayerCard = (l: LayerState) => {
    const globalIndex = layers.indexOf(l)
    const kat = l.info.jenis_bencana?.kategori || 'bencana'
    const isFasilitas = kat === 'fasilitas'
    const isAdmin = kat === 'administrasi'
    const isHasil = kat === 'hasil'
    const isTiered = l.subLayers.length > 0
    const op = l.style.fillOpacity ?? 1
    const opPct = Math.round(op * 100)

    const GARIS_PRESET = [{ w: 0.5, label: 'Tipis' }, { w: 2, label: 'Sedang' }, { w: 4, label: 'Tebal' }]

    // Ganti warna layer tunggal (bukan berkelas)
    const setWarnaTunggal = (w: string) => {
      if (isFasilitas) {
        l.info.warna = w
        applyStyle(globalIndex, { strokeColor: w })
      } else if (isAdmin) {
        // Administrasi: yang berwarna adalah GARIS (stroke), bukan area
        applyStyle(globalIndex, { strokeColor: w })
        if (l.layer) (l.layer as any).setStyle?.({ color: w })
        setLayers(prev => [...prev])
      } else if (l.layer) {
        (l.layer as any).setStyle?.({ fillColor: w, color: w })
        l.info.warna = w
        setLayers(prev => [...prev])
      }
    }

    return (
      <div key={l.info.id} className={`rounded-lg border select-none ${isHasil ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-white'}`}>
        {/* Header seragam */}
        <div className="flex items-center gap-1.5 px-2 py-1.5">
          {/* Urutan naik/turun */}
          {(() => {
            const bisaNaik = globalIndex > 0 && bolehTukar(l, layers[globalIndex - 1])
            const bisaTurun = globalIndex < layers.length - 1 && bolehTukar(l, layers[globalIndex + 1])
            return (
              <div className="flex flex-col flex-shrink-0 -my-0.5">
                <button onClick={() => pindahLayer(globalIndex, -1)} disabled={!bisaNaik}
                  title={bisaNaik ? 'Naikkan layer' : 'Sudah paling atas'}
                  className={`leading-none text-[8px] px-0.5 ${bisaNaik ? 'text-gray-400 hover:text-blue-600' : 'text-gray-200 cursor-default'}`}>▲</button>
                <button onClick={() => pindahLayer(globalIndex, 1)} disabled={!bisaTurun}
                  title={bisaTurun ? 'Turunkan layer' : 'Sudah paling bawah'}
                  className={`leading-none text-[8px] px-0.5 ${bisaTurun ? 'text-gray-400 hover:text-blue-600' : 'text-gray-200 cursor-default'}`}>▼</button>
              </div>
            )
          })()}
          {/* Mata */}
          <button onClick={() => toggleLayer(globalIndex)} title={l.visible ? 'Sembunyikan' : 'Tampilkan'}
            className={`w-5 h-5 flex items-center justify-center rounded flex-shrink-0 transition-all ${l.visible ? 'text-gray-500 hover:text-gray-700' : 'text-gray-300 hover:text-gray-500'}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {l.visible
                ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>
                : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />}
            </svg>
          </button>
          {/* Warna tunggal (hanya layer tak-berkelas) */}
          {!isTiered && (() => {
            const warnaKini = isAdmin ? (l.style.strokeColor || '#000000')
              : isFasilitas ? (l.style.strokeColor || l.info.warna || '#3388ff')
              : (l.info.warna || '#3388ff')
            return (
              <div className="relative w-3.5 h-3.5 flex-shrink-0" title="Ganti warna">
                {/* Admin = tampilkan sebagai cincin (stroke), lain = isi */}
                {isAdmin
                  ? <div className="w-3.5 h-3.5 rounded-sm bg-white" style={{ border: `2px solid ${warnaKini}` }} />
                  : <div className={`w-3.5 h-3.5 border border-black/10 ${isFasilitas ? 'rounded-full' : 'rounded-sm'}`} style={{ background: warnaKini }} />}
                <input type="color" value={warnaKini}
                  onChange={e => setWarnaTunggal(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{ padding: 0, border: 0 }} />
              </div>
            )
          })()}
          <button onClick={() => toggleStylePanel(globalIndex)} className="text-[10px] text-gray-700 flex-1 text-left truncate font-medium">{l.info.nama}</button>
          {/* Gear */}
          <button onClick={() => toggleStylePanel(globalIndex)} title="Pengaturan"
            className={`w-5 h-5 flex items-center justify-center rounded flex-shrink-0 transition-all ${l.showStylePanel ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a6.759 6.759 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
          </button>
          {/* Zoom */}
          <button onClick={() => zoomToLayer(globalIndex)} title="Zoom ke layer"
            className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0 text-gray-400 hover:text-blue-600 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
          </button>
          {/* Hapus */}
          <button onClick={() => { if (isHasil) clearHasilLayer(); else toggleAvailableLayer(l.info) }} title="Hapus layer"
            className="w-5 h-5 flex items-center justify-center rounded flex-shrink-0 text-gray-300 hover:text-red-400 transition-all">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* PENGATURAN SERAGAM (saat gear diklik) */}
        {l.showStylePanel && (
          <div className="mx-2 mb-2 pt-2 border-t border-gray-100 flex flex-col gap-2">
            {/* Opacity: −/+ dan preset (tanpa geser) */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400 w-10 flex-shrink-0">Opacity</span>
              <button onClick={() => setOpacityFor(globalIndex, op - 0.1)} className="w-5 h-5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center flex-shrink-0 text-xs">−</button>
              <span className="text-[10px] text-gray-600 tabular-nums w-8 text-center flex-shrink-0">{opPct}%</span>
              <button onClick={() => setOpacityFor(globalIndex, op + 0.1)} className="w-5 h-5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center flex-shrink-0 text-xs">+</button>
              <div className="flex gap-0.5 ml-1">
                {[25, 50, 75, 100].map(p => (
                  <button key={p} onClick={() => setOpacityFor(globalIndex, p / 100)}
                    className={`text-[8px] px-1 py-0.5 rounded border transition-all ${opPct === p ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>{p}</button>
                ))}
              </div>
            </div>
            {/* Garis tepi: tebal + Tanpa + warna stroke */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400 w-10 flex-shrink-0">Garis</span>
              <div className="flex gap-1 items-center flex-wrap">
                <button onClick={() => applyStyle(globalIndex, { strokeWidth: 0 })}
                  className={`text-[9px] px-2 py-0.5 rounded border transition-all ${l.style.strokeWidth < 0.01 ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>Tanpa</button>
                {GARIS_PRESET.map(g => (
                  <button key={g.label} onClick={() => applyStyle(globalIndex, { strokeWidth: g.w })}
                    className={`text-[9px] px-2 py-0.5 rounded border transition-all ${Math.abs(l.style.strokeWidth - g.w) < 0.01 ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>{g.label}</button>
                ))}
                {/* Warna garis */}
                <div className="relative w-5 h-5 flex-shrink-0 ml-0.5" title="Warna garis">
                  <div className="w-5 h-5 rounded border border-gray-200 flex items-center justify-center" style={{ background: l.style.strokeWidth < 0.01 ? '#fff' : l.style.strokeColor }}>
                    {l.style.strokeWidth < 0.01 && <span className="text-[8px] text-gray-300">—</span>}
                  </div>
                  <input type="color" value={l.style.strokeColor || '#ffffff'}
                    onChange={e => applyStyle(globalIndex, { strokeColor: e.target.value, strokeWidth: l.style.strokeWidth < 0.01 ? 1 : l.style.strokeWidth })}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{ padding: 0, border: 0 }} />
                </div>
              </div>
            </div>
            {/* Label */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400 w-10 flex-shrink-0">Label</span>
              <button onClick={() => applyStyle(globalIndex, { showLabels: !l.style.showLabels })}
                className={`text-[9px] px-2.5 py-0.5 rounded border font-medium transition-all ${l.style.showLabels ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>{l.style.showLabels ? 'ON' : 'OFF'}</button>
            </div>
          </div>
        )}

        {/* DAFTAR KELAS — hanya muncul saat gear diklik */}
        {isTiered && l.showStylePanel && (
          <div className="mx-2 mb-2 pt-1.5 border-t border-gray-100 flex flex-col gap-1">
            {sortSubLayers(l.subLayers).map((sl) => {
              const si = l.subLayers.indexOf(sl)
              return (
              <div key={sl.tingkat} className={`flex items-center gap-1.5 ${!sl.visible ? 'opacity-40' : ''}`}>
                <button onClick={() => toggleSubLayer(globalIndex, si)} title={sl.visible ? 'Sembunyikan kelas' : 'Tampilkan kelas'}
                  className="w-4 h-4 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 flex-shrink-0">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    {sl.visible
                      ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>
                      : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />}
                  </svg>
                </button>
                <div className="relative w-3 h-3 flex-shrink-0" title="Ganti warna kelas">
                  <div className="w-3 h-3 rounded-sm border border-black/10" style={{ background: sl.warna }} />
                  <input type="color" value={sl.warna}
                    onChange={e => {
                      const w = e.target.value
                      const updated = [...layers]
                      updated[globalIndex] = { ...l, subLayers: l.subLayers.map(s => s.tingkat === sl.tingkat ? { ...s, warna: w } : s) }
                      ;(sl.layer as any).setStyle?.({ fillColor: w })
                      ;(sl.layer as any).eachLayer?.((c: any) => {
                        if (c._icon) {
                          c._icon.querySelectorAll('div').forEach((d: any) => { if (d.style.background) d.style.background = w })
                          c._icon.querySelectorAll('polygon, path, circle, rect').forEach((p: any) => p.setAttribute('fill', w))
                        }
                      })
                      setLayers(updated)
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" style={{ padding: 0, border: 0 }} />
                </div>
                <span className="text-[10px] text-gray-600 capitalize flex-1 truncate">{sl.tingkat}</span>
              </div>
              )
            })}
          </div>
        )}

        {/* Daftar wilayah (administrasi) — juga di balik gear */}
        {isAdmin && l.showStylePanel && !isTiered && (() => {
          const names = getWilayahNames(l)
          if (!names.length) return null
          const hidden = hiddenWilayah[l.info.id] || []
          const allHidden = hidden.length >= names.length
          const tampil = names.length - hidden.length
          const cari = (wilayahCari[l.info.id] || '').toLowerCase()
          const terfilter = cari ? names.filter(n => n.toLowerCase().includes(cari)) : names
          const setHanya = (nama: string) => {
            const target = names.filter(n => n !== nama)
            setHiddenWilayah(prev => ({ ...prev, [l.info.id]: target }))
            const gjl = l.layer as any
            if (gjl?.eachLayer) gjl.eachLayer((child: any) => {
              const props = child.feature?.properties || {}
              const nf = detectNamaFieldMap(props)
              const childNama = nf ? String(props[nf]) : ''
              const el = child._path
              if (el) el.style.display = childNama === nama ? '' : 'none'
              if (child._icon) child._icon.style.display = childNama === nama ? '' : 'none'
            })
          }
          return (
            <div className="mx-2 mb-2 pt-2 border-t border-gray-100">
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                {/* Header wilayah */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 border-b border-gray-100">
                  <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                  <span className="text-[10px] font-semibold text-gray-600 flex-1">Wilayah</span>
                  <span className="text-[9px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full tabular-nums">{tampil}/{names.length}</span>
                </div>
                {/* Pencarian */}
                <div className="px-2 py-1.5 border-b border-gray-100">
                  <div className="flex items-center gap-1.5 bg-gray-50 rounded-md px-2 py-1">
                    <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                    <input value={wilayahCari[l.info.id] || ''} onChange={e => setWilayahCari(prev => ({ ...prev, [l.info.id]: e.target.value }))}
                      placeholder="Cari wilayah..." className="bg-transparent text-[10px] text-gray-700 flex-1 outline-none placeholder:text-gray-400" />
                    {cari && <button onClick={() => setWilayahCari(prev => ({ ...prev, [l.info.id]: '' }))} className="text-gray-300 hover:text-gray-500 text-[11px] leading-none flex-shrink-0">✕</button>}
                  </div>
                </div>
                {/* Aksi cepat */}
                <div className="flex items-center gap-2 px-2.5 py-1 border-b border-gray-100">
                  <button onClick={() => {
                    setHiddenWilayah(prev => ({ ...prev, [l.info.id]: [] }))
                    const gjl = l.layer as any
                    if (gjl?.eachLayer) gjl.eachLayer((child: any) => { const el = child._path; if (el) el.style.display = ''; if (child._icon) child._icon.style.display = '' })
                  }} className="text-[9px] text-blue-600 hover:underline">Tampilkan semua</button>
                  <span className="text-gray-200">·</span>
                  <button onClick={() => {
                    setHiddenWilayah(prev => ({ ...prev, [l.info.id]: [...names] }))
                    const gjl = l.layer as any
                    if (gjl?.eachLayer) gjl.eachLayer((child: any) => { const el = child._path; if (el) el.style.display = 'none'; if (child._icon) child._icon.style.display = 'none' })
                  }} className="text-[9px] text-gray-500 hover:underline">Sembunyikan semua</button>
                </div>
                {/* Daftar */}
                <div className="max-h-44 overflow-y-auto py-0.5">
                  {terfilter.length === 0 && <p className="text-[10px] text-gray-400 text-center py-3">Tidak ditemukan</p>}
                  {terfilter.map(nama => {
                    const aktif = !hidden.includes(nama)
                    return (
                      <div key={nama} className="group flex items-center gap-2 px-2.5 py-1 hover:bg-blue-50/50 transition-all">
                        <button onClick={() => toggleWilayahVisibility(l, nama)}
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border transition-all ${aktif ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                          {aktif && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
                        </button>
                        <span className={`text-[10px] flex-1 truncate ${aktif ? 'text-gray-700' : 'text-gray-400'}`}>{nama}</span>
                        <button onClick={() => setHanya(nama)} title="Tampilkan hanya wilayah ini"
                          className="text-[8px] text-blue-600 opacity-0 group-hover:opacity-100 hover:underline flex-shrink-0 transition-all">hanya ini</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}
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

      {/* ── ICON RAIL (kiri) — 3 ikon ── */}
      <div className={`absolute z-[1002] flex flex-col items-center gap-1 bg-blue-950 shadow-xl ${compact ? 'rounded-xl py-1.5 px-1' : 'rounded-2xl py-2.5 px-1.5'}`}
        style={{ top: compact ? 8 : 12, left: compact ? 8 : 12 }}>
        {([
          { key: 'layer', label: 'Layer', d: 'M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3' },
          { key: 'basemap', label: 'Peta', d: 'M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z' },
          { key: 'analisis', label: 'Analisis', d: 'M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z' },
        ] as { key: 'layer'|'basemap'|'analisis'; label: string; d: string }[]).map(it => (
          <button key={it.key} title={it.label}
            onClick={() => setActiveFlyout(prev => prev === it.key ? null : it.key)}
            className={`rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${compact ? 'w-8 h-8' : 'w-10 h-10'}
              ${activeFlyout === it.key ? 'bg-white text-blue-950' : 'text-blue-200 hover:bg-white/10'}`}>
            <svg className={compact ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'} width={compact ? 14 : 18} height={compact ? 14 : 18} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d={it.d} />
            </svg>
            <span className={`font-semibold leading-none ${compact ? 'text-[6px]' : 'text-[7px]'}`}>{it.label}</span>
          </button>
        ))}
      </div>

      {/* ── TOMBOL INTIP PETA DASAR (toggle) — muncul saat ada layer aktif ── */}
      {layers.length > 0 && !activeFlyout && (
        <button onClick={togglePeekBasemap} title={peekBasemap ? 'Tampilkan kembali layer' : 'Sembunyikan semua layer untuk lihat peta dasar'}
          className={`absolute z-[1001] flex items-center gap-1.5 rounded-full shadow-lg font-semibold transition-all
            ${compact ? 'text-[9px] px-2.5 py-1' : 'text-[11px] px-3.5 py-1.5'}
            ${peekBasemap ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-white/95 backdrop-blur text-gray-700 border border-gray-200 hover:bg-gray-50'}`}
          style={{ top: compact ? 8 : 12, left: compact ? 52 : 68 }}>
          <svg className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {peekBasemap
              ? <><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></>
              : <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />}
          </svg>
          {peekBasemap ? 'Tampilkan Layer' : 'Intip Peta Dasar'}
        </button>
      )}
      {toolActive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] bg-amber-500 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          {activeMenu === 'ukur' ? 'Mode Ukur — klik di peta' : 'Mode Elevasi — klik di peta'}
        </div>
      )}

      {/* ── FLYOUT PANEL (muncul di samping rail saat activeFlyout != null) ── */}
      <div className="absolute top-0 z-[1000] h-full transition-all duration-300 ease-in-out"
        style={{ left: compact ? 54 : 76, opacity: activeFlyout ? 1 : 0, transform: activeFlyout ? 'translateX(0)' : 'translateX(-12px)', pointerEvents: activeFlyout ? 'auto' : 'none' }}>
        <div className={`${compact ? 'w-[280px] my-2 rounded-xl' : 'w-[290px] my-3 rounded-2xl'} flex flex-col bg-white border border-gray-200 shadow-xl overflow-hidden`} style={{ maxHeight: compact ? 'calc(125% - 20px)' : 'calc(100% - 24px)', zoom: compact ? 0.8 : 1 }}>

          {/* Header flyout dinamis */}
          <div className={`border-b border-gray-100 flex items-center gap-2.5 flex-shrink-0 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
            <div className={`rounded-lg bg-blue-950 flex items-center justify-center flex-shrink-0 ${compact ? 'w-6 h-6' : 'w-8 h-8'}`}>
              <svg className={compact ? 'w-3 h-3 text-white' : 'w-4 h-4 text-white'} fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-gray-800 leading-tight ${compact ? 'text-[11px]' : 'text-[13px]'}`}>
                {activeFlyout === 'layer' ? 'Layer' : activeFlyout === 'basemap' ? 'Peta Dasar' : 'Analisis Spasial'}
              </p>
              {!compact && <p className="text-[10px] text-gray-400">Lampung Edu Gisaster</p>}
            </div>
            <button onClick={() => setActiveFlyout(null)} title="Tutup"
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Wilayah — tampil di flyout Layer & Basemap */}
          {(activeFlyout === 'layer' || activeFlyout === 'basemap') && (
          <div className="px-4 py-2.5 border-b border-gray-100 flex-shrink-0">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Wilayah</p>
            <select className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/20 appearance-none cursor-pointer"
              onChange={(e) => setSelectedKabupaten(Number(e.target.value))} value={selectedKabupaten || ''}>
              <option value="">Pilih Kabupaten / Kota</option>
              {kabupatenList.map(kab => <option key={kab.id} value={kab.id}>{kab.nama}</option>)}
            </select>
          </div>
          )}

          {/* Basemap — hanya di flyout Basemap */}
          {activeFlyout === 'basemap' && (
          <div className="px-4 py-2.5 flex-shrink-0 overflow-y-auto">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pilih Peta Dasar</p>
            <div className="grid grid-cols-2 gap-2">
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
                  <img src={bm.thumb} alt={bm.label} className="w-full h-12 object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <div className={`absolute inset-0 flex items-end justify-center pb-0.5 ${activeBasemap === bm.id ? 'bg-blue-600/30' : 'bg-black/25'}`}>
                    <span className="text-white text-[9px] font-bold drop-shadow">{bm.label}</span>
                  </div>
                </button>
              ))}
            </div>
            {/* Label Jalan & POI toggle */}
            <button onClick={() => { setShowGoogleLabels(!showGoogleLabels); setGoogleLabelsVisible(true) }}
              className={`w-full mt-3 flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all border
                ${showGoogleLabels ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-100'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${showGoogleLabels ? 'border-blue-600 bg-blue-600' : 'border-gray-300'}`}>
                {showGoogleLabels && <span className="text-white text-[8px]">✓</span>}
              </div>
              <span className="text-[11px] text-gray-700 flex-1">Label Jalan & POI</span>
            </button>
          </div>
          )}

          {/* Konten Layer / Analisis */}
          {(activeFlyout === 'layer' || activeFlyout === 'analisis') && (
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* ── LAYER (dua tab: Layer Aktif & Pilih Layer) ── */}
            {activeFlyout === 'layer' && (
              <div className="flex flex-col">
                {/* Tab switcher */}
                <div className="flex gap-1 px-3 pt-3 pb-2 sticky top-0 bg-white z-10 border-b border-gray-100">
                  <button onClick={() => setLayerTab('aktif')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all
                      ${layerTab === 'aktif' ? 'bg-blue-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    Layer Aktif
                    {layers.length > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full leading-none ${layerTab === 'aktif' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'}`}>{layers.length}</span>
                    )}
                  </button>
                  <button onClick={() => setLayerTab('pilih')}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all
                      ${layerTab === 'pilih' ? 'bg-blue-950 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    Pilih Layer
                  </button>
                </div>

                {/* TAB: Layer Aktif */}
                {layerTab === 'aktif' && (
                  <div className="px-4 py-3">
                    {layers.length > 0 ? (
                      <>
                        {/* Aksi cepat visibilitas */}
                        <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-gray-100">
                          <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider flex-1">Tampilan</span>
                          <button onClick={() => setSemuaLayerVisible(true)}
                            className="text-[9px] font-medium text-blue-700 hover:bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md transition-all">Tampilkan semua</button>
                          <button onClick={() => setSemuaLayerVisible(false)}
                            className="text-[9px] font-medium text-gray-500 hover:bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md transition-all">Sembunyikan semua</button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {layers.map(l => renderLayerCard(l))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 px-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" /></svg>
                        </div>
                        <p className="text-[11px] text-gray-500 font-medium mb-1">Belum ada layer aktif</p>
                        <p className="text-[10px] text-gray-400 mb-3">Buka "Pilih Layer" untuk menambahkan layer ke peta.</p>
                        <button onClick={() => setLayerTab('pilih')}
                          className="text-[11px] font-semibold text-white bg-blue-950 hover:bg-blue-900 px-4 py-1.5 rounded-lg transition-all">
                          + Pilih Layer
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: Pilih Layer (katalog) */}
                {layerTab === 'pilih' && (
                  <div className="px-4 py-3">
                    {availableLayers.length > 0 ? (
                      <>
                        <p className="text-[10px] text-gray-400 mb-2">Centang layer untuk menampilkannya di peta.</p>
                        {(['administrasi', 'fasilitas', 'faktor', 'bencana'] as const).map(kat => {
                          const group = availableLayers.filter((l: any) => {
                            const k = l.jenis_bencana?.kategori || 'bencana'
                            return kat === 'bencana' ? !['administrasi','fasilitas','faktor'].includes(k) : k === kat
                          })
                          if (!group.length) return null
                          return (
                            <div key={kat} className="mb-2.5">
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
                        {layers.length > 0 && (
                          <button onClick={() => setLayerTab('aktif')}
                            className="w-full mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 py-1.5 rounded-lg transition-all">
                            Lihat Layer Aktif ({layers.length})
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-[11px] text-gray-400">{selectedKabupaten ? 'Tidak ada layer tersedia' : 'Pilih wilayah dulu untuk melihat layer'}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ANALISIS SPASIAL ── */}
            {activeFlyout === 'analisis' && (
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
                            onRequestActivateLayer={() => setActiveFlyout('layer')}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

          </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 flex-shrink-0">
            <p className="text-[9px] text-gray-300 text-center">FKIP Universitas Lampung · WGS84</p>
          </div>
        </div>
      </div>

      {/* ── PANEL LAMA (disembunyikan, dipertahankan agar tidak merusak struktur) ── */}
      <div className="hidden">
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
        compact={compact}
        bottomOffset={compact ? 8 : 12}
        onCopy={() => {
          if (!clickCoord) return
          navigator.clipboard.writeText(`${clickCoord.lat.toFixed(6)}, ${clickCoord.lng.toFixed(6)}`)
          setCoordCopied(true); setTimeout(() => setCoordCopied(false), 2000)
        }}
        onClear={() => setClickCoord(null)} />

      {/* ── HASIL ANALISIS: KOTAK RINGKASAN KECIL (kiri bawah, DI ATAS status bar) ── */}
      {hasilLayers.length > 0 && (
        <div className="absolute z-[999] transition-all duration-300 ease-in-out"
          style={{ left: activeFlyout ? (compact ? '280px' : '392px') : (compact ? '52px' : '88px'), bottom: compact ? 34 : 52, maxWidth: compact ? '280px' : '280px', zoom: compact ? 0.8 : 1 }}>
          {hasilLayers.map(hl => {
            const mode = hl.meta?.mode
            // Hitung headline ringkas per mode
            let headline = ''
            let sub = ''
            if (mode === 'fasilitas') {
              const rows = hl.meta?.fasilitasRows || []
              headline = `${rows.length} fasilitas terdampak`
              const perLayer = [...new Set(rows.map(r => r.layerNama))]
              sub = perLayer.length > 1 ? `${perLayer.length} jenis fasilitas` : (perLayer[0] || '')
            } else if (mode === 'faktor') {
              const rows = hl.meta?.faktorRows || []
              const top = [...rows].sort((a, b) => b.persen - a.persen)[0]
              headline = top ? `${top.label}: ${top.persen}%` : 'Analisis faktor'
              sub = 'proporsi tertinggi di zona bahaya'
            } else {
              let total = 0
              hl.subLayers.forEach(sl => { try { total += (sl.layer as any).toGeoJSON?.()?.features?.length ?? 0 } catch (_) {} })
              headline = `${hl.subLayers.length} kelas hasil overlay`
              sub = total > 0 ? `${total} fitur` : ''
            }
            return (
              <div key={hl.info.id} className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {/* Baris ringkas */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75 2.25 12l4.179 2.25m0-4.5 5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0 4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0-5.571 3-5.571-3" /></svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-gray-800 leading-tight truncate">{headline}</p>
                    {sub && <p className="text-[9px] text-gray-400 leading-tight truncate">{sub}</p>}
                  </div>
                  <button onClick={() => setHasilSheetOpen(o => !o)} title={hasilSheetOpen ? 'Sembunyikan rincian' : 'Lihat rincian'}
                    className="text-[9px] font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-0.5 flex-shrink-0">
                    {hasilSheetOpen ? 'Tutup' : 'Rincian'}
                    <svg className={`w-3 h-3 transition-transform ${hasilSheetOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>
                  </button>
                  <button onClick={clearHasilLayer} title="Hapus hasil"
                    className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all flex-shrink-0">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Rincian (muncul saat diklik) — tetap kecil & scroll */}
                {hasilSheetOpen && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-100 max-h-[300px] overflow-y-auto" style={{ width: compact ? '210px' : '280px' }}>

                    {/* FASILITAS */}
                    {mode === 'fasilitas' && (() => {
                      const rows = hl.meta?.fasilitasRows || []
                      if (rows.length === 0) return <p className="text-[10px] text-gray-400 italic pt-2">Tidak ada fasilitas terdampak.</p>
                      const perLayer = [...new Set(rows.map(r => r.layerNama))].map(nama => ({ layerNama: nama, items: rows.filter(r => r.layerNama === nama) }))
                      return (
                        <div className="flex flex-col gap-1.5 pt-1">
                          {perLayer.map(grp => {
                            const key = `${hl.info.id}_${grp.layerNama}`
                            const isOpen = hasilExpand[key] === true
                            return (
                              <div key={grp.layerNama} className="border border-gray-100 rounded-lg overflow-hidden">
                                <button onClick={() => setHasilExpand(p => ({ ...p, [key]: !isOpen }))}
                                  className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 hover:bg-gray-100 transition-all text-left">
                                  <svg className={`w-2.5 h-2.5 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                                  <span className="text-[10px] font-semibold text-gray-700 flex-1 truncate">{grp.layerNama}</span>
                                  <span className="text-[9px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full flex-shrink-0">{grp.items.length}</span>
                                </button>
                                {isOpen && (
                                  <div className="divide-y divide-gray-50 max-h-32 overflow-y-auto">
                                    {grp.items.map((it, i) => (
                                      <div key={i} className="flex items-center gap-1.5 px-2 py-1">
                                        <span className="text-[8px] text-gray-300 w-3 text-right flex-shrink-0">{i + 1}</span>
                                        <span className="text-[10px] text-gray-600 flex-1 min-w-0 truncate">{it.nama}</span>
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

                    {/* FAKTOR — bar ringkas */}
                    {mode === 'faktor' && (() => {
                      const rows = hl.meta?.faktorRows || []
                      if (rows.length === 0) return <p className="text-[10px] text-gray-400 italic pt-2">Tidak ada data faktor.</p>
                      return (
                        <div className="flex flex-col gap-1.5 pt-2">
                          {rows.map(r => (
                            <div key={r.skor} className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/10" style={{ background: r.warna }} />
                              <span className="text-[9px] text-gray-600 w-20 flex-shrink-0 truncate" title={r.label}>{r.label}</span>
                              <div className="flex-1 h-2.5 bg-gray-100 rounded overflow-hidden min-w-[40px]">
                                <div className="h-full rounded" style={{ width: `${Math.min(r.persen, 100)}%`, background: r.warna }} />
                              </div>
                              <span className="text-[9px] font-bold tabular-nums w-8 text-right flex-shrink-0" style={{ color: r.persen >= 50 ? '#C0392B' : r.persen >= 25 ? '#E67E22' : '#64748b' }}>{r.persen}%</span>
                            </div>
                          ))}
                          <p className="text-[8px] text-gray-400 pt-1 leading-relaxed">Proporsi area tiap kelas di zona bahaya (Rawan + Sangat Rawan). Proporsi tinggi belum tentu penyebab.</p>
                        </div>
                      )
                    })()}

                    {/* ADMINISTRASI / DEFAULT — daftar kelas ringkas */}
                    {mode !== 'fasilitas' && mode !== 'faktor' && (() => {
                      const kelasStats = sortSubLayers(hl.subLayers).map(sl => {
                        let count = 0, luas = 0
                        try {
                          const gj = (sl.layer as any).toGeoJSON?.()
                          count = gj?.features?.length ?? 0
                          for (const f of (gj?.features || [])) { const v = parseFloat(f.properties?._luas_ha); if (!isNaN(v)) luas += v }
                        } catch (_) {}
                        return { tingkat: sl.tingkat, warna: sl.warna, count, luas: Math.round(luas * 10) / 10 }
                      })
                      return (
                        <div className="flex flex-col gap-1 pt-2">
                          {kelasStats.map(k => (
                            <div key={k.tingkat} className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/10" style={{ background: k.warna }} />
                              <span className="text-[10px] text-gray-700 capitalize flex-1 truncate">{k.tingkat}</span>
                              <span className="text-[9px] text-gray-400 tabular-nums flex-shrink-0">{k.luas > 0 ? `${k.luas.toLocaleString('id')} ha` : `${k.count} fitur`}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── SEARCH — pojok kanan atas ── */}
      <div className="absolute top-3 right-3 z-[1001] w-[260px]">
        <SearchControl map={mapRef.current} layers={layers} />
      </div>

      {/* ── LEGENDA READ-ONLY (kartu mengambang kanan bawah, DI ATAS tombol zoom) ── */}
      {(layers.length > 0 || showGoogleLabels) && (
        <div className={`absolute right-3 z-[1000] ${compact ? 'w-[175px]' : 'w-[180px]'}`} style={{ bottom: compact ? 66 : 92, zoom: compact ? 0.8 : 1 }}>
          <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl shadow-lg overflow-hidden select-none">
            <button onClick={() => setLegendOpen(!legendOpen)} className="w-full flex items-center justify-between px-3 py-1.5 border-b border-gray-100 hover:bg-gray-50 transition-all">
              <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">Legenda</span>
              <svg className={`w-3 h-3 text-gray-400 transition-transform ${legendOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {legendOpen && (
              <div className="px-3 py-2 max-h-[46vh] overflow-y-auto flex flex-col gap-2">
                {showGoogleLabels && (
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm flex-shrink-0 bg-gray-700 flex items-center justify-center text-white text-[7px] font-bold">A</span>
                    <span className="text-[10px] text-gray-600">Label Jalan & POI</span>
                  </div>
                )}
                {layers.map((l, lIdx) => {
                  const kat = l.info.jenis_bencana?.kategori || 'bencana'
                  const KAT_COLOR: Record<string,string> = { hasil:'text-amber-700', administrasi:'text-emerald-700', fasilitas:'text-blue-700', faktor:'text-purple-700', bencana:'text-red-700' }
                  if (!l.visible) return null
                  return (
                    <div key={`${l.info.id}-${lIdx}`}>
                      <p className={`text-[10px] font-bold mb-0.5 truncate ${KAT_COLOR[kat] || 'text-gray-700'}`}>{l.info.nama}</p>
                      {l.subLayers.length > 0 ? (
                        <div className="flex flex-col gap-0.5 pl-0.5">
                          {sortSubLayers(l.subLayers.filter(sl => sl.visible)).map((sl, si) => (
                            <div key={si} className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/10" style={{ background: sl.warna }} />
                              <span className="text-[9px] text-gray-600 capitalize truncate">{sl.tingkat}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 pl-0.5">
                          {kat === 'administrasi'
                            ? <span className="w-2.5 h-2.5 flex-shrink-0 rounded-sm bg-white" style={{ border: `2px solid ${l.style.strokeColor || '#000000'}` }} />
                            : <span className={`w-2.5 h-2.5 flex-shrink-0 border border-black/10 ${kat === 'fasilitas' ? 'rounded-full' : 'rounded-sm'}`} style={{ background: (kat==='fasilitas' ? (l.style.strokeColor || l.info.warna) : l.info.warna) || '#3388ff' }} />}
                          <span className="text-[9px] text-gray-600 truncate">{l.info.nama}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

            <div id={mapId} className="w-full" style={{ height: height || 'calc(100vh - 64px)' }} />
    </div>
  )
}