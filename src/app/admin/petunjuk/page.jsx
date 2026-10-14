'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PETUNJUK_FIELDS, petunjukError, validatePetunjuk } from '@/lib/petunjuk'
import PetunjukContent from '../../petunjuk/PetunjukContent'

const EMPTY = { judul: '', ringkasan: '', html_content: '', video_url: '', published: false }
const EXAMPLE = '<h2>Cara menggunakan peta bencana</h2>\n<ol>\n  <li>Buka menu Peta Bencana.</li>\n  <li>Pilih jenis bencana dan aktifkan layer yang dibutuhkan.</li>\n  <li>Klik lokasi pada peta untuk membaca informasinya.</li>\n</ol>\n<p>Bandingkan informasi pada peta dengan kondisi lingkungan sekitar.</p>'
const INPUT = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:opacity-60'
const BUTTON = 'rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'

export default function AdminPetunjukPage() {
  const [items, setItems] = useState([])
  const [access, setAccess] = useState('loading')
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [editing, setEditing] = useState(null)
  const [baseline, setBaseline] = useState(JSON.stringify(EMPTY))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deleteItem, setDeleteItem] = useState(null)
  const [leaveAction, setLeaveAction] = useState(null)
  const [preview, setPreview] = useState(false)
  const [query, setQuery] = useState('')
  const mutation = useRef(false)
  const dirty = JSON.stringify(form) !== baseline

  const fetchItems = useCallback(async () => {
    const result = await supabase.from('petunjuk_web').select(PETUNJUK_FIELDS)
      .order('sort_order').order('created_at').order('id')
    if (result.error) throw result.error
    setItems(result.data || [])
  }, [])

  const initialize = useCallback(async () => {
    setAccess('loading')
    setAccount(null)
    setError('')
    try {
      const { data, error: authError } = await supabase.auth.getUser()
      if (authError || !data.user) { setAccess('login'); return }
      setAccount({ id: data.user.id, email: data.user.email || '' })
      const result = await supabase.rpc('is_petunjuk_admin')
      if (result.error) throw result.error
      if (!result.data) { setAccess('denied'); return }
      await fetchItems()
      setAccess('allowed')
    } catch (failure) { setError(petunjukError(failure)); setAccess('error') }
  }, [fetchItems])

  useEffect(() => {
    initialize()
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') { setAccount(null); setItems([]); setForm({ ...EMPTY }); setEditing(null); setAccess('login') }
    })
    return () => data.subscription.unsubscribe()
  }, [initialize])

  useEffect(() => {
    if (!dirty) return
    const guard = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])

  function openEditor(item = null) {
    const next = item ? Object.fromEntries(Object.keys(EMPTY).map(key => [key, item[key] ?? EMPTY[key]])) : { ...EMPTY }
    setForm(next)
    setBaseline(JSON.stringify(next))
    setEditing(item)
    setPreview(false)
    setError('')
    setNotice('')
  }
  function requestEditor(item = null) {
    if (dirty) setLeaveAction({ item })
    else openEditor(item)
  }
  async function refresh() {
    setLoading(true); setError('')
    try { await fetchItems() } catch (failure) { setError(petunjukError(failure)) }
    finally { setLoading(false) }
  }
  async function runMutation(action, message) {
    if (mutation.current) return
    mutation.current = true; setBusy(true); setError(''); setNotice('')
    let saved = false
    try {
      await action()
      saved = true
      setNotice(message)
      await fetchItems()
    } catch (failure) {
      setError(saved ? `Perubahan tersimpan, tetapi daftar gagal dimuat ulang. Klik Muat ulang. ${petunjukError(failure)}` : petunjukError(failure))
    } finally { mutation.current = false; setBusy(false) }
  }
  async function save(event) {
    event.preventDefault()
    await runMutation(async () => {
      const payload = validatePetunjuk(form)
      let result
      if (editing) result = await supabase.from('petunjuk_web').update(payload).eq('id', editing.id).eq('updated_at', editing.updated_at).select(PETUNJUK_FIELDS).single()
      else {
        const order = items.length ? Math.max(...items.map(item => item.sort_order)) + 1 : 0
        result = await supabase.from('petunjuk_web').insert({ ...payload, sort_order: order }).select(PETUNJUK_FIELDS).single()
      }
      if (result.error?.code === 'PGRST116') throw new Error('Petunjuk berubah atau sudah dihapus oleh admin lain. Muat ulang daftar lalu buka petunjuk terbaru; salin isi formulir terlebih dahulu jika diperlukan.')
      if (result.error) throw result.error
      openEditor(result.data)
    }, form.published ? 'Petunjuk tersimpan dan dipublikasikan.' : 'Petunjuk tersimpan sebagai draft.')
  }
  async function togglePublish(item) {
    await runMutation(async () => {
      const result = await supabase.from('petunjuk_web').update({ published: !item.published }).eq('id', item.id).eq('updated_at', item.updated_at).select(PETUNJUK_FIELDS).single()
      if (result.error?.code === 'PGRST116') throw new Error('Data sudah berubah. Muat ulang daftar terlebih dahulu.')
      if (result.error) throw result.error
      if (editing?.id === item.id) {
        setEditing(result.data)
        setForm(value => ({ ...value, published: result.data.published }))
        setBaseline(value => JSON.stringify({ ...JSON.parse(value), published: result.data.published }))
      }
    }, item.published ? 'Petunjuk dikembalikan menjadi draft.' : 'Petunjuk dipublikasikan.')
  }
  async function remove() {
    const item = deleteItem
    if (!item) return
    await runMutation(async () => {
      const result = await supabase.from('petunjuk_web').delete().eq('id', item.id).eq('updated_at', item.updated_at).select('id').single()
      if (result.error?.code === 'PGRST116') throw new Error('Data sudah berubah atau dihapus. Muat ulang daftar terlebih dahulu.')
      if (result.error) throw result.error
      setDeleteItem(null)
      if (editing?.id === item.id) openEditor()
    }, 'Petunjuk dihapus.')
  }
  async function reorder(item, direction) {
    await runMutation(async () => {
      const result = await supabase.rpc('move_petunjuk', { item_id: item.id, direction })
      if (result.error) throw result.error
      // Keep the editor's optimistic version current after our own reorder.
      // If another admin changed any saved content, keep the old version guard.
      const current = result.data?.find(row => row.id === editing?.id)
      if (current && Object.keys(EMPTY).every(key => current[key] === editing[key])) setEditing(current)
    }, 'Urutan petunjuk diperbarui.')
  }
  const filtered = items.filter(item => `${item.judul} ${item.ringkasan}`.toLowerCase().includes(query.toLowerCase()))
  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }))

  if (access !== 'allowed') return <main className="mx-auto max-w-3xl px-6 py-12">
    <h1 className="mb-4 text-2xl font-bold text-blue-950">Admin Petunjuk Web</h1>
    <p role="status" className="rounded-xl border bg-white p-5 text-slate-600">{access === 'loading' ? 'Memeriksa akses admin…' : access === 'login' ? 'Silakan masuk dengan akun admin melalui halaman login website, lalu buka kembali halaman ini.' : access === 'denied' ? 'Akun ini belum memiliki akses mengelola petunjuk. Daftarkan User UID akun pada tabel petunjuk_admins melalui Supabase.' : error}</p>
    {access === 'denied' && account && <section className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-slate-700">
      <h2 className="font-semibold text-blue-950">Akun yang sedang login</h2>
      <p>Email: <strong className="break-all">{account.email || 'Email tidak tersedia'}</strong></p>
      <p>User UID: <code className="break-all">{account.id}</code></p>
      <p>Jika ini akun admin yang benar, salin SQL berikut dan jalankan pada SQL Editor proyek Supabase website ini. Setelah berhasil, klik Periksa ulang akses.</p>
      <label htmlFor="sql-akses-petunjuk" className="block font-medium">SQL pendaftaran akun ini sebagai admin petunjuk</label>
      <textarea id="sql-akses-petunjuk" readOnly rows={4} className={`${INPUT} font-mono leading-6`}
        onFocus={event => event.target.select()}
        value={`insert into public.petunjuk_admins (user_id)\nvalues ('${account.id}')\non conflict (user_id) do nothing;`} />
      <p className="text-xs leading-5 text-slate-600">Jika email di atas bukan akun admin yang dimaksud, logout dan masuk dengan akun admin yang benar terlebih dahulu.</p>
    </section>}
    {access !== 'loading' && <button type="button" onClick={initialize} className={`${BUTTON} mt-4`}>Periksa ulang akses</button>}
  </main>

  return <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-1 text-sm font-semibold text-teal-700">Pengelolaan konten</p><h1 className="text-3xl font-bold text-blue-950">Petunjuk Web</h1><p className="mt-2 text-slate-600">Susun panduan penggunaan website dengan HTML dan video.</p></div>
        <a href="/petunjuk" target="_blank" rel="noopener noreferrer" className={BUTTON}>Lihat halaman siswa ↗</a>
      </header>
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <p role="status" className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-800">{notice}</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[350px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-bold text-blue-950">Daftar petunjuk <span className="text-slate-400">({items.length})</span></h2><button type="button" disabled={busy || loading} onClick={refresh} className="text-sm font-medium text-teal-700">{loading ? 'Memuat…' : 'Muat ulang'}</button></div>
          <button type="button" disabled={busy} onClick={() => requestEditor()} className="mb-4 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">+ Tambah petunjuk</button>
          <label htmlFor="cari-petunjuk" className="sr-only">Cari petunjuk</label><input id="cari-petunjuk" className={INPUT} value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari judul petunjuk…" />
          <div className="mt-4 space-y-3">{!filtered.length && <p className="py-5 text-sm text-slate-500">{items.length ? 'Tidak ada petunjuk yang cocok.' : 'Belum ada petunjuk. Tambahkan panduan pertama.'}</p>}
            {filtered.map(item => {
              const index = items.findIndex(row => row.id === item.id)
              return <div key={item.id} className={`rounded-xl border p-3 ${editing?.id === item.id ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200'}`}>
                <div className="mb-2 flex gap-2"><span className="text-sm font-bold text-slate-400">{index + 1}.</span><button type="button" disabled={busy} onClick={() => requestEditor(item)} className="min-w-0 flex-1 break-words text-left text-sm font-semibold text-blue-950">{item.judul}</button></div>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${item.published ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>{item.published ? 'Dipublikasikan' : 'Draft'}</span>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" disabled={busy} onClick={() => requestEditor(item)} className={BUTTON}>Edit</button>
                  <button type="button" disabled={busy} onClick={() => togglePublish(item)} className={BUTTON}>{item.published ? 'Jadikan draft' : 'Publikasi'}</button>
                  <button type="button" title="Naikkan urutan" aria-label={`Naikkan urutan ${item.judul}`} disabled={busy || index === 0} onClick={() => reorder(item, -1)} className={BUTTON}>↑</button>
                  <button type="button" title="Turunkan urutan" aria-label={`Turunkan urutan ${item.judul}`} disabled={busy || index === items.length - 1} onClick={() => reorder(item, 1)} className={BUTTON}>↓</button>
                  <button type="button" disabled={busy} onClick={() => setDeleteItem(item)} className={`${BUTTON} text-red-700`}>Hapus</button>
                </div>
              </div>
            })}
          </div>
        </aside>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-blue-950">{editing ? 'Edit petunjuk' : 'Tambah petunjuk'}</h2><span className="text-xs text-slate-500">{dirty ? 'Perubahan belum disimpan' : editing ? 'Tersimpan' : 'Petunjuk baru'}</span></div>
          <form onSubmit={save} className="space-y-5">
            <fieldset disabled={busy} className="min-w-0 space-y-5">
              <div><label htmlFor="judul" className="mb-2 block text-sm font-semibold text-slate-700">Judul petunjuk <span className="text-red-600">*</span></label><input id="judul" required maxLength={160} className={INPUT} value={form.judul} onChange={event => change('judul', event.target.value)} placeholder="Contoh: Cara menggunakan peta bencana" /></div>
              <div><label htmlFor="ringkasan" className="mb-2 block text-sm font-semibold text-slate-700">Ringkasan (opsional)</label><textarea id="ringkasan" rows={2} maxLength={500} className={INPUT} value={form.ringkasan} onChange={event => change('ringkasan', event.target.value)} placeholder="Penjelasan singkat panduan ini." /></div>
              <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="html" className="text-sm font-semibold text-slate-700">Isi HTML (opsional jika ada video)</label><button type="button" disabled={Boolean(form.html_content.trim())} onClick={() => change('html_content', EXAMPLE)} className="text-xs font-medium text-teal-700 disabled:text-slate-400">Isi contoh HTML</button></div><textarea id="html" rows={12} maxLength={200000} spellCheck={false} className={`${INPUT} font-mono leading-6`} value={form.html_content} onChange={event => change('html_content', event.target.value)} placeholder={'<h2>Langkah penggunaan</h2>\n<p>Tulis petunjuk di sini...</p>'} /><p className="mt-2 text-xs leading-5 text-slate-500">Tempel potongan HTML atau dokumen HTML lengkap. Gambar harus menggunakan URL HTTPS. HTML interaktif ditampilkan dalam frame terpisah; akses ke akun website dan API dinonaktifkan.</p></div>
              <div><label htmlFor="video" className="mb-2 block text-sm font-semibold text-slate-700">URL video / kode embed (opsional jika ada HTML)</label><textarea id="video" rows={3} maxLength={4000} className={INPUT} value={form.video_url} onChange={event => change('video_url', event.target.value)} placeholder="https://www.youtube.com/watch?v=… atau <iframe src=…></iframe>" /><p className="mt-2 text-xs leading-5 text-slate-500">Mendukung YouTube dan Vimeo. HTML dan video boleh digunakan bersama.</p></div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-slate-50 p-4"><input type="checkbox" className="h-4 w-4 accent-teal-700" checked={form.published} onChange={event => change('published', event.target.checked)} /><span><span className="block text-sm font-semibold text-slate-700">Publikasikan petunjuk</span><span className="text-xs text-slate-500">Aktifkan agar petunjuk tampil pada halaman siswa setelah disimpan.</span></span></label>
            </fieldset>
            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5"><button type="submit" disabled={busy} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{busy ? 'Memproses…' : form.published ? 'Simpan & publikasikan' : 'Simpan draft'}</button><button type="button" disabled={busy} onClick={() => setPreview(value => !value)} className={BUTTON}>{preview ? 'Tutup pratinjau' : 'Pratinjau petunjuk'}</button><button type="button" disabled={busy} onClick={() => requestEditor()} className={BUTTON}>Reset / petunjuk baru</button></div>
          </form>
          {preview && <div className="mt-6 border-t border-slate-200 pt-6"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-teal-700">Pratinjau tampilan siswa</p><h3 className="mb-4 text-xl font-bold text-blue-950">{form.judul || 'Judul petunjuk'}</h3><PetunjukContent item={form} />{!form.html_content.trim() && !form.video_url.trim() && <p className="text-sm text-slate-500">Isi HTML atau video untuk melihat pratinjau.</p>}</div>}
        </section>
      </div>
      {(deleteItem || leaveAction) && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 id="dialog-title" className="text-lg font-bold text-blue-950">{deleteItem ? 'Hapus petunjuk?' : 'Tinggalkan perubahan?'}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{deleteItem ? `Petunjuk “${deleteItem.judul}” akan dihapus. Tindakan ini tidak dapat dibatalkan.` : 'Isi formulir belum disimpan. Lanjutkan untuk membuka petunjuk lain atau formulir baru.'}</p>
          {deleteItem && error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex justify-end gap-3"><button type="button" autoFocus disabled={busy} onClick={() => { setDeleteItem(null); setLeaveAction(null) }} className={BUTTON}>Batal</button><button type="button" disabled={busy} onClick={deleteItem ? remove : () => { openEditor(leaveAction.item); setLeaveAction(null) }} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Memproses…' : deleteItem ? 'Hapus' : 'Lanjutkan'}</button></div>
        </section>
      </div>}
    </div>
  </main>
}
