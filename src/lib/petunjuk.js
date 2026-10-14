export const PETUNJUK_FIELDS = 'id,judul,ringkasan,html_content,video_url,published,sort_order,created_at,updated_at'

// Only supported video providers are rendered. Pasted iframe markup is never executed.
export function normalizeVideo(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  let source = raw
  if (raw.startsWith('<')) {
    const match = raw.match(/^\s*<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i)
    if (!match) throw new Error('Kode embed harus berupa iframe dengan atribut src dalam tanda kutip.')
    source = match[2].replace(/&amp;/g, '&')
  }
  if (/^[\w-]{11}$/.test(source)) source = `https://youtu.be/${source}`
  let url
  try { url = new URL(source) } catch { throw new Error('Masukkan URL video HTTPS atau kode iframe YouTube/Vimeo.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('Video harus menggunakan URL HTTPS tanpa kredensial atau port khusus.')
  const host = url.hostname.toLowerCase()
  let id = null
  if (host === 'youtu.be') id = url.pathname.slice(1)
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else id = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/)?.[1]
  }
  if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const vimeoId = url.pathname.match(/^\/(?:video\/)?(\d+)\/?$/)?.[1]
    if (vimeoId) {
      const result = new URL(`https://player.vimeo.com/video/${vimeoId}`)
      const token = url.searchParams.get('h')
      if (token && /^[a-zA-Z0-9]+$/.test(token)) result.searchParams.set('h', token)
      return result.href
    }
  }
  throw new Error('Video belum didukung. Gunakan tautan YouTube, YouTube Shorts, Vimeo, atau kode embed dari kedua layanan tersebut.')
}

export function validatePetunjuk(form) {
  const judul = form.judul.trim()
  const ringkasan = form.ringkasan.trim()
  const html = form.html_content.trim()
  if (!judul) throw new Error('Judul petunjuk wajib diisi.')
  if (judul.length > 160) throw new Error('Judul maksimal 160 karakter.')
  if (ringkasan.length > 500) throw new Error('Ringkasan maksimal 500 karakter.')
  if (html.length > 200000) throw new Error('HTML maksimal 200.000 karakter.')
  const video = normalizeVideo(form.video_url)
  if (!html && !video) throw new Error('Isi minimal HTML atau video. Keduanya juga boleh digabungkan.')
  return { judul, ringkasan, html_content: html, video_url: video, published: Boolean(form.published) }
}

export function petunjukError(error) {
  if (error?.code === '42P01' || error?.code === 'PGRST205') return 'Tabel petunjuk belum tersedia. Jalankan berkas SQL pemasangan terlebih dahulu.'
  if (error?.code === '42501') return 'Akses ditolak. Pastikan akun Anda terdaftar sebagai admin petunjuk.'
  return error?.message || 'Terjadi kesalahan. Silakan coba kembali.'
}
