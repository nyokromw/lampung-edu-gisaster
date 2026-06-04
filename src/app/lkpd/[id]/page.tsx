'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const Map = dynamic(() => import('@/components/Map'), { ssr: false })

interface Aktivitas {
  id: number
  judul: string
  instruksi: string
  tipe: 'esai' | 'pilihan_ganda' | 'tabel' | 'diagram'
  kode_sdl: string
  ada_peta: boolean
  peta_kabupaten_id?: number
  soal?: string
  pilihan?: string[]
  jawaban_benar?: number
  kolom_tabel?: string[]
  jumlah_baris?: number
  jenis_grafik?: 'bar' | 'pie' | 'line'
  kolom_diagram?: string[]
}

interface Lkpd {
  id: string
  judul: string
  kabupaten: { nama: string }
  jenis_bencana: { nama: string }
  pertanyaan: Aktivitas[]
}

export default function LkpdDetailPage() {
  const params = useParams()
  const [lkpd, setLkpd] = useState<Lkpd | null>(null)
  const [identitas, setIdentitas] = useState({ nama: '', sekolah: '', kelas: '' })
  const [identitasSelesai, setIdentitasSelesai] = useState(false)
  const [jawaban, setJawaban] = useState<Record<number, any>>({})
  const [tabelData, setTabelData] = useState<Record<number, string[][]>>({})
  const [diagramData, setDiagramData] = useState<Record<number, string[][]>>({})

  useEffect(() => {
    const fetchLkpd = async () => {
      const { data } = await supabase
        .from('e_lkpd')
        .select('*, kabupaten(nama), jenis_bencana(nama)')
        .eq('id', params.id)
        .single()
      if (data) {
        setLkpd(data)
        const initTabel: Record<number, string[][]> = {}
        const initDiagram: Record<number, string[][]> = {}
        data.pertanyaan?.forEach((a: Aktivitas) => {
          if (a.tipe === 'tabel') {
            initTabel[a.id] = Array(a.jumlah_baris || 3).fill(null).map(() =>
              Array(a.kolom_tabel?.length || 2).fill('')
            )
          }
          if (a.tipe === 'diagram') {
            initDiagram[a.id] = Array(5).fill(null).map(() =>
              Array(a.kolom_diagram?.length || 2).fill('')
            )
          }
        })
        setTabelData(initTabel)
        setDiagramData(initDiagram)
      }
    }
    fetchLkpd()
  }, [params.id])

  const updateTabel = (aktivitasId: number, row: number, col: number, val: string) => {
    setTabelData(prev => {
      const updated = prev[aktivitasId].map(r => [...r])
      updated[row][col] = val
      return { ...prev, [aktivitasId]: updated }
    })
  }

  const updateDiagram = (aktivitasId: number, row: number, col: number, val: string) => {
    setDiagramData(prev => {
      const updated = prev[aktivitasId].map(r => [...r])
      updated[row][col] = val
      return { ...prev, [aktivitasId]: updated }
    })
  }

  const renderGrafik = (a: Aktivitas) => {
    const data = diagramData[a.id]
    if (!data) return null
    const labels = data.map(r => r[0]).filter(Boolean)
    const values = data.map(r => parseFloat(r[1])).filter(v => !isNaN(v))
    if (labels.length === 0) return null

    const canvasId = `chart-${a.id}`
    setTimeout(() => {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement
      if (!canvas) return
      const existing = Chart.getChart(canvas)
      if (existing) existing.destroy()
      new Chart(canvas, {
        type: a.jenis_grafik || 'bar',
        data: {
          labels,
          datasets: [{
            label: a.kolom_diagram?.[1] || 'Nilai',
            data: values,
            backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6'],
          }]
        },
        options: { responsive: true }
      })
    }, 100)

    return <canvas id={canvasId} className="mt-3 max-h-48" />
  }

  const handleCetak = () => window.print()

  if (!lkpd) return <div className="p-8">Loading...</div>

  if (!identitasSelesai) {
    return (
      <main className="p-8 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-2">{lkpd.judul}</h1>
        <p className="text-gray-500 text-sm mb-6">Isi identitas sebelum mengerjakan</p>
        <div className="flex flex-col gap-3">
          <input
            className="border p-2 rounded"
            placeholder="Nama lengkap"
            value={identitas.nama}
            onChange={(e) => setIdentitas({ ...identitas, nama: e.target.value })}
          />
          <input
            className="border p-2 rounded"
            placeholder="Nama sekolah"
            value={identitas.sekolah}
            onChange={(e) => setIdentitas({ ...identitas, sekolah: e.target.value })}
          />
          <input
            className="border p-2 rounded"
            placeholder="Kelas"
            value={identitas.kelas}
            onChange={(e) => setIdentitas({ ...identitas, kelas: e.target.value })}
          />
          <button
            className="bg-blue-600 text-white p-2 rounded"
            onClick={() => {
              if (!identitas.nama || !identitas.sekolah || !identitas.kelas) {
                alert('Lengkapi identitas dulu!')
                return
              }
              setIdentitasSelesai(true)
            }}
          >
            Mulai Mengerjakan
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="p-8 max-w-3xl mx-auto" id="lkpd-print">
      <style>{`
        @media print {
          button { display: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-8 border-b pb-4">
        <h1 className="text-2xl font-bold">LEMBAR KERJA PESERTA DIDIK</h1>
        <h2 className="text-lg mt-1">{lkpd.judul}</h2>
        <p className="text-sm text-gray-500 mt-1">{lkpd.kabupaten?.nama} — {lkpd.jenis_bencana?.nama}</p>
      </div>

      {/* Identitas */}
      <div className="border rounded p-4 mb-6">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Nama:</span> <strong>{identitas.nama}</strong></div>
          <div><span className="text-gray-500">Kelas:</span> <strong>{identitas.kelas}</strong></div>
          <div className="col-span-2"><span className="text-gray-500">Sekolah:</span> <strong>{identitas.sekolah}</strong></div>
        </div>
      </div>

      {/* Aktivitas */}
      <div className="flex flex-col gap-8">
        {lkpd.pertanyaan?.map((a, index) => (
          <div key={a.id} className="border rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold">Aktivitas {index + 1}</span>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{a.kode_sdl}</span>
            </div>
            <h3 className="font-medium mb-1">{a.judul}</h3>
            <p className="text-sm text-gray-600 mb-3">{a.instruksi}</p>

            {a.ada_peta && (
              <div className="mb-4 no-print" style={{ height: '300px' }}>
                <Map />
              </div>
            )}

            {a.tipe === 'esai' && (
              <div>
                <p className="text-sm font-medium mb-2">{a.soal}</p>
                <textarea
                  className="border p-2 rounded w-full text-sm"
                  rows={5}
                  placeholder="Tulis jawabanmu di sini..."
                  value={jawaban[a.id] || ''}
                  onChange={(e) => setJawaban({ ...jawaban, [a.id]: e.target.value })}
                />
              </div>
            )}

            {a.tipe === 'pilihan_ganda' && (
              <div>
                <p className="text-sm font-medium mb-2">{a.soal}</p>
                <div className="flex flex-col gap-2">
                  {a.pilihan?.map((p, pi) => (
                    <label key={pi} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={`jawaban-siswa-${a.id}`}
                        value={pi}
                        checked={jawaban[a.id] === pi}
                        onChange={() => setJawaban({ ...jawaban, [a.id]: pi })}
                      />
                      {p}
                    </label>
                  ))}
                </div>
                {jawaban[a.id] !== undefined && (
                  <p className={`text-xs mt-2 font-medium ${jawaban[a.id] === a.jawaban_benar ? 'text-green-600' : 'text-red-500'}`}>
                    {jawaban[a.id] === a.jawaban_benar ? '✓ Benar!' : '✗ Belum tepat, coba lagi'}
                  </p>
                )}
              </div>
            )}

            {a.tipe === 'tabel' && (
              <div>
                <p className="text-sm font-medium mb-2">{a.soal}</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr>
                        {a.kolom_tabel?.map((k, ki) => (
                          <th key={ki} className="border p-2 bg-gray-50 text-left">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tabelData[a.id]?.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="border p-1">
                              <input
                                className="w-full p-1 text-sm outline-none"
                                value={cell}
                                onChange={(e) => updateTabel(a.id, ri, ci, e.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {a.tipe === 'diagram' && (
              <div>
                <p className="text-sm font-medium mb-2">{a.soal}</p>
                <div className="overflow-x-auto mb-2">
                  <table className="text-sm border-collapse">
                    <thead>
                      <tr>
                        {a.kolom_diagram?.map((k, ki) => (
                          <th key={ki} className="border p-2 bg-gray-50">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {diagramData[a.id]?.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="border p-1">
                              <input
                                className="w-full p-1 text-sm outline-none"
                                value={cell}
                                onChange={(e) => updateDiagram(a.id, ri, ci, e.target.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  className="text-xs bg-blue-600 text-white px-3 py-1 rounded no-print"
                  onClick={() => renderGrafik(a)}
                >
                  Buat Grafik
                </button>
                {renderGrafik(a)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Tombol Cetak */}
      <div className="mt-8 flex gap-3 no-print">
        <button
          className="flex-1 bg-green-600 text-white p-3 rounded font-medium"
          onClick={handleCetak}
        >
          Download / Cetak PDF
        </button>
      </div>
    </main>
  )
}