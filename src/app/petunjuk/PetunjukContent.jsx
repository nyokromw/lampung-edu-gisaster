'use client'

import { useEffect, useRef, useState } from 'react'
import { normalizeVideo } from '@/lib/petunjuk'

function HtmlPetunjuk({ html, title }) {
  const frame = useRef(null)
  const [height, setHeight] = useState(400)
  const [documentHtml, setDocumentHtml] = useState('')
  useEffect(() => {
    setHeight(400)
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    // Prevent content-provided base URLs, refresh redirects and CSP overrides.
    parsed.querySelectorAll('base, meta[http-equiv]').forEach(node => node.remove())
    const csp = "default-src https: data: blob:; script-src https: 'unsafe-inline'; style-src https: 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
    const measure = `<script>(function(){function report(){parent.postMessage({type:'petunjuk-height',height:document.body.scrollHeight},'*')}addEventListener('load',report);if(typeof ResizeObserver!=='undefined')new ResizeObserver(report).observe(document.body);setTimeout(report,100);setTimeout(report,1000)})();<\/script>`
    setDocumentHtml(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;min-height:0}body{box-sizing:border-box;padding:20px;color:#334155;font:16px/1.75 system-ui,sans-serif;overflow-wrap:anywhere}h1,h2,h3{line-height:1.3;color:#172554}img,video,iframe{max-width:100%}table{max-width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #e2e8f0}pre{overflow:auto}a{color:#0369a1}*{box-sizing:border-box}</style>${parsed.head.innerHTML}</head><body>${parsed.body.innerHTML}${measure}</body></html>`)
    const onMessage = event => {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== 'petunjuk-height') return
      const value = event.data.height
      if (typeof value === 'number' && Number.isFinite(value)) setHeight(Math.max(200, Math.min(6000, Math.ceil(value) + 12)))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [html])
  return <iframe ref={frame} title={`Isi HTML: ${title}`} srcDoc={documentHtml}
    sandbox="allow-scripts" referrerPolicy="no-referrer" allowFullScreen
    className="block w-full rounded-xl border border-slate-200 bg-white" style={{ height }} />
}

export default function PetunjukContent({ item }) {
  let video = ''
  let videoError = ''
  try { video = normalizeVideo(item.video_url) } catch (error) { videoError = error.message }
  return <div className="space-y-5">
    {item.ringkasan && <p className="whitespace-pre-wrap leading-7 text-slate-600">{item.ringkasan}</p>}
    {video && <div className="aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
      <iframe src={video} title={`Video: ${item.judul || 'Petunjuk web'}`} loading="lazy"
        className="h-full w-full border-0" referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
    </div>}
    {videoError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{videoError}</p>}
    {item.html_content?.trim() && <HtmlPetunjuk html={item.html_content} title={item.judul || 'Petunjuk web'} />}
  </div>
}