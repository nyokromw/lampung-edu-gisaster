'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import L from 'leaflet'

interface Props {
  map: L.Map | null
  onToolStateChange?: (active: boolean) => void
}

export default function MeasureControl({ map, onToolStateChange }: Props) {
  const [mode, setMode] = useState<'none' | 'distance' | 'area'>('none')
  const [result, setResult] = useState('')
  const pointsRef = useRef<L.LatLng[]>([])
  const polylineRef = useRef<L.Polyline | null>(null)
  const polygonRef = useRef<L.Polygon | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])

  const calculateDistance = (pts: L.LatLng[]) => {
    let total = 0
    for (let i = 1; i < pts.length; i++) total += pts[i - 1].distanceTo(pts[i])
    return total >= 1000 ? `${(total / 1000).toFixed(2)} km` : `${total.toFixed(0)} m`
  }

  const calculateArea = (pts: L.LatLng[]) => {
    if (pts.length < 3) return ''
    const R = 6371000
    let area = 0
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length
      area += (pts[i].lng * Math.PI / 180) * Math.sin(pts[j].lat * Math.PI / 180)
      area -= (pts[j].lng * Math.PI / 180) * Math.sin(pts[i].lat * Math.PI / 180)
    }
    area = Math.abs(area / 2) * R * R
    return area >= 1000000 ? `${(area / 1000000).toFixed(2)} km²` : `${area.toFixed(0)} m²`
  }

  const clearAll = useCallback(() => {
    if (!map) return
    if (polylineRef.current) { map.removeLayer(polylineRef.current); polylineRef.current = null }
    if (polygonRef.current) { map.removeLayer(polygonRef.current); polygonRef.current = null }
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    pointsRef.current = []
    setResult('')
  }, [map])

  const activateMode = (newMode: 'distance' | 'area') => {
    clearAll()
    if (mode === newMode) {
      setMode('none')
      onToolStateChange?.(false)
    } else {
      setMode(newMode)
      onToolStateChange?.(true)
    }
  }

  const resetAll = () => {
    clearAll()
    setMode('none')
    onToolStateChange?.(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      onToolStateChange?.(false)
      if (map) {
        if (polylineRef.current) map.removeLayer(polylineRef.current)
        if (polygonRef.current) map.removeLayer(polygonRef.current)
        markersRef.current.forEach(m => map.removeLayer(m))
      }
    }
  }, [map, onToolStateChange])

  useEffect(() => {
    if (!map || mode === 'none') return

    const onClick = (e: L.LeafletMouseEvent) => {
      pointsRef.current = [...pointsRef.current, e.latlng]
      const pts = pointsRef.current

      const marker = L.circleMarker(e.latlng, {
        radius: 5, fillColor: mode === 'distance' ? '#3B82F6' : '#10B981', color: '#fff', weight: 2, fillOpacity: 1
      }).addTo(map)
      markersRef.current.push(marker)

      if (mode === 'distance') {
        if (polylineRef.current) map.removeLayer(polylineRef.current)
        polylineRef.current = L.polyline(pts, { color: '#3B82F6', weight: 2.5 }).addTo(map)
        if (pts.length > 1) setResult(calculateDistance(pts))
      }

      if (mode === 'area') {
        if (polygonRef.current) map.removeLayer(polygonRef.current)
        if (pts.length > 2) {
          polygonRef.current = L.polygon(pts, { color: '#10B981', weight: 2.5, fillOpacity: 0.15 }).addTo(map)
          setResult(calculateArea(pts))
        }
      }
    }

    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [mode, map])

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Pengukuran</p>
        <div className="flex gap-2">
          <button
            className={`flex-1 text-xs py-2.5 rounded-xl font-medium border transition-all flex items-center justify-center gap-1.5
              ${mode === 'distance' ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}
            onClick={() => activateMode('distance')}
          >
            📏 Jarak
          </button>
          <button
            className={`flex-1 text-xs py-2.5 rounded-xl font-medium border transition-all flex items-center justify-center gap-1.5
              ${mode === 'area' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-200' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'}`}
            onClick={() => activateMode('area')}
          >
            ⬡ Luas
          </button>
        </div>
      </div>

      {mode !== 'none' && (
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <p className="text-[11px] text-gray-500 mb-1">Klik di peta untuk menambah titik pengukuran</p>
          {result && (
            <div className={`text-sm font-bold mt-2 ${mode === 'distance' ? 'text-blue-600' : 'text-emerald-600'}`}>
              {result}
            </div>
          )}
          <button
            className="mt-2 w-full text-xs text-gray-500 bg-white border border-gray-200 rounded-lg py-1.5 hover:bg-gray-100 transition-all"
            onClick={resetAll}
          >
            Reset Pengukuran
          </button>
        </div>
      )}

      {mode === 'none' && (
        <div className="text-center py-6">
          <p className="text-2xl mb-2">📐</p>
          <p className="text-xs text-gray-400">Pilih mode ukur jarak atau luas,<br/>lalu klik titik-titik di peta</p>
        </div>
      )}
    </div>
  )
}