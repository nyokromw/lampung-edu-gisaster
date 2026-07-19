import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(req: NextRequest) {
  const token = req.cookies.get('admin-auth')?.value

  if (
    req.nextUrl.pathname.startsWith('/admin') &&
    !req.nextUrl.pathname.startsWith('/admin/login')
  ) {
    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }

  if (req.nextUrl.pathname === '/admin/login' && token) {
    return NextResponse.redirect(new URL('/admin', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}