import Link from 'next/link'
import ParticleCanvas from '@/components/ParticleCanvas'
import ImageCarousel from '@/components/ImageCarousel'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#020810]">
      <section
        className="relative h-[calc(100vh-64px)] overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #020810 0%, #071229 30%, #0c1940 60%, #0a0f2e 100%)',
        }}
      >
        <ParticleCanvas />

        {/* Glows */}
        <div className="absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[300px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.04) 0%, transparent 70%)' }} />

        {/* ══════ GRID ══════ */}
        <div className="relative z-10 h-full flex items-center max-w-7xl mx-auto w-full px-6 sm:px-10 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-12 items-center w-full">

            {/* ── LEFT ── */}
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium text-amber-400 mb-5"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Platform Edukasi Kebencanaan Lampung
              </span>

              <h1 className="text-[clamp(32px,4.5vw,52px)] font-extrabold text-white leading-[1.05] tracking-tight">
                Lampung Edu
              </h1>
              <h1 className="text-[clamp(32px,4.5vw,52px)] font-extrabold leading-[1.05] tracking-tight mb-5"
                style={{ background: 'linear-gradient(135deg, #14b8a6, #818cf8, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Gisaster
              </h1>

              <p className="text-[15px] mb-4" style={{ color: 'rgba(186,207,247,0.6)' }}>
                Media edukasi bencana berbasis{' '}
                <span className="text-teal-400 font-semibold">Web-GIS</span>
                {' '}dan pendekatan{' '}
                <span className="text-violet-400 font-semibold">Deep Learning</span>
              </p>

              <p className="text-[13px] leading-[1.75] mb-8 max-w-[480px]" style={{ color: 'rgba(186,207,247,0.35)' }}>
                Platform interaktif untuk menyajikan peta rawan bencana dan faktor kebencanaan
                Provinsi Lampung guna meningkatkan{' '}
                <span className="text-teal-400/70 font-medium">spatial disaster literacy</span> siswa.
              </p>

              <div className="flex flex-wrap gap-3">
                <Link href="/peta"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold
                    bg-gradient-to-r from-amber-400 to-yellow-500 text-blue-950
                    hover:from-amber-400 hover:to-orange-500
                    hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,158,11,0.3)]
                    shadow-[0_4px_12px_rgba(245,158,11,0.15)]
                    transition-all duration-200">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                  </svg>
                  Jelajahi Peta
                </Link>
                <Link href="/materi"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold
                    text-white border border-indigo-500/30 bg-indigo-500/15 hover:bg-indigo-500/30
                    hover:-translate-y-0.5 transition-all duration-200">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  Pelajari Materi
                </Link>
                <Link href="/lkpd"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold
                    text-white border border-teal-500/25 bg-teal-500/[0.12] hover:bg-teal-500/25
                    hover:-translate-y-0.5 transition-all duration-200">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                  </svg>
                  Kerjakan E-LKPD
                </Link>
              </div>
            </div>

            {/* ── RIGHT: Carousel only ── */}
            <div className="w-full h-[55vh] min-h-[320px] max-h-[480px]">
              <ImageCarousel />
            </div>

          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="px-6 sm:px-10 lg:px-16 py-5 flex items-center justify-between flex-wrap gap-4"
        style={{ background: '#020810', borderTop: '1px solid rgba(99,102,241,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #14b8a6, #6366f1)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold text-white">Lampung Edu Gisaster</p>
            <p className="text-[10px]" style={{ color: 'rgba(186,207,247,0.25)' }}>FKIP Universitas Lampung</p>
          </div>
        </div>
        <p className="text-[10px]" style={{ color: 'rgba(186,207,247,0.15)' }}>© 2025 — Platform GIS Edukasi Kebencanaan</p>
      </footer>
    </main>
  )
}