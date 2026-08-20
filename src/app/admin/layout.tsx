'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const MENU = [
  {
    group: 'Konten Peta',
    items: [
      { href: '/admin', label: 'Layer Peta', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
        </svg>
      )},
    ]
  },
  {
    group: 'Pembelajaran',
    items: [
      { href: '/admin/materi', label: 'Materi Mitigasi', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      )},
      { href: '/admin/pembelajaran', label: 'Pembelajaran Mendalam', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
        </svg>
      )},
      { href: '/admin/lkpd', label: 'E-LKPD', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      )},
      { href: '/admin/hasil-lkpd', label: 'Hasil LKPD', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
        </svg>
      )},
      { href: '/admin/sdl-test', label: 'SDL Test', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )},
    ]
  },
  {
    group: 'Pengaturan',
    items: [
      { href: '/admin/about', label: 'About Us', icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
      )},
    ]
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    document.cookie = 'admin-auth=; path=/; max-age=0'
    router.push('/admin/login')
    router.refresh()
  }

  const activeLabel = MENU.flatMap(g => g.items).find(i =>
    i.href === '/admin' ? pathname === '/admin' : pathname.startsWith(i.href)
  )?.label ?? 'Admin'

  // Bypass layout di halaman login — setelah semua hooks
  if (pathname === '/admin/login') return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── SIDEBAR ── */}
      <aside className={`${collapsed ? 'w-[60px]' : 'w-[220px]'} flex-shrink-0 bg-blue-950 flex flex-col transition-all duration-300 z-20`}>

        {/* Logo */}
        <div className="px-4 py-4 border-b border-white/10 flex items-center gap-2.5 min-h-[60px]">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <p className="text-white text-[12px] font-bold leading-tight">Edu Gisaster</p>
              <p className="text-blue-300/60 text-[9px]">Admin Panel</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {MENU.map(group => (
            <div key={group.group} className="mb-4">
              {!collapsed && (
                <p className="text-[9px] font-bold text-blue-400/60 uppercase tracking-widest px-2 mb-1.5">{group.group}</p>
              )}
              {group.items.map(item => {
                const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href)
                return (
                  <Link key={item.href} href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 transition-all
                      ${active ? 'bg-amber-400 text-blue-950 font-semibold' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}>
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="text-[12px] truncate">{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 py-3 border-t border-white/10 flex flex-col gap-0.5">
          <Link href="/" target="_blank"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/80 transition-all">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            {!collapsed && <span className="text-[12px]">Lihat Website</span>}
          </Link>
          <button onClick={handleLogout}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-white/40 hover:bg-red-500/20 hover:text-red-300 transition-all w-full text-left">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            {!collapsed && <span className="text-[12px]">Logout</span>}
          </button>
          <button onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-white/20 hover:bg-white/10 hover:text-white/50 transition-all w-full">
            <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 9-3 3 3 3m4.5-6 3 3-3 3M3.75 12h16.5" />
            </svg>
            {!collapsed && <span className="text-[11px]">Ciutkan</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top header */}
        <header className="h-[60px] bg-white border-b border-gray-200 flex items-center px-6 flex-shrink-0 shadow-sm">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">{activeLabel}</p>
            <p className="text-[10px] text-gray-400">Lampung Edu Gisaster · Admin</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" target="_blank"
              className="text-xs text-gray-400 hover:text-gray-700 transition-all hidden md:block">
              ← Ke Website
            </Link>
            <div className="w-8 h-8 bg-blue-950 rounded-full flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">A</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}