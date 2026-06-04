import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const locations = request.nextUrl.searchParams.get('locations')
  
  const res = await fetch(
    `https://api.opentopodata.org/v1/srtm30m?locations=${locations}`
  )
  const data = await res.json()
  
  return NextResponse.json(data)
}