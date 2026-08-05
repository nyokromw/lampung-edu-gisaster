'use client'

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
    <div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        height: '320px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] z-30">
        <div
          key={progressKey}
          className="h-full rounded-r-sm"
          style={{
            background: 'linear-gradient(90deg, #14b8a6, #6366f1)',
            animation: `progressBar ${INTERVAL}ms linear forwards`,
          }}
        />
      </div>

      {/* Slides */}
      {IMAGES.map((img, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            opacity: current === i ? 1 : 0,
            transition: 'opacity 0.8s ease-in-out',
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
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, rgba(20,184,166,${
                  0.06 + i * 0.02
                }), rgba(99,102,241,${0.04 + i * 0.02}))`,
              }}
            >
              <div className="text-center">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <p className="text-white/25 text-xs mt-2">{img.caption}</p>
              </div>
            </div>
          )}

          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(0deg, rgba(5,13,31,0.7) 0%, transparent 50%)',
            }}
          />

          {/* Caption */}
          <div className="absolute bottom-5 left-6 z-10">
            <p className="text-white/85 text-sm font-medium drop-shadow-md">
              {img.caption}
            </p>
          </div>
        </div>
      ))}

      {/* Prev button */}
      <button
        onClick={() => goTo(current - 1)}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full
          text-white flex items-center justify-center transition-colors cursor-pointer"
        style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(4px)',
        }}
        aria-label="Previous slide"
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
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full
          text-white flex items-center justify-center transition-colors cursor-pointer"
        style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(4px)',
        }}
        aria-label="Next slide"
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
      <div className="absolute bottom-3 right-6 z-10 flex gap-1.5">
        {IMAGES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="h-2 rounded-full border-none cursor-pointer"
            style={{
              width: current === i ? '24px' : '8px',
              background:
                current === i ? '#f59e0b' : 'rgba(255,255,255,0.3)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}