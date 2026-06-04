'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import L from 'leaflet'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

interface Props {
  map: L.Map | null
}

export default function CrossSection({ map }: Props) {
  const [active, setActive] = useState(false)
  const [points, setPoints] = useState<L.LatLng[]>([])
  const [loading, setLoading] = useState(false)
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<Chart | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null)
  const interpolatedRef = useRef<[number, number][]>([])

  const clearAll = useCallback(() => {
    if (!map) return
    if (polylineRef.current) { map.removeLayer(polylineRef.current); polylineRef.current = null }
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    if (hoverMarkerRef.current) { map.removeLayer(hoverMarkerRef.current); hoverMarkerRef.current = null }
    if (chartInstance.current) { chartInstance.current.destroy(); chartInstance.current = null }
    interpolatedRef.current = []
    setPoints([])
  }, [map])

  const interpolatePoints = (start: L.LatLng, end: L.LatLng, count: number) => {
    const pts: [number, number][] = []
    for (let i = 0; i <= count; i++) {
      const t = i / count
      pts.push([
        start.lat + (end.lat - start.lat) * t,
        start.lng + (end.lng - start.lng) * t
      ])
    }
    return pts
  }

  const fetchElevation = async (pts: [number, number][]) => {
    const locations = pts.map(p => `${p[0]},${p[1]}`).join('|')
    const res = await fetch(`/api/elevation?locations=${encodeURIComponent(locations)}`)
    const data = await res.json()
    return data.results.map((r: any) => r.elevation)
  }

  const generateProfile = async (latlngs: L.LatLng[]) => {
    if (latlngs.length < 2) return
    setLoading(true)

    const interpolated = interpolatePoints(latlngs[0], latlngs[latlngs.length - 1], 50)
    interpolatedRef.current = interpolated
    const elevations = await fetchElevation(interpolated)

    const totalDist = latlngs[0].distanceTo(latlngs[latlngs.length - 1])
    const labels = interpolated.map((_, i) =>
      `${((i / 50) * totalDist / 1000).toFixed(1)} km`
    )

    if (chartInstance.current) chartInstance.current.destroy()

    if (chartRef.current) {
      chartInstance.current = new Chart(chartRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Elevasi (m)',
            data: elevations,
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59,130,246,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              mode: 'index',
              intersect: false,
              callbacks: {
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex
                  if (idx === undefined || !map) return []
                  const pt = interpolatedRef.current[idx]
                  if (!pt) return []

                  if (hoverMarkerRef.current) map.removeLayer(hoverMarkerRef.current)
                  hoverMarkerRef.current = L.circleMarker([pt[0], pt[1]], {
                    radius: 8,
                    fillColor: '#EF4444',
                    color: '#fff',
                    weight: 2,
                    fillOpacity: 1
                  }).addTo(map)

                  return [`Lat: ${pt[0].toFixed(4)}, Lng: ${pt[1].toFixed(4)}`]
                }
              }
            }
          },
          scales: {
            x: { ticks: { maxTicksLimit: 6, font: { size: 10 } } },
            y: { title: { display: true, text: 'Elevasi (m)', font: { size: 10 } } }
          },
          onHover: (event, elements) => {
            if (elements.length === 0 && hoverMarkerRef.current && map) {
              map.removeLayer(hoverMarkerRef.current)
              hoverMarkerRef.current = null
            }
          }
        }
      })
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!map || !active) return

    const onClick = (e: L.LeafletMouseEvent) => {
      setPoints(prev => {
        const newPoints = [...prev, e.latlng]

        const marker = L.circleMarker(e.latlng, {
          radius: 5, fillColor: '#F59E0B', color: '#fff', weight: 1, fillOpacity: 1
        }).addTo(map)
        markersRef.current.push(marker)

        if (polylineRef.current) map.removeLayer(polylineRef.current)
        if (newPoints.length > 1) {
          polylineRef.current = L.polyline(newPoints, {
            color: '#F59E0B', weight: 2, dashArray: '5,5'
          }).addTo(map)
        }

        return newPoints
      })
    }

    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [active, map])

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-bold text-gray-600">Cross Section Topografi:</p>
      <div className="flex gap-1 flex-wrap">
        <button
          className={`text-xs px-2 py-1 rounded border ${active ? 'bg-amber-500 text-white' : 'bg-white'}`}
          onClick={() => { clearAll(); setActive(!active) }}
        >
          {active ? 'Aktif' : 'Mulai'}
        </button>
        {points.length >= 2 && (
          <button
            className="text-xs px-2 py-1 rounded border bg-blue-600 text-white"
            onClick={() => generateProfile(points)}
          >
            {loading ? 'Loading...' : 'Buat Profil'}
          </button>
        )}
        <button
          className="text-xs px-2 py-1 rounded border bg-gray-100"
          onClick={() => { clearAll(); setActive(false) }}
        >
          Reset
        </button>
      </div>
      {active && <p className="text-xs text-gray-400">Klik minimal 2 titik di peta</p>}
      {loading && <p className="text-xs text-amber-500">Mengambil data elevasi...</p>}
      <canvas ref={chartRef} className="mt-2" style={{ maxHeight: '150px' }} />
    </div>
  )
}