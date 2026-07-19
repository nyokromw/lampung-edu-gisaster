'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

const inp = "w-full border border-gray-200 bg-white px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"

interface TimMember { nama: string; peran: string; foto_url?: string }

export default function AdminAboutPage() {
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState('')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)
  const timFotoRefs = useRef<(HTMLInputElement | null)[]>([])

  const [form, setForm] = useState({
    judul: 'Lampung Edu Gisaster',
    tagline: 'Platform GIS Edukasi Kebencanaan Lampung',
    deskripsi: 'Platform interaktif untuk meningkatkan Spatial Disaster Literacy (SDL) siswa SMA di Provinsi Lampung melalui analisis peta bencana berbasis web-GIS.',
    institusi: 'FKIP Universitas Lampung',
    prodi: 'Pendidikan Geografi',
    email_kontak: '',
    website: 'https://lampungedugisaster.vercel.app',
    tahun: '2025',
    versi: '1.0.0',
    foto_url: '',
  })

  const [tim, setTim] = useState<TimMember[]>([
    { nama: '', peran: '', foto_url: '' }
  ])

  // Load existing data
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('about')
        .select('*')
        .limit(1)
        .maybeSingle()
      if (data) {
        setForm({
          judul: data.judul || form.judul,
          tagline: data.tagline || form.tagline,
          deskripsi: data.deskripsi || form.deskripsi,
          institusi: data.institusi || form.institusi,
          prodi: data.prodi || form.prodi,
          email_kontak: data.email_kontak || '',
          website: data.website || '',
          tahun: data.tahun || '2025',
          versi: data.versi || '1.0.0',
          foto_url: data.foto_url || '',
        })
        if (data.tim && Array.isArray(data.tim)) setTim(data.tim)
      }
    }
    load()
  }, [])

  const handleUploadFotoUtama = async (file: File) => {
    setUploadingFoto(true)
    const fileName = `about/foto-utama-${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('about-assets').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('about-assets').getPublicUrl(fileName)
      setForm(p => ({ ...p, foto_url: urlData.publicUrl }))
    }
    setUploadingFoto(false)
  }

  const handleUploadFotoTim = async (file: File, index: number) => {
    const fileName = `about/tim-${index}-${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('about-assets').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('about-assets').getPublicUrl(fileName)
      setTim(p => p.map((t, i) => i === index ? { ...t, foto_url: urlData.publicUrl } : t))
    }
  }

  const handleSave = async () => {
    setLoading(true); setPesan('')
    const payload = { ...form, tim: tim.filter(t => t.nama.trim()) }

    // Check existing
    const { data: existing } = await supabase.from('about').select('id').limit(1).maybeSingle()
    const { error } = existing?.id
      ? await supabase.from('about').update(payload).eq('id', existing.id)
      : await supabase.from('about').insert(payload)

    setPesan(error ? 'Gagal: ' + error.message : 'Berhasil disimpan!')
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-[900px]">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-800">About Us</h1>
        <p className="text-sm text-gray-400 mt-0.5">Informasi platform yang ditampilkan di halaman About</p>
      </div>

      <div className="flex flex-col gap-5">

        {/* ── Identitas Platform ── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-950 rounded flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253M3 12c0 .778.099 1.533.284 2.253" />
              </svg>
            </div>
            Identitas Platform
          </h2>

          {/* Foto Utama */}
          <div className="mb-4">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Foto / Banner Platform</label>
            <div className="flex items-start gap-4">
              {form.foto_url ? (
                <div className="relative w-32 h-24 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                  <img src={form.foto_url} alt="foto platform" className="w-full h-full object-cover" />
                  <button onClick={() => setForm(p => ({ ...p, foto_url: '' }))}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]">✕</button>
                </div>
              ) : (
                <div onClick={() => fotoInputRef.current?.click()}
                  className="w-32 h-24 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all flex-shrink-0">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                  <span className="text-[10px] text-gray-400">{uploadingFoto ? 'Uploading...' : 'Upload foto'}</span>
                </div>
              )}
              <input ref={fotoInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFotoUtama(f) }} />
              <div className="text-xs text-gray-400">
                <p>Format: JPG, PNG, WebP</p>
                <p className="mt-1">Ukuran ideal: 1200×400px</p>
                <p className="mt-1">Akan ditampilkan sebagai banner di halaman About</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Judul Platform</label>
              <input className={inp} value={form.judul} onChange={e => setForm(p => ({ ...p, judul: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Tagline</label>
              <input className={inp} value={form.tagline} onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Deskripsi</label>
              <textarea className={inp} rows={3} value={form.deskripsi} onChange={e => setForm(p => ({ ...p, deskripsi: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Institusi</label>
              <input className={inp} value={form.institusi} onChange={e => setForm(p => ({ ...p, institusi: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Program Studi</label>
              <input className={inp} value={form.prodi} onChange={e => setForm(p => ({ ...p, prodi: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Email Kontak</label>
              <input className={inp} type="email" value={form.email_kontak} onChange={e => setForm(p => ({ ...p, email_kontak: e.target.value }))} placeholder="email@unila.ac.id" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Website</label>
              <input className={inp} value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://..." />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Tahun</label>
              <input className={inp} value={form.tahun} onChange={e => setForm(p => ({ ...p, tahun: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Versi Aplikasi</label>
              <input className={inp} value={form.versi} onChange={e => setForm(p => ({ ...p, versi: e.target.value }))} placeholder="1.0.0" />
            </div>
          </div>
        </div>

        {/* ── Tim Pengembang ── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-950 rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              </div>
              Tim Pengembang
            </h2>
            <button onClick={() => setTim(p => [...p, { nama: '', peran: '', foto_url: '' }])}
              className="text-xs bg-blue-950 text-white px-3 py-1.5 rounded-lg hover:bg-blue-900 transition-all">
              + Tambah Anggota
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {tim.map((t, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 relative">
                {tim.length > 1 && (
                  <button onClick={() => setTim(p => p.filter((_, j) => j !== i))}
                    className="absolute top-3 right-3 w-6 h-6 bg-red-50 text-red-400 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all text-xs">✕</button>
                )}

                <div className="flex items-start gap-4">
                  {/* Foto anggota */}
                  <div>
                    {t.foto_url ? (
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
                        <img src={t.foto_url} alt={t.nama} className="w-full h-full object-cover" />
                        <button onClick={() => setTim(p => p.map((x, j) => j === i ? { ...x, foto_url: '' } : x))}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-all text-white text-[10px]">Hapus</button>
                      </div>
                    ) : (
                      <button onClick={() => timFotoRefs.current[i]?.click()}
                        className="w-16 h-16 rounded-full border-2 border-dashed border-gray-200 hover:border-blue-300 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all flex-shrink-0">
                        <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                        </svg>
                        <span className="text-[9px] text-gray-300">Foto</span>
                      </button>
                    )}
                    <input
                      ref={el => { timFotoRefs.current[i] = el }}
                      type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFotoTim(f, i) }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Nama Lengkap</label>
                      <input className={inp + ' text-xs py-2'} placeholder="Dr. Nama Lengkap, M.Pd."
                        value={t.nama} onChange={e => setTim(p => p.map((x, j) => j === i ? { ...x, nama: e.target.value } : x))} />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 mb-1 block">Peran / Jabatan</label>
                      <input className={inp + ' text-xs py-2'} placeholder="Ketua Peneliti"
                        value={t.peran} onChange={e => setTim(p => p.map((x, j) => j === i ? { ...x, peran: e.target.value } : x))} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save */}
        {pesan && (
          <div className={`text-sm px-4 py-3 rounded-xl ${pesan.includes('Gagal') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
            {pesan}
          </div>
        )}
        <button onClick={handleSave} disabled={loading}
          className="bg-blue-950 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-900 disabled:opacity-50 transition-all">
          {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </div>
  )
}