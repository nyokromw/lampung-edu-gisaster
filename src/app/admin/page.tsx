'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/* ═══════════════════ TYPES ═══════════════════ */

interface Kabupaten { id: number; nama: string }
interface JenisBencana { id: number; nama: string; kategori: string }

interface LegendaItem { nilai: string; label: string; warna: string }
interface Legenda { field: string; items: LegendaItem[] }

interface LayerPeta {
  id: string
  nama: string
  file_url: string
  warna: string
  published: boolean
  has_tingkat: boolean
  field_tingkat: string | null
  legenda: Legenda | null
  opacity: number | null
  kabupaten_id: number
  jenis_bencana_id: number
  created_at?: string
  kabupaten: { nama: string } | null
  jenis_bencana: { nama: string; kategori: string } | null
}

/* Hasil inspeksi file GeoJSON sebelum upload */
interface FieldInfo { name: string; values: string[]; unik: number }
interface GeoInfo {
  jumlahFitur: number
  tipeGeometri: string[]
  fields: FieldInfo[]
  error?: string
}

/* ═══════════════════ KONSTANTA ═══════════════════ */

const KATEGORI = ['bencana', 'faktor', 'fasilitas', 'administrasi'] as const
type Kategori = typeof KATEGORI[number]

const KAT_LABEL: Record<string, string> = {
  bencana: 'Bencana',
  faktor: 'Faktor Bencana',
  fasilitas: 'Fasilitas',
  administrasi: 'Administrasi',
}

const KAT_SIMBOL: Record<string, string> = {
  bencana: '▲', faktor: '⬡', fasilitas: '●', administrasi: '◆',
}

const KAT_COLOR: Record<string, string> = {
  bencana: 'bg-red-50 text-red-700 border-red-200',
  faktor: 'bg-purple-50 text-purple-700 border-purple-200',
  fasilitas: 'bg-blue-50 text-blue-700 border-blue-200',
  administrasi: 'bg-green-50 text-green-700 border-green-200',
}

/* Ramp warna siap pakai — dipilih sesuai makna layer */
const RAMPS: Record<string, { nama: string; warna: string[] }> = {
  bahaya: { nama: 'Bahaya (hijau → merah)', warna: ['#1a9850', '#91cf60', '#fee08b', '#fc8d59', '#d73027', '#7f0000'] },
  ketinggian: { nama: 'Ketinggian (biru → coklat)', warna: ['#c6dbef', '#9ecae1', '#a1d99b', '#fed976', '#d9a066', '#8c510a'] },
  lahan: { nama: 'Tutupan lahan', warna: ['#9e9e9e', '#2e7d32', '#d4b106', '#0288d1', '#8d6e63', '#5d4037'] },
  jarak: { nama: 'Jarak (dekat → jauh)', warna: ['#d73027', '#fdae61', '#4575b4', '#91bfdb', '#e0f3f8', '#313695'] },
  netral: { nama: 'Netral (kategorikal)', warna: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'] },
}

const MAX_MB = 25

const inp = 'w-full border border-gray-200 bg-white px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all'
const inpSm = inp + ' text-xs py-2'
const btnGhost = 'text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 font-medium transition-colors'

/* ═══════════════════ HELPER ═══════════════════ */

/** Baca GeoJSON di browser, ambil daftar field + nilai uniknya. */
async function inspeksiGeoJSON(file: File): Promise<GeoInfo> {
  const kosong: GeoInfo = { jumlahFitur: 0, tipeGeometri: [], fields: [] }

  if (!/\.(geojson|json)$/i.test(file.name)) {
    return { ...kosong, error: 'Format KML tidak bisa dibaca otomatis. Isi legenda secara manual.' }
  }

  try {
    const gj = JSON.parse(await file.text())
    const fitur: any[] =
      gj?.type === 'FeatureCollection' ? gj.features ?? []
      : gj?.type === 'Feature' ? [gj]
      : []

    if (!fitur.length) return { ...kosong, error: 'File tidak berisi fitur apa pun.' }

    const tipeGeometri = Array.from(new Set(fitur.map(f => f?.geometry?.type).filter(Boolean)))
    const peta = new Map<string, Set<string>>()

    for (const f of fitur) {
      const props = f?.properties ?? {}
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === '') continue
        if (!peta.has(k)) peta.set(k, new Set())
        const set = peta.get(k)!
        if (set.size <= 60) set.add(String(v))
      }
    }

    const fields: FieldInfo[] = Array.from(peta.entries())
      .map(([name, set]) => ({
        name,
        unik: set.size,
        values: Array.from(set).sort((a, b) =>
          a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })),
      }))
      .sort((a, b) => a.unik - b.unik)

    return { jumlahFitur: fitur.length, tipeGeometri, fields }
  } catch {
    return { ...kosong, error: 'File bukan GeoJSON yang valid.' }
  }
}

/** Bangun legenda awal dari daftar nilai + ramp warna. */
function buatLegenda(field: string, values: string[], rampKey = 'netral'): Legenda {
  const ramp = RAMPS[rampKey]?.warna ?? RAMPS.netral.warna
  return {
    field,
    items: values.map((nilai, i) => ({
      nilai,
      label: nilai,
      warna: ramp[i % ramp.length],
    })),
  }
}

/** Ambil nama objek storage dari public URL. */
function namaObjek(fileUrl: string): string | null {
  try {
    const bagian = fileUrl.split('/layer-peta/')
    return bagian.length > 1 ? decodeURIComponent(bagian[1].split('?')[0]) : null
  } catch { return null }
}

function kategoriDariJenis(list: JenisBencana[], jenisId: string | number): Kategori | '' {
  const j = list.find(b => String(b.id) === String(jenisId))
  return (j?.kategori as Kategori) ?? ''
}

/* ═══════════════════ EDITOR LEGENDA ═══════════════════ */

function EditorLegenda({
  legenda, setLegenda, fieldOptions, warnaTunggal, setWarnaTunggal, kategori,
}: {
  legenda: Legenda | null
  setLegenda: (l: Legenda | null) => void
  fieldOptions: FieldInfo[]
  warnaTunggal: string
  setWarnaTunggal: (w: string) => void
  kategori: Kategori | ''
}) {
  const [rampKey, setRampKey] = useState('netral')
  const bertingkat = !!legenda

  const pilihField = (name: string) => {
    if (!name) { setLegenda(null); return }
    const f = fieldOptions.find(x => x.name === name)
    setLegenda(buatLegenda(name, f?.values ?? [], rampKey))
  }

  const terapkanRamp = (key: string) => {
    setRampKey(key)
    if (!legenda) return
    const ramp = RAMPS[key].warna
    setLegenda({ ...legenda, items: legenda.items.map((it, i) => ({ ...it, warna: ramp[i % ramp.length] })) })
  }

  const ubahItem = (i: number, patch: Partial<LegendaItem>) => {
    if (!legenda) return
    const items = legenda.items.map((it, idx) => idx === i ? { ...it, ...patch } : it)
    setLegenda({ ...legenda, items })
  }

  const geser = (i: number, arah: -1 | 1) => {
    if (!legenda) return
    const j = i + arah
    if (j < 0 || j >= legenda.items.length) return
    const items = [...legenda.items]
    ;[items[i], items[j]] = [items[j], items[i]]
    setLegenda({ ...legenda, items })
  }

  const hapusItem = (i: number) => {
    if (!legenda) return
    setLegenda({ ...legenda, items: legenda.items.filter((_, idx) => idx !== i) })
  }

  const tambahItem = () => {
    if (!legenda) return
    setLegenda({ ...legenda, items: [...legenda.items, { nilai: '', label: '', warna: '#94a3b8' }] })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle mode pewarnaan */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setLegenda(null)}
          className={`flex-1 text-xs py-2 rounded-xl font-medium border transition-all ${!bertingkat ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
          Satu warna
        </button>
        <button type="button"
          onClick={() => {
            const f = fieldOptions[0]
            setLegenda(f ? buatLegenda(f.name, f.values, rampKey) : { field: '', items: [] })
          }}
          className={`flex-1 text-xs py-2 rounded-xl font-medium border transition-all ${bertingkat ? 'bg-blue-950 text-white border-blue-950' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
          Berdasarkan kelas
        </button>
      </div>

      {!bertingkat && (
        <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
          <input type="color" value={warnaTunggal} onChange={e => setWarnaTunggal(e.target.value)}
            className="w-8 h-7 cursor-pointer rounded border-0 bg-transparent" />
          <span className="text-sm font-mono text-gray-500">{warnaTunggal}</span>
          <div className="flex-1 h-2 rounded-full" style={{ background: warnaTunggal }} />
        </div>
      )}

      {bertingkat && legenda && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Field klasifikasi</label>
              {fieldOptions.length > 0 ? (
                <select className={inpSm} value={legenda.field} onChange={e => pilihField(e.target.value)}>
                  <option value="">Pilih field</option>
                  {fieldOptions.map(f => (
                    <option key={f.name} value={f.name}>{f.name} — {f.unik} kelas</option>
                  ))}
                </select>
              ) : (
                <input className={inpSm} placeholder="cth: Keterangan" value={legenda.field}
                  onChange={e => setLegenda({ ...legenda, field: e.target.value })} />
              )}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Ramp warna</label>
              <select className={inpSm} value={rampKey} onChange={e => terapkanRamp(e.target.value)}>
                {Object.entries(RAMPS).map(([k, v]) => <option key={k} value={k}>{v.nama}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-0.5">
            {legenda.items.length === 0 && (
              <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">
                Belum ada kelas. Pilih field di atas, atau tambah baris manual.
              </p>
            )}
            {legenda.items.map((it, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
                <input type="color" value={it.warna} onChange={e => ubahItem(i, { warna: e.target.value })}
                  className="w-7 h-6 cursor-pointer rounded border-0 bg-transparent flex-shrink-0" />
                <input className="flex-1 min-w-0 bg-white border border-gray-200 rounded-md px-2 py-1 text-[11px] font-mono text-gray-500"
                  value={it.nilai} onChange={e => ubahItem(i, { nilai: e.target.value })} placeholder="nilai di data" />
                <input className="flex-1 min-w-0 bg-white border border-gray-200 rounded-md px-2 py-1 text-[11px] text-gray-700"
                  value={it.label} onChange={e => ubahItem(i, { label: e.target.value })} placeholder="label di peta" />
                <div className="flex flex-col flex-shrink-0">
                  <button type="button" onClick={() => geser(i, -1)} className="text-gray-300 hover:text-gray-600 leading-none text-[10px]">▲</button>
                  <button type="button" onClick={() => geser(i, 1)} className="text-gray-300 hover:text-gray-600 leading-none text-[10px]">▼</button>
                </div>
                <button type="button" onClick={() => hapusItem(i)}
                  className="text-gray-300 hover:text-red-500 text-sm leading-none flex-shrink-0 px-0.5">×</button>
              </div>
            ))}
          </div>

          <button type="button" onClick={tambahItem}
            className="text-xs text-blue-600 hover:underline self-start">+ Tambah kelas manual</button>

          {kategori === 'fasilitas' && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
              Layer fasilitas biasanya titik. Klasifikasi kelas tetap bisa dipakai, misalnya untuk membedakan Rumah Sakit dan Puskesmas lewat field Tipe.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/* ═══════════════════ HALAMAN ═══════════════════ */

export default function AdminLayerPage() {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [layerList, setLayerList] = useState<LayerPeta[]>([])
  const [memuat, setMemuat] = useState(true)

  /* Filter */
  const [filterKabupaten, setFilterKabupaten] = useState('')
  const [filterKategori, setFilterKategori] = useState('')
  const [filterJenis, setFilterJenis] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  /* Form upload */
  const [selectedKabupaten, setSelectedKabupaten] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [namaLayer, setNamaLayer] = useState('')
  const [warna, setWarna] = useState('#3388ff')
  const [opacity, setOpacity] = useState(0.7)
  const [file, setFile] = useState<File | null>(null)
  const [geoInfo, setGeoInfo] = useState<GeoInfo | null>(null)
  const [legenda, setLegenda] = useState<Legenda | null>(null)
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'galat'; teks: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  /* Edit */
  const [editId, setEditId] = useState<string | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editWarna, setEditWarna] = useState('#3388ff')
  const [editOpacity, setEditOpacity] = useState(0.7)
  const [editKabupaten, setEditKabupaten] = useState('')
  const [editBencana, setEditBencana] = useState('')
  const [editLegenda, setEditLegenda] = useState<Legenda | null>(null)
  const [editFields, setEditFields] = useState<FieldInfo[]>([])
  const [menyimpan, setMenyimpan] = useState(false)

  /* Ganti file */
  const [gantiId, setGantiId] = useState<string | null>(null)
  const gantiRef = useRef<HTMLInputElement>(null)

  const kategoriUpload = kategoriDariJenis(bencanaList, selectedBencana)
  const kategoriEdit = kategoriDariJenis(bencanaList, editBencana)

  /* ── data ── */

  const fetchLayers = async () => {
    const { data, error } = await supabase
      .from('layer_peta')
      .select('*, kabupaten(nama), jenis_bencana(nama, kategori)')
      .order('created_at', { ascending: false })
    if (!error && data) setLayerList(data as LayerPeta[])
    setMemuat(false)
  }

  useEffect(() => {
    ;(async () => {
      const [{ data: kab }, { data: ben }] = await Promise.all([
        supabase.from('kabupaten').select('*').order('nama'),
        supabase.from('jenis_bencana').select('*').order('nama'),
      ])
      if (kab) setKabupatenList(kab)
      if (ben) setBencanaList(ben)
      fetchLayers()
    })()
  }, [])

  /* ── file terpilih ── */

  const pilihFile = async (f: File | null) => {
    setFile(f); setGeoInfo(null); setLegenda(null)
    if (!f) return
    if (f.size > MAX_MB * 1024 * 1024) {
      setPesan({ tipe: 'galat', teks: `File ${(f.size / 1048576).toFixed(1)} MB melebihi batas ${MAX_MB} MB. Sederhanakan geometri atau dissolve dulu.` })
      setFile(null); return
    }
    setPesan(null)
    const info = await inspeksiGeoJSON(f)
    setGeoInfo(info)
    if (!namaLayer) setNamaLayer(f.name.replace(/\.(geojson|json|kml)$/i, '').replace(/[_-]+/g, ' '))

    /* Auto-pilih field klasifikasi: Keterangan / tingkat / kelas lebih diprioritaskan */
    const prioritas = ['keterangan', 'tingkat', 'kelas', 'klasifikasi', 'kategori', 'tipe', 'skor', 'value']
    const kandidat = info.fields
      .filter(f2 => f2.unik >= 2 && f2.unik <= 12)
      .sort((a, b) => {
        const ia = prioritas.indexOf(a.name.toLowerCase())
        const ib = prioritas.indexOf(b.name.toLowerCase())
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      })[0]
    if (kandidat) setLegenda(buatLegenda(kandidat.name, kandidat.values, 'netral'))
  }

  /* ── upload ── */

  const handleUpload = async () => {
    if (!file || !selectedKabupaten || !selectedBencana || !namaLayer.trim()) {
      setPesan({ tipe: 'galat', teks: 'Kabupaten, jenis layer, nama, dan file wajib diisi.' })
      return
    }
    const legendaBersih = legenda?.items.length
      ? { field: legenda.field, items: legenda.items.filter(i => i.nilai !== '') }
      : null
    if (legenda && !legendaBersih?.items.length) {
      setPesan({ tipe: 'galat', teks: 'Mode kelas dipilih tapi tidak ada kelas yang terisi. Pilih field atau ganti ke satu warna.' })
      return
    }

    setLoading(true); setPesan(null)
    const namaFile = `${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`

    const { error: errUpload } = await supabase.storage
      .from('layer-peta')
      .upload(namaFile, file, { contentType: 'application/geo+json', upsert: false })

    if (errUpload) {
      setPesan({ tipe: 'galat', teks: 'Upload file gagal: ' + errUpload.message })
      setLoading(false); return
    }

    const { data: urlData } = supabase.storage.from('layer-peta').getPublicUrl(namaFile)

    const { error: errDb } = await supabase.from('layer_peta').insert({
      kabupaten_id: Number(selectedKabupaten),
      jenis_bencana_id: Number(selectedBencana),
      nama: namaLayer.trim(),
      file_url: urlData.publicUrl,
      warna,
      opacity,
      published: true,
      has_tingkat: !!legendaBersih,
      field_tingkat: legendaBersih?.field ?? null,
      legenda: legendaBersih,
    })

    if (errDb) {
      /* Rollback supaya tidak ada file yatim di storage */
      await supabase.storage.from('layer-peta').remove([namaFile])
      setPesan({ tipe: 'galat', teks: 'Simpan ke database gagal: ' + errDb.message })
    } else {
      setPesan({ tipe: 'ok', teks: `Layer "${namaLayer.trim()}" berhasil diupload.` })
      setNamaLayer(''); setFile(null); setGeoInfo(null); setLegenda(null)
      fetchLayers()
    }
    setLoading(false)
  }

  /* ── ganti file ── */

  const handleGantiFile = async (layer: LayerPeta, baru: File) => {
    if (baru.size > MAX_MB * 1024 * 1024) {
      setPesan({ tipe: 'galat', teks: `File melebihi batas ${MAX_MB} MB.` }); return
    }
    if (!confirm(`Ganti file layer "${layer.nama}" dengan ${baru.name}? File lama akan dihapus.`)) return

    setGantiId(layer.id); setPesan(null)
    const namaFile = `${Date.now()}_${baru.name.replace(/[^\w.-]/g, '_')}`

    const { error: errUpload } = await supabase.storage
      .from('layer-peta').upload(namaFile, baru, { contentType: 'application/geo+json', upsert: false })
    if (errUpload) {
      setPesan({ tipe: 'galat', teks: 'Upload file baru gagal: ' + errUpload.message }); setGantiId(null); return
    }

    const { data: urlData } = supabase.storage.from('layer-peta').getPublicUrl(namaFile)
    const { error: errDb } = await supabase.from('layer_peta')
      .update({ file_url: urlData.publicUrl }).eq('id', layer.id)

    if (errDb) {
      await supabase.storage.from('layer-peta').remove([namaFile])
      setPesan({ tipe: 'galat', teks: 'Update database gagal: ' + errDb.message })
    } else {
      const lama = namaObjek(layer.file_url)
      if (lama) await supabase.storage.from('layer-peta').remove([lama])
      setPesan({ tipe: 'ok', teks: `File layer "${layer.nama}" berhasil diganti.` })
      fetchLayers()
    }
    setGantiId(null)
  }

  /* ── hapus / publish / edit ── */

  const handleHapus = async (l: LayerPeta) => {
    if (!confirm(`Hapus layer "${l.nama}"? Tindakan ini tidak bisa dibatalkan.`)) return
    const nama = namaObjek(l.file_url)
    if (nama) await supabase.storage.from('layer-peta').remove([nama])
    await supabase.from('layer_peta').delete().eq('id', l.id)
    fetchLayers()
  }

  const handleTogglePublish = async (id: string, current: boolean) => {
    await supabase.from('layer_peta').update({ published: !current }).eq('id', id)
    fetchLayers()
  }

  const bukaEdit = async (l: LayerPeta) => {
    setEditId(l.id)
    setEditNama(l.nama)
    setEditWarna(l.warna || '#3388ff')
    setEditOpacity(l.opacity ?? 0.7)
    setEditKabupaten(String(l.kabupaten_id))
    setEditBencana(String(l.jenis_bencana_id))
    setEditLegenda(l.legenda ?? null)
    setEditFields([])

    /* Ambil file yang sudah tersimpan supaya daftar field tetap muncul saat mengedit */
    try {
      const res = await fetch(l.file_url)
      const gj = await res.json()
      const fitur: any[] = gj?.features ?? []
      const peta = new Map<string, Set<string>>()
      for (const f of fitur) {
        for (const [k, v] of Object.entries(f?.properties ?? {})) {
          if (v === null || v === undefined || v === '') continue
          if (!peta.has(k)) peta.set(k, new Set())
          const s = peta.get(k)!
          if (s.size <= 60) s.add(String(v))
        }
      }
      const fields = Array.from(peta.entries())
        .map(([name, s]) => ({ name, unik: s.size, values: Array.from(s).sort() }))
        .sort((a, b) => a.unik - b.unik)
      setEditFields(fields)

      /* Layer lama: punya field_tingkat tapi belum punya legenda.
         Bangun legenda dari field itu supaya konfigurasinya tidak hilang saat disimpan. */
      if (!l.legenda && l.has_tingkat && l.field_tingkat) {
        const f = fields.find(x => x.name === l.field_tingkat)
        setEditLegenda(f
          ? buatLegenda(f.name, f.values, 'bahaya')
          : { field: l.field_tingkat, items: [] })
      }
    } catch {
      /* Offline atau CORS: daftar field tidak bisa diambil.
         Tetap pertahankan field lama supaya tidak terhapus. */
      if (!l.legenda && l.has_tingkat && l.field_tingkat) {
        setEditLegenda({ field: l.field_tingkat, items: [] })
      }
    }
  }

  const handleSimpanEdit = async (id: string) => {
    setMenyimpan(true)
    const legendaBersih = editLegenda?.items.length
      ? { field: editLegenda.field, items: editLegenda.items.filter(i => i.nilai !== '') }
      : null

    /* Kalau daftar kelas kosong tapi field-nya diketahui, field tetap dipertahankan.
       Ini yang menjaga layer rawan bencana lama agar tidak kehilangan konfigurasinya. */
    const field = legendaBersih?.field ?? editLegenda?.field ?? null

    const { error } = await supabase.from('layer_peta').update({
      nama: editNama.trim(),
      warna: editWarna,
      opacity: editOpacity,
      kabupaten_id: Number(editKabupaten),
      jenis_bencana_id: Number(editBencana),
      has_tingkat: !!field,
      field_tingkat: field,
      legenda: legendaBersih,
    }).eq('id', id)

    setMenyimpan(false)
    if (error) { setPesan({ tipe: 'galat', teks: 'Simpan perubahan gagal: ' + error.message }); return }
    setEditId(null)
    fetchLayers()
  }

  /* ── turunan ── */

  const filteredLayers = useMemo(() => layerList.filter(l => {
    if (filterKabupaten && String(l.kabupaten_id) !== filterKabupaten) return false
    if (filterKategori && l.jenis_bencana?.kategori !== filterKategori) return false
    if (filterJenis && String(l.jenis_bencana_id) !== filterJenis) return false
    if (filterSearch && !l.nama.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  }), [layerList, filterKabupaten, filterKategori, filterJenis, filterSearch])

  const jenisFiltered = bencanaList.filter(b => !filterKategori || b.kategori === filterKategori)
  const adaFilter = !!(filterKabupaten || filterKategori || filterJenis || filterSearch)

  const stats = [
    { label: 'Total layer', value: layerList.length, cls: 'bg-blue-950 text-white' },
    { label: 'Tayang', value: layerList.filter(l => l.published).length, cls: 'bg-green-50 text-green-800 border border-green-200' },
    { label: 'Draf', value: layerList.filter(l => !l.published).length, cls: 'bg-gray-50 text-gray-600 border border-gray-200' },
    { label: 'Berlegenda', value: layerList.filter(l => l.legenda?.items?.length).length, cls: 'bg-purple-50 text-purple-800 border border-purple-200' },
  ]

  /* ═══════════════════ RENDER ═══════════════════ */

  return (
    <div className="p-6 max-w-[1300px]">

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className={`${s.cls} rounded-xl px-4 py-3`}>
            <p className="text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="text-xs opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {pesan && (
        <div className={`text-sm px-3.5 py-2.5 rounded-xl mb-4 flex items-start justify-between gap-3 ${
          pesan.tipe === 'galat' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
          <span>{pesan.teks}</span>
          <button onClick={() => setPesan(null)} className="opacity-50 hover:opacity-100 leading-none">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* ══ FORM UPLOAD ══ */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 h-fit">
          <h2 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-950 rounded-lg flex items-center justify-center text-white text-sm leading-none">+</span>
            Tambah layer
          </h2>

          <div className="flex flex-col gap-3.5">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Kabupaten / kota</label>
              <select className={inp} value={selectedKabupaten} onChange={e => setSelectedKabupaten(e.target.value)}>
                <option value="">Pilih kabupaten/kota</option>
                {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Jenis layer</label>
              <select className={inp} value={selectedBencana} onChange={e => setSelectedBencana(e.target.value)}>
                <option value="">Pilih jenis layer</option>
                {KATEGORI.map(kat => {
                  const items = bencanaList.filter(b => b.kategori === kat)
                  if (!items.length) return null
                  return (
                    <optgroup key={kat} label={`${KAT_SIMBOL[kat]} ${KAT_LABEL[kat]}`}>
                      {items.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Nama layer</label>
              <input className={inp} placeholder="cth: Rawan Banjir Bandar Lampung 2026"
                value={namaLayer} onChange={e => setNamaLayer(e.target.value)} />
            </div>

            {/* File */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">File GeoJSON / KML</label>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); pilihFile(e.dataTransfer.files[0] ?? null) }}
                onClick={() => document.getElementById('fileInput')?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-blue-400 bg-blue-50'
                  : file ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-green-800 break-all">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(file.size / 1024).toFixed(0)} KB
                      {geoInfo && !geoInfo.error && ` · ${geoInfo.jumlahFitur} fitur · ${geoInfo.tipeGeometri.join(', ')}`}
                    </p>
                    <button className="text-xs text-red-500 mt-1 hover:text-red-700"
                      onClick={e => { e.stopPropagation(); pilihFile(null) }}>Hapus file</button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-500">Tarik file ke sini, atau klik untuk memilih</p>
                    <p className="text-xs text-gray-400 mt-0.5">.geojson · .json · .kml — maks {MAX_MB} MB</p>
                  </div>
                )}
                <input id="fileInput" type="file" accept=".geojson,.kml,.json" className="hidden"
                  onChange={e => pilihFile(e.target.files?.[0] ?? null)} />
              </div>
              {geoInfo?.error && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-1.5">
                  {geoInfo.error}
                </p>
              )}
            </div>

            {/* Legenda */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Warna &amp; legenda</label>
              <EditorLegenda
                legenda={legenda} setLegenda={setLegenda}
                fieldOptions={geoInfo?.fields ?? []}
                warnaTunggal={warna} setWarnaTunggal={setWarna}
                kategori={kategoriUpload}
              />
            </div>

            {/* Opasitas */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Opasitas isi — {Math.round(opacity * 100)}%
              </label>
              <input type="range" min={0.1} max={1} step={0.05} value={opacity}
                onChange={e => setOpacity(Number(e.target.value))} className="w-full accent-blue-800" />
            </div>

            <button onClick={handleUpload} disabled={loading}
              className="w-full bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition-all">
              {loading ? 'Mengupload…' : 'Upload layer'}
            </button>
          </div>
        </div>

        {/* ══ DAFTAR LAYER ══ */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-200 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 text-sm">Daftar layer</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full tabular-nums">
              {filteredLayers.length} / {layerList.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <input className={inpSm} placeholder="Cari nama layer…" value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)} />
            <select className={inpSm} value={filterKabupaten} onChange={e => setFilterKabupaten(e.target.value)}>
              <option value="">Semua kabupaten</option>
              {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <select className={inpSm} value={filterKategori}
              onChange={e => { setFilterKategori(e.target.value); setFilterJenis('') }}>
              <option value="">Semua kategori</option>
              {KATEGORI.map(k => <option key={k} value={k}>{KAT_LABEL[k]}</option>)}
            </select>
            <select className={inpSm} value={filterJenis} onChange={e => setFilterJenis(e.target.value)}>
              <option value="">Semua jenis</option>
              {jenisFiltered.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </select>
          </div>

          {adaFilter && (
            <button onClick={() => { setFilterKabupaten(''); setFilterKategori(''); setFilterJenis(''); setFilterSearch('') }}
              className="text-xs text-blue-600 hover:underline mb-2 text-left">Hapus semua filter</button>
          )}

          <input ref={gantiRef} type="file" accept=".geojson,.kml,.json" className="hidden" />

          <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ maxHeight: '65vh' }}>
            {memuat && <p className="text-sm text-gray-400 text-center py-12">Memuat layer…</p>}

            {!memuat && filteredLayers.length === 0 && (
              <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
                <p className="text-sm text-gray-500">
                  {adaFilter ? 'Tidak ada layer yang cocok dengan filter.' : 'Belum ada layer. Upload lewat panel di sebelah kiri.'}
                </p>
              </div>
            )}

            {filteredLayers.map(l => {
              const sedangEdit = editId === l.id
              return (
                <div key={l.id}
                  className={`border rounded-xl p-3.5 transition-all ${sedangEdit ? 'border-blue-300 bg-blue-50/30' : 'border-gray-100 hover:border-blue-200 hover:shadow-sm'} group`}>

                  {/* Ringkasan */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center border-2"
                      style={{ background: (l.warna || '#94a3b8') + '20', borderColor: l.warna || '#94a3b8' }}>
                      <div className="w-3.5 h-3.5 rounded-full" style={{ background: l.warna || '#94a3b8' }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800 truncate">{l.nama}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${
                          l.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {l.published ? 'Tayang' : 'Draf'}
                        </span>
                        {l.jenis_bencana?.kategori && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${KAT_COLOR[l.jenis_bencana.kategori] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                            {KAT_LABEL[l.jenis_bencana.kategori] ?? l.jenis_bencana.kategori}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {l.kabupaten?.nama} · {l.jenis_bencana?.nama}
                      </p>

                      {/* Pratinjau legenda */}
                      {!!l.legenda?.items?.length && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {l.legenda.items.slice(0, 6).map((it, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-[10px] text-gray-600 bg-gray-50 border border-gray-150 rounded px-1.5 py-0.5">
                              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: it.warna }} />
                              {it.label || it.nilai}
                            </span>
                          ))}
                          {l.legenda.items.length > 6 && (
                            <span className="text-[10px] text-gray-400">+{l.legenda.items.length - 6}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button className={btnGhost} onClick={() => sedangEdit ? setEditId(null) : bukaEdit(l)}>
                        {sedangEdit ? 'Tutup' : 'Edit'}
                      </button>
                      <button className={btnGhost} disabled={gantiId === l.id}
                        onClick={() => {
                          const el = gantiRef.current
                          if (!el) return
                          el.value = ''
                          el.onchange = () => { const f = el.files?.[0]; if (f) handleGantiFile(l, f) }
                          el.click()
                        }}>
                        {gantiId === l.id ? 'Mengganti…' : 'Ganti file'}
                      </button>
                      <button className={btnGhost} onClick={() => handleTogglePublish(l.id, l.published)}>
                        {l.published ? 'Sembunyikan' : 'Tayangkan'}
                      </button>
                      <button className="text-xs bg-red-50 text-red-600 border border-red-100 px-2.5 py-1.5 rounded-lg hover:bg-red-100 font-medium"
                        onClick={() => handleHapus(l)}>Hapus</button>
                    </div>
                  </div>

                  {/* Panel edit */}
                  {sedangEdit && (
                    <div className="mt-3.5 pt-3.5 border-t border-blue-100 flex flex-col gap-3">
                      <input className={inpSm} value={editNama} onChange={e => setEditNama(e.target.value)} placeholder="Nama layer" />

                      <div className="grid grid-cols-2 gap-2">
                        <select className={inpSm} value={editKabupaten} onChange={e => setEditKabupaten(e.target.value)}>
                          {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                        </select>
                        <select className={inpSm} value={editBencana} onChange={e => setEditBencana(e.target.value)}>
                          {KATEGORI.map(kat => {
                            const items = bencanaList.filter(b => b.kategori === kat)
                            if (!items.length) return null
                            return (
                              <optgroup key={kat} label={`${KAT_SIMBOL[kat]} ${KAT_LABEL[kat]}`}>
                                {items.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
                              </optgroup>
                            )
                          })}
                        </select>
                      </div>

                      <EditorLegenda
                        legenda={editLegenda} setLegenda={setEditLegenda}
                        fieldOptions={editFields}
                        warnaTunggal={editWarna} setWarnaTunggal={setEditWarna}
                        kategori={kategoriEdit}
                      />

                      <div>
                        <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                          Opasitas isi — {Math.round(editOpacity * 100)}%
                        </label>
                        <input type="range" min={0.1} max={1} step={0.05} value={editOpacity}
                          onChange={e => setEditOpacity(Number(e.target.value))} className="w-full accent-blue-800" />
                      </div>

                      <div className="flex gap-2">
                        <button disabled={menyimpan} onClick={() => handleSimpanEdit(l.id)}
                          className="flex-1 text-xs bg-blue-950 text-white py-2 rounded-lg font-medium hover:bg-blue-900 disabled:opacity-50">
                          {menyimpan ? 'Menyimpan…' : 'Simpan perubahan'}
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="flex-1 text-xs bg-gray-100 text-gray-600 py-2 rounded-lg font-medium hover:bg-gray-200">
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}