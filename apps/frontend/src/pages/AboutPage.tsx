import { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { changelog } from '../lib/changelog'
import { api } from '../lib/axios'
import { PageHeader, secondaryButtonClass, sectionLabelClass } from '../components/ui'
import { useFeedback } from '../components/feedback'

export function AboutPage() {
  const { t } = useLanguage()
  const { toast, confirm } = useFeedback()
  const [version, setVersion] = useState('…')

  useEffect(() => {
    api
      .get<{ version: string }>('/health')
      .then(({ data }) => setVersion(data.version))
      .catch(() => setVersion('?'))
  }, [])

  return (
    <div>
      <PageHeader
        backTo="/profile"
        backLabel={t.about.back}
        title={t.about.title}
        subtitle={<span className="font-mono">{`${t.about.version}: ${version}`}</span>}
      />

      {import.meta.env.DEV && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className={secondaryButtonClass} onClick={() => toast('Cambios guardados')}>
            Toast OK
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => toast('No se ha podido conectar', 'error')}>
            Toast error
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => toast('Enlace copiado', 'info')}>
            Toast info
          </button>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={async () =>
              toast(
                (await confirm({ message: '¿Eliminar esta nota?', danger: true, confirmLabel: t.common.delete }))
                  ? 'Confirmado'
                  : 'Cancelado',
                'info',
              )
            }
          >
            Confirm
          </button>
        </div>
      )}

      <h2 className={`mt-6 ${sectionLabelClass}`}>{t.about.changelog}</h2>
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
