import { supabase } from '@/lib/supabase'

async function getAbout() {
  const { data } = await supabase.from('about').select('*').limit(1).maybeSingle()
  return data
}

export default async function AboutPage() {
  const about = await getAbout()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-950 to-blue-900 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {about?.foto_url && (
            <img src={about.foto_url} alt="banner" className="w-full max-w-2xl mx-auto rounded-2xl mb-8 object-cover h-48 shadow-lg" />
          )}
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-3">{about?.judul || 'Lampung Edu Gisaster'}</h1>
          <p className="text-teal-300 text-sm font-medium mb-4">{about?.tagline || 'Platform GIS Edukasi Kebencanaan Lampung'}</p>
          <p className="text-blue-200/70 text-sm max-w-2xl mx-auto leading-relaxed">{about?.deskripsi || 'Platform interaktif untuk meningkatkan Spatial Disaster Literacy siswa SMA di Provinsi Lampung.'}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-8">

        {/* Info platform */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 text-lg mb-5">Tentang Platform</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Institusi', value: about?.institusi || 'FKIP Universitas Lampung' },
              { label: 'Program Studi', value: about?.prodi || 'Pendidikan Geografi' },
              { label: 'Tahun', value: about?.tahun || '2025' },
              { label: 'Versi', value: about?.versi || '1.0.0' },
            ].map(item => (
              <div key={item.label} className="bg-gray-50 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-gray-800">{item.value}</p>
              </div>
            ))}
          </div>

          {(about?.email_kontak || about?.website) && (
            <div className="flex gap-4 mt-5 pt-5 border-t border-gray-100">
              {about.email_kontak && (
                <a href={`mailto:${about.email_kontak}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  {about.email_kontak}
                </a>
              )}
              {about.website && (
                <a href={about.website} target="_blank" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253M3 12c0 .778.099 1.533.284 2.253" />
                  </svg>
                  Website
                </a>
              )}
            </div>
          )}
        </div>

        {/* Tim */}
        {about?.tim && Array.isArray(about.tim) && about.tim.filter((t: any) => t.nama).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-5">Tim Pengembang</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {about.tim.filter((t: any) => t.nama).map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                  {t.foto_url ? (
                    <img src={t.foto_url} alt={t.nama} className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-white shadow" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-950 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-lg">{t.nama.charAt(0)}</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{t.nama}</p>
                    <p className="text-xs text-gray-500 truncate">{t.peran}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SDL Framework */}
        <div className="bg-gradient-to-br from-gray-50 to-blue-50/30 rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 text-lg mb-2">Landasan: Spatial Disaster Literacy</h2>
          <p className="text-sm text-gray-500 mb-5">Platform ini dibangun berdasarkan kerangka SDL yang mengintegrasikan kemampuan berpikir spasial dengan literasi kebencanaan.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { code: 'SML', label: 'Mitigasi', color: 'bg-blue-50 border-blue-200 text-blue-800' },
              { code: 'SPL', label: 'Kesiapsiagaan', color: 'bg-green-50 border-green-200 text-green-800' },
              { code: 'SRL', label: 'Respons', color: 'bg-red-50 border-red-200 text-red-800' },
              { code: 'SRcL', label: 'Pemulihan', color: 'bg-amber-50 border-amber-200 text-amber-800' },
            ].map(p => (
              <div key={p.code} className={`${p.color} border rounded-xl p-4 text-center`}>
                <p className="font-bold text-lg">{p.code}</p>
                <p className="text-xs mt-0.5 font-medium">{p.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}