'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

export default function PetaPage() {
  return (
    <main className="w-full h-screen">
      <Map />
    </main>
  )
}