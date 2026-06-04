'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Youtube from '@tiptap/extension-youtube'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { useEffect } from 'react'

interface Props {
  content: string
  onChange: (val: string) => void
}

export default function RichTextEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Youtube.configure({ controls: true }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content])

  if (!editor) return null

  const btn = (label: string, action: () => void, active?: boolean) => (
    <button
      type="button"
      onClick={action}
      className={`px-2 py-1 text-xs rounded border ${active ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'}`}
    >
      {label}
    </button>
  )

  const addImage = () => {
    const url = prompt('URL Gambar:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const addYoutube = () => {
    const url = prompt('URL YouTube:')
    if (url) editor.commands.setYoutubeVideo({ src: url })
  }

  const addLink = () => {
    const url = prompt('URL Link:')
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  const insertHtml = () => {
    const html = prompt('Paste HTML:')
    if (html) editor.chain().focus().insertContent(html).run()
  }

  return (
    <div className="border rounded overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50">
        {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
        {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
        {btn('H1', () => editor.chain().focus().toggleHeading({ level: 1 }).run(), editor.isActive('heading', { level: 1 }))}
        {btn('H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 }))}
        {btn('H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 }))}
        {btn('• List', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('1. List', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
        {btn('Quote', () => editor.chain().focus().toggleBlockquote().run(), editor.isActive('blockquote'))}
        <div className="w-px bg-gray-300 mx-1" />
        {btn('Kiri', () => editor.chain().focus().setTextAlign('left').run())}
        {btn('Tengah', () => editor.chain().focus().setTextAlign('center').run())}
        {btn('Kanan', () => editor.chain().focus().setTextAlign('right').run())}
        <div className="w-px bg-gray-300 mx-1" />
        {btn('🖼 Gambar', addImage)}
        {btn('▶ YouTube', addYoutube)}
        {btn('🔗 Link', addLink)}
        {btn('</> HTML', insertHtml)}
      </div>

      {/* Editor Area */}
      <EditorContent
        editor={editor}
        className="p-3 min-h-[200px] prose prose-sm max-w-none focus:outline-none"
      />
    </div>
  )
}