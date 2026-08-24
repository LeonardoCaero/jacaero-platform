import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { changelog } from '../lib/changelog'
import { api } from '../lib/axios'

export function AboutPage() {
  const { t } = useLanguage()
  const [version, setVersion] = useState('…')

  useEffect(() => {
    api
      .get<{ version: string }>('/health')
      .then(({ data }) => setVersion(data.version))
      .catch(() => setVersion('?'))
  }, [])

  return (
    <div>
      <Link
        to="/profile"
        className="inline-flex items-center gap-1 text-sm text-graphite hover:text-ink dark:text-graphite-dark dark:hover:text-cream"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.about.back}
      </Link>

      <h1 className="mt-6 font-display text-2xl font-semibold tracking-wide text-ink dark:text-cream">
        {t.about.title}
      </h1>
      <p className="mt-1 font-mono text-sm text-graphite dark:text-graphite-dark">
        {t.about.version}: {version}
      </p>

      <h2 className="mt-6 text-sm font-medium text-graphite dark:text-graphite-dark">{t.about.changelog}</h2>
      <div className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface dark:divide-line-dark dark:border-line-dark dark:bg-surface-dark">
        {changelog.map((entry) => (
          <div key={entry.date} className="px-5 py-4">
            <p className="font-mono text-xs text-graphite dark:text-graphite-dark">{entry.date}</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-ink dark:text-cream">
              {entry.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
