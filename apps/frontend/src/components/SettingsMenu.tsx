import { useEffect, useRef, useState } from 'react'
import { Settings, Check } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'

export function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const themeOptions: { value: typeof theme; label: string }[] = [
    { value: 'light', label: t.settings.light },
    { value: 'dark', label: t.settings.dark },
    { value: 'system', label: t.settings.system },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-testid="settings-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.settings.theme}
        className="flex h-9 w-9 items-center justify-center rounded-full text-graphite hover:bg-ink/5 hover:text-ink dark:text-graphite-dark dark:hover:bg-cream/10 dark:hover:text-cream"
      >
        <Settings className="h-4.5 w-4.5" />
      </button>

      {open && (
        <div className="animate-scale-in absolute right-0 z-10 mt-2 w-52 origin-top-right rounded-xl border border-line bg-surface p-3 shadow-lg dark:border-line-dark dark:bg-surface-dark">
          <p className="px-1 text-xs font-medium text-graphite dark:text-graphite-dark">{t.settings.theme}</p>
          <div className="mt-1.5 flex flex-col">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                data-testid={`theme-${opt.value}`}
                onClick={() => setTheme(opt.value)}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-ink/5 dark:text-cream dark:hover:bg-cream/10"
              >
                {opt.label}
                {theme === opt.value && <Check className="h-4 w-4 text-yellow" />}
              </button>
            ))}
          </div>

          <p className="mt-3 px-1 text-xs font-medium text-graphite dark:text-graphite-dark">
            {t.settings.language}
          </p>
          <div className="mt-1.5 flex flex-col">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-ink/5 dark:text-cream dark:hover:bg-cream/10"
            >
              English
              {language === 'en' && <Check className="h-4 w-4 text-yellow" />}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('es')}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-ink/5 dark:text-cream dark:hover:bg-cream/10"
            >
              Español
              {language === 'es' && <Check className="h-4 w-4 text-yellow" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
