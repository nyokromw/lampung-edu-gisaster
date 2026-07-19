'use client'

import { usePathname } from 'next/navigation'

export default function NavbarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Halaman yang TIDAK perlu pt-16: homepage, peta, admin
  const noPadding = pathname === '/' || pathname.startsWith('/peta') || pathname.startsWith('/admin')
  return <div className={noPadding ? '' : 'pt-16'}>{children}</div>
}