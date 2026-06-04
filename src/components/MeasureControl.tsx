'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import L from 'leaflet'

interface Props {
  map: L.Map | null
}

export default function MeasureControl({ map }: Props) {
  const [mode, setMode] = useState<'none' | 'distance' | 'area'>('none')
  const [result, setResult] = useState('')
  const pointsRef = useRef<L.LatLng[]>([])
  const polylineRef = useRef<L.Polyline | null>(null)
  const polygonRef = useRef<L.Polygon | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])

  const calculateDistance = (pts: L.LatLng[]) => {
    let total = 0
    for (let i = 1; i < pts.length; i++) {
      total += pts[i - 1].distanceTo(pts[i])
    }
    return total >= 1000
      ? `${(total / 1000).toFixed(2)} km`
      : `${total.toFixed(0)} m`
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
    return area >= 1000000
      ? `${(area / 1000000).toFixed(2)} km²`
      : `${area.toFixed(0)} m²`
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

  useEffect(() => {
    if (!map || mode === 'none') return
    clearAll()

    const onClick = (e: L.LeafletMouseEvent) => {
      pointsRef.current = [...pointsRef.current, e.latlng]
      const pts = pointsRef.current

      const marker = L.circleMarker(e.latlng, {
        radius: 5, fillColor: '#3B82F6', color: '#fff', weight: 1, fillOpacity: 1
      }).addTo(map)
      markersRef.current.push(marker)

      if (mode === 'distance') {
        if (polylineRef.current) map.removeLayer(polylineRef.current)
        polylineRef.current = L.polyline(pts, { color: '#3B82F6', weight: 2 }).addTo(map)
        if (pts.length > 1) setResult(calculateDistance(pts))
      }

      if (mode === 'area') {
        if (polygonRef.current) map.removeLayer(polygonRef.current)
        if (pts.length > 2) {
          polygonRef.current = L.polygon(pts, { color: '#10B981', weight: 2, fillOpacity: 0.2 }).addTo(map)
          setResult(calculateArea(pts))
        }
      }
    }

    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [mode, map])

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-bold text-gray-600">Ukur:</p>
      <div className="flex gap-1">
        <button
          className={`text-xs px-2 py-1 rounded border ${mode === 'distance' ? 'bg-blue-600 text-white' : 'bg-white'}`}
          onClick={() => { clearAll(); setMode(mode === 'distance' ? 'none' : 'distance') }}
        >
          Jarak
        </button>
        <button
          className={`text-xs px-2 py-1 rounded border ${mode === 'area' ? 'bg-green-600 text-white' : 'bg-white'}`}
          onClick={() => { clearAll(); setMode(mode === 'area' ? 'none' : 'area') }}
        >
          Luas
        </button>
        <button
          className="text-xs px-2 py-1 rounded border bg-gray-100"
          onClick={() => { clearAll(); setMode('none') }}
        >
          Reset
        </button>
      </div>
      {result && <p className="text-xs text-gray-700 font-medium">Hasil: {result}</p>}
      {mode !== 'none' && <p className="text-xs text-gray-400">Klik di peta untuk menambah titik</p>}
    </div>
  )
}