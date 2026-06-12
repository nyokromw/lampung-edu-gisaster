import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">G</span>
            </div>
            <span className="font-bold text-gray-900">Lampung Edu Gisaster</span>
          </div>
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

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-block bg-blue-50 text-blue-600 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          Platform GIS Edukasi Kebencanaan Lampung
        </div>
        <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-6">
          Belajar Bencana,<br />
          <span className="text-blue-600">Lebih Mudah dengan Peta</span>
        </h1>
        <p className="text-lg text-gray-500 mb-10 max-w-2xl mx-auto">
          Platform edukasi kebencanaan berbasis GIS untuk guru dan siswa SMA di Provinsi Lampung.
          Analisis peta bencana, pelajari mitigasi, dan kerjakan E-LKPD interaktif.
        </p>
        <div className="flex items-center justify-center gap-4 mb-12">
          <Link
            href="/peta"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Buka Peta Interaktif
          </Link>
          <Link
            href="/materi"
            className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            Lihat Materi
          </Link>
        </div>
        <div className="flex items-center justify-center gap-8 text-sm text-gray-500 flex-wrap">
          <span>✓ 15 Kabupaten/Kota</span>
          <span>✓ 12 Jenis Bencana</span>
          <span>✓ Peta Interaktif GIS</span>
          <span>✓ E-LKPD Digital</span>
        </div>
      </section>

      {/* Fitur */}
      <section className="py-20 bg-gray-50 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Fitur Unggulan</h2>
          <p className="text-center text-gray-500 mb-12">Semua yang dibutuhkan untuk belajar kebencanaan secara spasial</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">🗺️</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Peta Bencana Interaktif</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Visualisasi data bencana 15 kabupaten/kota Lampung. Ukur jarak, analisis dampak, dan buat profil topografi.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📚</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Materi Kebencanaan</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Materi lengkap sesuai kurikulum SMA — dari konsep dasar hingga mitigasi per jenis bencana di Lampung.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <span className="text-2xl">📝</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">E-LKPD Interaktif</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Lembar kerja digital berbasis peta. Isi jawaban, buat diagram, dan download PDF untuk dipresentasikan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fitur GIS */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Analisis Spasial Lengkap</h2>
          <p className="text-center text-gray-500 mb-12">Tools GIS profesional yang bisa dipakai langsung di browser</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '📏', label: 'Ukur Jarak & Luas' },
              { icon: '⛰️', label: 'Cross Section Topografi' },
              { icon: '🔍', label: 'Search Lokasi' },
              { icon: '🔄', label: 'Overlay Analisis Dampak' },
              { icon: '🗂️', label: 'Multi Layer Bencana' },
              { icon: '🎚️', label: 'Kontrol Opacity Layer' },
              { icon: '🏔️', label: 'Basemap Topografi' },
              { icon: '📊', label: 'Grafik Elevasi' },
            ].map((f) => (
              <div key={f.label} className="border rounded-lg p-4 text-center hover:border-blue-300 hover:bg-blue-50 transition">
                <div className="text-2xl mb-2">{f.icon}</div>
                <p className="text-xs font-medium text-gray-700">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-blue-600 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">Siap Mulai Belajar?</h2>
          <p className="text-blue-100 mb-8">Buka peta bencana Lampung dan mulai eksplorasi sekarang. Gratis untuk semua guru dan siswa.</p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/peta"
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition"
            >
              Buka Peta Sekarang
            </Link>
            <Link
              href="/lkpd"
              className="border border-blue-300 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Kerjakan E-LKPD
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 px-6 text-center">
        <p className="text-gray-400 text-sm">© 2025 Lampung Edu Gisaster — Platform GIS Edukasi Kebencanaan</p>
        <p className="text-gray-500 text-xs mt-1">Dikembangkan untuk FKIP Universitas Lampung</p>
      </footer>

    </main>
  )
}