'use client'

import dynamic from 'next/dynamic'

const GameBencana = dynamic(() => import('@/components/game/GameBencana'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen pt-24 flex items-center justify-center bg-blue-950 text-white">
      <p className="animate-pulse">Memuat game 3D...</p>
    </main>
  ),
})

export default function GamePage() {
  return <GameBencana />
}