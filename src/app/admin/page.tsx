'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

interface Kabupaten { id: number; nama: string }
interface JenisBencana { id: number; nama: string; kategori: string }
interface LayerPeta {
  id: string; nama: string; file_url: string; warna: string; published: boolean
  has_tingkat: boolean; field_tingkat: string; kabupaten_id: number; jenis_bencana_id: number
  kabupaten: { nama: string }; jenis_bencana: { nama: string; kategori: string }
}

const inp = "w-full border border-gray-200 bg-white px-3 py-2.5 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"

const KAT_LABEL: Record<string, string> = { bencana: 'Bencana', fasilitas: 'Fasilitas', administrasi: 'Administrasi', faktor: 'Faktor Bencana' }
const KAT_COLOR: Record<string, string> = {
  bencana: 'bg-red-50 text-red-700 border-red-200',
  fasilitas: 'bg-blue-50 text-blue-700 border-blue-200',
  administrasi: 'bg-green-50 text-green-700 border-green-200',
  faktor: 'bg-purple-50 text-purple-700 border-purple-200',
}

export default function AdminLayerPage() {
  const [kabupatenList, setKabupatenList] = useState<Kabupaten[]>([])
  const [bencanaList, setBencanaList] = useState<JenisBencana[]>([])
  const [layerList, setLayerList] = useState<LayerPeta[]>([])

  // Filter state
  const [filterKabupaten, setFilterKabupaten] = useState('')
  const [filterKategori, setFilterKategori] = useState('')
  const [filterJenis, setFilterJenis] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // Upload form
  const [selectedKabupaten, setSelectedKabupaten] = useState('')
  const [selectedBencana, setSelectedBencana] = useState('')
  const [namaLayer, setNamaLayer] = useState('')
  const [warna, setWarna] = useState('#3388ff')
  const [file, setFile] = useState<File | null>(null)
  const [hasTingkat, setHasTingkat] = useState(false)
  const [fieldTingkat, setFieldTingkat] = useState('')
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState('')
  const [dragOver, setDragOver] = useState(false)

  // Edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editWarna, setEditWarna] = useState('')
  const [editKabupaten, setEditKabupaten] = useState('')
  const [editBencana, setEditBencana] = useState('')
  const [editHasTingkat, setEditHasTingkat] = useState(false)
  const [editFieldTingkat, setEditFieldTingkat] = useState('')

  const fetchLayers = async () => {
    const { data } = await supabase
      .from('layer_peta')
      .select('*, kabupaten(nama), jenis_bencana(nama, kategori)')
      .order('created_at', { ascending: false })
    if (data) setLayerList(data)
  }

  useEffect(() => {
    const fetchData = async () => {
      const [{ data: kab }, { data: ben }] = await Promise.all([
        supabase.from('kabupaten').select('*').order('nama'),
        supabase.from('jenis_bencana').select('*').order('nama'),
      ])
      if (kab) setKabupatenList(kab)
      if (ben) setBencanaList(ben)
    }
    fetchData()
    fetchLayers()
  }, [])

  // Filtered layers
  const filteredLayers = useMemo(() => {
    return layerList.filter(l => {
      if (filterKabupaten && String(l.kabupaten_id) !== filterKabupaten) return false
      if (filterKategori && l.jenis_bencana?.kategori !== filterKategori) return false
      if (filterJenis && String(l.jenis_bencana_id) !== filterJenis) return false
      if (filterSearch && !l.nama.toLowerCase().includes(filterSearch.toLowerCase())) return false
      return true
    })
  }, [layerList, filterKabupaten, filterKategori, filterJenis, filterSearch])

  // Jenis filtered by kategori
  const jenisFiltered = bencanaList.filter(b => !filterKategori || b.kategori === filterKategori)

  const handleUpload = async () => {
    if (!file || !selectedKabupaten || !selectedBencana || !namaLayer) {
      setPesan('Lengkapi semua field!')
      return
    }
    setLoading(true); setPesan('')
    const fileName = `${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('layer-peta').upload(fileName, file)
    if (uploadError) { setPesan('Gagal upload: ' + uploadError.message); setLoading(false); return }
    const { data: urlData } = supabase.storage.from('layer-peta').getPublicUrl(fileName)
    const { error: dbError } = await supabase.from('layer_peta').insert({
      kabupaten_id: Number(selectedKabupaten),
      jenis_bencana_id: Number(selectedBencana),
      nama: namaLayer, file_url: urlData.publicUrl, warna, published: true,
      has_tingkat: hasTingkat, field_tingkat: hasTingkat ? (fieldTingkat || null) : null
    })
    if (dbError) { setPesan('Gagal simpan: ' + dbError.message) }
    else {
      setPesan('Layer berhasil diupload!')
      setNamaLayer(''); setFile(null); setHasTingkat(false); setFieldTingkat('')
      fetchLayers()
    }
    setLoading(false)
  }

  const handleHapus = async (id: string, fileUrl: string) => {
    if (!confirm('Yakin hapus layer ini?')) return
    const fileName = fileUrl.split('/').pop()
    if (fileName) await supabase.storage.from('layer-peta').remove([fileName])
    await supabase.from('layer_peta').delete().eq('id', id)
    fetchLayers()
  }

  const handleTogglePublish = async (id: string, current: boolean) => {
    await supabase.from('layer_peta').update({ published: !current }).eq('id', id)
    fetchLayers()
  }

  const handleEdit = async (id: string) => {
    const updateData: any = {
      nama: editNama, warna: editWarna, has_tingkat: editHasTingkat,
      field_tingkat: editHasTingkat ? (editFieldTingkat || null) : null
    }
    if (editKabupaten) updateData.kabupaten_id = Number(editKabupaten)
    if (editBencana) updateData.jenis_bencana_id = Number(editBencana)
    await supabase.from('layer_peta').update(updateData).eq('id', id)
    setEditId(null)
    fetchLayers()
  }

  const stats = [
    { label: 'Total Layer', value: layerList.length, cls: 'bg-blue-950 text-white' },
    { label: 'Published', value: layerList.filter(l => l.published).length, cls: 'bg-green-50 text-green-800 border border-green-200' },
    { label: 'Draft', value: layerList.filter(l => !l.published).length, cls: 'bg-gray-50 text-gray-600 border border-gray-200' },
    { label: 'Multi-tingkat', value: layerList.filter(l => l.has_tingkat).length, cls: 'bg-amber-50 text-amber-800 border border-amber-200' },
  ]

  return (
    <div className="p-6 max-w-[1300px]">

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {stats.map(s => (
          <div key={s.label} className={`${s.cls} rounded-xl px-4 py-3`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs opacity-70 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* ── FORM UPLOAD ── */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-950 rounded-lg flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            Upload Layer Baru
          </h2>

          <div className="flex flex-col gap-3.5">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Kabupaten / Kota</label>
              <select className={inp} value={selectedKabupaten} onChange={e => setSelectedKabupaten(e.target.value)}>
                <option value="">Pilih Kabupaten/Kota</option>
                {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Jenis Layer</label>
              <select className={inp} value={selectedBencana} onChange={e => setSelectedBencana(e.target.value)}>
                <option value="">Pilih Jenis Layer</option>
                {['bencana', 'fasilitas', 'administrasi', 'faktor'].map(kat => {
                  const items = bencanaList.filter(b => b.kategori === kat)
                  if (!items.length) return null
                  return (
                    <optgroup key={kat} label={kat === 'bencana' ? '▲ Bencana' : kat === 'fasilitas' ? '● Fasilitas' : kat === 'administrasi' ? '◆ Administrasi' : '⬡ Faktor Bencana'}>
                      {items.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Nama Layer</label>
              <input className={inp} placeholder="cth: Banjir Bandar Lampung 2024" value={namaLayer} onChange={e => setNamaLayer(e.target.value)} />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Warna Layer</label>
              <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <input type="color" value={warna} onChange={e => setWarna(e.target.value)} className="w-8 h-7 cursor-pointer rounded border-0 bg-transparent" />
                <span className="text-sm font-mono text-gray-500">{warna}</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: warna }} />
              </div>
            </div>

            {/* Drag & Drop */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">File GeoJSON / KML</label>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
                onClick={() => document.getElementById('fileInput')?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all
                  ${dragOver ? 'border-blue-400 bg-blue-50' : file ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}>
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-green-700">{file.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                    <button className="text-xs text-red-400 mt-1 hover:text-red-600" onClick={e => { e.stopPropagation(); setFile(null) }}>Hapus</button>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm text-gray-500">Drag & drop atau klik untuk browse</p>
                    <p className="text-xs text-gray-300 mt-0.5">.geojson · .kml · .json</p>
                  </div>
                )}
                <input id="fileInput" type="file" accept=".geojson,.kml,.json" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-200">
              <input type="checkbox" checked={hasTingkat} onChange={e => setHasTingkat(e.target.checked)} className="accent-blue-700 w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-sm font-medium text-gray-700">Multi-tingkat bahaya</span>
                <p className="text-xs text-gray-400 mt-0.5">Centang jika layer punya atribut tingkat (sangat rawan, rawan, dll)</p>
              </div>
            </label>

            {hasTingkat && (
              <input className={inp} placeholder="Nama field tingkat (kosongkan = auto-detect)" value={fieldTingkat} onChange={e => setFieldTingkat(e.target.value)} />
            )}

            {pesan && (
              <div className={`text-sm px-3 py-2.5 rounded-xl ${pesan.includes('Gagal') || pesan.includes('Lengkapi') ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                {pesan}
              </div>
            )}

            <button onClick={handleUpload} disabled={loading}
              className="w-full bg-blue-950 hover:bg-blue-900 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition-all">
              {loading ? 'Mengupload...' : 'Upload Layer'}
            </button>
          </div>
        </div>

        {/* ── DAFTAR LAYER ── */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-200 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 text-sm">Daftar Layer</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">{filteredLayers.length} / {layerList.length} layer</span>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input className={inp + ' text-xs py-2'} placeholder="Cari nama layer..." value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)} />
            <select className={inp + ' text-xs py-2'} value={filterKabupaten} onChange={e => { setFilterKabupaten(e.target.value) }}>
              <option value="">Semua Kabupaten</option>
              {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
            <select className={inp + ' text-xs py-2'} value={filterKategori} onChange={e => { setFilterKategori(e.target.value); setFilterJenis('') }}>
              <option value="">Semua Kategori</option>
              <option value="bencana">Bencana</option>
              <option value="fasilitas">Fasilitas</option>
              <option value="administrasi">Administrasi</option>
              <option value="faktor">Faktor Bencana</option>
            </select>
            <select className={inp + ' text-xs py-2'} value={filterJenis} onChange={e => setFilterJenis(e.target.value)}>
              <option value="">Semua Jenis</option>
              {jenisFiltered.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </select>
          </div>

          {/* Reset filter */}
          {(filterKabupaten || filterKategori || filterJenis || filterSearch) && (
            <button onClick={() => { setFilterKabupaten(''); setFilterKategori(''); setFilterJenis(''); setFilterSearch('') }}
              className="text-xs text-blue-600 hover:underline mb-2 text-left">
              Reset filter
            </button>
          )}

          {/* Layer list */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-2" style={{ maxHeight: '60vh' }}>
            {filteredLayers.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                </svg>
                <p className="text-sm text-gray-400">Tidak ada layer ditemukan</p>
              </div>
            )}

            {filteredLayers.map(l => (
              <div key={l.id} className="border border-gray-100 rounded-xl p-3.5 hover:border-blue-200 hover:shadow-sm transition-all group">
                {editId === l.id ? (
                  <div className="flex flex-col gap-2.5">
                    <input className={inp + ' text-xs'} value={editNama} onChange={e => setEditNama(e.target.value)} placeholder="Nama layer" />
                    <div className="grid grid-cols-2 gap-2">
                      <select className={inp + ' text-xs'} value={editKabupaten} onChange={e => setEditKabupaten(e.target.value)}>
                        <option value="">Kabupaten (tidak diubah)</option>
                        {kabupatenList.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                      </select>
                      <select className={inp + ' text-xs'} value={editBencana} onChange={e => setEditBencana(e.target.value)}>
                        <option value="">Jenis (tidak diubah)</option>
                        {['bencana', 'fasilitas', 'administrasi'].map(kat => {
                          const items = bencanaList.filter(b => b.kategori === kat)
                          if (!items.length) return null
                          return (
                            <optgroup key={kat} label={kat}>
                              {items.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
                            </optgroup>
                          )
                        })}
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="color" value={editWarna} onChange={e => setEditWarna(e.target.value)} className="w-8 h-7 rounded cursor-pointer border border-gray-200" />
                      <span className="text-xs font-mono text-gray-400">{editWarna}</span>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer ml-auto">
                        <input type="checkbox" checked={editHasTingkat} onChange={e => setEditHasTingkat(e.target.checked)} className="accent-blue-700" />
                        Multi-tingkat
                      </label>
                    </div>
                    {editHasTingkat && (
                      <input className={inp + ' text-xs'} placeholder="Nama field tingkat" value={editFieldTingkat} onChange={e => setEditFieldTingkat(e.target.value)} />
                    )}
                    <div className="flex gap-2">
                      <button className="flex-1 text-xs bg-blue-950 text-white py-2 rounded-lg font-medium hover:bg-blue-900" onClick={() => handleEdit(l.id)}>Simpan</button>
                      <button className="flex-1 text-xs bg-gray-100 text-gray-600 py-2 rounded-lg font-medium hover:bg-gray-200" onClick={() => setEditId(null)}>Batal</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {/* Color dot */}
                    <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center border-2" style={{ background: l.warna + '20', borderColor: l.warna }}>
                      <div className="w-3.5 h-3.5 rounded-full" style={{ background: l.warna }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800 truncate">{l.nama}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${l.published ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                          {l.published ? 'Live' : 'Draft'}
                        </span>
                        {l.jenis_bencana?.kategori && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border ${KAT_COLOR[l.jenis_bencana.kategori] || 'bg-gray-50 text-gray-500'}`}>
                            {KAT_LABEL[l.jenis_bencana.kategori]}
                          </span>
                        )}
                        {l.has_tingkat && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-medium">Multi-tingkat</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{l.kabupaten?.nama} · {l.jenis_bencana?.nama}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 font-medium"
                        onClick={() => {
                          setEditId(l.id); setEditNama(l.nama); setEditWarna(l.warna)
                          setEditKabupaten(String(l.kabupaten_id)); setEditBencana(String(l.jenis_bencana_id))
                          setEditHasTingkat(l.has_tingkat || false); setEditFieldTingkat(l.field_tingkat || '')
                        }}>Edit</button>
                      <button className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 font-medium"
                        onClick={() => handleTogglePublish(l.id, l.published)}>
                        {l.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button className="text-xs bg-red-50 text-red-500 border border-red-100 px-2.5 py-1.5 rounded-lg hover:bg-red-100 font-medium"
                        onClick={() => handleHapus(l.id, l.file_url)}>Hapus</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}