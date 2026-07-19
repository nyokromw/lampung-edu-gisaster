'use client'

import { useState } from 'react'
import L from 'leaflet'
import * as turf from '@turf/turf'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface LayerStyle { fillOpacity: number }
interface LayerState {
  info: {
    id: string; nama: string; file_url: string
    has_tingkat: boolean; field_tingkat: string
    warna?: string
    jenis_bencana: { nama: string; kategori: string }
  }
  visible: boolean
  style: LayerStyle
}

// Struktur output — harus sama dengan LayerState + SubLayer di Map.tsx
interface HasilSubLayer { tingkat: string; layer: L.GeoJSON; visible: boolean; warna: string }
interface HasilLayerStyle {
  fillOpacity: number; strokeColor: string; strokeWidth: number
  dashArray: string; showLabels: boolean; iconShape: 'circle' | 'square' | 'diamond' | 'triangle' | 'star'
}
export interface HasilLayerState {
  info: {
    id: string; nama: string; file_url: string; warna: string
    has_tingkat: boolean; field_tingkat: string
    jenis_bencana: { nama: string; kategori: string }
  }
  layer: L.GeoJSON | null
  visible: boolean
  subLayers: HasilSubLayer[]
  style: HasilLayerStyle
  showStylePanel: boolean
  meta?: HasilMeta
}

interface HasilFasilitas { nama: string; keterangan: string; tingkat?: string; layerNama: string; wilayah?: string }
interface BreakdownTingkat { tingkat: string; luas_ha: number; persen: number; warna: string }
interface HasilAdministrasi {
  namaWilayah: string
  luas_wilayah_ha: number
  total_bencana_ha: number
  breakdown: BreakdownTingkat[]
}
interface HasilFaktorBar {
  label: string
  skor: string
  warna: string
  total_ha: number
  rawan_ha: number
  persen: number
}

// Metadata hasil analisis — dibawa ke Map.tsx untuk render panel detail
// (daftar fasilitas, tabel + bar chart faktor) di bottom sheet.
export interface HasilMeta {
  mode: 'fasilitas' | 'administrasi' | 'faktor'
  fasilitasRows?: HasilFasilitas[]
  faktorRows?: HasilFaktorBar[]
  adminRows?: HasilAdministrasi[]
}

interface IntersectResult {
  type: 'fasilitas' | 'administrasi' | 'faktor'
  geojson: any
}

interface Props {
  layers: LayerState[]
  onIntersectResult?: (result: IntersectResult | null) => void
  onHasilLayer?: (layerState: HasilLayerState) => void
  onClearHasilLayer?: () => void
  onRequestActivateLayer?: () => void
  totalLuasWilayah?: number
}

type Mode = 'fasilitas' | 'administrasi' | 'faktor'
type Step = 1 | 2 | 3

// ─────────────────────────────────────────────────────────────
// Helpers (dipertahankan dari versi sebelumnya)
// ─────────────────────────────────────────────────────────────

const WARNA_TINGKAT: Record<string, string> = {
  'sangat rawan': '#C0392B', 'rawan': '#E67E22', 'agak rawan': '#F4D03F',
  'aman': '#A8D86E', 'sangat aman': '#27AE60',
  'sangat tinggi': '#C0392B', 'tinggi': '#E67E22', 'sedang': '#F4D03F',
  'rendah': '#A8D86E', 'sangat rendah': '#27AE60', 'tidak rawan': '#A8D86E',
}
function getWarna(t: string) { return WARNA_TINGKAT[t.toLowerCase()] || '#94a3b8' }

function isBahaya(t: string): boolean {
  const s = t.toLowerCase().trim()
  return s === 'sangat rawan' || s === 'rawan' || s === 'sangat tinggi' || s === 'tinggi'
}

function autoDetectField(geojson: any, fieldTingkat: string): string {
  const keys = Object.keys(geojson.features?.[0]?.properties || {})
  if (fieldTingkat && fieldTingkat !== 'tingkat' && keys.includes(fieldTingkat)) return fieldTingkat
  return keys[0] || 'tingkat'
}

function normalizeGeoJSON(geojson: any): any {
  return {
    ...geojson,
    features: geojson.features.map((f: any) => {
      if (!f.geometry) return f
      const geom = f.geometry
      let coordinates = geom.coordinates
      if (geom.type === 'Point' && coordinates.length === 3) {
        coordinates = [coordinates[0], coordinates[1]]
      } else if (geom.type === 'MultiPoint' || geom.type === 'LineString') {
        coordinates = coordinates.map((c: number[]) => c.length === 3 ? [c[0], c[1]] : c)
      } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
        coordinates = coordinates.map((ring: number[][]) => ring.map((c: number[]) => c.length === 3 ? [c[0], c[1]] : c))
      } else if (geom.type === 'MultiPolygon') {
        coordinates = coordinates.map((poly: number[][][]) => poly.map((ring: number[][]) => ring.map((c: number[]) => c.length === 3 ? [c[0], c[1]] : c)))
      }
      return { ...f, geometry: { ...geom, coordinates } }
    })
  }
}

function autoDetectNamaField(properties: Record<string, any>): string | null {
  const nameKeys = ['nama', 'name', 'NAMA', 'NAME', 'KECAMATAN', 'KELURAHAN', 'kecamatan', 'kelurahan', 'WADMKC', 'WADMKD', 'NAMOBJ']
  for (const k of nameKeys) { if (properties[k]) return k }
  const strKey = Object.keys(properties).find(k => typeof properties[k] === 'string' && properties[k].length > 1 && properties[k].length < 60)
  return strKey || null
}

function simp(f: any): any {
  try { return turf.simplify(f, { tolerance: 0.0001, highQuality: false }) } catch (_) { return f }
}
function bboxOverlap(a: number[], b: number[]): boolean {
  return !(b[2] < a[0] || b[0] > a[2] || b[3] < a[1] || b[1] > a[3])
}
function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// Urutan sortir kelas hasil (aman → bahaya)
const URUTAN_KELAS = ['sangat aman', 'aman', 'tidak rawan', 'sangat rendah', 'rendah', 'agak rawan', 'sedang', 'tinggi', 'rawan', 'sangat rawan', 'sangat tinggi']
function sortKelas(a: string, b: string): number {
  const ia = URUTAN_KELAS.findIndex(u => a.toLowerCase().includes(u))
  const ib = URUTAN_KELAS.findIndex(u => b.toLowerCase().includes(u))
  if (ia !== -1 && ib !== -1) return ia - ib
  const na = parseFloat(a), nb = parseFloat(b)
  if (!isNaN(na) && !isNaN(nb)) return na - nb
  return a.localeCompare(b)
}

// Marker titik hasil — konsisten dengan createPointMarker (bentuk circle) di Map.tsx.
// Ukuran tetap 12px karena layer belum di-add ke map saat dibuat (tidak ada akses zoom).
function createHasilPointMarker(latlng: L.LatLng, warna: string): L.Marker {
  const s = 12
  const html = `<div style="width:${s}px;height:${s}px;border-radius:50%;background:${warna};border:2px solid rgba(255,255,255,0.9);box-shadow:0 1px 3px rgba(0,0,0,0.35)"></div>`
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

// Group intersectFeatures per kelas → HasilLayerState siap kirim ke Map.tsx.
// PENTING: L.geoJSON dibuat di sini tapi TIDAK di-addTo(map) — Map.tsx yang menambahkan.
function buildHasilLayerState(
  nama: string,
  features: any[],
  groupKey: '_tingkat' | '_kelas',
  geomType: 'point' | 'polygon',
): HasilLayerState {
  const byKelas: Record<string, { warna: string; features: any[] }> = {}
  for (const f of features) {
    const kelas = String(f.properties?.[groupKey] ?? 'Hasil')
    if (!byKelas[kelas]) byKelas[kelas] = { warna: f.properties?._warna || '#FEFB00', features: [] }
    byKelas[kelas].features.push(f)
  }

  const subLayers: HasilSubLayer[] = Object.entries(byKelas)
    .sort((a, b) => sortKelas(a[0], b[0]))
    .map(([kelas, { warna, features: feats }]) => {
      const fc = { type: 'FeatureCollection', features: feats }
      const layer = geomType === 'point'
        ? L.geoJSON(fc as any, {
            pointToLayer: (_f: any, latlng: L.LatLng) => createHasilPointMarker(latlng, warna),
            onEachFeature: (feature, lyr) => {
              const p = feature.properties || {}
              lyr.bindPopup(`<div style="font-family:system-ui;font-size:12px"><b>${p.nama || 'Fasilitas'}</b><br/><span style="color:#555">Tingkat: <b>${p._tingkat || '-'}</b></span></div>`)
            },
          })
        : L.geoJSON(fc as any, {
            style: { fillColor: warna, fillOpacity: 0.6, weight: 0.5, color: '#ffffff' },
            onEachFeature: (feature, lyr) => {
              const p = feature.properties || {}
              lyr.bindPopup(p._namaWilayah
                ? `<div style="font-family:system-ui;font-size:12px"><b>${p._namaWilayah}</b><br/><span style="color:#555">Tingkat: <b>${p._tingkat}</b></span><br/><span style="color:#555">Luas: ${p._luas_ha} ha</span></div>`
                : `<div style="font-family:system-ui;font-size:12px"><b>${p._kelas || 'Hasil'}</b><br/><span style="color:#555">Tingkat: <b>${p._tingkat || '-'}</b></span></div>`)
            },
          })
      return { tingkat: kelas, layer, visible: true, warna }
    })

  return {
    info: {
      id: `overlay_${Date.now()}`,
      nama,
      file_url: '',
      warna: '#FEFB00',
      has_tingkat: true,
      field_tingkat: groupKey,
      jenis_bencana: { nama: 'Hasil Analisis', kategori: 'hasil' },
    },
    layer: null,
    visible: true,
    subLayers,
    style: { fillOpacity: geomType === 'point' ? 1 : 0.6, strokeColor: '#ffffff', strokeWidth: 0.5, dashArray: '', showLabels: false, iconShape: 'circle' },
    showStylePanel: false,
  }
}

// ─────────────────────────────────────────────────────────────
// Komponen
// ─────────────────────────────────────────────────────────────

const MODE_CARDS: { mode: Mode; icon: string; judul: string; desc: string }[] = [
  { mode: 'fasilitas', icon: '🏥', judul: 'Fasilitas Terdampak', desc: 'Cari sekolah, rumah sakit, dan fasilitas lain yang berada di zona bencana' },
  { mode: 'administrasi', icon: '🗺️', judul: 'Wilayah Terdampak', desc: 'Hitung luas zona bencana di setiap kecamatan' },
  { mode: 'faktor', icon: '📊', judul: 'Faktor Penyebab', desc: 'Lihat kelas faktor mana yang paling berhubungan dengan zona bahaya' },
]

export default function OverlayControl({ layers, onIntersectResult, onHasilLayer, onClearHasilLayer, onRequestActivateLayer }: Props) {
  // ── Wizard ──
  const [step, setStep] = useState<Step>(1)
  const [mode, setMode] = useState<Mode | null>(null)

  // ── Bencana ──
  const [selectedBencana, setSelectedBencana] = useState('')
  const [bencanaGeoJSON, setBencanaGeoJSON] = useState<any>(null)
  const [loadingBencana, setLoadingBencana] = useState(false)
  const [detectedField, setDetectedField] = useState('')
  const [tingkatOptions, setTingkatOptions] = useState<string[]>([])
  const [selectedTingkatList, setSelectedTingkatList] = useState<string[]>([])

  // ── Fasilitas (multi) ──
  const [selectedFasilitasIds, setSelectedFasilitasIds] = useState<string[]>([])

  // ── Faktor ──
  const [selectedFaktor, setSelectedFaktor] = useState('')
  const [faktorGeoJSON, setFaktorGeoJSON] = useState<any>(null)

  // ── Administrasi ──
  const [selectedAdmin, setSelectedAdmin] = useState('')
  const [adminGeoJSON, setAdminGeoJSON] = useState<any>(null)
  const [adminWilayahOptions, setAdminWilayahOptions] = useState<string[]>([])
  const [selectedWilayah, setSelectedWilayah] = useState<string[]>([])

  // ── Result ──
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [hasilFasilitas, setHasilFasilitas] = useState<HasilFasilitas[]>([])
  const [hasilAdmin, setHasilAdmin] = useState<HasilAdministrasi[]>([])
  const [hasilFaktor, setHasilFaktor] = useState<HasilFaktorBar[]>([])
  const [sudahAnalisis, setSudahAnalisis] = useState(false)
  const [ringkasan, setRingkasan] = useState('')

  const bencanaLayers = layers.filter(l => l.info.jenis_bencana?.kategori === 'bencana')
  const fasilitasLayers = layers.filter(l => l.info.jenis_bencana?.kategori === 'fasilitas')
  const adminLayers = layers.filter(l => l.info.jenis_bencana?.kategori === 'administrasi')
  const faktorLayers = layers.filter(l => l.info.jenis_bencana?.kategori === 'faktor')

  const resetHasil = () => {
    setHasilFasilitas([]); setHasilAdmin([]); setHasilFaktor([])
    setSudahAnalisis(false); setProgress(''); setRingkasan('')
    onIntersectResult?.(null)
  }

  // Reset penuh: kembali ke langkah 1, kosongkan semua pilihan, hapus layer hasil dari peta
  const resetAnalisis = () => {
    resetHasil()
    setStep(1); setMode(null)
    setSelectedBencana(''); setBencanaGeoJSON(null); setDetectedField('')
    setTingkatOptions([]); setSelectedTingkatList([])
    setSelectedFasilitasIds([])
    setSelectedFaktor(''); setFaktorGeoJSON(null)
    setSelectedAdmin(''); setAdminGeoJSON(null)
    setAdminWilayahOptions([]); setSelectedWilayah([])
    onClearHasilLayer?.()
  }

  // Kirim hasil ke Map.tsx — prioritas onHasilLayer (sistem layer); fallback ke
  // onIntersectResult untuk kompatibilitas jika Map.tsx belum di-update.
  const kirimHasil = (state: HasilLayerState, type: IntersectResult['type'], geojson: any) => {
    if (onHasilLayer) {
      onClearHasilLayer?.() // ganti hasil lama dengan yang baru
      onHasilLayer(state)
    } else {
      onIntersectResult?.({ type, geojson })
    }
  }

  // ── Load bencana ──
  const handlePilihBencana = async (id: string) => {
    setSelectedBencana(id); setBencanaGeoJSON(null); setDetectedField('')
    setTingkatOptions([]); setSelectedTingkatList([])
    resetHasil()
    if (!id) return
    const layer = layers.find(l => l.info.id === id)
    if (!layer) return
    setLoadingBencana(true)
    try {
      const geojson = normalizeGeoJSON(await fetch(layer.info.file_url).then(r => r.json()))
      setBencanaGeoJSON(geojson)
      const field = autoDetectField(geojson, layer.info.field_tingkat)
      setDetectedField(field)
      const vals = [...new Set(geojson.features.map((f: any) => f.properties?.[field]).filter(Boolean))] as string[]
      setTingkatOptions(vals)
    } catch (e) { console.error('Gagal load bencana:', e) }
    setLoadingBencana(false)
  }

  // ── Load administrasi ──
  const handlePilihAdmin = async (id: string) => {
    setSelectedAdmin(id); setAdminGeoJSON(null)
    setAdminWilayahOptions([]); setSelectedWilayah([])
    resetHasil()
    if (!id) return
    const layer = layers.find(l => l.info.id === id)
    if (!layer) return
    try {
      const geojson = normalizeGeoJSON(await fetch(layer.info.file_url).then(r => r.json()))
      setAdminGeoJSON(geojson)
      const namaList: string[] = []
      for (const f of geojson.features) {
        const nf = autoDetectNamaField(f.properties)
        if (nf && f.properties[nf]) namaList.push(String(f.properties[nf]))
      }
      setAdminWilayahOptions([...new Set(namaList)].sort())
    } catch (e) { console.error('Gagal load admin:', e) }
  }

  // ── Load faktor ──
  const handlePilihFaktor = async (id: string) => {
    setSelectedFaktor(id); setFaktorGeoJSON(null)
    resetHasil()
    if (!id) return
    const layer = layers.find(l => l.info.id === id)
    if (!layer) return
    try {
      const geojson = normalizeGeoJSON(await fetch(layer.info.file_url).then(r => r.json()))
      setFaktorGeoJSON(geojson)
    } catch (e) { console.error('Gagal load faktor:', e) }
  }

  const toggleTingkat = (t: string) =>
    setSelectedTingkatList(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const toggleFasilitas = (id: string) =>
    setSelectedFasilitasIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleWilayah = (nama: string) =>
    setSelectedWilayah(prev => prev.includes(nama) ? prev.filter(n => n !== nama) : [...prev, nama])

  const getSelectedAdminFeatures = () => {
    if (!adminGeoJSON) return []
    return adminGeoJSON.features.filter((f: any) => {
      if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) return false
      if (selectedWilayah.length === 0) return true
      const nf = autoDetectNamaField(f.properties)
      return nf && selectedWilayah.includes(String(f.properties[nf]))
    })
  }

  const clipToAdmin = (features: any[]): any[] => {
    if (!selectedAdmin || !adminGeoJSON || selectedWilayah.length === 0) return features
    const adminFeats = getSelectedAdminFeatures().map(simp)
    if (!adminFeats.length) return features
    const adminBboxes = adminFeats.map((a: any) => turf.bbox(a))
    const out: any[] = []
    for (const f of features) {
      let fb: number[]
      try { fb = turf.bbox(f) } catch (_) { continue }
      for (let i = 0; i < adminFeats.length; i++) {
        if (!bboxOverlap(adminBboxes[i], fb)) continue
        try {
          const inter = turf.intersect(turf.featureCollection([f, adminFeats[i]]))
          if (inter) out.push({ ...inter, properties: f.properties })
        } catch (_) {}
      }
    }
    return out
  }

  // ═══════════ MODE 1: BENCANA × FASILITAS ═══════════
  const analisisFasilitas = async () => {
    if (!selectedBencana || selectedFasilitasIds.length === 0 || !bencanaGeoJSON) return
    setLoading(true); resetHasil()
    try {
      const field = detectedField || autoDetectField(bencanaGeoJSON, '')

      let polygons = bencanaGeoJSON.features.filter((f: any) => {
        if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) return false
        return selectedTingkatList.length === 0 || selectedTingkatList.includes(f.properties?.[field])
      })

      if (selectedWilayah.length > 0) {
        setProgress('Memotong bencana ke wilayah terpilih...')
        await sleep(10)
        polygons = clipToAdmin(polygons)
      }

      const adminFeats = (selectedAdmin && adminGeoJSON) ? getSelectedAdminFeatures() : []

      const terdampak: HasilFasilitas[] = []
      const intersectFeatures: any[] = []

      for (let li = 0; li < selectedFasilitasIds.length; li++) {
        const fL = layers.find(l => l.info.id === selectedFasilitasIds[li])
        if (!fL) continue
        setProgress(`Memuat ${fL.info.nama}...`)
        const fasGeo = normalizeGeoJSON(await fetch(fL.info.file_url).then(r => r.json()))
        const seenCoords = new Set<string>()

        for (let pi = 0; pi < polygons.length; pi++) {
          if (pi % 10 === 0) {
            setProgress(`${fL.info.nama}: polygon ${pi + 1}/${polygons.length}`)
            await sleep(0)
          }
          const polygon = polygons[pi]
          for (const titik of fasGeo.features) {
            if (titik.geometry?.type !== 'Point') continue
            try {
              if (!turf.booleanPointInPolygon(titik, polygon)) continue
              const coords = titik.geometry.coordinates.join(',')
              if (seenCoords.has(coords)) continue
              seenCoords.add(coords)

              const namaField = autoDetectNamaField(titik.properties)
              const nama = (namaField ? titik.properties[namaField] : null) || 'Tanpa nama'
              const ketField = ['keterangan', 'REMARK', 'remark', 'desc', 'DESC', 'type', 'TYPE'].find(k => titik.properties?.[k])
              const tingkat = polygon.properties?.[field] || ''

              let wilayah = ''
              for (const a of adminFeats) {
                try {
                  if (turf.booleanPointInPolygon(titik, a)) {
                    const nf = autoDetectNamaField(a.properties)
                    wilayah = nf ? String(a.properties[nf]) : ''
                    break
                  }
                } catch (_) {}
              }

              terdampak.push({
                nama, keterangan: ketField ? titik.properties[ketField] : '',
                tingkat, layerNama: fL.info.nama, wilayah
              })
              intersectFeatures.push({
                type: 'Feature', geometry: titik.geometry,
                properties: { ...titik.properties, nama, _tingkat: tingkat, _warna: getWarna(tingkat) }
              })
            } catch (_) {}
          }
        }
      }

      terdampak.sort((a, b) => a.layerNama.localeCompare(b.layerNama) || (a.wilayah || '').localeCompare(b.wilayah || ''))
      setHasilFasilitas(terdampak)
      setSudahAnalisis(true)
      setProgress('')
      setRingkasan(terdampak.length === 0 ? 'Tidak ada fasilitas terdampak' : `${terdampak.length} fasilitas terdampak ditemukan`)

      const bencanaNama = layers.find(l => l.info.id === selectedBencana)?.info.nama || 'Bencana'
      const geojson = { type: 'FeatureCollection', features: intersectFeatures }
      const state = buildHasilLayerState(`Hasil: ${bencanaNama} × Fasilitas`, intersectFeatures, '_tingkat', 'point')
      state.meta = { mode: 'fasilitas', fasilitasRows: terdampak }
      kirimHasil(state, 'fasilitas', geojson)
    } catch (e) { console.error('Gagal analisis fasilitas:', e) }
    setLoading(false)
  }

  // ═══════════ MODE 2: BENCANA × ADMINISTRASI ═══════════
  const analisisAdministrasi = async () => {
    if (!selectedBencana || !selectedAdmin || !bencanaGeoJSON || !adminGeoJSON) return
    setLoading(true); resetHasil()
    try {
      const field = detectedField || autoDetectField(bencanaGeoJSON, '')

      const bencanaFeatures = bencanaGeoJSON.features
        .filter((f: any) => ['Polygon', 'MultiPolygon'].includes(f.geometry?.type))
        .map(simp)
      const bencanaBboxes = bencanaFeatures.map((f: any) => { try { return turf.bbox(f) } catch (_) { return [0, 0, 0, 0] } })

      const adminFeatures = getSelectedAdminFeatures()
      const hasil: HasilAdministrasi[] = []
      const intersectFeatures: any[] = []

      for (let ai = 0; ai < adminFeatures.length; ai++) {
        const adminFeat = adminFeatures[ai]
        const nf = autoDetectNamaField(adminFeat.properties)
        const namaWilayah = nf ? String(adminFeat.properties[nf]) : `Wilayah ${ai + 1}`
        setProgress(`${namaWilayah} (${ai + 1}/${adminFeatures.length})`)
        await sleep(0)

        const adminSimp = simp(adminFeat)
        const adminBbox = turf.bbox(adminSimp)
        const luasWilayah = turf.area(adminSimp) / 10000

        const perTingkat: Record<string, number> = {}
        let totalBencana = 0

        for (let bi = 0; bi < bencanaFeatures.length; bi++) {
          if (!bboxOverlap(adminBbox, bencanaBboxes[bi])) continue
          const bFeat = bencanaFeatures[bi]
          const bTingkat = String(bFeat.properties?.[field] || 'tidak diketahui')
          try {
            const inter = turf.intersect(turf.featureCollection([adminSimp, bFeat]))
            if (!inter) continue
            const luas = turf.area(inter) / 10000
            perTingkat[bTingkat] = (perTingkat[bTingkat] || 0) + luas
            totalBencana += luas
            intersectFeatures.push({
              type: 'Feature', geometry: inter.geometry,
              properties: { _namaWilayah: namaWilayah, _tingkat: bTingkat, _luas_ha: luas.toFixed(2), _warna: getWarna(bTingkat) }
            })
          } catch (_) {}
        }

        const breakdown: BreakdownTingkat[] = Object.entries(perTingkat)
          .map(([tingkat, luas]) => ({
            tingkat,
            luas_ha: Math.round(luas * 10) / 10,
            persen: Math.round((luas / luasWilayah) * 1000) / 10,
            warna: getWarna(tingkat)
          }))
          .sort((a, b) => b.luas_ha - a.luas_ha)

        hasil.push({
          namaWilayah,
          luas_wilayah_ha: Math.round(luasWilayah * 10) / 10,
          total_bencana_ha: Math.round(totalBencana * 10) / 10,
          breakdown
        })
      }

      hasil.sort((a, b) => b.total_bencana_ha - a.total_bencana_ha)
      setHasilAdmin(hasil)
      setSudahAnalisis(true)
      setProgress('')
      setRingkasan(hasil.length === 0 ? 'Tidak ada wilayah terdampak' : `Kerawanan terpetakan di ${hasil.length} kecamatan/wilayah`)

      const bencanaNama = layers.find(l => l.info.id === selectedBencana)?.info.nama || 'Bencana'
      const geojson = { type: 'FeatureCollection', features: intersectFeatures }
      const state = buildHasilLayerState(`Hasil: ${bencanaNama} × Administrasi`, intersectFeatures, '_tingkat', 'polygon')
      state.meta = { mode: 'administrasi', adminRows: hasil }
      kirimHasil(state, 'administrasi', geojson)
    } catch (e) { console.error('Gagal analisis administrasi:', e) }
    setLoading(false)
  }

  // ═══════════ MODE 3: BENCANA × FAKTOR ═══════════
  const analisisFaktor = async () => {
    if (!selectedBencana || !selectedFaktor || !bencanaGeoJSON || !faktorGeoJSON) return
    setLoading(true); resetHasil()
    try {
      const bencanaField = detectedField || autoDetectField(bencanaGeoJSON, '')

      let bencanaBahaya = bencanaGeoJSON.features.filter((f: any) => {
        if (!['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) return false
        return isBahaya(String(f.properties?.[bencanaField] || ''))
      })

      const props0 = faktorGeoJSON.features[0]?.properties || {}
      const skorField = ['skor', 'Skor', 'SKOR', 'score'].find(k => props0[k] !== undefined) || Object.keys(props0)[0]
      const ketField = ['Keterangan', 'keterangan', 'KETERANGAN', 'label', 'Label'].find(k => props0[k] !== undefined)
      const LABEL_SKOR: Record<string, string> = { '1': 'Sangat Rendah', '2': 'Rendah', '3': 'Sedang', '4': 'Tinggi', '5': 'Sangat Tinggi' }
      const WARNA_SKOR: Record<string, string> = { '1': '#27AE60', '2': '#A8D86E', '3': '#F4D03F', '4': '#E67E22', '5': '#C0392B' }

      let faktorFeatures = faktorGeoJSON.features.filter((f: any) =>
        ['Polygon', 'MultiPolygon'].includes(f.geometry?.type))

      if (selectedWilayah.length > 0) {
        setProgress('Memotong bencana ke wilayah...')
        await sleep(10)
        bencanaBahaya = clipToAdmin(bencanaBahaya)
        setProgress('Memotong faktor ke wilayah...')
        await sleep(10)
        faktorFeatures = clipToAdmin(faktorFeatures)
      }

      const bencanaSimp = bencanaBahaya.map(simp)
      const bencanaBboxes = bencanaSimp.map((f: any) => { try { return turf.bbox(f) } catch (_) { return [0, 0, 0, 0] } })

      const byKelas: Record<string, { label: string; warna: string; features: any[] }> = {}
      for (const f of faktorFeatures) {
        const skor = String(f.properties?.[skorField] ?? '?')
        if (!byKelas[skor]) {
          const label = ketField ? String(f.properties[ketField]) : (LABEL_SKOR[skor] || `Kelas ${skor}`)
          byKelas[skor] = { label, warna: WARNA_SKOR[skor] || '#8b5cf6', features: [] }
        }
        byKelas[skor].features.push(f)
      }

      const kelasList = Object.entries(byKelas).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
      const hasil: HasilFaktorBar[] = []
      const intersectFeatures: any[] = []

      for (const [skor, { label, warna, features }] of kelasList) {
        let totalHa = 0
        let rawanHa = 0
        for (let fi = 0; fi < features.length; fi++) {
          if (fi % 5 === 0) {
            setProgress(`${label}: ${fi + 1}/${features.length}`)
            await sleep(0)
          }
          const fSimp = simp(features[fi])
          try { totalHa += turf.area(fSimp) / 10000 } catch (_) { continue }
          let fBbox: number[]
          try { fBbox = turf.bbox(fSimp) } catch (_) { continue }

          for (let bi = 0; bi < bencanaSimp.length; bi++) {
            if (!bboxOverlap(fBbox, bencanaBboxes[bi])) continue
            try {
              const inter = turf.intersect(turf.featureCollection([fSimp, bencanaSimp[bi]]))
              if (!inter) continue
              const luas = turf.area(inter) / 10000
              rawanHa += luas
              intersectFeatures.push({
                ...inter,
                properties: { _kelas: label, _tingkat: String(bencanaSimp[bi].properties?.[bencanaField] || ''), _warna: warna }
              })
            } catch (_) {}
          }
        }
        hasil.push({
          label, skor, warna,
          total_ha: Math.round(totalHa * 10) / 10,
          rawan_ha: Math.round(rawanHa * 10) / 10,
          persen: totalHa > 0 ? Math.round((rawanHa / totalHa) * 1000) / 10 : 0
        })
      }

      setHasilFaktor(hasil)
      setSudahAnalisis(true)
      setProgress('')
      const top = [...hasil].sort((a, b) => b.persen - a.persen)[0]
      setRingkasan(top && top.persen > 0
        ? `Kelas "${top.label}" paling berasosiasi dengan zona bahaya (${top.persen}%)`
        : `${hasil.length} kelas faktor dianalisis`)

      const bencanaNama = layers.find(l => l.info.id === selectedBencana)?.info.nama || 'Bencana'
      const faktorNama = layers.find(l => l.info.id === selectedFaktor)?.info.nama || 'Faktor'
      const geojson = { type: 'FeatureCollection', features: intersectFeatures }
      const state = buildHasilLayerState(`Hasil: ${bencanaNama} × ${faktorNama}`, intersectFeatures, '_kelas', 'polygon')
      state.meta = { mode: 'faktor', faktorRows: hasil }
      kirimHasil(state, 'faktor', geojson)
    } catch (e) { console.error('Gagal analisis faktor:', e) }
    setLoading(false)
  }

  const canAnalisis = mode === 'fasilitas'
    ? (!!selectedBencana && selectedFasilitasIds.length > 0 && !!bencanaGeoJSON)
    : mode === 'faktor'
      ? (!!selectedBencana && !!selectedFaktor && !!bencanaGeoJSON && !!faktorGeoJSON)
      : (!!selectedBencana && !!selectedAdmin && !!bencanaGeoJSON && !!adminGeoJSON)

  const runAnalisis = () => {
    if (mode === 'fasilitas') analisisFasilitas()
    else if (mode === 'administrasi') analisisAdministrasi()
    else analisisFaktor()
  }

  // ─────────────────────────────────────────────────────────────
  // UI — Wizard 3 langkah
  // ─────────────────────────────────────────────────────────────

  const stepLabels = ['Jenis', 'Bencana', 'Atur & Jalankan']

  const Stepper = () => (
    <div className="flex items-center justify-center gap-0 py-1">
      {[1, 2, 3].map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
              ${step === s ? 'bg-blue-950 text-white' : step > s ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-400'}`}>
              {step > s ? '✓' : s}
            </div>
            <span className={`text-[8px] ${step === s ? 'text-blue-950 font-semibold' : 'text-gray-400'}`}>{stepLabels[i]}</span>
          </div>
          {i < 2 && <div className={`w-8 h-px mb-3 ${step > s ? 'bg-blue-300' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )

  const BackButton = ({ to }: { to: Step }) => (
    <button onClick={() => setStep(to)}
      className="text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-all">
      <span>←</span> Kembali
    </button>
  )

  // ── Tampilan setelah analisis selesai: ringkasan + Analisis Baru ──
  if (sudahAnalisis) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Analisis Overlay</p>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-start gap-2">
          <span className="text-green-600 text-sm flex-shrink-0">✓</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-green-800">Analisis selesai</p>
            <p className="text-[10px] text-green-700 mt-0.5">{ringkasan}</p>
            <p className="text-[9px] text-green-600/70 mt-1">
              Hasil ditampilkan di peta dan legenda kanan — warna serta kelas bisa diatur di sana.
            </p>
          </div>
        </div>
        <button onClick={resetAnalisis}
          className="w-full text-xs bg-blue-950 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-900 transition-all">
          Analisis Baru
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider sticky top-0 bg-gray-50 pb-1 z-10">Analisis Overlay</p>
      <Stepper />

      {/* ════════ STEP 1: Pilih jenis analisis ════════ */}
      {step === 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-gray-600 font-medium">Apa yang ingin kamu analisis?</p>
          {MODE_CARDS.map(c => (
            <button key={c.mode}
              onClick={() => { setMode(c.mode); resetHasil(); setStep(2) }}
              className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-sm transition-all group">
              <div className="flex items-start gap-2.5">
                <span className="text-xl flex-shrink-0 group-hover:scale-110 transition-transform">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-gray-800 group-hover:text-blue-900">{c.judul}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{c.desc}</p>
                </div>
                <span className="text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-1">›</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ════════ STEP 2: Pilih layer bencana ════════ */}
      {step === 2 && mode && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <BackButton to={1} />
            <span className="text-[9px] text-gray-400">{MODE_CARDS.find(c => c.mode === mode)?.judul}</span>
          </div>

          <p className="text-[11px] text-gray-600 font-medium">Pilih peta bencana yang mau dianalisis</p>

          {bencanaLayers.length === 0 && layers.filter(l => l.info.has_tingkat).length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-[11px] text-amber-800 font-medium">Belum ada layer bencana aktif</p>
              <p className="text-[10px] text-amber-700">Aktifkan dulu layer bencana (misalnya Rawan Banjir) dari daftar layer.</p>
              <button onClick={() => onRequestActivateLayer?.()}
                className="w-full text-[11px] bg-amber-600 text-white py-2 rounded-lg font-semibold hover:bg-amber-700 transition-all">
                Buka Daftar Layer
              </button>
            </div>
          ) : (
            <>
              <select className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2.5 text-gray-700 focus:outline-none focus:border-blue-400"
                value={selectedBencana} onChange={e => handlePilihBencana(e.target.value)}>
                <option value="">Pilih layer bencana aktif</option>
                {(bencanaLayers.length > 0 ? bencanaLayers : layers.filter(l => l.info.has_tingkat)).map(l => (
                  <option key={l.info.id} value={l.info.id}>{l.info.nama}</option>
                ))}
              </select>

              {loadingBencana && (
                <div className="flex items-center gap-2 text-[10px] text-blue-600">
                  <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Memuat data peta...
                </div>
              )}

              {mode !== 'fasilitas' && selectedBencana && bencanaGeoJSON && (
                <p className="text-[9px] text-gray-400">Semua tingkat kerawanan otomatis dianalisis</p>
              )}

              <button onClick={() => setStep(3)} disabled={!selectedBencana || !bencanaGeoJSON}
                className="w-full text-xs bg-blue-950 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Lanjut →
              </button>
            </>
          )}
        </div>
      )}

      {/* ════════ STEP 3: Atur & jalankan ════════ */}
      {step === 3 && mode && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <BackButton to={2} />
            <span className="text-[9px] text-gray-400">{MODE_CARDS.find(c => c.mode === mode)?.judul}</span>
          </div>

          {/* ── Checklist Tingkat (mode fasilitas saja) ── */}
          {mode === 'fasilitas' && tingkatOptions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-500">Tingkat Kerawanan</label>
                <button onClick={() => setSelectedTingkatList(selectedTingkatList.length === tingkatOptions.length ? [] : [...tingkatOptions])}
                  className="text-[9px] text-slate-600 hover:underline">
                  {selectedTingkatList.length === tingkatOptions.length ? 'Hapus semua' : 'Pilih semua'}
                </button>
              </div>
              <p className="text-[9px] text-gray-400 mb-1">{selectedTingkatList.length === 0 ? 'Kosong = semua tingkat' : `${selectedTingkatList.length} tingkat dipilih`}</p>
              <div className="flex flex-col gap-0.5 border border-gray-200 rounded-lg p-1.5 bg-white">
                {tingkatOptions.map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                    <input type="checkbox" checked={selectedTingkatList.includes(t)}
                      onChange={() => toggleTingkat(t)}
                      className="w-3 h-3 accent-slate-700 flex-shrink-0" />
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: getWarna(t) }} />
                    <span className="text-[11px] text-gray-700 capitalize">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Checklist Fasilitas multi (mode fasilitas) ── */}
          {mode === 'fasilitas' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-500">Layer Fasilitas</label>
                {fasilitasLayers.length > 0 && (
                  <button onClick={() => setSelectedFasilitasIds(selectedFasilitasIds.length === fasilitasLayers.length ? [] : fasilitasLayers.map(l => l.info.id))}
                    className="text-[9px] text-slate-600 hover:underline">
                    {selectedFasilitasIds.length === fasilitasLayers.length ? 'Hapus semua' : 'Pilih semua'}
                  </button>
                )}
              </div>
              {fasilitasLayers.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex flex-col gap-1.5">
                  <p className="text-[10px] text-amber-800">Belum ada layer fasilitas aktif</p>
                  <button onClick={() => onRequestActivateLayer?.()}
                    className="w-full text-[10px] bg-amber-600 text-white py-1.5 rounded-lg font-semibold hover:bg-amber-700 transition-all">
                    Buka Daftar Layer
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5 border border-gray-200 rounded-lg p-1.5 bg-white">
                  {fasilitasLayers.map(l => (
                    <label key={l.info.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded">
                      <input type="checkbox" checked={selectedFasilitasIds.includes(l.info.id)}
                        onChange={() => { toggleFasilitas(l.info.id); resetHasil() }}
                        className="w-3 h-3 accent-slate-700 flex-shrink-0" />
                      <span className="text-[11px] text-gray-700">{l.info.nama}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Layer Faktor (mode faktor) ── */}
          {mode === 'faktor' && (
            <div>
              <label className="text-[10px] text-gray-500 block mb-1">Layer Faktor Bencana</label>
              <select className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 focus:outline-none focus:border-blue-400"
                value={selectedFaktor} onChange={e => handlePilihFaktor(e.target.value)}>
                <option value="">Pilih layer faktor aktif</option>
                {faktorLayers.map(l => <option key={l.info.id} value={l.info.id}>{l.info.nama}</option>)}
              </select>
              {faktorLayers.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-1.5 flex flex-col gap-1.5">
                  <p className="text-[10px] text-amber-800">Belum ada layer faktor aktif</p>
                  <button onClick={() => onRequestActivateLayer?.()}
                    className="w-full text-[10px] bg-amber-600 text-white py-1.5 rounded-lg font-semibold hover:bg-amber-700 transition-all">
                    Buka Daftar Layer
                  </button>
                </div>
              ) : selectedFaktor && (
                <p className="text-[9px] text-gray-400 mt-1">Semua kelas faktor otomatis dianalisis</p>
              )}
            </div>
          )}

          {/* ── Administrasi + ceklist kecamatan (semua mode; wajib di mode wilayah) ── */}
          <div className={mode === 'administrasi' ? '' : 'border border-dashed border-gray-200 rounded-xl p-2.5'}>
            <label className="text-[10px] text-gray-500 block mb-1">
              {mode === 'administrasi' ? 'Layer Batas Administrasi' : 'Batasi Wilayah (opsional)'}
            </label>
            <select className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-gray-700 focus:outline-none focus:border-blue-400"
              value={selectedAdmin} onChange={e => handlePilihAdmin(e.target.value)}>
              <option value="">{mode === 'administrasi' ? 'Pilih layer administrasi' : 'Tanpa batas wilayah'}</option>
              {adminLayers.map(l => <option key={l.info.id} value={l.info.id}>{l.info.nama}</option>)}
            </select>
            {adminLayers.length === 0 && mode === 'administrasi' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-1.5 flex flex-col gap-1.5">
                <p className="text-[10px] text-amber-800">Belum ada layer administrasi aktif</p>
                <button onClick={() => onRequestActivateLayer?.()}
                  className="w-full text-[10px] bg-amber-600 text-white py-1.5 rounded-lg font-semibold hover:bg-amber-700 transition-all">
                  Buka Daftar Layer
                </button>
              </div>
            )}
            {adminWilayahOptions.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-500">Kecamatan</label>
                  <button onClick={() => setSelectedWilayah(selectedWilayah.length === adminWilayahOptions.length ? [] : [...adminWilayahOptions])}
                    className="text-[9px] text-slate-600 hover:underline">
                    {selectedWilayah.length === adminWilayahOptions.length ? 'Hapus semua' : 'Pilih semua'}
                  </button>
                </div>
                <p className="text-[9px] text-gray-400 mb-1">
                  {selectedWilayah.length === 0
                    ? (mode === 'administrasi' ? 'Kosong = semua kecamatan dianalisis' : 'Kosong = seluruh area (tanpa pemotongan)')
                    : `${selectedWilayah.length} kecamatan dipilih`}
                </p>
                <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-1.5 bg-white">
                  {adminWilayahOptions.map(w => (
                    <label key={w} className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded min-w-0">
                      <input type="checkbox" checked={selectedWilayah.includes(w)}
                        onChange={() => toggleWilayah(w)}
                        className="w-3 h-3 accent-slate-700 flex-shrink-0" />
                      <span className="text-[10px] text-gray-700 truncate">{w}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Tombol analisis ── */}
          <button onClick={runAnalisis} disabled={!canAnalisis || loading}
            className="w-full text-xs bg-blue-950 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            {loading ? 'Menganalisis...' : 'Jalankan Analisis'}
          </button>

          {loading && progress && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
              <p className="text-[10px] text-blue-700">{progress}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}