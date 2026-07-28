'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
  brightness: number
  phase: number
}

export default function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let time = 0
    const particles: Particle[] = []
    const COLORS = ['rgba(20,184,166,', 'rgba(99,102,241,', 'rgba(245,158,11,']

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx!.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    for (let i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * 2000,
        y: Math.random() * 1400,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 2 + 0.5,
        color: COLORS[Math.floor(Math.random() * 3)],
        brightness: Math.random() * 0.5 + 0.3,
        phase: Math.random() * Math.PI * 2,
      })
    }

    function draw() {
      if (!canvas || !ctx) return
      time += 0.008
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      ctx.clearRect(0, 0, w, h)

      particles.forEach((p, i) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1

        const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + p.phase)
        const alpha = p.brightness * twinkle

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color + alpha.toFixed(2) + ')'
        ctx.fill()

        if (p.r > 1.5) {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4)
          glow.addColorStop(0, p.color + (alpha * 0.12).toFixed(2) + ')')
          glow.addColorStop(1, p.color + '0)')
          ctx.fillStyle = glow
          ctx.fillRect(p.x - p.r * 4, p.y - p.r * 4, p.r * 8, p.r * 8)
        }

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(99,102,241,${(0.07 * (1 - dist / 120)).toFixed(3)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  )
}