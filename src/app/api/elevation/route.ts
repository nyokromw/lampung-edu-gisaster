import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const locations = request.nextUrl.searchParams.get('locations')
  if (!locations) return NextResponse.json({ error: 'locations required' }, { status: 400 })

  // Primary: opentopodata SRTM30m
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(
      `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`,
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    if (res.ok) {
      const data = await res.json()
      if (data.results) return NextResponse.json(data)
    }
  } catch (_) {}

  // Fallback: Open-Meteo (format berbeda, convert ke opentopodata format)
  try {
    const pts = locations.split('|').map(l => {
      const [lat, lng] = l.split(',')
      return { lat: parseFloat(lat), lng: parseFloat(lng) }
    })
    const lats = pts.map(p => p.lat).join(',')
    const lngs = pts.map(p => p.lng).join(',')
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
    )
    if (res.ok) {
      const data = await res.json()
      // Convert to opentopodata format
      const results = data.elevation.map((elev: number, i: number) => ({
        elevation: elev,
        location: { lat: pts[i].lat, lng: pts[i].lng }
      }))
      return NextResponse.json({ results, status: 'OK' })
    }
  } catch (_) {}

  return NextResponse.json({ error: 'Semua sumber elevasi gagal' }, { status: 503 })
}