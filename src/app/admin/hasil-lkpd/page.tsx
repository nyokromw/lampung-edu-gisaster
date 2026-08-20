'use client'

// ============================================================
// ADMIN — CEK HASIL LKPD
// Menelusuri kiriman siswa dari Supabase Storage (bucket: LKPD).
// Taruh di: src/app/admin/hasil-lkpd/page.tsx  -> /admin/hasil-lkpd
//
// SYARAT (jalankan di Supabase > SQL Editor):
//   create policy "admin baca LKPD"
//   on storage.objects for select
//   to authenticated
//   using ( bucket_id = 'LKPD' );
// Policy INSERT untuk siswa (anon) yang lama tetap dibiarkan.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const BUCKET = 'LKPD'

// ---- Tipe ----
interface FileRow {
  fullPath: string
  judul: string
  sekolah: string
  kelas: string
  nama: string
  waktuLabel: string
  waktuRaw: string
}

interface Detail {
  lkpd_id?: string
  lkpd_judul?: string
  kabupaten?: string
  jenis_bencana?: string
  identitas?: { nama: string; sekolah: string; kelas: string; anggota?: string[] }
  waktu_submit?: string
  skor_total?: number
  skor_maks?: number
  persentase?: number | null
  rekap_fase?: { fase: string; benar: number; soal: number }[]
  jawaban?: Record<string, any>
  tabelData?: Record<string, string[][]>
  diagramData?: Record<string, string[][]>
  nilai_manual?: number | null
  catatan_guru?: string
}

// ---- Helper: bersihkan teks jadi segmen path aman (samakan dgn halaman siswa) ----
const safeKey = (s: string) =>
  (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim().replace(/\s+/g, '_')
    .slice(0, 50) || 'tanpa-nama'

// ---- Helper: telusuri seluruh bucket secara rekursif ----
async function listAll(prefix = ''): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } })
  if (error) throw error
  let out: string[] = []
  for (const item of data || []) {
    if (item.name === '.emptyFolderPlaceholder') continue
    const full = prefix ? `${prefix}/${item.name}` : item.name
    const isFolder = (item as any).id === null || (item as any).metadata === null
    if (isFolder) out = out.concat(await listAll(full))
    else if (item.name.toLowerCase().endsWith('.json')) out.push(full)
  }
  return out
}

// ---- Helper: pecah path jadi kolom tabel ----
function parsePath(fullPath: string): FileRow {
  const seg = fullPath.split('/')
  const file = seg[seg.length - 1]
  const judul = (seg[0] || '').replace(/_/g, ' ')
  const sekolah = (seg[1] || '').replace(/_/g, ' ')
  const kelas = (seg[2] || '').replace(/_/g, ' ')

  const noExt = file.replace(/\.json$/i, '')
  const idx = noExt.lastIndexOf('__')
  const nama = (idx >= 0 ? noExt.slice(0, idx) : noExt).replace(/_/g, ' ')
  const tsRaw = idx >= 0 ? noExt.slice(idx + 2) : ''
  // tsRaw contoh: 2026-08-20T04-48-13
  const [d, t] = tsRaw.split('T')
  const waktuLabel = d ? `${d} ${t ? t.replace(/-/g, ':') : ''}`.trim() : '—'

  return { fullPath, judul, sekolah, kelas, nama, waktuLabel, waktuRaw: tsRaw }
}

const FASE_STYLE: Record<string, string> = {
  Memahami: 'text-blue-700 bg-blue-50 border-blue-200',
  Mengaplikasi: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Merefleksi: 'text-amber-700 bg-amber-50 border-amber-200',
}

export default function HasilLkpdPage() {
  const [rows, setRows] = useState<FileRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [userEmail, setUserEmail] = useState<string | null | undefined>(undefined) // undefined = blm dicek

  // filter
  const [fJudul, setFJudul] = useState('')
  const [fSekolah, setFSekolah] = useState('')
  const [fKelas, setFKelas] = useState('')
  const [cari, setCari] = useState('')

  // detail
  const [detailRow, setDetailRow] = useState<FileRow | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLkpd, setDetailLkpd] = useState<any | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // edit / hapus
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [aksiMsg, setAksiMsg] = useState('')
  const [form, setForm] = useState({ nama: '', kelas: '', sekolah: '', nilai_manual: '', catatan_guru: '' })

  const muat = async () => {
    setLoading(true); setErrMsg('')
    try {
      const paths = await listAll('')
      setRows(paths.map(parsePath).sort((a, b) => b.waktuRaw.localeCompare(a.waktuRaw)))
    } catch (e: any) {
      setErrMsg(e?.message || 'Gagal memuat daftar.')
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }: { data: { user: { email?: string } | null } }) => setUserEmail(data.user?.email ?? null))
    muat()
  }, [])

  const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean))).sort()
  const daftarJudul = useMemo(() => uniq(rows.map(r => r.judul)), [rows])
  const daftarSekolah = useMemo(() => uniq(rows.map(r => r.sekolah)), [rows])
  const daftarKelas = useMemo(() => uniq(rows.map(r => r.kelas)), [rows])

  const terfilter = useMemo(() => rows.filter(r =>
    (!fJudul || r.judul === fJudul) &&
    (!fSekolah || r.sekolah === fSekolah) &&
    (!fKelas || r.kelas === fKelas) &&
    (!cari || r.nama.toLowerCase().includes(cari.toLowerCase()))
  ), [rows, fJudul, fSekolah, fKelas, cari])

  const bukaDetail = async (row: FileRow) => {
    setDetailRow(row); setDetail(null); setDetailLkpd(null); setDetailLoading(true)
    setEditMode(false); setAksiMsg('')
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(row.fullPath)
      if (error) throw error
      const json: Detail = JSON.parse(await data.text())
      setDetail(json)
      // Ambil definisi LKPD untuk memberi label soal (best-effort)
      if (json.lkpd_id) {
        const { data: lk } = await supabase.from('e_lkpd').select('pertanyaan').eq('id', json.lkpd_id).single()
        if (lk) setDetailLkpd(lk)
      }
    } catch (e: any) {
      setDetail({ lkpd_judul: 'Gagal memuat: ' + (e?.message || 'error') })
    }
    setDetailLoading(false)
  }

  const unduhJson = () => {
    if (!detail) return
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = (detailRow?.nama || 'jawaban').replace(/\s+/g, '_') + '.json'
    a.click(); URL.revokeObjectURL(url)
  }

  // ---- Mulai mode edit: isi form dari data saat ini ----
  const mulaiEdit = () => {
    if (!detail) return
    setAksiMsg('')
    setForm({
      nama: detail.identitas?.nama ?? detailRow?.nama ?? '',
      kelas: detail.identitas?.kelas ?? detailRow?.kelas ?? '',
      sekolah: detail.identitas?.sekolah ?? detailRow?.sekolah ?? '',
      nilai_manual: detail.nilai_manual != null ? String(detail.nilai_manual) : '',
      catatan_guru: detail.catatan_guru ?? '',
    })
    setEditMode(true)
  }

  // ---- Simpan perubahan. Kalau identitas berubah, file "dipindah"
  //      (unggah path baru + hapus path lama); kalau tidak, ditimpa di tempat. ----
  const simpanEdit = async () => {
    if (!detail || !detailRow) return
    setSaving(true); setAksiMsg('')
    try {
      const nilaiNum = form.nilai_manual.trim() === '' ? null : Number(form.nilai_manual)
      if (nilaiNum != null && Number.isNaN(nilaiNum)) throw new Error('Nilai harus berupa angka.')

      const updated: Detail = {
        ...detail,
        identitas: {
          nama: form.nama.trim(),
          kelas: form.kelas.trim(),
          sekolah: form.sekolah.trim(),
          anggota: detail.identitas?.anggota ?? [],
        },
        nilai_manual: nilaiNum,
        catatan_guru: form.catatan_guru.trim() || undefined,
      }

      // Susun path baru: pertahankan segmen judul & timestamp asli
      const origSeg = detailRow.fullPath.split('/')
      const judulSeg = origSeg[0]
      const ts = detailRow.waktuRaw
      const newPath = [judulSeg, safeKey(form.sekolah), safeKey(form.kelas), `${safeKey(form.nama)}__${ts}.json`].join('/')

      const blob = new Blob([JSON.stringify(updated, null, 2)], { type: 'application/json' })

      if (newPath === detailRow.fullPath) {
        const { error } = await supabase.storage.from(BUCKET).upload(newPath, blob, { contentType: 'application/json', upsert: true })
        if (error) throw error
      } else {
        // pindah: unggah baru dulu, baru hapus lama
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, blob, { contentType: 'application/json', upsert: true })
        if (upErr) throw upErr
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove([detailRow.fullPath])
        if (rmErr) throw rmErr
      }

      await muat()
      const newRow = parsePath(newPath)
      setDetailRow(newRow)
      setDetail(updated)
      setEditMode(false)
    } catch (e: any) {
      setAksiMsg(e?.message || 'Gagal menyimpan.')
    }
    setSaving(false)
  }

  // ---- Hapus kiriman ----
  const hapusKiriman = async () => {
    if (!detailRow) return
    if (!confirm(`Hapus kiriman "${detailRow.nama}" (${detailRow.kelas})? Tindakan ini tidak bisa dibatalkan.`)) return
    setDeleting(true); setAksiMsg('')
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([detailRow.fullPath])
      if (error) throw error
      await muat()
      setDetailRow(null)
    } catch (e: any) {
      setAksiMsg(e?.message || 'Gagal menghapus.')
    }
    setDeleting(false)
  }

  const inp = "border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400"

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 py-8">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Hasil LKPD Siswa</h1>
            <p className="text-sm text-gray-400">Kiriman jawaban dari bucket <span className="font-mono">{BUCKET}</span></p>
          </div>
          <button onClick={muat} disabled={loading}
            className="inline-flex items-center gap-2 bg-blue-950 hover:bg-blue-900 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-60">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Muat Ulang
          </button>
        </div>

        {/* Banner status login (self-diagnosa RLS) */}
        {userEmail === null && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
            <b>Belum terdeteksi login Supabase.</b> Kalau daftar di bawah kosong atau muncul error izin, itu sebabnya — policy <span className="font-mono">SELECT</span> hanya untuk sesi login. Pastikan Anda masuk lewat halaman admin, atau cek kembali policy-nya.
          </div>
        )}
        {userEmail && (
          <p className="text-xs text-gray-400 mb-4">Login sebagai <b>{userEmail}</b></p>
        )}

        {/* Filter */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex flex-wrap gap-2 items-center">
          <select className={inp} value={fJudul} onChange={e => setFJudul(e.target.value)}>
            <option value="">Semua LKPD</option>
            {daftarJudul.map(j => <option key={j} value={j}>{j}</option>)}
          </select>
          <select className={inp} value={fSekolah} onChange={e => setFSekolah(e.target.value)}>
            <option value="">Semua Sekolah</option>
            {daftarSekolah.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={inp} value={fKelas} onChange={e => setFKelas(e.target.value)}>
            <option value="">Semua Kelas</option>
            {daftarKelas.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <input className={`${inp} flex-1 min-w-[160px]`} placeholder="Cari nama siswa..." value={cari} onChange={e => setCari(e.target.value)} />
          <span className="text-xs text-gray-400 px-2">{terfilter.length} kiriman</span>
        </div>

        {/* Error */}
        {errMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
            {errMsg}
            {errMsg.toLowerCase().includes('policy') && (
              <p className="mt-1 text-xs text-red-500">Tambahkan policy SELECT untuk role authenticated (lihat komentar di atas file ini).</p>
            )}
          </div>
        )}

        {/* Tabel */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400 text-sm">Memuat…</div>
          ) : terfilter.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">Belum ada kiriman.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3 font-semibold">Nama</th>
                    <th className="px-4 py-3 font-semibold">Kelas</th>
                    <th className="px-4 py-3 font-semibold">Sekolah</th>
                    <th className="px-4 py-3 font-semibold">LKPD</th>
                    <th className="px-4 py-3 font-semibold">Waktu Kirim</th>
                    <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {terfilter.map((r) => (
                    <tr key={r.fullPath} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{r.nama}</td>
                      <td className="px-4 py-3 text-gray-600">{r.kelas || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{r.sekolah || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate" title={r.judul}>{r.judul}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{r.waktuLabel}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => bukaDetail(r)}
                          className="text-blue-600 hover:text-blue-800 font-semibold text-xs">Lihat →</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ===== DRAWER DETAIL ===== */}
      {detailRow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDetailRow(null)} />
          <div className="relative w-full max-w-xl bg-gray-50 h-full overflow-y-auto shadow-2xl">
            {/* header drawer */}
            <div className="sticky top-0 bg-blue-950 text-white px-5 py-4 flex items-center justify-between z-10">
              <div className="min-w-0">
                <p className="font-bold truncate">{detailRow.nama}</p>
                <p className="text-xs text-blue-300 truncate">{detailRow.kelas} · {detailRow.sekolah}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {detail && !detailLoading && !editMode && (
                  <button onClick={mulaiEdit} title="Edit"
                    className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                  </button>
                )}
                <button onClick={unduhJson} title="Unduh JSON"
                  className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                </button>
                <button onClick={() => setDetailRow(null)}
                  className="bg-white/10 hover:bg-white/20 rounded-lg p-2 transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {detailLoading && <p className="text-sm text-gray-400 text-center py-10">Memuat jawaban…</p>}

              {aksiMsg && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">{aksiMsg}</div>
              )}

              {/* ===== FORM EDIT ===== */}
              {detail && !detailLoading && editMode && (
                <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
                  <p className="text-[11px] uppercase tracking-wide text-blue-600 font-bold">Edit Kiriman</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">Nama</label>
                      <input className={inp + ' w-full'} value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">Kelas</label>
                      <input className={inp + ' w-full'} value={form.kelas} onChange={e => setForm({ ...form, kelas: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">Sekolah</label>
                      <input className={inp + ' w-full'} value={form.sekolah} onChange={e => setForm({ ...form, sekolah: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">Nilai akhir (opsional)</label>
                      <input type="number" className={inp + ' w-full'} placeholder="mis. 85" value={form.nilai_manual} onChange={e => setForm({ ...form, nilai_manual: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[11px] font-semibold text-gray-500 block mb-1">Catatan guru (opsional)</label>
                      <textarea rows={3} className={inp + ' w-full resize-none'} placeholder="Umpan balik untuk siswa…" value={form.catatan_guru} onChange={e => setForm({ ...form, catatan_guru: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={simpanEdit} disabled={saving}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition-all disabled:opacity-60">
                      {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
                    </button>
                    <button onClick={() => { setEditMode(false); setAksiMsg('') }} disabled={saving}
                      className="px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-lg transition-all">
                      Batal
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">Mengubah nama/kelas/sekolah akan memindahkan file ke path baru di bucket.</p>
                </div>
              )}

              {detail && !detailLoading && !editMode && (
                <>
                  {/* Ringkasan skor */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold">LKPD</p>
                        <p className="text-sm font-semibold text-gray-800">{detail.lkpd_judul || '—'}</p>
                      </div>
                      {detail.persentase != null && (
                        <div className="text-right">
                          <p className="text-2xl font-extrabold text-blue-700">{detail.persentase}%</p>
                          <p className="text-[11px] text-gray-400">{detail.skor_total}/{detail.skor_maks} benar (auto)</p>
                        </div>
                      )}
                    </div>
                    {detail.rekap_fase && detail.rekap_fase.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {detail.rekap_fase.map(f => (
                          <div key={f.fase} className={`rounded-lg border px-2 py-2 text-center ${FASE_STYLE[f.fase] || 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                            <p className="text-[10px] font-bold uppercase opacity-70">{f.fase}</p>
                            <p className="text-sm font-extrabold mt-0.5">{f.soal > 0 ? `${f.benar}/${f.soal}` : '—'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {detail.waktu_submit && (
                      <p className="text-[11px] text-gray-400 mt-3">Dikirim: {new Date(detail.waktu_submit).toLocaleString('id-ID')}</p>
                    )}
                  </div>

                  {/* Nilai akhir & catatan guru (bila ada) */}
                  {(detail.nilai_manual != null || detail.catatan_guru) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      {detail.nilai_manual != null && (
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-[11px] uppercase tracking-wide text-amber-700 font-bold">Nilai Akhir</span>
                          <span className="text-2xl font-extrabold text-amber-700">{detail.nilai_manual}</span>
                        </div>
                      )}
                      {detail.catatan_guru && (
                        <p className="text-sm text-amber-800 whitespace-pre-wrap">{detail.catatan_guru}</p>
                      )}
                    </div>
                  )}

                  {/* Anggota kelompok */}
                  {detail.identitas?.anggota && detail.identitas.anggota.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-1">Anggota Kelompok</p>
                      <p className="text-sm text-gray-700">{[detail.identitas.nama, ...detail.identitas.anggota].filter(Boolean).join(', ')}</p>
                    </div>
                  )}

                  {/* Jawaban per aktivitas */}
                  <JawabanList detail={detail} lkpd={detailLkpd} />

                  {/* Hapus */}
                  <button onClick={hapusKiriman} disabled={deleting}
                    className="w-full mt-2 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold py-2.5 rounded-lg transition-all inline-flex items-center justify-center gap-2 disabled:opacity-60">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
                    {deleting ? 'Menghapus…' : 'Hapus Kiriman Ini'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Render jawaban per aktivitas. Kalau definisi LKPD tersedia,
// tampilkan judul soal + jawaban dalam bentuk terbaca; kalau tidak,
// tampilkan pasangan kunci-nilai apa adanya.
// ============================================================
function JawabanList({ detail, lkpd }: { detail: Detail; lkpd: any | null }) {
  const jawaban = detail.jawaban || {}
  const aktivitas: any[] = lkpd?.pertanyaan || []

  if (aktivitas.length === 0) {
    // Fallback: dump mentah
    const entri = Object.entries(jawaban)
    if (entri.length === 0) return <p className="text-sm text-gray-400">Tidak ada jawaban tersimpan.</p>
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 font-bold mb-2">Jawaban (mentah)</p>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">{JSON.stringify(jawaban, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {aktivitas.map((a, i) => (
        <div key={a.id ?? i} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-start gap-2 mb-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">{a.judul || `Aktivitas ${i + 1}`}</p>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">{a.tipe}{a.fase ? ` · ${a.fase}` : ''}</p>
            </div>
          </div>
          <div className="pl-7">
            <RenderJawaban a={a} detail={detail} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RenderJawaban({ a, detail }: { a: any; detail: Detail }) {
  const val = (detail.jawaban || {})[a.id]
  const muted = "text-sm text-gray-400 italic"

  switch (a.tipe) {
    case 'esai': {
      return val ? <p className="text-sm text-gray-700 whitespace-pre-wrap">{String(val)}</p>
        : <p className={muted}>Tidak dijawab</p>
    }
    case 'pilihan_ganda': {
      if (val === undefined || val === null) return <p className={muted}>Tidak dijawab</p>
      const pilihan = a.pilihan || []
      const benar = val === a.jawaban_benar
      return (
        <p className={`text-sm font-medium ${benar ? 'text-emerald-700' : 'text-red-600'}`}>
          {benar ? '✓' : '✗'} {pilihan[val] ?? `(opsi ${val})`}
          {!benar && a.jawaban_benar != null && (
            <span className="text-gray-400 font-normal"> — kunci: {pilihan[a.jawaban_benar]}</span>
          )}
        </p>
      )
    }
    case 'tabel': {
      const grid = (detail.tabelData || {})[a.id] || []
      if (grid.length === 0) return <p className={muted}>Tidak dijawab</p>
      return <MiniTable head={a.kolom_tabel} rows={grid} />
    }
    case 'diagram': {
      const grid = (detail.diagramData || {})[a.id] || []
      if (grid.length === 0) return <p className={muted}>Tidak dijawab</p>
      return <MiniTable head={a.kolom_diagram} rows={grid} />
    }
    case 'tts':
    case 'matching':
    case 'kategorisasi': {
      // Auto-nilai — skor sudah tercermin di rekap fase.
      const answered = val && (typeof val === 'object' ? Object.keys(val).length > 0 : true)
      return <p className={answered ? "text-sm text-gray-500" : muted}>
        {answered ? 'Dikerjakan (skor tercatat di ringkasan fase di atas).' : 'Tidak dijawab'}
      </p>
    }
    case 'paint':
    case 'peta':
      return <p className={muted}>Jawaban visual — lihat versi PDF siswa.</p>
    case 'multi':
      return <MultiDump a={a} detail={detail} />
    default:
      return val
        ? <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">{JSON.stringify(val, null, 2)}</pre>
        : <p className={muted}>Tidak dijawab</p>
  }
}

function MiniTable({ head, rows }: { head?: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border border-gray-200 rounded">
        {head && head.length > 0 && (
          <thead><tr className="bg-gray-50">
            {head.map((h, i) => <th key={i} className="border border-gray-200 px-2 py-1 text-left font-semibold text-gray-600">{h}</th>)}
          </tr></thead>
        )}
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-gray-200 px-2 py-1 text-gray-700">{c || '—'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MultiDump({ a, detail }: { a: any; detail: Detail }) {
  const komp: any[] = a.komponen || []
  const j = detail.jawaban || {}
  return (
    <div className="space-y-2">
      {komp.map((k, i) => {
        const base = j[`${a.id}__${k.kid}`]
        const tab = j[`${a.id}__${k.kid}_tabel`]
        const isi = base ?? (Array.isArray(tab) ? tab : undefined)
        return (
          <div key={k.kid ?? i} className="text-sm">
            <p className="text-[11px] text-gray-400">{k.tipe}{k.soal ? ` — ${k.soal}` : ''}</p>
            {isi === undefined || isi === '' || isi === null
              ? <p className="text-gray-400 italic">Tidak dijawab</p>
              : typeof isi === 'string'
                ? <p className="text-gray-700 whitespace-pre-wrap">{isi}</p>
                : <pre className="text-xs text-gray-600 whitespace-pre-wrap break-words">{JSON.stringify(isi, null, 2)}</pre>}
          </div>
        )
      })}
    </div>
  )
}