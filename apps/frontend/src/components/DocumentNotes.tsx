import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StickyNote, Trash2 } from 'lucide-react'
import { api } from '../lib/axios'
import { useAuth } from '../contexts/AuthContext'
import { useFeedback } from './feedback'
import { useLanguage } from '../contexts/LanguageContext'

type Note = {
  id: string
  text: string
  createdAt: string
  author: { id: string; fullName: string }
}

export function DocumentNotes({ category, year, name }: { category: string; year: number; name: string }) {
  const { t, language } = useLanguage()
  const { confirm } = useFeedback()
  const { user } = useAuth()
  const locale = language === 'es' ? 'es-ES' : 'en-GB'
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const key = ['notes', category, year, name]

  const { data: notes = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await api.get<Note[]>('/notes', { params: { category, year, name } })).data,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key })
    queryClient.invalidateQueries({ queryKey: ['documents'] })
  }

  const addMutation = useMutation({
    mutationFn: async () => api.post('/notes', { category, year, name, text }),
    onSuccess: () => {
      setText('')
      refresh()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/notes/${id}`),
    onSuccess: refresh,
  })

  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-graphite dark:text-graphite-dark">
        <StickyNote className="h-3.5 w-3.5" />
        {t.docNotes.title}
      </p>
      <div className="mt-2 space-y-2">
        {notes.length === 0 && <p className="text-sm text-graphite dark:text-graphite-dark">{t.docNotes.empty}</p>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-xl border border-line px-3 py-2 text-sm dark:border-line-dark">
            <div className="flex items-start justify-between gap-2">
              <p className="whitespace-pre-line text-ink dark:text-cream">{n.text}</p>
              {n.author.id === user?.id && (
                <button
                  type="button"
                  title={t.docNotes.delete}
                  aria-label={t.docNotes.delete}
                  onClick={async () => (await confirm({ message: t.docNotes.confirmDelete, danger: true, confirmLabel: t.common.delete })) && deleteMutation.mutate(n.id)}
                  className="shrink-0 text-graphite hover:text-rust dark:text-graphite-dark dark:hover:text-rust-dark"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-graphite dark:text-graphite-dark">
              {n.author.fullName} · {new Date(n.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        ))}
      </div>
      <form
        className="mt-2 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) addMutation.mutate()
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={t.docNotes.placeholder}
          className="min-h-11 flex-1 resize-y rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-yellow dark:border-line-dark dark:bg-paper-dark dark:text-cream"
        />
        <button
          type="submit"
          disabled={!text.trim() || addMutation.isPending}
          className="h-11 shrink-0 rounded-xl bg-ink px-3 text-sm font-semibold text-cream disabled:opacity-50 dark:bg-cream dark:text-ink"
        >
          {t.docNotes.add}
        </button>
      </form>
    </div>
  )
}
