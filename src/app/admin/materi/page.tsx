'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const BUCKET = 'pembelajaran-assets'
const FOLDER = 'materi'

interface JenisBencana { id: number; nama: string }

type Blok =
  | { id: string; tipe: 'teks'; isi: string }
  | { id: string; tipe: 'gambar'; url: string; caption: string; sumberGambar: 'link' | 'upload'; storagePath?: string }
  | { id: string; tipe: 'video'; youtubeUrl: string }
  | { id: string; tipe: 'html'; kode: string }

interface Kuis {
  pertanyaan: string; pilihan: string[]; jawaban_benar: number; pembahasan: string
  gambar_url?: string; gambar_storage_path?: string
}
interface Segmen { id: string; judul: string; blok: Blok[]; kuis: Kuis | null }

interface MateriItem {
  id: string; judul: string; published: boolean; is_konsep_dasar: boolean
  jenis_bencana_id: number | null; jenis_bencana: { nama: string } | null
  segmen: Segmen[] | null
}

const uid = () => Math.random().toString(36).slice(2, 10)

function ytId(url: string): string | null {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : (url.length === 11 ? url : null)
}

// ── Upload helper ──
async function uploadGambar(file: File): Promise<{ url: string; path: string } | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const fileName = `${FOLDER}/${Date.now()}_${uid()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { upsert: false })
  if (error) { alert('Upload gagal: ' + error.message); return null }
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
  return { url: pub.publicUrl, path: fileName }
}

async function hapusGambarStorage(path: string) {
  if (!path) return
  await supabase.storage.from(BUCKET).remove([path])
}

const blokMeta: Record<Blok['tipe'], { label: string; warna: string; ikon: string }> = {
  teks: { label: 'Teks', warna: 'bg-blue-50 text-blue-700 border-blue-200', ikon: '¶' },
  gambar: { label: 'Gambar', warna: 'bg-green-50 text-green-700 border-green-200', ikon: '🖼' },
  video: { label: 'Video YouTube', warna: 'bg-red-50 text-red-700 border-red-200', ikon: '▶' },
  html: { label: 'Embed HTML', warna: 'bg-purple-50 text-purple-700 border-purple-200', ikon: '</>' },
}

// ── Komponen upload gambar (reusable) ──
function GambarUploader({ url, storagePath, onUploaded, onRemove, label }: {
  url?: string; storagePath?: string
  onUploaded: (url: string, path: string) => void
  onRemove: () => void
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('File harus berupa gambar (JPG, PNG, GIF, WebP).'); return }
    if (file.size > 10 * 1024 * 1024) { alert('Ukuran file maksimum 10 MB.'); return }
    setUploading(true)
    // Hapus file lama kalau ada (ganti gambar)
    if (storagePath) await hapusGambarStorage(storagePath)
    const result = await uploadGambar(file)
    if (result) onUploaded(result.url, result.path)
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleRemove = async () => {
    if (storagePath) await hapusGambarStorage(storagePath)
    onRemove()
  }

  return (
    <div className="flex flex-col gap-2">
      {label && <p className="text-[11px] font-medium text-gray-500">{label}</p>}
      {url ? (
        <div className="relative group">
          <img src={url} alt="" className="max-h-44 rounded-lg border border-gray-100 object-contain bg-gray-50" />
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => inputRef.current?.click()} title="Ganti gambar"
              className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-xs hover:bg-blue-50 hover:border-blue-300 text-blue-600">⟳</button>
            <button onClick={handleRemove} title="Hapus gambar"
              className="w-7 h-7 rounded-lg bg-white/90 border border-gray-200 shadow-sm flex items-center justify-center text-xs hover:bg-red-50 hover:border-red-300 text-red-500">✕</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-teal-300 hover:bg-teal-50/30 transition-colors cursor-pointer disabled:opacity-50"
        >
          {uploading
            ? <span className="text-sm text-teal-600 font-medium animate-pulse">Mengupload...</span>
            : (
              <span className="flex flex-col items-center gap-1">
                <span className="text-2xl">📁</span>
                <span className="text-sm text-gray-500">Klik untuk upload gambar</span>
                <span className="text-[10px] text-gray-400">JPG, PNG, GIF, WebP — maks 10 MB</span>
              </span>
            )}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
    </div>
  )
}

// ── Editor per blok ──
function BlokEditor({ blok, onChange, onHapus, onNaik, onTurun, bisaNaik, bisaTurun }: {
  blok: Blok; onChange: (b: Blok) => void; onHapus: () => void
  onNaik: () => void; onTurun: () => void; bisaNaik: boolean; bisaTurun: boolean
}) {
  const meta = blokMeta[blok.tipe]
  const ta = "border border-gray-200 bg-white p-2.5 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"

  // Tab state untuk blok gambar: 'upload' atau 'link'
  const [tabGambar, setTabGambar] = useState<'upload' | 'link'>(
    blok.tipe === 'gambar' ? (blok.sumberGambar || (blok.storagePath ? 'upload' : 'link')) : 'upload'
  )

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.warna}`}>{meta.label}</span>
        <div className="flex-1" />
        <button onClick={onNaik} disabled={!bisaNaik} title="Naik"
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30">↑</button>
        <button onClick={onTurun} disabled={!bisaTurun} title="Turun"
          className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30">↓</button>
        <button onClick={onHapus} title="Hapus blok"
          className="w-6 h-6 flex items-center justify-center rounded text-red-400 hover:bg-red-50">✕</button>
      </div>
      <div className="p-3">
        {blok.tipe === 'teks' && (
          <textarea className={ta} rows={4} placeholder="Tulis teks materi..."
            value={blok.isi} onChange={e => onChange({ ...blok, isi: e.target.value })} />
        )}

        {blok.tipe === 'gambar' && (
          <div className="flex flex-col gap-3">
            {/* Tab selector */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 self-start">
              <button onClick={() => setTabGambar('upload')}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-md transition-colors ${tabGambar === 'upload' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
                📁 Upload File
              </button>
              <button onClick={() => setTabGambar('link')}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-md transition-colors ${tabGambar === 'link' ? 'bg-white shadow-sm text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}>
                🔗 Link URL
              </button>
            </div>

            {tabGambar === 'upload' ? (
              <GambarUploader
                url={blok.sumberGambar === 'upload' ? blok.url : undefined}
                storagePath={blok.storagePath}
                onUploaded={(url, path) => onChange({ ...blok, url, sumberGambar: 'upload', storagePath: path })}
                onRemove={() => onChange({ ...blok, url: '', sumberGambar: 'upload', storagePath: undefined })}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <input className={ta} placeholder="URL gambar (https://...)"
                  value={blok.sumberGambar === 'link' ? blok.url : ''}
                  onChange={e => onChange({ ...blok, url: e.target.value, sumberGambar: 'link', storagePath: undefined })} />
                {blok.sumberGambar === 'link' && blok.url && (
                  <img src={blok.url} alt="" className="max-h-40 rounded-lg border border-gray-100 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}
              </div>
            )}

            <input className={ta} placeholder="Keterangan gambar (opsional)"
              value={blok.caption} onChange={e => onChange({ ...blok, caption: e.target.value })} />
          </div>
        )}

        {blok.tipe === 'video' && (
          <div className="flex flex-col gap-2">
            <input className={ta} placeholder="Link YouTube (https://youtube.com/watch?v=... atau youtu.be/...)"
              value={blok.youtubeUrl} onChange={e => onChange({ ...blok, youtubeUrl: e.target.value })} />
            {ytId(blok.youtubeUrl)
              ? <div className="aspect-video rounded-lg overflow-hidden border border-gray-100">
                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId(blok.youtubeUrl)}`} allowFullScreen title="preview" />
                </div>
              : blok.youtubeUrl && <p className="text-[11px] text-amber-600">Link YouTube belum dikenali. Pastikan formatnya benar.</p>}
          </div>
        )}
        {blok.tipe === 'html' && (
          <div className="flex flex-col gap-2">
            <textarea className={`${ta} font-mono text-xs`} rows={4} placeholder='Tempel kode embed, mis. <iframe src="..."></iframe> atau embed peta WebGIS'
              value={blok.kode} onChange={e => onChange({ ...blok, kode: e.target.value })} />
            <p className="text-[10px] text-gray-400">Embed HTML hanya untuk admin. Cocok untuk sisipan peta WebGIS, infografis, atau widget interaktif.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Editor kuis ──
function KuisEditor({ kuis, onChange, onHapus }: { kuis: Kuis; onChange: (k: Kuis) => void; onHapus: () => void }) {
  const inp = "border border-gray-200 bg-white p-2 rounded-lg w-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
  const setPilihan = (i: number, v: string) => { const p = [...kuis.pilihan]; p[i] = v; onChange({ ...kuis, pilihan: p }) }
  return (
    <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide">Kuis Singkat (checkpoint)</span>
        <div className="flex-1" />
        <button onClick={onHapus} className="text-[11px] text-red-500 hover:underline">Hapus kuis</button>
      </div>
      <input className={inp} placeholder="Pertanyaan..." value={kuis.pertanyaan}
        onChange={e => onChange({ ...kuis, pertanyaan: e.target.value })} />

      {/* Upload gambar pertanyaan (opsional) */}
      <div className="rounded-lg border border-amber-100 bg-white p-2.5">
        <GambarUploader
          label="Gambar pertanyaan (opsional)"
          url={kuis.gambar_url}
          storagePath={kuis.gambar_storage_path}
          onUploaded={(url, path) => onChange({ ...kuis, gambar_url: url, gambar_storage_path: path })}
          onRemove={() => onChange({ ...kuis, gambar_url: undefined, gambar_storage_path: undefined })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {kuis.pilihan.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <button onClick={() => onChange({ ...kuis, jawaban_benar: i })} title="Tandai sebagai jawaban benar"
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-[10px]
                ${kuis.jawaban_benar === i ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-transparent'}`}>✓</button>
            <input className={inp} placeholder={`Pilihan ${String.fromCharCode(65 + i)}`} value={p}
              onChange={e => setPilihan(i, e.target.value)} />
            {kuis.pilihan.length > 2 && (
              <button onClick={() => onChange({ ...kuis, pilihan: kuis.pilihan.filter((_, x) => x !== i), jawaban_benar: Math.min(kuis.jawaban_benar, kuis.pilihan.length - 2) })}
                className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
            )}
          </div>
        ))}
        {kuis.pilihan.length < 5 && (
          <button onClick={() => onChange({ ...kuis, pilihan: [...kuis.pilihan, ''] })}
            className="text-[11px] text-teal-600 hover:underline self-start mt-0.5">+ Tambah pilihan</button>
        )}
      </div>
      <p className="text-[10px] text-gray-400">Klik lingkaran di kiri untuk menandai jawaban benar (hijau).</p>
      <textarea className={inp} rows={2} placeholder="Pembahasan (muncul setelah siswa menjawab)..."
        value={kuis.pembahasan} onChange={e => onChange({ ...kuis, pembahasan: e.target.value })} />
    </div>
  )
}

export default function AdminMateriPage() {
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [materiList, setMateriList] = useState<MateriItem[]>([])
  const [mode, setMode] = useState<'list' | 'buat' | 'edit'>('list')
  const [editTarget, setEditTarget] = useState<MateriItem | null>(null)
  const [isKonsepDasar, setIsKonsepDasar] = useState(false)
  const [judul, setJudul] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [segmen, setSegmen] = useState<Segmen[]>([])
  const [pesan, setPesan] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const fetchMateri = async () => {
    const { data } = await supabase.from('materi_bencana').select('*, jenis_bencana(nama)').order('created_at', { ascending: false })
    if (data) setMateriList(data as any)
  }

  useEffect(() => {
    supabase.from('jenis_bencana').select('*').eq('kategori', 'bencana').then(({ data }) => { if (data) setBencanaList(data) })
    fetchMateri()
  }, [])

  const resetForm = () => {
    setJudul(''); setSelectedBencana(''); setIsKonsepDasar(false); setSegmen([]); setEditTarget(null); setPesan('')
  }

  const handleEdit = (m: MateriItem) => {
    setEditTarget(m); setJudul(m.judul); setSelectedBencana(m.jenis_bencana_id ? String(m.jenis_bencana_id) : '')
    setIsKonsepDasar(m.is_konsep_dasar)
    // Migrasi data lama: blok gambar tanpa sumberGambar dianggap 'link'
    const migratedSegmen = (Array.isArray(m.segmen) ? m.segmen : []).map(sg => ({
      ...sg,
      blok: sg.blok.map(b => {
        if (b.tipe === 'gambar' && !b.sumberGambar) {
          return { ...b, sumberGambar: 'link' as const }
        }
        return b
      })
    }))
    setSegmen(migratedSegmen)
    setMode('edit')
  }

  // ── Operasi segmen ──
  const tambahSegmen = () => setSegmen(s => [...s, { id: uid(), judul: '', blok: [], kuis: null }])
  const ubahSegmen = (id: string, patch: Partial<Segmen>) => setSegmen(s => s.map(sg => sg.id === id ? { ...sg, ...patch } : sg))
  const hapusSegmen = (id: string) => setSegmen(s => s.filter(sg => sg.id !== id))
  const geserSegmen = (i: number, arah: -1 | 1) => setSegmen(s => {
    const j = i + arah; if (j < 0 || j >= s.length) return s
    const c = [...s];[c[i], c[j]] = [c[j], c[i]]; return c
  })

  // ── Operasi blok ──
  const blokBaru = (tipe: Blok['tipe']): Blok => {
    if (tipe === 'teks') return { id: uid(), tipe, isi: '' }
    if (tipe === 'gambar') return { id: uid(), tipe, url: '', caption: '', sumberGambar: 'upload' }
    if (tipe === 'video') return { id: uid(), tipe, youtubeUrl: '' }
    return { id: uid(), tipe: 'html', kode: '' }
  }
  const tambahBlok = (segId: string, tipe: Blok['tipe']) =>
    setSegmen(s => s.map(sg => sg.id === segId ? { ...sg, blok: [...sg.blok, blokBaru(tipe)] } : sg))
  const ubahBlok = (segId: string, blokId: string, b: Blok) =>
    setSegmen(s => s.map(sg => sg.id === segId ? { ...sg, blok: sg.blok.map(x => x.id === blokId ? b : x) } : sg))
  const hapusBlok = (segId: string, blokId: string) =>
    setSegmen(s => s.map(sg => sg.id === segId ? { ...sg, blok: sg.blok.filter(x => x.id !== blokId) } : sg))
  const geserBlok = (segId: string, i: number, arah: -1 | 1) =>
    setSegmen(s => s.map(sg => {
      if (sg.id !== segId) return sg
      const j = i + arah; if (j < 0 || j >= sg.blok.length) return sg
      const c = [...sg.blok];[c[i], c[j]] = [c[j], c[i]]; return { ...sg, blok: c }
    }))

  // ── Operasi kuis ──
  const tambahKuis = (segId: string) =>
    ubahSegmen(segId, { kuis: { pertanyaan: '', pilihan: ['', ''], jawaban_benar: 0, pembahasan: '' } })
  const hapusKuis = (segId: string) => ubahSegmen(segId, { kuis: null })

  const handleSimpan = async (published: boolean) => {
    if (!judul) { setPesan('Judul wajib diisi!'); return }
    if (!isKonsepDasar && !selectedBencana) { setPesan('Pilih jenis bencana!'); return }
    setLoading(true)
    const payload: any = {
      judul, published, is_konsep_dasar: isKonsepDasar,
      jenis_bencana_id: isKonsepDasar ? null : Number(selectedBencana),
      segmen,
    }
    let error
    if (mode === 'edit' && editTarget) {
      const res = await supabase.from('materi_bencana').update(payload).eq('id', editTarget.id); error = res.error
    } else {
      const res = await supabase.from('materi_bencana').insert(payload); error = res.error
    }
    if (error) setPesan('Gagal: ' + error.message)
    else { setPesan(published ? 'Berhasil dipublish!' : 'Tersimpan sebagai draft!'); resetForm(); setMode('list'); fetchMateri() }
    setLoading(false)
  }

  const inputCls = "border border-gray-200 p-2.5 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-400"

  // ══════════════ MODE LIST ══════════════
  if (mode === 'list') {
    return (
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Materi Bencana</h1>
            <p className="text-gray-500 text-sm mt-1">Materi microlearning — belajar bertahap dengan kuis singkat</p>
          </div>
          <button className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium"
            onClick={() => { resetForm(); tambahSegmen(); setMode('buat') }}>+ Buat Materi</button>
        </div>

        {materiList.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400 text-sm">Belum ada materi</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {materiList.map(m => {
            const jmlSeg = Array.isArray(m.segmen) ? m.segmen.length : 0
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-teal-200 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 text-sm">{m.judul}</h3>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                      {m.is_konsep_dasar && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Konsep Dasar</span>}
                      {m.jenis_bencana && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{m.jenis_bencana.nama}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${m.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{m.published ? 'Live' : 'Draft'}</span>
                      <span className="text-xs text-gray-400">· {jmlSeg} segmen</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100" onClick={() => handleEdit(m)}>Edit</button>
                  <button className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100"
                    onClick={() => { supabase.from('materi_bencana').update({ published: !m.published }).eq('id', m.id).then(fetchMateri) }}>
                    {m.published ? 'Unpublish' : 'Publish'}
                  </button>
                  <button className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-100"
                    onClick={async () => { if (!confirm('Yakin hapus?')) return; await supabase.from('materi_bencana').delete().eq('id', m.id); fetchMateri() }}>Hapus</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ══════════════ MODE BUAT / EDIT ══════════════
  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <button className="text-sm text-teal-600 hover:text-teal-800" onClick={() => { resetForm(); setMode('list') }}>← Kembali</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{mode === 'edit' ? 'Edit Materi' : 'Buat Materi Baru'}</h1>
          <p className="text-gray-500 text-sm">Susun materi jadi segmen kecil. Tiap segmen bisa berisi teks, gambar, video, embed HTML, dan kuis singkat.</p>
        </div>
      </div>

      {/* Info dasar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 flex flex-col gap-4">
        <h2 className="font-semibold text-gray-700">Informasi Dasar</h2>
        <input className={inputCls} placeholder="Judul materi" value={judul} onChange={e => setJudul(e.target.value)} />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={isKonsepDasar} onChange={e => setIsKonsepDasar(e.target.checked)} className="accent-teal-600" />
          Materi Konsep Dasar (tematik, lintas-bencana)
        </label>
        {!isKonsepDasar && (
          <select className={inputCls} value={selectedBencana} onChange={e => setSelectedBencana(e.target.value)}>
            <option value="">Pilih Jenis Bencana</option>
            {bencanaList.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
          </select>
        )}
      </div>

      {/* Segmen */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-700">Segmen Pembelajaran ({segmen.length})</h2>
        <button onClick={tambahSegmen} className="text-sm bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded-lg font-medium">+ Segmen</button>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {segmen.length === 0 && (
          <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            Belum ada segmen. Klik "+ Segmen" untuk memulai.
          </div>
        )}
        {segmen.map((sg, si) => (
          <div key={sg.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header segmen */}
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{si + 1}</span>
              <input className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400"
                placeholder={`Judul segmen ${si + 1} (mis. "Ancaman / Hazard")`}
                value={sg.judul} onChange={e => ubahSegmen(sg.id, { judul: e.target.value })} />
              <button onClick={() => geserSegmen(si, -1)} disabled={si === 0} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30" title="Naik">↑</button>
              <button onClick={() => geserSegmen(si, 1)} disabled={si === segmen.length - 1} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-200 disabled:opacity-30" title="Turun">↓</button>
              <button onClick={() => setPreviewId(previewId === sg.id ? null : sg.id)} className="text-[11px] text-teal-600 hover:underline px-1" title="Pratinjau">{previewId === sg.id ? 'Tutup' : 'Pratinjau'}</button>
              <button onClick={() => { if (confirm('Hapus segmen ini?')) hapusSegmen(sg.id) }} className="w-7 h-7 flex items-center justify-center rounded text-red-400 hover:bg-red-50" title="Hapus segmen">✕</button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* Blok-blok */}
              {sg.blok.map((b, bi) => (
                <BlokEditor key={b.id} blok={b}
                  onChange={nb => ubahBlok(sg.id, b.id, nb)}
                  onHapus={() => hapusBlok(sg.id, b.id)}
                  onNaik={() => geserBlok(sg.id, bi, -1)} onTurun={() => geserBlok(sg.id, bi, 1)}
                  bisaNaik={bi > 0} bisaTurun={bi < sg.blok.length - 1} />
              ))}

              {/* Tambah blok */}
              <div className="flex flex-wrap gap-2">
                {(['teks', 'gambar', 'video', 'html'] as Blok['tipe'][]).map(t => (
                  <button key={t} onClick={() => tambahBlok(sg.id, t)}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border ${blokMeta[t].warna} hover:brightness-95`}>
                    + {blokMeta[t].label}
                  </button>
                ))}
              </div>

              {/* Kuis */}
              <div className="pt-1">
                {sg.kuis
                  ? <KuisEditor kuis={sg.kuis} onChange={k => ubahSegmen(sg.id, { kuis: k })} onHapus={() => hapusKuis(sg.id)} />
                  : <button onClick={() => tambahKuis(sg.id)} className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 font-medium">+ Tambah Kuis Singkat (opsional)</button>}
              </div>

              {/* Pratinjau segmen */}
              {previewId === sg.id && (
                <div className="mt-2 border-t border-dashed border-gray-200 pt-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Pratinjau</p>
                  <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
                    <h4 className="font-bold text-gray-800">{sg.judul || `Segmen ${si + 1}`}</h4>
                    {sg.blok.map(b => (
                      <div key={b.id}>
                        {b.tipe === 'teks' && <p className="text-sm text-gray-700 whitespace-pre-wrap">{b.isi}</p>}
                        {b.tipe === 'gambar' && b.url && (
                          <figure><img src={b.url} alt="" className="rounded-lg max-h-56 object-contain" />{b.caption && <figcaption className="text-xs text-gray-400 mt-1">{b.caption}</figcaption>}</figure>
                        )}
                        {b.tipe === 'video' && ytId(b.youtubeUrl) && (
                          <div className="aspect-video rounded-lg overflow-hidden"><iframe className="w-full h-full" src={`https://www.youtube.com/embed/${ytId(b.youtubeUrl)}`} allowFullScreen title="v" /></div>
                        )}
                        {b.tipe === 'html' && b.kode && <div className="rounded-lg overflow-hidden border border-gray-100" dangerouslySetInnerHTML={{ __html: b.kode }} />}
                      </div>
                    ))}
                    {sg.kuis && (
                      <div className="bg-white rounded-lg border border-amber-200 p-3">
                        <p className="text-sm font-medium text-gray-800 mb-2">{sg.kuis.pertanyaan || '(pertanyaan kuis)'}</p>
                        {sg.kuis.gambar_url && (
                          <img src={sg.kuis.gambar_url} alt="" className="max-h-40 rounded-lg border border-gray-100 object-contain mb-2" />
                        )}
                        <div className="flex flex-col gap-1.5">
                          {sg.kuis.pilihan.map((p, i) => (
                            <div key={i} className={`text-xs px-3 py-1.5 rounded-lg border ${i === sg.kuis!.jawaban_benar ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-200 text-gray-600'}`}>
                              {String.fromCharCode(65 + i)}. {p} {i === sg.kuis!.jawaban_benar && '✓'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {pesan && <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 ${pesan.includes('Gagal') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{pesan}</div>}

      <div className="flex gap-3 sticky bottom-4">
        <button className="flex-1 bg-gray-100 text-gray-700 p-2.5 rounded-xl font-medium hover:bg-gray-200 shadow-sm" onClick={() => handleSimpan(false)} disabled={loading}>Simpan Draft</button>
        <button className="flex-1 bg-teal-600 text-white p-2.5 rounded-xl font-medium hover:bg-teal-700 shadow-sm" onClick={() => handleSimpan(true)} disabled={loading}>
          {loading ? 'Menyimpan...' : 'Publish'}
        </button>
      </div>
    </div>
  )
}