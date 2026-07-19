'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import L from 'leaflet'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

interface Props {
  map: L.Map | null
  onToolStateChange?: (active: boolean) => void
}

interface ElevData {
  labels: string[]
  elevations: number[]
  min: number
  max: number
  dist: number
}

// Plugin custom: gambar crosshair vertikal + titik di posisi hoverIndex
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart: Chart) {
    const idx = (chart as any)._hoverIndex
    if (idx === null || idx === undefined) return
    const meta = chart.getDatasetMeta(0)
    const point = meta.data[idx] as any
    if (!point) return
    const { ctx, chartArea } = chart
    ctx.save()
    // Garis vertikal putus-putus
    ctx.beginPath()
    ctx.setLineDash([4, 3])
    ctx.moveTo(point.x, chartArea.top)
    ctx.lineTo(point.x, chartArea.bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = '#94a3b8'
    ctx.stroke()
    // Titik
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(point.x, point.y, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}
Chart.register(crosshairPlugin)

export default function CrossSection({ map, onToolStateChange }: Props) {
  const [active, setActive] = useState(false)
  const [points, setPoints] = useState<L.LatLng[]>([])
  const [loading, setLoading] = useState(false)
  const [elevData, setElevData] = useState<ElevData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hoverInfo, setHoverInfo] = useState<{ dist: string; elev: number; lat: number; lng: number } | null>(null)

  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<Chart | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)
  const hitLineRef = useRef<L.Polyline | null>(null)
  const markersRef = useRef<L.CircleMarker[]>([])
  const hoverMarkerRef = useRef<L.CircleMarker | null>(null)
  const interpolatedRef = useRef<[number, number][]>([])
  const rafPending = useRef(false)

  const clearMap = useCallback(() => {
    if (!map) return
    polylineRef.current && map.removeLayer(polylineRef.current)
    polylineRef.current = null
    hitLineRef.current && map.removeLayer(hitLineRef.current)
    hitLineRef.current = null
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []
    hoverMarkerRef.current && map.removeLayer(hoverMarkerRef.current)
    hoverMarkerRef.current = null
  }, [map])

  const destroyChart = () => {
    chartInstance.current?.destroy()
    chartInstance.current = null
  }

  const reset = useCallback(() => {
    clearMap()
    destroyChart()
    interpolatedRef.current = []
    setPoints([])
    setElevData(null)
    setError(null)
    setLoading(false)
    setHoverInfo(null)
  }, [clearMap])

  const deactivate = useCallback(() => {
    reset()
    setActive(false)
    onToolStateChange?.(false)
  }, [reset, onToolStateChange])

  // Cleanup on unmount
  useEffect(() => {
    return () => { deactivate() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update posisi & info berdasarkan index — dipanggil dari chart hover ATAU peta hover
  const setHoverIndex = useCallback((idx: number | null) => {
    const chart = chartInstance.current
    if (chart) {
      ;(chart as any)._hoverIndex = idx
      chart.draw()
    }
    if (idx === null) {
      if (hoverMarkerRef.current) hoverMarkerRef.current.setStyle({ opacity: 0, fillOpacity: 0 })
      setHoverInfo(null)
      return
    }
    const pt = interpolatedRef.current[idx]
    if (!pt || !map) return
    // Marker tunggal — dipindah, bukan dibuat ulang (mencegah kedip)
    if (!hoverMarkerRef.current) {
      hoverMarkerRef.current = L.circleMarker([pt[0], pt[1]], {
        radius: 7, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1
      }).addTo(map)
    } else {
      hoverMarkerRef.current.setLatLng([pt[0], pt[1]])
      hoverMarkerRef.current.setStyle({ opacity: 1, fillOpacity: 1 })
    }
    hoverMarkerRef.current.bringToFront()

    if (elevData) {
      setHoverInfo({
        dist: elevData.labels[idx],
        elev: elevData.elevations[idx],
        lat: pt[0],
        lng: pt[1],
      })
    }
  }, [map, elevData])

  // Init chart when elevData changes
  useEffect(() => {
    if (!elevData || !chartRef.current) return
    destroyChart()

    chartInstance.current = new Chart(chartRef.current, {
      type: 'line',
      data: {
        labels: elevData.labels,
        datasets: [{
          data: elevData.elevations,
          borderColor: '#1d4ed8',
          backgroundColor: 'rgba(29,78,216,0.07)',
          fill: true,
          cubicInterpolationMode: 'monotone',
          tension: 0,
          pointRadius: 0,
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        // Tooltip bawaan dimatikan — info ditampilkan di bar terpisah di atas chart
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        scales: {
          x: {
            title: { display: true, text: 'Jarak (km)', font: { size: 9 }, color: '#9ca3af' },
            ticks: { maxTicksLimit: 5, font: { size: 9 }, color: '#9ca3af' },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: 'Elevasi (mdpl)', font: { size: 9 }, color: '#9ca3af' },
            ticks: { font: { size: 9 }, color: '#9ca3af' },
            grid: { color: '#f1f5f9' },
            grace: '35%',
          }
        },
        onHover: (evt, elements) => {
          if (elements.length > 0) {
            setHoverIndex(elements[0].index)
          } else {
            setHoverIndex(null)
          }
        }
      }
    })

    // Bersihkan hover saat kursor keluar dari canvas chart
    const canvas = chartRef.current
    const onLeave = () => setHoverIndex(null)
    canvas.addEventListener('mouseleave', onLeave)

    return () => {
      canvas.removeEventListener('mouseleave', onLeave)
      destroyChart()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elevData])

  // Klik titik di peta (mode aktif)
  useEffect(() => {
    if (!map || !active) return
    const onClick = (e: L.LeafletMouseEvent) => {
      setPoints(prev => {
        const newPoints = [...prev, e.latlng]
        const m = L.circleMarker(e.latlng, {
          radius: 6, fillColor: '#1d4ed8', color: '#fff', weight: 2, fillOpacity: 1
        }).addTo(map)
        markersRef.current.push(m)
        if (polylineRef.current) map.removeLayer(polylineRef.current)
        if (newPoints.length > 1) {
          polylineRef.current = L.polyline(newPoints, {
            color: '#1d4ed8', weight: 2, dashArray: '6,4'
          }).addTo(map)
        }
        return newPoints
      })
    }
    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [active, map])

  // Sinkronisasi peta → chart: deteksi jarak kursor ke path dalam PIXEL layar.
  // Kursor tidak perlu tepat di garis — cukup dalam radius 40px, otomatis snap ke titik terdekat.
  useEffect(() => {
    if (!map || !elevData) return
    const TOLERANCE_PX = 40

    const onMove = (e: L.LeafletMouseEvent) => {
      if (rafPending.current) return
      rafPending.current = true
      requestAnimationFrame(() => {
        rafPending.current = false
        try {
          const cursor = map.latLngToContainerPoint(e.latlng)
          const pts = interpolatedRef.current
          let bestIdx = -1
          let bestDistSq = Infinity
          for (let i = 0; i < pts.length; i++) {
            const p = map.latLngToContainerPoint(L.latLng(pts[i][0], pts[i][1]))
            const dx = p.x - cursor.x
            const dy = p.y - cursor.y
            const dSq = dx * dx + dy * dy
            if (dSq < bestDistSq) { bestDistSq = dSq; bestIdx = i }
          }
          if (bestIdx >= 0 && bestDistSq <= TOLERANCE_PX * TOLERANCE_PX) {
            setHoverIndex(bestIdx)
          } else {
            setHoverIndex(null)
          }
        } catch (_) {}
      })
    }

    map.on('mousemove', onMove)
    return () => { map.off('mousemove', onMove) }
  }, [map, elevData, setHoverIndex])

  const generateProfile = async () => {
    if (points.length < 2) return
    setLoading(true)
    setError(null)
    setElevData(null)
    destroyChart()

    try {
      // ── Interpolasi akurat sepanjang SELURUH path (mendukung >2 titik) ──
      // Hitung jarak kumulatif per segmen, lalu sample merata berdasarkan jarak total
      const segDist: number[] = []
      let totalDist = 0
      for (let i = 0; i < points.length - 1; i++) {
        const d = points[i].distanceTo(points[i + 1])
        segDist.push(d)
        totalDist += d
      }

      const STEPS = 60
      const interpolated: [number, number][] = []
      for (let s = 0; s <= STEPS; s++) {
        const targetDist = (s / STEPS) * totalDist
        // Cari segmen yang memuat targetDist
        let acc = 0
        let segIdx = 0
        for (; segIdx < segDist.length; segIdx++) {
          if (acc + segDist[segIdx] >= targetDist || segIdx === segDist.length - 1) break
          acc += segDist[segIdx]
        }
        const segLen = segDist[segIdx] || 1
        const t = segLen > 0 ? Math.min(1, Math.max(0, (targetDist - acc) / segLen)) : 0
        const p1 = points[segIdx]
        const p2 = points[segIdx + 1] || points[segIdx]
        interpolated.push([
          p1.lat + (p2.lat - p1.lat) * t,
          p1.lng + (p2.lng - p1.lng) * t,
        ])
      }
      interpolatedRef.current = interpolated

      // Gunakan endpoint lokal yang proxy ke opentopodata.org
      const locations = interpolated.map(p => `${p[0]},${p[1]}`).join('|')
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await fetch(`/api/elevation?locations=${encodeURIComponent(locations)}`, {
        signal: controller.signal
      })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const raw: number[] = json.results.map((r: any) => r.elevation ?? 0)

      if (!raw || raw.length === 0) throw new Error('Data elevasi kosong')

      // Haluskan data dengan weighted moving average (mengurangi noise SRTM)
      const elevations = raw.map((v, i) => {
        const prev = raw[i - 1] ?? v
        const next = raw[i + 1] ?? v
        return Math.round((prev * 0.25 + v * 0.5 + next * 0.25) * 10) / 10
      })

      const labels = interpolated.map((_, i) =>
        `${((i / STEPS) * totalDist / 1000).toFixed(2)}`
      )

      setElevData({
        labels,
        elevations,
        min: Math.min(...elevations),
        max: Math.max(...elevations),
        dist: totalDist,
      })

    } catch (e: any) {
      console.error('Elevasi error:', e)
      const msg = e.name === 'AbortError'
        ? 'Timeout — server elevasi tidak merespons. Coba lagi.'
        : `Gagal ambil data elevasi: ${e.message}`
      setError(msg)
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Profil Topografi</p>

      <button
        onClick={() => {
          if (active) { deactivate() }
          else { reset(); setActive(true); onToolStateChange?.(true) }
        }}
        className={`w-full text-xs py-2 rounded-lg font-medium border transition-all
          ${active ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'}`}>
        {active ? 'Aktif — Klik titik di peta' : 'Mulai Buat Profil'}
      </button>

      {active && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex flex-col gap-2">
          <p className="text-[11px] text-gray-600">
            {points.length === 0 ? 'Klik titik awal di peta'
              : points.length === 1 ? 'Klik titik akhir di peta (atau tambah titik lagi)'
              : `${points.length} titik dipilih`}
          </p>
          <div className="flex gap-1.5">
            {points.length >= 2 && (
              <button onClick={generateProfile} disabled={loading}
                className="flex-1 text-xs bg-blue-950 text-white py-1.5 rounded-lg font-medium hover:bg-blue-900 disabled:opacity-50 transition-all">
                {loading ? 'Memuat elevasi...' : 'Buat Profil'}
              </button>
            )}
            <button onClick={reset}
              className="text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-all">
              Reset
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5">
          <p className="text-[11px] text-red-600">{error}</p>
        </div>
      )}

      {elevData && !loading && (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { label: 'Min', value: `${elevData.min.toFixed(0)} m` },
              { label: 'Maks', value: `${elevData.max.toFixed(0)} m` },
              { label: 'Jarak', value: `${(elevData.dist / 1000).toFixed(2)} km` },
            ].map(s => (
              <div key={s.label} className="bg-blue-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-blue-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-[11px] font-bold text-blue-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Info bar — di ATAS chart, tidak menutupi grafik */}
          <div className="rounded-lg bg-slate-800 px-3 py-2 min-h-[42px] flex items-center">
            {hoverInfo ? (
              <div className="flex items-center gap-3 text-white w-full">
                <div className="flex flex-col leading-tight">
                  <span className="text-[8px] text-slate-400 uppercase tracking-wide">Jarak</span>
                  <span className="text-[11px] font-semibold tabular-nums">{hoverInfo.dist} km</span>
                </div>
                <div className="w-px h-6 bg-slate-600" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[8px] text-slate-400 uppercase tracking-wide">Elevasi</span>
                  <span className="text-[11px] font-semibold tabular-nums">{hoverInfo.elev.toFixed(0)} mdpl</span>
                </div>
                <div className="w-px h-6 bg-slate-600" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[8px] text-slate-400 uppercase tracking-wide">Koordinat</span>
                  <span className="text-[10px] font-mono tabular-nums">{hoverInfo.lat.toFixed(4)}, {hoverInfo.lng.toFixed(4)}</span>
                </div>
              </div>
            ) : (
              <span className="text-[10px] text-slate-400 italic">Arahkan kursor ke grafik atau garis di peta untuk melihat detail titik</span>
            )}
          </div>

          <div className="rounded-lg border border-gray-100 bg-white p-2" style={{ height: '160px' }}>
            <canvas ref={chartRef} />
          </div>
        </>
      )}

      {!active && !elevData && !error && (
        <p className="text-[11px] text-gray-400 text-center py-4">
          Klik Mulai, lalu pilih 2 titik di peta untuk membuat profil elevasi
        </p>
      )}
    </div>
  )
}