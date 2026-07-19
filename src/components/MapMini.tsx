'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const MapFull = dynamic(() => import('@/components/Map'), { ssr: false })

interface Props {
  aktivitasId: number
  height?: number
}

export default function MapMini({ aktivitasId, height = 320 }: Props) {
  const [fullscreen, setFullscreen] = useState(false)
  const mapId = `map-lkpd-${aktivitasId}`

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      {/* Mini view */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200"
        style={{ height: `${height}px` }}>
        <div className="w-full h-full">
          <MapFull mapId={mapId} compact={true} />
        </div>
        <button onClick={() => setFullscreen(true)}
          className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 bg-white border border-gray-200 shadow-md px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
          </svg>
          Peta Penuh
        </button>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <div className="fixed inset-0 z-[9999] flex flex-col">
          <div className="flex items-center justify-between bg-blue-950 px-4 py-2.5 flex-shrink-0">
            <p className="text-white text-sm font-semibold">Peta Bencana Interaktif</p>
            <button onClick={() => setFullscreen(false)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
              </svg>
              Tutup (ESC)
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <MapFull mapId={`${mapId}-full`} />
          </div>
        </div>
      )}
    </>
  )
}