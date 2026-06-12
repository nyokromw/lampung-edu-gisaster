import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <span className="font-bold text-gray-900">Lampung Edu Gisaster</span>
        </Link>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/peta" className="text-sm text-gray-600 hover:text-blue-600">Peta</Link>
          <Link href="/materi" className="text-sm text-gray-600 hover:text-blue-600">Materi</Link>
          <Link href="/lkpd" className="text-sm text-gray-600 hover:text-blue-600">E-LKPD</Link>
        </div>
        <Link
          href="/admin"
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Admin
        </Link>
      </div>
    </nav>
  )
}