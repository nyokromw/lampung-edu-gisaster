'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const inp = "w-full border border-gray-200 bg-white px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"

interface Modul {
  id: string; judul: string; deskripsi: string; konten: string
  jenis_bencana: string; fase: string; thumbnail_url: string; published: boolean
}

const FASE = ['Mitigasi', 'Kesiapsiagaan', 'Respons', 'Pemulihan']
const BENCANA = ['Banjir', 'Banjir Bandang', 'Tanah Longsor', 'Gempa Bumi', 'Tsunami', 'Kekeringan', 'Multi Bencana']

export default function AdminPembelajaranPage() {
  const [moduls, setModuls] = useState<Modul[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingThumb, setUploadingThumb] = useState(false)
  const [pesan, setPesan] = useState('')
  const [form, setForm] = useState({
    judul: '', deskripsi: '', konten: '',
    jenis_bencana: 'Banjir', fase: 'Mitigasi',
    thumbnail_url: '', published: true
  })

  const fetchModuls = async () => {
    const { data } = await supabase.from('pembelajaran').select('*').order('created_at', { ascending: false })
    if (data) setModuls(data)
  }

  useEffect(() => { fetchModuls() }, [])

  const resetForm = () => {
    setForm({ judul: '', deskripsi: '', konten: '', jenis_bencana: 'Banjir', fase: 'Mitigasi', thumbnail_url: '', published: true })
    setEditId(null)
  }

  const handleUploadThumb = async (file: File) => {
    setUploadingThumb(true)
    const fileName = `pembelajaran/${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('pembelajaran-assets').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('pembelajaran-assets').getPublicUrl(fileName)
      setForm(p => ({ ...p, thumbnail_url: data.publicUrl }))
    }
    setUploadingThumb(false)
  }

  const handleSave = async () => {
    if (!form.judul || !form.deskripsi) { setPesan('Judul dan deskripsi wajib diisi!'); return }
    setLoading(true); setPesan('')
    const { error } = editId
      ? await supabase.from('pembelajaran').update(form).eq('id', editId)
      : await supabase.from('pembelajaran').insert(form)
    if (error) setPesan('Gagal: ' + error.message)
    else { setPesan('Berhasil disimpan!'); resetForm(); setShowForm(false); fetchModuls() }
    setLoading(false)
  }

  const handleEdit = (m: Modul) => {
    setForm({ judul: m.judul, deskripsi: m.deskripsi, konten: m.konten, jenis_bencana: m.jenis_bencana, fase: m.fase, thumbnail_url: m.thumbnail_url, published: m.published })
    setEditId(m.id); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleHapus = async (id: string) => {
    if (!confirm('Hapus modul ini?')) return
    await supabase.from('pembelajaran').delete().eq('id', id)
    fetchModuls()
  }

  const handleToggle = async (id: string, current: boolean) => {
    await supabase.from('pembelajaran').update({ published: !current }).eq('id', id)
    fetchModuls()
  }

  return (
    <div className="p-6 max-w-[1100px]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Pembelajaran Mendalam</h1>
          <p className="text-sm text-gray-400 mt-0.5">Kelola studi kasus dan modul pembelajaran bencana</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="bg-blue-950 text-white text-sm px-4 py-2 rounded-xl font-medium hover:bg-blue-900 transition-all">
          {showForm ? 'Tutup' : '+ Tambah Modul'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
          <h2 className="font-semibold text-sm text-gray-800 mb-4">{editId ? 'Edit Modul' : 'Tambah Modul Baru'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Judul Modul</label>
              <input className={inp} placeholder="cth: Analisis Banjir Bandang Way Kanan 2022" value={form.judul} onChange={e => setForm(p => ({ ...p, judul: e.target.value }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Jenis Bencana</label>
              <select className={inp} value={form.jenis_bencana} onChange={e => setForm(p => ({ ...p, jenis_bencana: e.target.value }))}>
                {BENCANA.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Fase SDL</label>
              <select className={inp} value={form.fase} onChange={e => setForm(p => ({ ...p, fase: e.target.value }))}>
                {FASE.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Deskripsi Singkat</label>
              <textarea className={inp} rows={2} placeholder="Ringkasan singkat isi modul..." value={form.deskripsi} onChange={e => setForm(p => ({ ...p, deskripsi: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Konten Modul</label>
              <textarea className={inp} rows={8} placeholder="Tulis konten lengkap modul di sini. Bisa berisi analisis kasus, data, penjelasan, rekomendasi mitigasi, dll..." value={form.konten} onChange={e => setForm(p => ({ ...p, konten: e.target.value }))} />
              <p className="text-[10px] text-gray-400 mt-1">Tip: gunakan baris baru untuk memisahkan paragraf</p>
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Thumbnail / Gambar Cover</label>
              <div className="flex items-start gap-4">
                {form.thumbnail_url ? (
                  <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                    <img src={form.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
                    <button onClick={() => setForm(p => ({ ...p, thumbnail_url: '' }))}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">✕</button>
                  </div>
                ) : (
                  <label className="w-32 h-20 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-300 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                    </svg>
                    <span className="text-[10px] text-gray-400">{uploadingThumb ? 'Uploading...' : 'Upload'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadThumb(f) }} />
                  </label>
                )}
                <div className="text-xs text-gray-400 pt-1">
                  <p>Format JPG/PNG, ideal 800×500px</p>
                  <p className="mt-1">Ditampilkan sebagai cover modul di halaman daftar</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <input type="checkbox" id="published" checked={form.published} onChange={e => setForm(p => ({ ...p, published: e.target.checked }))} className="accent-blue-700 w-4 h-4" />
              <label htmlFor="published" className="text-sm text-gray-700 cursor-pointer">Publish (tampilkan ke siswa)</label>
            </div>
          </div>
          {pesan && <p className={`mt-3 text-sm px-3 py-2 rounded-lg ${pesan.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{pesan}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={loading}
              className="flex-1 bg-blue-950 text-white text-sm py-2.5 rounded-xl font-medium hover:bg-blue-900 disabled:opacity-50 transition-all">
              {loading ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Modul'}
            </button>
            <button onClick={() => { resetForm(); setShowForm(false) }}
              className="px-4 bg-gray-100 text-gray-600 text-sm py-2.5 rounded-xl font-medium hover:bg-gray-200 transition-all">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Daftar modul */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {moduls.length === 0 && (
          <p className="text-sm text-gray-400 col-span-2 text-center py-12">Belum ada modul pembelajaran</p>
        )}
        {moduls.map(m => (
          <div key={m.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-blue-200 transition-all group">
            {m.thumbnail_url && <img src={m.thumbnail_url} alt={m.judul} className="w-full h-36 object-cover" />}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  m.fase === 'Mitigasi' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  m.fase === 'Kesiapsiagaan' ? 'bg-green-50 text-green-700 border-green-200' :
                  m.fase === 'Respons' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {m.fase}
                </span>
                <span className="text-[10px] text-gray-400">{m.jenis_bencana}</span>
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium border ${m.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                  {m.published ? 'Live' : 'Draft'}
                </span>
              </div>
              <h3 className="font-bold text-sm text-gray-800 mb-1 line-clamp-1">{m.judul}</h3>
              <p className="text-xs text-gray-400 line-clamp-2">{m.deskripsi}</p>
              <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(m)} className="flex-1 text-xs bg-gray-50 border border-gray-200 text-gray-600 py-1.5 rounded-lg hover:bg-gray-100 font-medium">Edit</button>
                <button onClick={() => handleToggle(m.id, m.published)} className="flex-1 text-xs bg-gray-50 border border-gray-200 text-gray-600 py-1.5 rounded-lg hover:bg-gray-100 font-medium">
                  {m.published ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => handleHapus(m.id)} className="text-xs bg-red-50 border border-red-100 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-100 font-medium">Hapus</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}