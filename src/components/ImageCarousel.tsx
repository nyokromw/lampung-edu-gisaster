"use client";

import { useEffect, useRef, useState, useCallback } from 'react'

interface CarouselImage {
  url: string
  caption: string
}

const IMAGES: CarouselImage[] = [
  {
    url: 'https://pgptvvqfagpbdbjrtrqt.supabase.co/storage/v1/object/public/about-assets/HERO%201.png',
    caption: 'Banjir di Bandar Lampung',
  },
  {
    url: 'https://asset.kompas.com/crops/PgDHgSDnsuDD2kIhT1QxnKEovWY=/0x0:0x0/1200x800/data/photo/2025/01/18/678aefdba5a14.jpg',
    caption: 'Dampak bencana banjir Lampung',
  },
  {
    url: 'https://awsimages.detik.net.id/community/media/visual/2025/01/19/kondisi-banjir-di-bandar-lampung_169.jpeg?w=1200',
    caption: 'Kondisi banjir Bandar Lampung',
  },
  {
    url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSiTMh80McCNSSl6iNv4FPmVMebMxKc38Nrg4fP24Ooq1Jh2aAJ7RjnC8Q&s=10',
    caption: 'Bencana alam Provinsi Lampung',
  },
]

const INTERVAL = 5000

export default function ImageCarousel() {
  const [current, setCurrent] = useState(0)
  const [loadErr, setLoadErr] = useState<Record<number, boolean>>({})
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [progressKey, setProgressKey] = useState(0)

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % IMAGES.length)
      setProgressKey((k) => k + 1)
    }, INTERVAL)
  }, [])

  const goTo = useCallback(
    (idx: number) => {
      setCurrent(((idx % IMAGES.length) + IMAGES.length) % IMAGES.length)
      setProgressKey((k) => k + 1)
      startTimer()
    },
    [startTimer]
  )

  useEffect(() => {
    startTimer()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [startTimer])

  return (
    <div className="hero-carousel" aria-roledescription="carousel" aria-label="Galeri kebencanaan Lampung">
      {/* Progress bar */}
      <div className="hero-carousel-progress">
        <div
          key={progressKey}
          className="hero-carousel-progress-fill"
          style={{
            animation: `progressBar ${INTERVAL}ms linear forwards`,
          }}
        />
      </div>

      {/* Slides */}
      {IMAGES.map((img, i) => (
        <div
          key={i}
          className="hero-carousel-slide"
          aria-hidden={current !== i}
          style={{
            opacity: current === i ? 1 : 0,
            transition: 'opacity 0.65s ease-in-out',
            zIndex: current === i ? 1 : 0,
          }}
        >
          {!loadErr[i] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.url}
              alt={img.caption}
              onError={() => setLoadErr((e) => ({ ...e, [i]: true }))}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div
              className="hero-carousel-fallback"
              style={{
                background: `linear-gradient(135deg, #104b76, #7dc5e0)`,
              }}
            >
              <div className="text-center">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <p className="text-white text-sm mt-2">{img.caption}</p>
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="hero-carousel-shade" />

          {/* Caption */}
          <div className="hero-carousel-caption">
            <p>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5a7.5 7.5 0 0 0-7.5 7.5c0 5.5 7.5 11.5 7.5 11.5s7.5-6 7.5-11.5A7.5 7.5 0 0 0 12 2.5Zm0 10.2a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z" /></svg>
              {img.caption}
            </p>
          </div>
        </div>
      ))}

      {/* Prev button */}
      <button
        onClick={() => goTo(current - 1)}
        className="hero-carousel-arrow hero-carousel-prev"
        aria-label="Gambar sebelumnya"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Next button */}
      <button
        onClick={() => goTo(current + 1)}
        className="hero-carousel-arrow hero-carousel-next"
        aria-label="Gambar berikutnya"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots */}
      <div className="hero-carousel-dots" aria-label="Pilih gambar">
        {IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Tampilkan gambar ${i + 1}`}
            aria-current={current === i ? 'true' : undefined}
            className={`hero-carousel-dot ${current === i ? 'is-active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
