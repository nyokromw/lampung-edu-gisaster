'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Paket = { id: string; nama: string; deskripsi: string | null; published: boolean; durasi_menit: number | null; urutan: number }
type Soal = { id: string; paket_id: string; pertanyaan: string; opsi_a: string; opsi_b: string; opsi_c: string; opsi_d: string; jawaban_benar: 'a' | 'b' | 'c' | 'd'; gambar_url: string | null; gambar_path: string | null; pembahasan: string | null; urutan: number }
type FormSoal = Omit<Soal, 'id' | 'urutan'>
const kosong = (paket_id: string): FormSoal => ({ paket_id, pertanyaan: '', opsi_a: '', opsi_b: '', opsi_c: '', opsi_d: '', jawaban_benar: 'a', gambar_url: null, gambar_path: null, pembahasan: '' })
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'
const tombol = 'rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'

export default function AdminKuisBencanaPage() {
  const [paket, setPaket] = useState<Paket[]>([])
  const [soal, setSoal] = useState<Soal[]>([])
  const [aktif, setAktif] = useState('')
  const [buatPaket, setBuatPaket] = useState(false)
  const [nama, setNama] = useState('')
  const [deskripsi, setDeskripsi] = useState('')
  const [durasi, setDurasi] = useState('30')
  const [editor, setEditor] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormSoal>(kosong(''))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pesan, setPesan] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [infoAkses, setInfoAkses] = useState('Belum diperiksa')

  // Pemeriksaan ini harus dijalankan dari website: SQL Editor tidak memiliki
  // session JWT user browser, sehingga auth.uid() di SQL Editor biasanya NULL.
  async function periksaAksesAdmin(): Promise<boolean> {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    const user = authData.user
    if (authError || !user) {
      setInfoAkses('Tidak ada sesi Supabase Auth (anon).')
      setPesan('Akun admin website belum login melalui Supabase Auth. Login custom/localStorage tidak memberi hak RLS. Integrasikan login admin dengan Supabase Auth atau gunakan API server yang memvalidasi sesi admin.')
      return false
    }
    const { data: isAdmin, error: rpcError } = await supabase.rpc('quiz_is_admin')
    if (rpcError) {
      setInfoAkses(`Pengguna ${user.email || user.id} terautentikasi, tetapi pengecekan RLS gagal: ${rpcError.message}`)
      setPesan(`Tidak bisa mengecek izin admin: ${rpcError.message}`)
      return false
    }
    const granted = isAdmin === true
    setInfoAkses(`Email: ${user.email || 'tanpa email'} | ID Auth: ${user.id} | Izin admin RLS: ${granted ? 'YA' : 'TIDAK'}`)
    if (!granted) setPesan('Akun berhasil dikenali oleh Supabase Auth, tetapi belum mendapat hak admin. Cocokkan ID Auth di atas dengan auth.users.id dan pastikan raw_app_meta_data.role = admin di akun yang sama.')
    return granted
  }

  async function muatPaket() {
    const { data, error } = await supabase.from('quiz_pakets').select('*').order('urutan').order('created_at')
    if (error) setPesan(`Gagal membaca paket: ${error.message}`)
    else setPaket((data || []) as Paket[])
  }
  async function muatSoal(id: string) {
    const { data, error } = await supabase.from('quiz_questions').select('*').eq('paket_id', id).order('urutan').order('created_at')
    if (error) setPesan(`Gagal membaca soal: ${error.message}`)
    else setSoal((data || []) as Soal[])
  }
  useEffect(() => { void muatPaket() }, [])
  useEffect(() => { if (aktif) { void muatSoal(aktif); setForm(kosong(aktif)); setEditId(null); setEditor(false) } else setSoal([]) }, [aktif])

  async function tambahPaket() {
    if (!nama.trim()) return setPesan('Nama paket wajib diisi.')
    if (!await periksaAksesAdmin()) return
    setSaving(true); setPesan('')
    const { data, error } = await supabase.from('quiz_pakets').insert({ nama: nama.trim(), deskripsi: deskripsi.trim() || null, durasi_menit: durasi.trim() ? Number(durasi) : null, urutan: paket.length + 1, published: false }).select('id').single()
    setSaving(false)
    if (error) return setPesan(`Gagal membuat paket: ${error.message}`)
    setNama(''); setDeskripsi(''); setDurasi('30'); setBuatPaket(false)
    await muatPaket(); setAktif(data.id)
    setPesan('Paket baru dibuat sebagai draft.')
  }
  async function togglePublish(p: Paket) {
    setPesan('')
    if (!p.published) {
      const { count, error: e } = await supabase.from('quiz_questions').select('*', { count: 'exact', head: true }).eq('paket_id', p.id)
      if (e) return setPesan(e.message)
      if (!count) return setPesan('Tambahkan soal sebelum menerbitkan paket.')
      if (count !== 20 && !confirm(`Paket ini berisi ${count} soal, bukan 20. Tetap terbitkan?`)) return
    }
    const { error } = await supabase.from('quiz_pakets').update({ published: !p.published }).eq('id', p.id)
    if (error) setPesan(error.message)
    else await muatPaket()
  }
  function editSoal(s: Soal) {
    setEditId(s.id)
    setForm({ paket_id: s.paket_id, pertanyaan: s.pertanyaan, opsi_a: s.opsi_a, opsi_b: s.opsi_b, opsi_c: s.opsi_c, opsi_d: s.opsi_d, jawaban_benar: s.jawaban_benar, gambar_url: s.gambar_url, gambar_path: s.gambar_path, pembahasan: s.pembahasan })
    setEditor(true); setPesan('')
  }
  async function uploadGambar(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) return setPesan('Format gambar harus JPG, PNG, WebP, atau GIF.')
    if (file.size > 10 * 1024 * 1024) return setPesan('Maksimum ukuran gambar 10 MB.')
    setUploading(true); setPesan('')
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `kuis/${aktif}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('pembelajaran-assets').upload(path, file, { upsert: false, contentType: file.type })
    setUploading(false)
    if (error) return setPesan(`Upload gagal: ${error.message}`)
    const { data } = supabase.storage.from('pembelajaran-assets').getPublicUrl(path)
    setForm(f => ({ ...f, gambar_url: data.publicUrl, gambar_path: path }))
  }
  async function simpanSoal() {
    if (!aktif) return
    if (![form.pertanyaan, form.opsi_a, form.opsi_b, form.opsi_c, form.opsi_d].every(x => x.trim())) return setPesan('Pertanyaan dan semua opsi A–D wajib diisi.')
    if (form.gambar_url && !/^https?:\/\//i.test(form.gambar_url)) return setPesan('URL gambar harus dimulai dengan https:// atau http://.')
    setSaving(true); setPesan('')
    const payload = { ...form, paket_id: aktif, pertanyaan: form.pertanyaan.trim(), opsi_a: form.opsi_a.trim(), opsi_b: form.opsi_b.trim(), opsi_c: form.opsi_c.trim(), opsi_d: form.opsi_d.trim(), pembahasan: form.pembahasan?.trim() || null }
    const { error } = editId
      ? await supabase.from('quiz_questions').update(payload).eq('id', editId)
      : await supabase.from('quiz_questions').insert({ ...payload, urutan: soal.length + 1 })
    setSaving(false)
    if (error) return setPesan(`Gagal menyimpan soal: ${error.message}`)
    setEditor(false); setEditId(null); setForm(kosong(aktif)); await muatSoal(aktif)
    setPesan('Soal berhasil disimpan.')
  }
  async function hapusSoal(s: Soal) {
    if (!confirm('Hapus soal ini?')) return
    const { error } = await supabase.from('quiz_questions').delete().eq('id', s.id)
    if (error) setPesan(error.message)
    else { await muatSoal(aktif); setPesan('Soal dihapus.') }
  }
  async function hapusPaket(p: Paket) {
    if (!confirm(`Hapus paket "${p.nama}" beserta semua soal dan riwayat jawabannya? Tindakan tidak dapat dibatalkan.`)) return
    const { error } = await supabase.from('quiz_pakets').delete().eq('id', p.id)
    if (error) return setPesan(error.message)
    if (aktif === p.id) setAktif('')
    await muatPaket()
  }

  const pilihan = paket.find(p => p.id === aktif)
  return <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-extrabold text-slate-900">Kuis Bencana</h1><p className="mt-1 text-sm text-slate-500">Kelola paket ujian komprehensif. Setiap paket dapat berisi 20 soal atau lebih.</p></div><button className={`${tombol} bg-teal-700 text-white hover:bg-teal-800`} onClick={() => setBuatPaket(v => !v)}>+ Buat Paket</button></div>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-slate-700">
      <button type="button" onClick={() => void periksaAksesAdmin()} className="rounded-lg bg-slate-900 px-3 py-2 font-semibold text-white">Periksa Akses Admin</button>
      <span className="break-all">{infoAkses}</span>
    </div>
    {pesan && <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{pesan}</div>}
    {buatPaket && <section className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/40 p-5"><h2 className="font-bold">Paket Baru</h2><input className={input} placeholder="Nama paket (contoh: Paket 1 — Evaluasi Kebencanaan)" value={nama} onChange={e => setNama(e.target.value)} /><textarea className={input} rows={2} placeholder="Deskripsi (opsional)" value={deskripsi} onChange={e => setDeskripsi(e.target.value)} /><label className="block text-xs text-slate-600">Durasi menit (kosong = tanpa batas)</label><input className={input} type="number" min="1" value={durasi} onChange={e => setDurasi(e.target.value)} /><button disabled={saving || (!!durasi && Number(durasi) < 1)} onClick={tambahPaket} className={`${tombol} bg-teal-700 text-white`}>Simpan Paket</button></section>}
    <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]"><aside className="space-y-2"><h2 className="mb-3 font-bold text-slate-800">Daftar Paket ({paket.length})</h2>{paket.map(p => <div key={p.id} className={`rounded-xl border p-3 ${aktif === p.id ? 'border-teal-400 bg-teal-50' : 'border-slate-200 bg-white'}`}><button className="block w-full text-left" onClick={() => setAktif(p.id)}><span className="block text-sm font-bold text-slate-900">{p.nama}</span><span className="text-xs text-slate-500">{p.published ? 'Terbit' : 'Draft'} · {p.durasi_menit ? `${p.durasi_menit} menit` : 'Tanpa timer'}</span></button><div className="mt-3 flex flex-wrap gap-2"><button className="rounded-lg bg-white px-2 py-1 text-xs text-teal-700 ring-1 ring-teal-200" onClick={() => togglePublish(p)}>{p.published ? 'Unpublish' : 'Publish'}</button><button className="rounded-lg px-2 py-1 text-xs text-red-600 ring-1 ring-red-200" onClick={() => hapusPaket(p)}>Hapus</button></div></div>)}{paket.length === 0 && <p className="text-sm text-slate-500">Belum ada paket.</p>}</aside>
    <main className="min-w-0 space-y-4">{pilihan ? <><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5"><div><h2 className="text-lg font-bold">{pilihan.nama}</h2><p className="text-sm text-slate-500">{soal.length} soal terdaftar · Target 20 soal per paket</p></div><button className={`${tombol} bg-slate-900 text-white`} onClick={() => { setEditId(null); setForm(kosong(aktif)); setEditor(true); setPesan('') }}>+ Tambah Soal</button></div>
    {editor && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-bold">{editId ? 'Edit Soal' : `Tambah Soal ke ${pilihan.nama}`}</h3><button onClick={() => setEditor(false)} className="text-sm text-slate-500">Tutup</button></div><label className="block space-y-1 text-sm font-medium">Pertanyaan<textarea className={input} rows={4} value={form.pertanyaan} onChange={e => setForm(f => ({ ...f, pertanyaan: e.target.value }))} /></label>
    <div className="space-y-2 rounded-xl bg-slate-50 p-4"><p className="text-sm font-semibold">Gambar soal (opsional)</p><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void uploadGambar(f); e.currentTarget.value = '' }} /><button disabled={uploading} className={`${tombol} border border-teal-200 bg-white text-teal-700`} onClick={() => fileRef.current?.click()}>{uploading ? 'Mengunggah...' : 'Upload Gambar'}</button><p className="text-xs text-slate-500">Atau tempel URL gambar:</p><input className={input} placeholder="https://contoh.com/peta.jpg" value={form.gambar_url || ''} onChange={e => setForm(f => ({ ...f, gambar_url: e.target.value || null, gambar_path: null }))} />{form.gambar_url && <div className="space-y-2"><img src={form.gambar_url} alt="Pratinjau gambar soal" className="max-h-64 w-auto max-w-full rounded-xl border object-contain" /><button className="text-xs text-red-600" onClick={() => setForm(f => ({ ...f, gambar_url: null, gambar_path: null }))}>Hapus gambar dari soal</button></div>}</div>
    <div className="grid gap-3 sm:grid-cols-2">{(['a','b','c','d'] as const).map(k => <label key={k} className="block space-y-1 text-sm font-medium">Opsi {k.toUpperCase()}<input className={input} value={form[`opsi_${k}`]} onChange={e => setForm(f => ({ ...f, [`opsi_${k}`]: e.target.value }))} /></label>)}</div><label className="block space-y-1 text-sm font-medium">Kunci jawaban<select className={input} value={form.jawaban_benar} onChange={e => setForm(f => ({ ...f, jawaban_benar: e.target.value as Soal['jawaban_benar'] }))}>{(['a','b','c','d'] as const).map(k => <option key={k} value={k}>Opsi {k.toUpperCase()}</option>)}</select></label><label className="block space-y-1 text-sm font-medium">Pembahasan (opsional)<textarea className={input} rows={3} value={form.pembahasan || ''} onChange={e => setForm(f => ({ ...f, pembahasan: e.target.value }))} /></label><button className={`${tombol} bg-teal-700 text-white`} disabled={saving || uploading} onClick={simpanSoal}>{saving ? 'Menyimpan...' : 'Simpan Soal'}</button></section>}
    <div className="space-y-2">{soal.map((s, i) => <article key={s.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><span className="shrink-0 text-xs font-bold text-teal-700">{i + 1}.</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{s.pertanyaan}</p>{s.gambar_url && <img alt="Gambar soal" src={s.gambar_url} className="my-2 max-h-36 rounded-lg object-contain" />}<p className="mt-2 text-xs text-slate-500">Kunci: {s.jawaban_benar.toUpperCase()}</p></div><button className="text-xs font-semibold text-teal-700" onClick={() => editSoal(s)}>Edit</button><button className="text-xs font-semibold text-red-600" onClick={() => hapusSoal(s)}>Hapus</button></div></article>)}{!soal.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Belum ada soal. Tambahkan soal pertama.</div>}</div></> : <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">Pilih paket di sebelah kiri atau buat paket baru.</div>}</main></div>
  </div>
}
