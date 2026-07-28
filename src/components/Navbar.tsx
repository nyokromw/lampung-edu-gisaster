'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const MENU = [
  {
    href: '/',
    label: 'Beranda',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: '/materi',
    label: 'Materi Mitigasi',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    href: '/peta',
    label: 'Peta Bencana',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
  },
  {
    href: '/lkpd',
    label: 'E-LKPD',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
  },
  {
    href: '/sdl-test',
    label: 'SDL Test',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    href: '/about',
    label: 'About Us',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    ),
  },
]

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (pathname.startsWith('/admin')) return null

  return (
    <nav className="fixed top-0 left-0 right-0 z-[2000] h-16 bg-gradient-to-r from-blue-950 to-blue-900 border-b border-white/10 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center shadow-md shadow-teal-900/40">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
          </div>
          <span className="font-bold text-white text-sm hidden sm:block leading-tight">
            Lampung Edu<br />
            <span className="text-teal-300 font-semibold text-xs">Gisaster</span>
          </span>
        </Link>

        {/* Desktop menu */}
        <div className="hidden lg:flex items-center gap-0.5">
          {MENU.map(item => {
            const active = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg transition-all whitespace-nowrap
                  ${active
                    ? 'bg-amber-400 text-blue-950 shadow-sm shadow-amber-900/20'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}>
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden text-white/70 hover:text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {mobileOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            }
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-blue-950/98 backdrop-blur border-t border-white/10 py-2 px-4 flex flex-col gap-1 shadow-xl">
          {MENU.map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-all
                  ${active ? 'bg-amber-400 text-blue-950' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </nav>
  )
}