import Link from 'next/link'
import ImageCarousel from '@/components/ImageCarousel'

const features = [
  { title: 'Edukasi Bencana', detail: 'Kenali ancaman, mitigasi, dan langkah kesiapsiagaan.', href: '/materi', tone: 'blue', icon: <><path d="M12 2.5 20 6v5.4c0 5.1-3.3 8.3-8 10.1-4.7-1.8-8-5-8-10.1V6l8-3.5Z" /><path d="M12 6v11m-4-4 4 4 4-4" /></> },
  { title: 'Peta Interaktif', detail: 'Jelajahi informasi spasial kebencanaan Lampung.', href: '/peta', tone: 'teal', icon: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z" /><path d="M9 3v16m6-14v16" /></> },
  { title: 'Deep Learning', detail: 'Analisis masalah nyata dan bangun pemahaman mendalam.', href: '/lkpd', tone: 'violet', icon: <><path d="M9 4a3 3 0 0 0-4 4 3.5 3.5 0 0 0-.5 6A3.5 3.5 0 0 0 9 19m6-15a3 3 0 0 1 4 4 3.5 3.5 0 0 1 .5 6A3.5 3.5 0 0 1 15 19M9 4v15a3 3 0 0 0 6 0V4a3 3 0 0 0-6 0Z" /><path d="M7 10h2m6 0h2M7 15h2m6 0h2" /></> },
  { title: 'Literasi Bencana Spasial', detail: 'Baca peta, pahami risiko, dan tentukan tindakan.', href: '/sdl-test', tone: 'amber', icon: <><path d="M12 5c-2.5-1.5-5.4-1.6-9-.5v15c3.6-1.1 6.5-1 9 .5 2.5-1.5 5.4-1.6 9-.5v-15C17.4 3.4 14.5 3.5 12 5Z" /><path d="M12 5v15m-6-12h3m6 0h3m-12 4h3m6 0h3" /></> },
]

function Arrow() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg> }

function Landscape() {
  return <svg className="home-landscape" viewBox="0 0 1440 280" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Ilustrasi siluet Menara Siger, perbukitan, dan pesisir Lampung">
    <path fill="#d8efff" d="M0 118c80-66 141-67 218-32 74 34 106 65 178 37 93-36 157-67 248-8 68 44 120 39 199 0 93-45 167-32 226 15 64 51 133 23 201-32 67-55 116-67 170-42v224H0Z" />
    <path fill="#a9d9f4" d="M0 154c84-32 131-26 203 21 46 30 123 45 189 20 68-27 135-19 204 10 74 30 159 22 221-13 82-46 162-38 222 8 47 36 108 47 185 15 86-35 143-88 216-81v146H0Z" />
    <path fill="#69b9e1" d="M0 215c129-27 219 57 320 36 92-18 120-36 234-17 100 16 154 32 265 5 109-27 194-26 280 10 89 37 205-48 341-16v47H0Z" />
    <g fill="#2879a5" opacity=".75"><path d="M37 229 65 160l28 69Zm42 1 28-88 31 88Zm70 3 17-53 19 53Zm1098 8 26-69 24 69Zm36 2 34-89 36 89Z" /></g>
    <g transform="translate(86 110)" fill="#155f89" stroke="#155f89" strokeLinejoin="round"><path d="M22 110h71l-9-10H30Z" /><path d="M29 99h58L78 64H38Z" /><path d="M38 63h40l-7-12H45Z" /><path d="M47 50h22l-3-21H50Z" /><path d="M54 28h8L58 4Z" /><path d="M17 62q9 16 20-2 8 15 21-3 13 18 22 3 12 17 23 2-7 25-29 15H47Q24 86 17 62Z" strokeWidth="2" /><path d="M41 91h33m-29-9h25" fill="none" stroke="#a9d9f4" strokeWidth="3" /></g>
    <path fill="#eef9ff" d="M0 254c164-15 303 34 463 22 125-9 200-27 350-9 138 17 265 1 370-14 113-17 173-7 257 7v20H0Z" />
  </svg>
}

export default function HomePage() {
  return <main className="home-page">
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-cloud home-cloud-one" aria-hidden="true" /><div className="home-cloud home-cloud-two" aria-hidden="true" />
      <div className="home-container home-main-grid">
        <div className="home-copy">
          <span className="home-eyebrow"><span className="home-eyebrow-dot" />Platform Edukasi Kebencanaan Lampung</span>
          <h1 id="home-title">Lampung Edu<br /><span>Gisaster</span></h1>
          <p className="home-lead">Media edukasi bencana berbasis <strong>Web-GIS</strong> dan pendekatan <strong>Deep Learning</strong></p>
          <p className="home-description">Jelajahi peta rawan bencana, pahami lingkungan sekitar, dan latih kemampuan mengambil keputusan berbasis informasi spasial.</p>
          <div className="home-actions">
            <Link className="home-button home-button-primary" href="/peta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16" /></svg>Jelajahi Peta<Arrow /></Link>
            <Link className="home-button home-button-secondary" href="/materi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5C9.5 3.5 6.5 3.5 3 4.5v15c3.5-1 6.5-1 9 .5 2.5-1.5 5.5-1.5 9-.5v-15c-3.5-1-6.5-1-9 .5Zm0 0v15" /></svg>Pelajari Materi<Arrow /></Link>
            <Link className="home-button home-button-outline" href="/lkpd"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 8 12 4l9 4-9 4-9-4Zm3 2v6c4 3 8 3 12 0v-6m3-2v8" /></svg>Kerjakan E-LKPD<Arrow /></Link>
          </div>
        </div>
        <div className="home-carousel-wrap"><ImageCarousel /></div>
      </div>
      <div className="home-container home-features" aria-label="Fitur utama">
        {features.map(f => <Link key={f.href} href={f.href} className={`home-feature home-feature-${f.tone}`}><span className="home-feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{f.icon}</svg></span><span className="home-feature-body"><strong>{f.title}</strong><span>{f.detail}</span></span><span className="home-feature-arrow" aria-hidden="true"><Arrow /></span></Link>)}
      </div>
      <Landscape />
    </section>
    <footer className="home-footer"><span>Lampung Edu Gisaster · FKIP Universitas Lampung</span><span>Belajar memahami risiko, mulai dari peta.</span></footer>
  </main>
}